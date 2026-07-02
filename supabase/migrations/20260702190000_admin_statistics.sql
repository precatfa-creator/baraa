-- Admin-only operational statistics and role leaderboards.

create or replace function public.admin_operational_stats(p_days int default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_company uuid;
  v_active boolean;
  v_chart_days int := least(coalesce(p_days, 90), 90);
begin
  select role, company_id, is_active
  into v_role, v_company, v_active
  from public.profiles where id = auth.uid();
  if not coalesce(v_active, false) or v_role not in ('company_admin', 'super_admin') then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'kpis', jsonb_build_object(
      'requests', (
        select count(*) from public.shortage_requests r
        where (v_role = 'super_admin' or r.company_id = v_company)
          and (p_days is null or r.created_at >= now() - make_interval(days => p_days))
      ),
      'active', (
        select count(*) from public.shortage_requests r
        where (v_role = 'super_admin' or r.company_id = v_company)
          and r.status in ('missing', 'in_purchase')
          and (p_days is null or r.created_at >= now() - make_interval(days => p_days))
      ),
      'fulfilled', (
        select count(*) from public.shortage_requests r
        where (v_role = 'super_admin' or r.company_id = v_company)
          and r.status = 'fulfilled'
          and (p_days is null or r.created_at >= now() - make_interval(days => p_days))
      ),
      'unavailable', (
        select count(*) from public.shortage_requests r
        where (v_role = 'super_admin' or r.company_id = v_company)
          and r.status = 'not_found'
          and (p_days is null or r.created_at >= now() - make_interval(days => p_days))
      ),
      'batches', (
        select count(*) from public.batches b
        where (v_role = 'super_admin' or b.company_id = v_company)
          and (p_days is null or b.created_at >= now() - make_interval(days => p_days))
      ),
      'average_purchase_minutes', (
        select round(avg(extract(epoch from (pe.purchased_at - pe.started_at)) / 60.0), 1)
        from public.purchase_events pe
        where (v_role = 'super_admin' or pe.company_id = v_company)
          and pe.reversed_at is null and pe.started_at is not null
          and (p_days is null or pe.purchased_at >= now() - make_interval(days => p_days))
      ),
      'items', (
        select count(*) from public.items i
        where (v_role = 'super_admin' or i.company_id = v_company) and i.is_active
      ),
      'pharmacies', (
        select count(*) from public.pharmacies ph
        where (v_role = 'super_admin' or ph.company_id = v_company) and ph.is_active
      ),
      'active_users', (
        select count(*) from public.profiles p
        where (v_role = 'super_admin' or p.company_id = v_company) and p.is_active
      )
    ),
    'status_counts', coalesce((
      select jsonb_agg(jsonb_build_object('label', status, 'value', total) order by status)
      from (
        select r.status, count(*) total
        from public.shortage_requests r
        where (v_role = 'super_admin' or r.company_id = v_company)
          and (p_days is null or r.created_at >= now() - make_interval(days => p_days))
        group by r.status
      ) grouped
    ), '[]'::jsonb),
    'daily_requests', coalesce((
      select jsonb_agg(
        jsonb_build_object('date', grouped.request_date, 'value', grouped.total)
        order by grouped.request_date
      )
      from (
        select date(r.created_at) request_date, count(*) total
        from public.shortage_requests r
        where (v_role = 'super_admin' or r.company_id = v_company)
          and r.created_at >= current_date - (v_chart_days - 1)
        group by date(r.created_at)
      ) grouped
    ), '[]'::jsonb),
    'top_items', coalesce((
      select jsonb_agg(jsonb_build_object('label', name_ar, 'value', demand) order by demand desc)
      from (
        select i.name_ar, coalesce(sum(requester_count.total), count(*)) demand
        from public.shortage_requests r
        join public.items i on i.id = r.item_id
        left join lateral (
          select count(*) total from public.shortage_request_requesters rr
          where rr.shortage_request_id = r.id
        ) requester_count on true
        where (v_role = 'super_admin' or r.company_id = v_company)
          and (p_days is null or r.created_at >= now() - make_interval(days => p_days))
        group by i.id, i.name_ar
        order by demand desc limit 8
      ) grouped
    ), '[]'::jsonb),
    'pharmacy_activity', coalesce((
      select jsonb_agg(jsonb_build_object('label', name, 'value', total) order by total desc)
      from (
        select ph.name, count(*) total
        from public.shortage_requests r
        join public.pharmacies ph on ph.id = r.pharmacy_id
        where (v_role = 'super_admin' or r.company_id = v_company)
          and (p_days is null or r.created_at >= now() - make_interval(days => p_days))
        group by ph.id, ph.name
        order by total desc limit 8
      ) grouped
    ), '[]'::jsonb),
    'purchase_sources', coalesce((
      select jsonb_agg(jsonb_build_object('label', source, 'value', total) order by total desc)
      from (
        select coalesce(nullif(trim(pe.purchase_source), ''), 'غير محدد') source, count(*) total
        from public.purchase_events pe
        where (v_role = 'super_admin' or pe.company_id = v_company)
          and pe.reversed_at is null
          and (p_days is null or pe.purchased_at >= now() - make_interval(days => p_days))
        group by source
        order by total desc limit 8
      ) grouped
    ), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.admin_operational_stats(int) from public, anon;
grant execute on function public.admin_operational_stats(int) to authenticated;

create or replace function public.rep_purchase_leaderboard(
  p_days int default 30,
  p_limit int default 20
)
returns table (
  rep_id uuid,
  full_name text,
  purchased_items bigint,
  batches_handled bigint,
  average_minutes numeric,
  fastest_minutes numeric,
  last_purchase_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_role text; v_company uuid; v_active boolean;
begin
  select role, company_id, is_active into v_role, v_company, v_active
  from public.profiles where id = auth.uid();
  if not coalesce(v_active, false) or v_role not in ('company_admin', 'super_admin') then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
    select pe.buyer_id, p.full_name, count(*)::bigint,
           count(distinct pe.batch_id)::bigint,
           round(avg(extract(epoch from (pe.purchased_at - pe.started_at)) / 60.0), 1),
           round(min(extract(epoch from (pe.purchased_at - pe.started_at)) / 60.0), 1),
           max(pe.purchased_at)
    from public.purchase_events pe
    join public.profiles p on p.id = pe.buyer_id and p.role = 'sales_rep'
    where (v_role = 'super_admin' or pe.company_id = v_company)
      and pe.reversed_at is null and pe.started_at is not null
      and (p_days is null or pe.purchased_at >= now() - make_interval(days => p_days))
    group by pe.buyer_id, p.full_name
    order by count(*) desc, avg(pe.purchased_at - pe.started_at) asc
    limit greatest(p_limit, 1);
end;
$$;
revoke execute on function public.rep_purchase_leaderboard(int, int) from public, anon;
grant execute on function public.rep_purchase_leaderboard(int, int) to authenticated;

create or replace function public.pharmacist_activity_leaderboard(
  p_days int default 30,
  p_limit int default 20
)
returns table (
  pharmacist_id uuid,
  full_name text,
  requests_submitted bigint,
  unique_items bigint,
  fulfilled_requests bigint,
  fulfillment_rate numeric,
  last_request_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_role text; v_company uuid; v_active boolean;
begin
  select role, company_id, is_active into v_role, v_company, v_active
  from public.profiles where id = auth.uid();
  if not coalesce(v_active, false) or v_role not in ('company_admin', 'super_admin') then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
    select rr.profile_id, p.full_name, count(*)::bigint,
           count(distinct r.item_id)::bigint,
           count(*) filter (where r.status = 'fulfilled')::bigint,
           round(
             100.0 * count(*) filter (where r.status = 'fulfilled')
             / greatest(count(*), 1),
             1
           ),
           max(rr.created_at)
    from public.shortage_request_requesters rr
    join public.shortage_requests r on r.id = rr.shortage_request_id
    join public.profiles p on p.id = rr.profile_id and p.role = 'pharmacist'
    where (v_role = 'super_admin' or rr.company_id = v_company)
      and (p_days is null or rr.created_at >= now() - make_interval(days => p_days))
    group by rr.profile_id, p.full_name
    order by count(*) desc,
             count(*) filter (where r.status = 'fulfilled') desc
    limit greatest(p_limit, 1);
end;
$$;
revoke execute on function public.pharmacist_activity_leaderboard(int, int) from public, anon;
grant execute on function public.pharmacist_activity_leaderboard(int, int) to authenticated;
