-- Bluerig schema. One row per business holds the draft and published profile (JSON),
-- so the site, Google data and promos all come from one record.

create extension if not exists pgcrypto;

-- Agencies are backlogged; org_id stays nullable so we can add them without a rewrite.
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,47}$'),
  status text not null default 'preview' check (status in ('preview', 'live', 'archived')),
  draft jsonb not null,
  published jsonb,
  published_at timestamptz,
  preview_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  custom_domain text unique,
  source_url text,
  import_sources jsonb,
  org_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Claim codes live in their own table with no policies, so only the server sees them.
create table public.claims (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sent_to text not null,
  created_at timestamptz not null default now()
);

create table public.members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index members_user_idx on public.members (user_id);

-- Every publish is a version: that's undo and history.
create table public.site_versions (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  profile jsonb not null,
  label text not null default 'Published',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index site_versions_business_idx on public.site_versions (business_id, created_at desc);

create table public.leads (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  town text,
  message text not null,
  urgency text not null default 'soon' check (urgency in ('now', 'soon', 'quote')),
  handled boolean not null default false,
  created_at timestamptz not null default now()
);
create index leads_business_idx on public.leads (business_id, created_at desc);

-- Review requests sent by text after a job. Phone kept so we can honour opt-outs.
create table public.review_requests (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  phone_e164 text not null,
  first_name text,
  sent_by uuid references auth.users (id) on delete set null,
  status text not null default 'sent' check (status in ('sent', 'failed', 'blocked')),
  created_at timestamptz not null default now()
);
create index review_requests_business_idx on public.review_requests (business_id, created_at desc);

-- CASL: anyone who replies STOP is never texted again, by any shop.
create table public.sms_opt_outs (
  phone_e164 text primary key,
  created_at timestamptz not null default now()
);

-- ---------- helpers ----------

create or replace function public.is_member(b uuid, need_owner boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members m
    where m.business_id = b and m.user_id = auth.uid() and (not need_owner or m.role = 'owner')
  );
$$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger businesses_touch before update on public.businesses
  for each row execute function public.touch_updated_at();

-- Field-level edits: two people editing different fields never overwrite each other.
-- Same field: last write wins, and the editor shows who changed it.
create or replace function public.apply_draft_patch(b uuid, path text[], value jsonb)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare ts timestamptz;
begin
  if not public.is_member(b) then raise exception 'not allowed' using errcode = '42501'; end if;
  if array_length(path, 1) is null or array_length(path, 1) > 6 then raise exception 'bad path'; end if;
  if path[1] not in ('brand','phone','email','city','province','towns','services','hours','overrides','special',
                     'availability','copy','facts','prices','jobs','reviewsUrl','googlePlaceId','bookingUrl','timezone','confirm') then
    raise exception 'field not editable: %', path[1];
  end if;
  if octet_length(value::text) > 200000 then raise exception 'value too large'; end if;
  update businesses set draft = jsonb_set(draft, path, value, true) where id = b returning updated_at into ts;
  return ts;
end $$;

revoke all on function public.apply_draft_patch(uuid, text[], jsonb) from public, anon;
grant execute on function public.apply_draft_patch(uuid, text[], jsonb) to authenticated;

-- ---------- row level security ----------
-- Public pages and admin tools use the service role on the server. Signed-in owners
-- and editors only ever see their own businesses.

alter table public.businesses enable row level security;
alter table public.members enable row level security;
alter table public.site_versions enable row level security;
alter table public.leads enable row level security;
alter table public.review_requests enable row level security;
alter table public.sms_opt_outs enable row level security;

create policy "members read their business" on public.businesses for select to authenticated using (public.is_member(id));
create policy "members see co-members" on public.members for select to authenticated using (public.is_member(business_id));
create policy "owners remove members" on public.members for delete to authenticated using (public.is_member(business_id, true) and user_id <> auth.uid());
create policy "members read history" on public.site_versions for select to authenticated using (public.is_member(business_id));
create policy "members read leads" on public.leads for select to authenticated using (public.is_member(business_id));
create policy "members mark leads handled" on public.leads for update to authenticated using (public.is_member(business_id)) with check (public.is_member(business_id));
create policy "members read review requests" on public.review_requests for select to authenticated using (public.is_member(business_id));
-- (no policies on sms_opt_outs: server only)

alter table public.claims enable row level security; -- no policies: server only

-- Live updates to the draft for everyone in the editor.
alter publication supabase_realtime add table public.businesses;

-- ---------- storage: logos, service photos, work photos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 6291456, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

-- Files live under <business_id>/..., and only that business's members can write there.
create policy "members upload media" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "members replace media" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "members delete media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_member(((storage.foldername(name))[1])::uuid));
