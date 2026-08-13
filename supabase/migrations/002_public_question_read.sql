-- The game reads question text and answers without an Admin session.
-- Keep all write policies restricted to Admin in 001_questions.sql.
drop policy if exists "public can read questions" on public.questions;
create policy "public can read questions"
on public.questions for select
to anon, authenticated
using (true);
