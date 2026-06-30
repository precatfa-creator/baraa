-- Trending items — rank drugs by how often they're recorded as shortages (demand),
-- for the pharmacy/company to spot fast-moving products. SECURITY INVOKER so the
-- caller's RLS scopes the underlying shortage_requests (admin: whole company,
-- pharmacist: own pharmacy, rep: assigned pharmacies). p_days = null means all-time.

create or replace function public.trending_items(p_days int default null, p_limit int default 50)
returns table (
  item_id uuid,
  name_ar text,
  category text,
  shortage_count bigint,
  total_requesters bigint,
  fulfilled_count bigint,
  last_at timestamptz
)
language sql
security invoker
set search_path = public
as $$
  select
    sr.item_id,
    i.name_ar,
    i.category,
    count(*)::bigint as shortage_count,
    coalesce(sum(rc.cnt), count(*))::bigint as total_requesters,
    count(*) filter (where sr.status = 'fulfilled')::bigint as fulfilled_count,
    max(sr.created_at) as last_at
  from public.shortage_requests sr
  join public.items i on i.id = sr.item_id
  left join lateral (
    select count(*) as cnt from public.shortage_request_requesters r
    where r.shortage_request_id = sr.id
  ) rc on true
  where p_days is null or sr.created_at >= now() - make_interval(days => p_days)
  group by sr.item_id, i.name_ar, i.category
  order by shortage_count desc, total_requesters desc
  limit greatest(p_limit, 1);
$$;

revoke execute on function public.trending_items(int, int) from public, anon;
grant execute on function public.trending_items(int, int) to authenticated;
