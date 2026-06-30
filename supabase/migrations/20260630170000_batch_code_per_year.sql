-- Per-year batch serial: YYYY-##### resets to 00001 each calendar year.
-- Replaces the global sequence default (0008) with a function that takes a per-year
-- advisory lock and numbers from max(existing this year)+1, so a new year starts fresh.

create or replace function public.next_batch_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_n int;
begin
  -- serialize allocation within the year so concurrent inserts don't collide
  perform pg_advisory_xact_lock(hashtextextended('batch_code_' || v_year, 0));
  select coalesce(max(split_part(code, '-', 2)::int), 0) + 1 into v_n
  from public.batches
  where code like v_year || '-%';
  return v_year || '-' || lpad(v_n::text, 5, '0');
end;
$$;
revoke execute on function public.next_batch_code() from public, anon, authenticated;

alter table public.batches alter column code set default public.next_batch_code();
drop sequence if exists public.batch_seq;
