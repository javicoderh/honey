begin;

create table public.honey_staff (
  id uuid primary key references auth.users(id),
  data jsonb not null,
  email text generated always as (lower(data->>'email')) stored unique,
  check (data->>'role' in ('admin','delivery')),
  check (jsonb_typeof(data->'active') = 'boolean'),
  check (data->>'id' = id::text)
);
create table public.honey_sessions (
  token_hash text primary key check (length(token_hash) = 64),
  staff_id uuid not null references public.honey_staff(id),
  access_version integer not null,
  expires_at timestamptz not null
);
create index on public.honey_sessions(expires_at);
create sequence public.honey_order_numbers;
create table public.honey_orders (
  id uuid primary key,
  number text not null unique,
  request_hash text not null unique,
  capability_hash text not null,
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  data jsonb not null,
  check (data->>'id' = id::text),
  check ((data->>'total')::bigint >= 0)
);
create index on public.honey_orders ((data->'delivery'->>'assignedTo'));
create table public.honey_order_items (order_id uuid references public.honey_orders(id), position integer, data jsonb not null, primary key(order_id,position));
create table public.honey_payments (id text primary key, order_id uuid not null references public.honey_orders(id), data jsonb not null);
create unique index honey_one_approved_payment on public.honey_payments(order_id) where data->>'approvedAt' is not null;
create unique index honey_payment_transaction on public.honey_payments((data->>'providerTransactionId')) where data->>'providerTransactionId' is not null;
create table public.honey_assignments (order_id uuid primary key references public.honey_orders(id), staff_id uuid references public.honey_staff(id), data jsonb not null);
create table public.honey_comments (id text primary key, order_id uuid not null references public.honey_orders(id), data jsonb not null);
create table public.honey_history (id text primary key, order_id uuid not null references public.honey_orders(id), data jsonb not null);
create table public.honey_catalog (slug text primary key, active boolean not null default true, data jsonb not null);
create table public.honey_rate_limits (key text primary key, started_at timestamptz not null, attempts integer not null);

-- Solo la API privada puede acceder. No hay políticas para anon/authenticated.
do $$ declare t text; begin
  foreach t in array array['staff','sessions','orders','order_items','payments','assignments','comments','history','catalog','rate_limits'] loop
    execute format('alter table public.honey_%I enable row level security', t);
    execute format('revoke all on public.honey_%I from public, anon, authenticated', t);
    execute format('grant all on public.honey_%I to service_role', t);
  end loop;
end $$;
revoke all on sequence public.honey_order_numbers from public, anon, authenticated;
grant usage, select on sequence public.honey_order_numbers to service_role;

create function public.honey_session(p_hash text) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('member', u.data, 'expiresAt', s.expires_at)
  from public.honey_sessions s join public.honey_staff u on u.id=s.staff_id
  where s.token_hash=p_hash and s.expires_at>now() and (u.data->>'active')::boolean
    and (u.data->>'accessVersion')::integer=s.access_version;
$$;

create function public.honey_rate_limit(p_key text, p_limit integer) returns void language plpgsql set search_path = '' as $$
declare attempts integer;
begin
  delete from public.honey_rate_limits where started_at < now()-interval '2 hours';
  delete from public.honey_sessions where expires_at < now();
  insert into public.honey_rate_limits values(p_key,now(),1)
  on conflict(key) do update set
    attempts=case when honey_rate_limits.started_at < now()-interval '1 hour' then 1 else honey_rate_limits.attempts+1 end,
    started_at=case when honey_rate_limits.started_at < now()-interval '1 hour' then now() else honey_rate_limits.started_at end
  returning honey_rate_limits.attempts into attempts;
  if attempts>p_limit then raise exception 'Rate limit' using errcode='P4290'; end if;
end $$;

-- Proyecciones relacionales actualizadas en la misma transacción que el pedido.
create function public.honey_project_order() returns trigger language plpgsql set search_path = '' as $$
declare entry jsonb; n integer := 0;
begin
  for entry in select value from jsonb_array_elements(new.data->'items') loop
    insert into public.honey_order_items values(new.id,n,entry) on conflict(order_id,position) do update set data=excluded.data; n:=n+1;
  end loop;
  for entry in select value from jsonb_array_elements(new.data->'payments') loop
    insert into public.honey_payments values(entry->>'id',new.id,entry) on conflict(id) do update set data=excluded.data;
  end loop;
  insert into public.honey_assignments values(new.id,(new.data->'delivery'->>'assignedTo')::uuid,new.data->'delivery')
    on conflict(order_id) do update set staff_id=excluded.staff_id,data=excluded.data;
  for entry in select value from jsonb_array_elements(new.data->'comments') loop
    insert into public.honey_comments values(entry->>'id',new.id,entry) on conflict(id) do nothing;
  end loop;
  for entry in select value from jsonb_array_elements(new.data->'history') loop
    insert into public.honey_history values(entry->>'id',new.id,entry) on conflict(id) do nothing;
  end loop;
  return new;
