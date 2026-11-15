-- nfc-ecard — migration 0001 (Steps 1–2)
-- Run this in the Supabase SQL Editor.

create type public.profile_type as enum ('personal', 'commercial');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade unique,
  slug          text not null unique,
  display_name  text,
  title         text,
  bio           text,
  avatar_url    text,
  profile_type  public.profile_type not null default 'personal',
  is_public     boolean not null default true,
  theme         jsonb not null default '{
                  "primary": "#4f46e5",
                  "secondary": "#0f172a",
                  "accent": "#f59e0b",
                  "background": { "type": "solid", "value": "#f8fafc" },
                  "font": "system"
                }'::jsonb,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone can view public profiles; users can always view their own.
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (is_public = true);

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

-- Users can update their own row; with_check prevents reassigning user_id.
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- profile_type is gated behind the commercial tier (Step 6). Until then,
-- block any change so a personal user cannot self-upgrade by writing 'commercial'.
create or replace function public.guard_profile_type()
returns trigger
language plpgsql
as $$
begin
  if new.profile_type is distinct from old.profile_type then
    raise exception 'profile_type changes are disabled until the commercial tier ships (step 6)';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_profile_type
  before update on public.profiles
  for each row execute function public.guard_profile_type();

-- ---------------------------------------------------------------------------
-- auto-create a profile (with unique slug) on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_slug  text;
  final_slug text;
  n          int := 0;
begin
  base_slug := lower(regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    '[^a-zA-Z0-9]+', '-', 'g'
  ));
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then base_slug := 'user'; end if;

  final_slug := base_slug;
  while exists (select 1 from public.profiles where slug = final_slug) loop
    n := n + 1;
    final_slug := base_slug || '-' || n;
  end loop;

  insert into public.profiles (user_id, slug, display_name)
  values (new.id, final_slug, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- avatar storage bucket (objects stored as avatars/{user_id}/filename)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Public avatar read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
