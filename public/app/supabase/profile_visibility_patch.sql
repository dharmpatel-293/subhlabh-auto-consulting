-- Apply once to the existing AutoLedger database.
-- Do NOT rerun schema.sql; this patch only adds a narrowly scoped SELECT policy.
create policy "Workspace members view partner profiles"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.business_members bm
    where bm.user_id = profiles.id
      and public.is_business_member(bm.business_id)
  )
);
