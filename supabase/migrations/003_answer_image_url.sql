alter table public.questions
add column if not exists answer_image_url text;

notify pgrst, 'reload schema';