end $$;
create trigger honey_project after insert or update on public.honey_orders for each row execute function public.honey_project_order();

create function public.honey_new_order(p_request_hash text,p_capability_hash text,p_order jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare saved jsonb; number text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_request_hash,0));
  select data into saved from public.honey_orders where request_hash=p_request_hash;
  if saved is not null then
    if exists(select 1 from public.honey_orders where request_hash=p_request_hash and capability_hash<>p_capability_hash) then raise exception 'Private reference configuration changed'; end if;
    return saved;
  end if;
  number:='CM-'||lpad(nextval('public.honey_order_numbers')::text,8,'0');
  saved:=jsonb_set(p_order,'{number}',to_jsonb(number));
  insert into public.honey_orders(id,number,request_hash,capability_hash,data) values((saved->>'id')::uuid,number,p_request_hash,p_capability_hash,saved);
  return saved;
end $$;

create function public.honey_commit_order(p_hash text,p_id uuid,p_revision integer,p_order jsonb,p_type text) returns jsonb language plpgsql set search_path = '' as $$
declare actor jsonb; prior jsonb; assigned jsonb;
begin
  -- Mismo bloqueo que los cambios de staff: no se confirma una escritura con acceso revocado.
  perform pg_advisory_xact_lock(617110);
  actor:=public.honey_session(p_hash)->'member';
  if actor is null then raise exception 'Session required' using errcode='42501'; end if;
  select data into prior from public.honey_orders where id=p_id and revision=p_revision for update;
  if prior is null then raise exception 'Concurrent update' using errcode='40001'; end if;
  if actor->>'role'='delivery' then
    if p_type not in ('delivery','comment') or (prior->'delivery'->>'assignedTo') is distinct from (actor->>'id')
       or not exists(select 1 from jsonb_array_elements(prior->'payments') p where p->>'status'='approved' and p->>'approvedAt' is not null)
       or prior->>'cancelledAt' is not null or prior->>'archivedAt' is not null or coalesce((prior->>'paymentReviewRequired')::boolean,false) then
      raise exception 'Forbidden' using errcode='42501';
    end if;
  elsif actor->>'role'<>'admin' then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_type='assign' then
    select data into assigned from public.honey_staff where id=(p_order->'delivery'->>'assignedTo')::uuid;
    if assigned is null or assigned->>'role'<>'delivery' or not (assigned->>'active')::boolean then raise exception 'Inactive delivery'; end if;
  end if;
  update public.honey_orders set data=p_order,revision=revision+1 where id=p_id;
  return p_order;
end $$;

create function public.honey_commit_staff(p_hash text,p_member jsonb,p_expected_version integer) returns jsonb language plpgsql set search_path = '' as $$
declare actor jsonb; prior jsonb;
begin
  perform pg_advisory_xact_lock(617110);
  actor:=public.honey_session(p_hash)->'member';
  if actor is null or actor->>'role'<>'admin' then raise exception 'Admin required' using errcode='42501'; end if;
  select data into prior from public.honey_staff where id=(p_member->>'id')::uuid;
  if p_expected_version is null then
    if prior is not null then raise exception 'Already exists' using errcode='23505'; end if;
    insert into public.honey_staff(id,data) values((p_member->>'id')::uuid,p_member);
  else
    if prior is null or (prior->>'accessVersion')::integer<>p_expected_version then raise exception 'Concurrent update' using errcode='40001'; end if;
    if prior->>'role'='admin' and (prior->>'active')::boolean and
      (p_member->>'role'<>'admin' or not (p_member->>'active')::boolean) and
      not exists(select 1 from public.honey_staff where id<>(p_member->>'id')::uuid and data->>'role'='admin' and (data->>'active')::boolean) then
      raise exception 'Last active admin';
    end if;
    update public.honey_staff set data=p_member where id=(p_member->>'id')::uuid;
    delete from public.honey_sessions where staff_id=(p_member->>'id')::uuid and access_version<>(p_member->>'accessVersion')::integer;
  end if;
  return p_member;
end $$;

-- Las funciones también quedan fuera del alcance público y de tokens de usuario.
do $$ declare signature regprocedure; begin
  for signature in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname like 'honey_%' loop
    execute format('revoke all on function %s from public, anon, authenticated',signature);
    execute format('grant execute on function %s to service_role',signature);
  end loop;
end $$;
commit;
