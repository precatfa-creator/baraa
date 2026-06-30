-- Human-friendly batch serial: YYYY-##### (year prefix + zero-padded running number).
-- Filled by a column default on insert, so the RPCs that create batches need no change.
-- ponytail: single global sequence (number does not reset per calendar year); add a
-- per-year/per-company counter later if strict per-year numbering is needed.

create sequence if not exists public.batch_seq start 1;

alter table public.batches add column code text;
alter table public.batches
  alter column code set default
    to_char(now(), 'YYYY') || '-' || lpad(nextval('public.batch_seq')::text, 5, '0');

-- backfill existing batches chronologically, then advance the sequence past them
update public.batches b
set code = to_char(b.created_at, 'YYYY') || '-' || lpad(o.rn::text, 5, '0')
from (select id, row_number() over (order by created_at) as rn from public.batches) o
where b.id = o.id and b.code is null;

do $$
declare n int;
begin
  select count(*) into n from public.batches;
  if n > 0 then perform setval('public.batch_seq', n, true); end if;
end $$;

alter table public.batches alter column code set not null;
create unique index batches_code_uniq on public.batches(code);
