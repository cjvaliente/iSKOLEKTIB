-- Shared-database setup for iSKOLEKTIB (used when LOCAL_DEMO_MODE is false in config.js).
-- Run this whole file once in the Supabase SQL Editor, then set the admin code (see section 2 below).
-- Email + password sign-up has no OTP step, so turn OFF "Confirm email" in Supabase
-- (Authentication > Providers > Email). Google sign-in needs no extra SQL.

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
create table if not exists users         (id text   primary key, owner text, data jsonb not null);
create table if not exists scholarships  (id bigint primary key, owner text, data jsonb not null);
create table if not exists applications  (id bigint primary key, owner text, data jsonb not null);

alter table users        enable row level security;
alter table scholarships enable row level security;
alter table applications enable row level security;

-- ---------------------------------------------------------------------
-- 2. Admin tables. RLS is ON with NO policies, so the browser can never read or write them.
--    Only the functions below (security definer) and you in the SQL Editor can.
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

create table if not exists admins         (email text primary key, created_at timestamptz default now());
create table if not exists admin_secret   (id int primary key default 1 check (id = 1), code_hash text not null);
create table if not exists admin_attempts (email text, at timestamptz default now());
alter table admins         enable row level security;
alter table admin_secret   enable row level security;
alter table admin_attempts enable row level security;

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from admins where email = lower(auth.jwt() ->> 'email'));
$$;

-- Called by the app when someone registers as Admin Staff.
-- Returns 'ok', 'bad' or 'locked'. Max 5 wrong tries per email and 30 overall per hour.
create or replace function public.claim_admin(code text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_hash text; v_recent int; v_global int;
begin
  if v_email is null then return 'bad'; end if;
  if exists (select 1 from admins where email = v_email) then return 'ok'; end if;

  select count(*) into v_recent from admin_attempts where email = v_email and at > now() - interval '1 hour';
  select count(*) into v_global from admin_attempts where at > now() - interval '1 hour';
  if v_recent >= 5 or v_global >= 30 then return 'locked'; end if;

  select code_hash into v_hash from admin_secret where id = 1;
  if v_hash is not null and crypt(code, v_hash) = v_hash then
    insert into admins (email) values (v_email) on conflict do nothing;
    return 'ok';
  end if;
  insert into admin_attempts (email) values (v_email);
  return 'bad';
end $$;

revoke all on function public.claim_admin(text) from public, anon;
revoke all on function public.is_admin()        from public, anon;
grant execute on function public.claim_admin(text) to authenticated;
grant execute on function public.is_admin()        to authenticated;

-- SET (or change) THE ADMIN REGISTRATION CODE: run this ONCE in the SQL Editor with your own
-- secret, then delete it from the editor. NEVER commit the real code to GitHub.
--
--   insert into admin_secret (id, code_hash) values (1, extensions.crypt('YOUR-SECRET-CODE', extensions.gen_salt('bf')))
--   on conflict (id) do update set code_hash = excluded.code_hash;
--
-- Remove an admin later:  delete from admins where email = 'someone@up.edu.ph';

-- ---------------------------------------------------------------------
-- 3. Remove the former @up.edu.ph signup restriction, if this setup was run before.
-- ---------------------------------------------------------------------
drop trigger if exists enforce_up_mail on auth.users;
drop function if exists public.enforce_up_mail();

-- ---------------------------------------------------------------------
-- 4. Row-level security (replaces the old open "demo all" policies)
-- ---------------------------------------------------------------------
drop policy if exists "demo all" on users;
drop policy if exists "demo all" on scholarships;
drop policy if exists "demo all" on applications;
drop policy if exists "own row" on users;
drop policy if exists "read" on scholarships;
drop policy if exists "admin write" on scholarships;
drop policy if exists "own or admin" on applications;

-- users: you can only see/edit your own profile; admins can see everyone
create policy "own row" on users for all to authenticated
  using      (id = lower(auth.jwt() ->> 'email') or is_admin())
  with check (id = lower(auth.jwt() ->> 'email') or is_admin());

-- scholarships: any signed-in user can read; only admins can create/edit/delete
create policy "read" on scholarships for select to authenticated using (true);
create policy "admin write" on scholarships for all to authenticated
  using (is_admin()) with check (is_admin());

-- applications: students see/edit only their own; admins see and review all
create policy "own or admin" on applications for all to authenticated
  using      (owner = lower(auth.jwt() ->> 'email') or is_admin())
  with check (owner = lower(auth.jwt() ->> 'email') or is_admin());

-- ---------------------------------------------------------------------
-- 5. Private file bucket for announcement PDFs and student documents
--    Paths used by the app: announcements/<id>-... and applications/<applicationId>/...
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('iskolektib-files', 'iskolektib-files', false)
  on conflict (id) do nothing;

drop policy if exists "demo files" on storage.objects;
drop policy if exists "iskolektib read"   on storage.objects;
drop policy if exists "iskolektib insert" on storage.objects;
drop policy if exists "iskolektib update" on storage.objects;
drop policy if exists "iskolektib delete" on storage.objects;

create policy "iskolektib read" on storage.objects for select to authenticated using (
  bucket_id = 'iskolektib-files' and (
    name like 'announcements/%'
    or is_admin()
    or exists (select 1 from public.applications a
               where a.id::text = (storage.foldername(name))[2]
                 and a.owner = lower(auth.jwt() ->> 'email'))
  ));
create policy "iskolektib insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'iskolektib-files' and (name like 'applications/%' or is_admin()));
create policy "iskolektib update" on storage.objects for update to authenticated
  using      (bucket_id = 'iskolektib-files' and (name like 'applications/%' or is_admin()))
  with check (bucket_id = 'iskolektib-files' and (name like 'applications/%' or is_admin()));
create policy "iskolektib delete" on storage.objects for delete to authenticated using (
  bucket_id = 'iskolektib-files' and (
    is_admin()
    or exists (select 1 from public.applications a
               where a.id::text = (storage.foldername(name))[2]
                 and a.owner = lower(auth.jwt() ->> 'email'))
  ));