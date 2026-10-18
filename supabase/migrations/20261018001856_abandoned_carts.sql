begin;

create table public.honey_marketing_contacts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email=lower(email) and length(email)<=254),
  name text not null default '' check (length(name)<=100),
  marketing_consent_at timestamptz,
  suppressed_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create table public.honey_saved_carts (
  id uuid primary key,
  contact_id uuid not null references public.honey_marketing_contacts(id),
  owner_hash text not null check(length(owner_hash)=64),
  recovery_hash text not null check(length(recovery_hash)=64),
  lines jsonb not null check(jsonb_typeof(lines)='array' and jsonb_array_length(lines)<=30),
  items jsonb not null check(jsonb_typeof(items)='array'),
  subtotal bigint not null check(subtotal>=0),
  recovery_consent_at timestamptz not null default now(),
  marketing_consent boolean not null default false,
  consent_version text not null default 'cart-recovery-v1',
  source text not null check(source in ('cart','checkout')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '30 days',
  recovered_at timestamptz,
  order_id uuid references public.honey_orders(id)
);
create index honey_saved_carts_contact_idx on public.honey_saved_carts(contact_id);
create index honey_saved_carts_order_idx on public.honey_saved_carts(order_id) where order_id is not null;
create index honey_saved_carts_activity_idx on public.honey_saved_carts(updated_at desc,id desc);
create index honey_saved_carts_open_idx on public.honey_saved_carts(updated_at) where order_id is null;
create index honey_marketing_contacts_activity_idx on public.honey_marketing_contacts(last_seen_at desc,id desc);
create index honey_orders_buyer_email_idx on public.honey_orders((lower(data->'buyer'->>'email')));
create table public.honey_consent_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.honey_marketing_contacts(id),
  cart_id uuid references public.honey_saved_carts(id),
  action text not null check(action in ('recovery_opt_in','marketing_opt_in','unsubscribe')),
  source text not null,
  consent_version text not null default 'cart-recovery-v1',
  created_at timestamptz not null default now()
);
create index honey_consent_events_contact_idx on public.honey_consent_events(contact_id,created_at desc);
create index honey_consent_events_cart_idx on public.honey_consent_events(cart_id) where cart_id is not null;

alter table public.honey_marketing_contacts enable row level security;
alter table public.honey_saved_carts enable row level security;
alter table public.honey_consent_events enable row level security;
revoke all on public.honey_marketing_contacts,public.honey_saved_carts,public.honey_consent_events from public,anon,authenticated;
grant all on public.honey_marketing_contacts,public.honey_saved_carts,public.honey_consent_events to service_role;

create view public.honey_marketing_carts with(security_invoker=true) as
select c.id,p.id as "contactId",p.email,p.name,c.lines,c.items,c.subtotal,
  c.created_at as "createdAt",c.updated_at as "updatedAt",c.expires_at as "expiresAt",
  c.recovered_at as "recoveredAt",c.order_id as "orderId",c.source,
  c.recovery_consent_at as "recoveryConsentAt",c.marketing_consent as "marketingConsent",
  c.consent_version as "consentVersion",p.suppressed_at as "suppressedAt",
  case
    when c.order_id is not null and exists(select 1 from jsonb_array_elements(o.data->'payments') payment where payment->>'status'='approved') then 'converted'
    when c.order_id is not null then 'ordered'
    when p.suppressed_at is not null then 'unsubscribed'
    when c.expires_at<=now() then 'expired'
    when jsonb_array_length(c.lines)=0 then 'cleared'
    when c.updated_at<=now()-interval '1 hour' then 'abandoned'
    else 'active'
  end as status
from public.honey_saved_carts c join public.honey_marketing_contacts p on p.id=c.contact_id
left join public.honey_orders o on o.id=c.order_id;

create view public.honey_marketing_audience with(security_invoker=true) as
select c.id,c.email,c.name,c.created_at as "createdAt",c.last_seen_at as "lastSeenAt",
 c.marketing_consent_at as "marketingConsentAt",c.suppressed_at as "suppressedAt",
 (select sc.id from public.honey_saved_carts sc where sc.contact_id=c.id order by sc.created_at desc limit 1) as "unsubscribeCartId",
 coalesce(s.paid_orders,0) as "paidOrders",coalesce(s.lifetime_total,0) as "lifetimeTotal",s.last_purchase_at as "lastPurchaseAt"
from public.honey_marketing_contacts c
left join lateral (
 select count(*) as paid_orders,sum((o.data->>'total')::bigint) as lifetime_total,max(o.created_at) as last_purchase_at
 from public.honey_orders o where lower(o.data->'buyer'->>'email')=c.email
 and not coalesce((o.data->>'isTest')::boolean,false)
 and exists(select 1 from jsonb_array_elements(o.data->'payments') payment where payment->>'status'='approved')
) s on true;
revoke all on public.honey_marketing_carts,public.honey_marketing_audience from public,anon,authenticated;
grant select on public.honey_marketing_carts,public.honey_marketing_audience to service_role;

