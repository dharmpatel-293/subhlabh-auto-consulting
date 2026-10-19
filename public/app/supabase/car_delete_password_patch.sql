-- AutoLedger: secure, transactional deletion of a car and its related records.
-- Run once in Supabase SQL Editor. The frontend re-verifies the signed-in
-- user's password before calling this function. This function checks workspace
-- membership and removes dependent records in one database transaction.

create or replace function public.delete_car_with_records(p_car_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_business_id uuid;
begin
  select c.business_id
    into target_business_id
    from public.cars c
   where c.id = p_car_id;

  if target_business_id is null then
    raise exception 'Car not found';
  end if;

  if not public.is_business_member(target_business_id) then
    raise exception 'You are not authorized to delete this car';
  end if;

  delete from public.settlements
   where business_id = target_business_id and car_id = p_car_id;
  delete from public.profit_allocations
   where business_id = target_business_id and car_id = p_car_id;
  delete from public.car_sales
   where business_id = target_business_id and car_id = p_car_id;
  delete from public.car_costs
   where business_id = target_business_id and car_id = p_car_id;
  delete from public.cars
   where business_id = target_business_id and id = p_car_id;
end;
$$;

revoke all on function public.delete_car_with_records(uuid) from public, anon;
grant execute on function public.delete_car_with_records(uuid) to authenticated;
