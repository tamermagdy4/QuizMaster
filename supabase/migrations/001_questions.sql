create extension if not exists pgcrypto;

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  category_id text not null,
  question text not null check (length(trim(question)) > 0),
  answer text not null check (length(trim(answer)) > 0),
  points integer not null check (points in (100, 300, 500)),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists questions_category_id_idx on public.questions (category_id);
create index if not exists questions_points_idx on public.questions (points);

create or replace function public.set_questions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists questions_updated_at on public.questions;
create trigger questions_updated_at
before update on public.questions
for each row execute function public.set_questions_updated_at();

alter table public.questions enable row level security;

-- No public write policy is created. Add policies after Admin Auth is connected.
-- The expected admin claim is auth.jwt()->'app_metadata'->>'role' = 'admin'.
create policy "admins can read questions"
on public.questions for select
to authenticated
using ((auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "admins can insert questions"
on public.questions for insert
to authenticated
with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "admins can update questions"
on public.questions for update
to authenticated
using ((auth.jwt()->'app_metadata'->>'role') = 'admin')
with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "admins can delete questions"
on public.questions for delete
to authenticated
using ((auth.jwt()->'app_metadata'->>'role') = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-images', 'question-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "admins can upload question images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'question-images' and (auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "admins can update question images"
on storage.objects for update
to authenticated
using (bucket_id = 'question-images' and (auth.jwt()->'app_metadata'->>'role') = 'admin')
with check (bucket_id = 'question-images' and (auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "admins can delete question images"
on storage.objects for delete
to authenticated
using (bucket_id = 'question-images' and (auth.jwt()->'app_metadata'->>'role') = 'admin');