create function public.honey_capture_cart(p_id uuid,p_hash text,p_recovery_hash text,p_email text,p_name text,p_lines jsonb,p_items jsonb,p_subtotal bigint,p_marketing boolean,p_source text)
returns jsonb language plpgsql set search_path='' as $$
declare prior public.honey_saved_carts; person public.honey_marketing_contacts; fresh boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into prior from public.honey_saved_carts where id=p_id for update;
 fresh:=prior.id is null;
 if not fresh then
   if p_hash is null or p_hash not in (prior.owner_hash,prior.recovery_hash) then raise exception 'Unavailable cart' using errcode='P4040'; end if;
   if prior.expires_at<=now() then raise exception 'Expired cart' using errcode='P4100'; end if;
   if prior.order_id is not null then raise exception 'Cart already ordered' using errcode='40001'; end if;
   if not exists(select 1 from public.honey_marketing_contacts where id=prior.contact_id and email=lower(p_email)) then raise exception 'Use original cart email' using errcode='40001'; end if;
 end if;
 insert into public.honey_marketing_contacts(email,name,marketing_consent_at)
 values(lower(p_email),p_name,case when p_marketing then now() end)
 on conflict(email) do update set last_seen_at=now(),
  name=case when excluded.name<>'' then excluded.name else honey_marketing_contacts.name end,
  marketing_consent_at=coalesce(honey_marketing_contacts.marketing_consent_at,excluded.marketing_consent_at)
 returning * into person;
 insert into public.honey_saved_carts(id,contact_id,owner_hash,recovery_hash,lines,items,subtotal,marketing_consent,source)
 values(p_id,person.id,p_hash,p_recovery_hash,p_lines,p_items,p_subtotal,p_marketing,p_source)
 on conflict(id) do update set lines=excluded.lines,items=excluded.items,subtotal=excluded.subtotal,updated_at=now(),
  marketing_consent=honey_saved_carts.marketing_consent or excluded.marketing_consent;
 if fresh then
   insert into public.honey_consent_events(contact_id,cart_id,action,source) values(person.id,p_id,'recovery_opt_in',p_source);
 end if;
 if p_marketing and (fresh or not prior.marketing_consent) then
   insert into public.honey_consent_events(contact_id,cart_id,action,source) values(person.id,p_id,'marketing_opt_in',p_source);
 end if;
 return jsonb_build_object('id',p_id,'expiresAt',coalesce(prior.expires_at,now()+interval '30 days'),'suppressed',person.suppressed_at is not null);
end $$;

create function public.honey_touch_cart(p_id uuid,p_hash text,p_lines jsonb,p_items jsonb,p_subtotal bigint)
returns jsonb language plpgsql set search_path='' as $$
declare cart public.honey_saved_carts;
begin
 select * into cart from public.honey_saved_carts where id=p_id for update;
 if cart.id is null or p_hash is null or p_hash not in (cart.owner_hash,cart.recovery_hash) then raise exception 'Unavailable cart' using errcode='P4040'; end if;
 if cart.expires_at<=now() then raise exception 'Expired cart' using errcode='P4100'; end if;
 if cart.order_id is not null then raise exception 'Cart already ordered' using errcode='40001'; end if;
 update public.honey_saved_carts set lines=p_lines,items=p_items,subtotal=p_subtotal,updated_at=now() where id=p_id;
 return jsonb_build_object('saved',true);
end $$;

create function public.honey_recover_cart(p_id uuid,p_hash text) returns jsonb language plpgsql set search_path='' as $$
declare cart public.honey_saved_carts;
begin
 select * into cart from public.honey_saved_carts where id=p_id for update;
 if cart.id is null or p_hash is null or p_hash not in (cart.owner_hash,cart.recovery_hash) then raise exception 'Unavailable cart' using errcode='P4040'; end if;
 if cart.expires_at<=now() then raise exception 'Expired cart' using errcode='P4100'; end if;
 if cart.order_id is not null then raise exception 'Cart already ordered' using errcode='40001'; end if;
 update public.honey_saved_carts set recovered_at=now(),updated_at=now() where id=p_id;
 return jsonb_build_object('id',cart.id,'lines',cart.lines,'expiresAt',cart.expires_at);
end $$;

create function public.honey_unsubscribe_cart(p_id uuid,p_hash text) returns jsonb language plpgsql set search_path='' as $$
declare cart public.honey_saved_carts;
begin
 select * into cart from public.honey_saved_carts where id=p_id;
 if cart.id is null or p_hash is null or p_hash not in (cart.owner_hash,cart.recovery_hash) then raise exception 'Unavailable cart' using errcode='P4040'; end if;
 update public.honey_marketing_contacts set suppressed_at=now() where id=cart.contact_id and suppressed_at is null;
 if found then insert into public.honey_consent_events(contact_id,cart_id,action,source) values(cart.contact_id,p_id,'unsubscribe','private_link'); end if;
 return jsonb_build_object('unsubscribed',true);
