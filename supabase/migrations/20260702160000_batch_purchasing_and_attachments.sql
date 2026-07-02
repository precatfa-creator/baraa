-- Purchasing source per batch/item + private batch attachments.

alter table public.batches
  add column default_purchase_source text
  check (default_purchase_source is null or char_length(default_purchase_source) <= 200);

alter table public.shortage_requests
  add column purchase_source text
  check (purchase_source is null or char_length(purchase_source) <= 200);

create table public.batch_attachments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now()
);
create index batch_attachments_batch_idx
  on public.batch_attachments(batch_id, created_at);

alter table public.batch_attachments enable row level security;

create policy batch_attachments_select on public.batch_attachments
  for select to authenticated
  using (
    exists (
      select 1 from public.batches b
      where b.id = batch_id and b.company_id = company_id
    )
  );

create policy batch_attachments_insert on public.batch_attachments
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (is_super_admin() or company_id = app_company_id())
    and exists (
      select 1 from public.batches b
      where b.id = batch_id
        and b.company_id = company_id
        and public.can_handle_pharmacy(b.company_id, b.pharmacy_id)
    )
  );

create policy batch_attachments_delete on public.batch_attachments
  for delete to authenticated
  using (
    exists (
      select 1 from public.batches b
      where b.id = batch_id
        and b.company_id = company_id
        and public.can_handle_pharmacy(b.company_id, b.pharmacy_id)
    )
  );

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'batch-attachments',
  'batch-attachments',
  false,
  10485760,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf', 'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- New clients must supply the default source when purchasing starts.
create or replace function public.take_batch(
  p_batch_id uuid,
  p_purchase_source text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare b public.batches%rowtype; v_source text := nullif(trim(p_purchase_source), '');
begin
  if v_source is null or char_length(v_source) > 200 then
    raise exception 'invalid purchase source' using errcode = '22023';
  end if;
  select * into b from public.batches where id = p_batch_id for update;
  if b.id is null then raise exception 'batch not found' using errcode = 'P0002'; end if;
  if not public.can_handle_pharmacy(b.company_id, b.pharmacy_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if b.status <> 'open' then
    raise exception 'batch is % not open', b.status using errcode = '55000';
  end if;

  update public.batches
  set status = 'in_market', taken_by = auth.uid(), taken_at = now(),
      default_purchase_source = v_source
  where id = p_batch_id;

  insert into public.shortage_status_history
    (shortage_request_id, company_id, old_status, new_status, changed_by, note)
  select id, company_id, 'missing', 'in_purchase', auth.uid(),
         'أخذ الدفعة إلى السوق'
  from public.shortage_requests
  where batch_id = p_batch_id and status = 'missing';

  update public.shortage_requests
  set status = 'in_purchase', purchase_source = v_source
  where batch_id = p_batch_id and status = 'missing';
end;
$$;
revoke execute on function public.take_batch(uuid, text) from public, anon;
grant execute on function public.take_batch(uuid, text) to authenticated;

create or replace function public.set_batch_item_purchase_source(
  p_request_id uuid,
  p_purchase_source text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.shortage_requests%rowtype;
  v_source text := nullif(trim(p_purchase_source), '');
begin
  if v_source is null or char_length(v_source) > 200 then
    raise exception 'invalid purchase source' using errcode = '22023';
  end if;
  select * into r from public.shortage_requests where id = p_request_id for update;
  if r.id is null then raise exception 'request not found' using errcode = 'P0002'; end if;
  if r.batch_id is null then raise exception 'request not in batch' using errcode = '22023'; end if;
  if not public.can_handle_pharmacy(r.company_id, r.pharmacy_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.shortage_requests set purchase_source = v_source where id = p_request_id;
end;
$$;
revoke execute on function public.set_batch_item_purchase_source(uuid, text) from public, anon;
grant execute on function public.set_batch_item_purchase_source(uuid, text) to authenticated;

-- Preserve the batch default when a subset is split into another in-market batch.
create or replace function public.split_batch(p_batch_id uuid, p_request_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare b public.batches%rowtype; v_new uuid; v_match int; v_n int;
begin
  select * into b from public.batches where id = p_batch_id for update;
  if b.id is null then raise exception 'batch not found' using errcode = 'P0002'; end if;
  if not public.can_handle_pharmacy(b.company_id, b.pharmacy_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if b.status <> 'in_market' then
    raise exception 'only an in-market batch can be split' using errcode = '22023';
  end if;

  v_n := coalesce(array_length(p_request_ids, 1), 0);
  if v_n = 0 then raise exception 'no items selected' using errcode = '22023'; end if;
  select count(*) into v_match from public.shortage_requests
  where id = any(p_request_ids) and batch_id = p_batch_id;
  if v_match <> v_n then
    raise exception 'some items are not in this batch' using errcode = '22023';
  end if;

  insert into public.batches (
    company_id, pharmacy_id, status, created_by, taken_by, taken_at,
    default_purchase_source
  )
  values (
    b.company_id, b.pharmacy_id, 'in_market', auth.uid(), auth.uid(), now(),
    b.default_purchase_source
  )
  returning id into v_new;

  update public.shortage_requests set batch_id = v_new
  where id = any(p_request_ids) and batch_id = p_batch_id;
  return v_new;
end;
$$;
revoke execute on function public.split_batch(uuid, uuid[]) from public, anon;
grant execute on function public.split_batch(uuid, uuid[]) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'batch_attachments'
  ) then
    alter publication supabase_realtime add table public.batch_attachments;
  end if;
end;
$$;
