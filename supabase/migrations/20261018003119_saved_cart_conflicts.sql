begin;
-- Los conflictos de negocio no deben activar reintentos de serialización.
create or replace function public.honey_capture_cart(p_id uuid,p_hash text,p_recovery_hash text,p_email text,p_name text,p_lines jsonb,p_items jsonb,p_subtotal bigint,p_marketing boolean,p_source text)
returns jsonb language plpgsql set search_path='' as $$
declare prior public.honey_saved_carts; person public.honey_marketing_contacts; fresh boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into prior from public.honey_saved_carts where id=p_id for update;
 fresh:=prior.id is null;
 if not fresh then
   if p_hash is null or p_hash not in (prior.owner_hash,prior.recovery_hash) then raise exception 'Unavailable cart' using errcode='P4040'; end if;
   if prior.expires_at<=now() then raise exception 'Expired cart' using errcode='P4100'; end if;
   if prior.order_id is not null then raise exception 'Cart already ordered' using errcode='P4090'; end if;
   if not exists(select 1 from public.honey_marketing_contacts where id=prior.contact_id and email=lower(p_email)) then raise exception 'Use original cart email' using errcode='P4090'; end if;
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

create or replace function public.honey_touch_cart(p_id uuid,p_hash text,p_lines jsonb,p_items jsonb,p_subtotal bigint)
returns jsonb language plpgsql set search_path='' as $$
declare cart public.honey_saved_carts;
begin
 select * into cart from public.honey_saved_carts where id=p_id for update;
 if cart.id is null or p_hash is null or p_hash not in (cart.owner_hash,cart.recovery_hash) then raise exception 'Unavailable cart' using errcode='P4040'; end if;
 if cart.expires_at<=now() then raise exception 'Expired cart' using errcode='P4100'; end if;
 if cart.order_id is not null then raise exception 'Cart already ordered' using errcode='P4090'; end if;
 update public.honey_saved_carts set lines=p_lines,items=p_items,subtotal=p_subtotal,updated_at=now() where id=p_id;
 return jsonb_build_object('saved',true);
end $$;

create or replace function public.honey_recover_cart(p_id uuid,p_hash text) returns jsonb language plpgsql set search_path='' as $$
declare cart public.honey_saved_carts;
begin
 select * into cart from public.honey_saved_carts where id=p_id for update;
 if cart.id is null or p_hash is null or p_hash not in (cart.owner_hash,cart.recovery_hash) then raise exception 'Unavailable cart' using errcode='P4040'; end if;
 if cart.expires_at<=now() then raise exception 'Expired cart' using errcode='P4100'; end if;
 if cart.order_id is not null then raise exception 'Cart already ordered' using errcode='P4090'; end if;
 update public.honey_saved_carts set recovered_at=now(),updated_at=now() where id=p_id;
 return jsonb_build_object('id',cart.id,'lines',cart.lines,'expiresAt',cart.expires_at);
end $$;

create or replace function public.honey_new_order_with_cart(p_request_hash text,p_capability_hash text,p_order jsonb,p_cart_id uuid,p_cart_hash text)
returns jsonb language plpgsql set search_path='' as $$
declare cart public.honey_saved_carts; saved jsonb;
begin
 select * into cart from public.honey_saved_carts where id=p_cart_id for update;
 if cart.id is null or p_cart_hash is null or p_cart_hash not in (cart.owner_hash,cart.recovery_hash) then raise exception 'Unavailable cart' using errcode='P4040'; end if;
 if cart.expires_at<=now() and cart.order_id is null then raise exception 'Expired cart' using errcode='P4100'; end if;
 saved:=public.honey_new_order(p_request_hash,p_capability_hash,p_order);
 if cart.order_id is not null and cart.order_id<>(saved->>'id')::uuid then raise exception 'Cart already ordered' using errcode='P4090'; end if;
 update public.honey_saved_carts set order_id=(saved->>'id')::uuid,updated_at=now() where id=p_cart_id;
 return saved;
end $$;
commit;