end $$;

create function public.honey_new_order_with_cart(p_request_hash text,p_capability_hash text,p_order jsonb,p_cart_id uuid,p_cart_hash text)
returns jsonb language plpgsql set search_path='' as $$
declare cart public.honey_saved_carts; saved jsonb;
begin
 select * into cart from public.honey_saved_carts where id=p_cart_id for update;
 if cart.id is null or p_cart_hash is null or p_cart_hash not in (cart.owner_hash,cart.recovery_hash) then raise exception 'Unavailable cart' using errcode='P4040'; end if;
 if cart.expires_at<=now() and cart.order_id is null then raise exception 'Expired cart' using errcode='P4100'; end if;
 saved:=public.honey_new_order(p_request_hash,p_capability_hash,p_order);
 if cart.order_id is not null and cart.order_id<>(saved->>'id')::uuid then raise exception 'Cart already ordered' using errcode='40001'; end if;
 update public.honey_saved_carts set order_id=(saved->>'id')::uuid,updated_at=now() where id=p_cart_id;
 return saved;
end $$;

create function public.honey_marketing_list(p_hash text,p_kind text,p_segment text,p_query text,p_offset integer,p_limit integer)
returns jsonb language plpgsql stable set search_path='' as $$
declare actor jsonb; result jsonb; amount bigint;
begin
 actor:=public.honey_session(p_hash)->'member';
 if actor is null or actor->>'role'<>'admin' then raise exception 'Admin required' using errcode='42501'; end if;
 if p_offset<0 or p_offset>100000 or p_limit<1 or p_limit>5001 or length(p_query)>100 then raise exception 'Invalid pagination'; end if;
 if p_kind='carts' then
   select count(*) into amount from public.honey_marketing_carts c where
    (p_segment='all' or c.status=p_segment or (p_segment='recovery' and c.status='abandoned'))
    and (p_query='' or c.email ilike '%'||p_query||'%' or c.name ilike '%'||p_query||'%');
   select coalesce(jsonb_agg(to_jsonb(page)),'[]'::jsonb) into result from (
    select * from public.honey_marketing_carts c where
     (p_segment='all' or c.status=p_segment or (p_segment='recovery' and c.status='abandoned'))
     and (p_query='' or c.email ilike '%'||p_query||'%' or c.name ilike '%'||p_query||'%')
    order by c."updatedAt" desc,c.id desc limit p_limit offset p_offset
   ) page;
 elsif p_kind='contacts' then
   select count(*) into amount from public.honey_marketing_audience c where
    (p_segment='all' or (p_segment='campaigns' and c."marketingConsentAt" is not null and c."suppressedAt" is null)
     or (p_segment='repeat' and c."marketingConsentAt" is not null and c."suppressedAt" is null and c."paidOrders">0)
     or (p_segment='unsubscribed' and c."suppressedAt" is not null))
    and (p_query='' or c.email ilike '%'||p_query||'%' or c.name ilike '%'||p_query||'%');
   select coalesce(jsonb_agg(to_jsonb(page)),'[]'::jsonb) into result from (
    select * from public.honey_marketing_audience c where
     (p_segment='all' or (p_segment='campaigns' and c."marketingConsentAt" is not null and c."suppressedAt" is null)
      or (p_segment='repeat' and c."marketingConsentAt" is not null and c."suppressedAt" is null and c."paidOrders">0)
      or (p_segment='unsubscribed' and c."suppressedAt" is not null))
     and (p_query='' or c.email ilike '%'||p_query||'%' or c.name ilike '%'||p_query||'%')
    order by c."lastSeenAt" desc,c.id desc limit p_limit offset p_offset
   ) page;
 else raise exception 'Invalid collection'; end if;
 return jsonb_build_object('rows',result,'total',amount,'offset',p_offset);
end $$;

create function public.honey_marketing_unsubscribe(p_hash text,p_contact_id uuid) returns jsonb language plpgsql set search_path='' as $$
declare actor jsonb;
begin
 perform pg_advisory_xact_lock(617110);
 actor:=public.honey_session(p_hash)->'member';
 if actor is null or actor->>'role'<>'admin' then raise exception 'Admin required' using errcode='42501'; end if;
 update public.honey_marketing_contacts set suppressed_at=now() where id=p_contact_id and suppressed_at is null;
 if found then insert into public.honey_consent_events(contact_id,action,source) values(p_contact_id,'unsubscribe','admin'); end if;
 return jsonb_build_object('unsubscribed',true);
end $$;

do $$ declare signature regprocedure; begin
 for signature in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace
  and proname in ('honey_capture_cart','honey_touch_cart','honey_recover_cart','honey_unsubscribe_cart','honey_new_order_with_cart','honey_marketing_list','honey_marketing_unsubscribe') loop
  execute format('revoke all on function %s from public,anon,authenticated',signature);
  execute format('grant execute on function %s to service_role',signature);
 end loop;
end $$;
commit;
