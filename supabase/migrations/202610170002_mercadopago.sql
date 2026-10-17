begin;
create table public.honey_checkout_sessions (
  order_id uuid primary key references public.honey_orders(id),
  attempt_id uuid not null unique default gen_random_uuid(),
  owner uuid not null,
  state text not null check(state in ('creating','ready','uncertain')),
  preference_id text unique,
  checkout_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '24 hours'
);
create table public.honey_payment_events (
  id text primary key,
  order_id uuid not null references public.honey_orders(id),
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.honey_checkout_sessions enable row level security;
alter table public.honey_payment_events enable row level security;
revoke all on public.honey_checkout_sessions,public.honey_payment_events from public,anon,authenticated;
grant all on public.honey_checkout_sessions,public.honey_payment_events to service_role;

create function public.honey_reserve_checkout(p_order_id uuid,p_owner uuid) returns jsonb language plpgsql set search_path='' as $$
declare saved public.honey_checkout_sessions; item jsonb;
begin
  select data into item from public.honey_orders where id=p_order_id for update;
  if item is null or item->>'cancelledAt' is not null or item->>'archivedAt' is not null
     or coalesce((item->>'paymentReviewRequired')::boolean,false)
     or exists(select 1 from jsonb_array_elements(item->'payments') p where p->>'approvedAt' is not null) then raise exception 'Order cannot be paid'; end if;
  select * into saved from public.honey_checkout_sessions where order_id=p_order_id;
  if saved.order_id is not null then
    if saved.state='ready' and saved.expires_at>now() then return to_jsonb(saved); end if;
    raise exception 'Checkout requires reconciliation' using errcode='PMP01';
  end if;
  insert into public.honey_checkout_sessions(order_id,owner,state) values(p_order_id,p_owner,'creating') returning * into saved;
  return to_jsonb(saved);
end $$;

create function public.honey_finish_checkout(p_order_id uuid,p_owner uuid,p_preference_id text,p_url text) returns void language plpgsql set search_path='' as $$
begin
  update public.honey_checkout_sessions set state='ready',preference_id=p_preference_id,checkout_url=p_url
    where order_id=p_order_id and owner=p_owner and state='creating';
  if not found then raise exception 'Checkout changed' using errcode='40001'; end if;
end $$;
create function public.honey_uncertain_checkout(p_order_id uuid,p_owner uuid) returns void language sql set search_path='' as $$
  update public.honey_checkout_sessions set state='uncertain' where order_id=p_order_id and owner=p_owner and state='creating';
$$;

create function public.honey_commit_payment(p_order_id uuid,p_revision integer,p_order jsonb,p_event jsonb) returns jsonb language plpgsql set search_path='' as $$
declare saved public.honey_orders;
begin
  select * into saved from public.honey_orders where id=p_order_id for update;
  if saved.id is null then raise exception 'Order missing'; end if;
  if exists(select 1 from public.honey_payment_events where id=p_event->>'id') then return saved.data; end if;
  if saved.revision<>p_revision then raise exception 'Concurrent update' using errcode='40001'; end if;
  if not exists(select 1 from public.honey_checkout_sessions where order_id=p_order_id and attempt_id=(p_event->>'checkoutAttemptId')::uuid) then raise exception 'Unknown checkout'; end if;
  if (p_order - array['payments','history','updatedAt','paymentReviewRequired','paymentReviewReason']) is distinct from
     (saved.data - array['payments','history','updatedAt','paymentReviewRequired','paymentReviewReason']) then raise exception 'Immutable order data'; end if;
  insert into public.honey_payment_events(id,order_id,data) values(p_event->>'id',p_order_id,p_event);
  update public.honey_orders set data=p_order,revision=revision+1 where id=p_order_id;
  return p_order;
end $$;

revoke all on function public.honey_reserve_checkout(uuid,uuid),public.honey_finish_checkout(uuid,uuid,text,text),public.honey_uncertain_checkout(uuid,uuid),public.honey_commit_payment(uuid,integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.honey_reserve_checkout(uuid,uuid),public.honey_finish_checkout(uuid,uuid,text,text),public.honey_uncertain_checkout(uuid,uuid),public.honey_commit_payment(uuid,integer,jsonb,jsonb) to service_role;
commit;
