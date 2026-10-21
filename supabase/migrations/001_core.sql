-- Supabase PostgreSQL. No raw table access for browser roles.
revoke create on schema public from public,anon,authenticated;
alter default privileges in schema public revoke execute on functions from public;
create table public.question_definitions(id text primary key, definition jsonb not null);
create table public.responses(id uuid primary key, answers jsonb not null check(jsonb_typeof(answers)='object'), consent_version text not null default 'private-staging-v1', created_at timestamptz not null default now());
create table public.demands(id bigint generated always as identity primary key, response_id uuid not null references public.responses(id) on delete cascade, question_id text not null references public.question_definitions(id), original_text text not null check(length(original_text) between 1 and 1000), safe_text text, status text not null default 'pending' check(status in ('pending','approved','rejected')), reviewed_by uuid, reviewed_at timestamptz, check(status <> 'approved' or (length(trim(safe_text)) between 1 and 1000)));
create table public.admin_roles(user_id uuid primary key, role text not null check(role in ('owner','analyst','moderator')));
create table public.settings(id boolean primary key default true check(id), retention_days integer not null default 180 check(retention_days between 30 and 730), suppression_threshold integer not null default 5 check(suppression_threshold between 5 and 50));
insert into public.settings(id) values(true);
create table public.audit_log(id bigint generated always as identity primary key, actor uuid, action text not null, target text, created_at timestamptz not null default now());
create table public.rate_buckets(bucket text primary key, hits integer not null, expires_at timestamptz not null);
alter table public.question_definitions enable row level security;
alter table public.responses enable row level security;
alter table public.demands enable row level security;
alter table public.admin_roles enable row level security;
alter table public.settings enable row level security;
alter table public.audit_log enable row level security;
alter table public.rate_buckets enable row level security;
revoke all on public.question_definitions, public.responses, public.demands, public.admin_roles, public.settings, public.audit_log, public.rate_buckets from anon, authenticated;
revoke all on sequence public.demands_id_seq,public.audit_log_id_seq from anon,authenticated;
create index responses_created on public.responses(created_at);
create index demands_status on public.demands(status);

create function public.validate_answers(a jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare item record; d jsonb; val jsonb; n integer;
begin
 if a is null or jsonb_typeof(a)<>'object' or octet_length(a::text)>20000 then raise exception 'invalid answers'; end if;
 for item in select key,value from jsonb_each(a) loop
  select definition into d from question_definitions where id=item.key;
  if d is null then raise exception 'unknown question'; end if;
  if d ? 'condition' and not coalesce((d->'condition'->'values') @> jsonb_build_array(a->>(d->'condition'->>'question')),false) then raise exception 'hidden question'; end if;
  if d->>'type'='text' then
   if jsonb_typeof(item.value)<>'string' or length(trim(item.value #>> '{}')) not between 1 and (d->>'maxLength')::integer then raise exception 'invalid text'; end if;
  elsif d->>'type'='multi' then
   if jsonb_typeof(item.value)<>'array' then raise exception 'invalid array'; end if;
   n:=jsonb_array_length(item.value);
   if n<1 or n>(d->>'maxSelections')::integer or n<>(select count(distinct value) from jsonb_array_elements(item.value)) then raise exception 'invalid selection count'; end if;
   if n>1 and exists(select 1 from jsonb_array_elements(item.value) v where d->'exclusiveOptions' @> jsonb_build_array(v.value)) then raise exception 'exclusive option'; end if;
   for val in select value from jsonb_array_elements(item.value) loop
    if not exists(select 1 from jsonb_array_elements(d->'options') o where o->'value'=val) then raise exception 'invalid option'; end if;
   end loop;
  else
   if not exists(select 1 from jsonb_array_elements(d->'options') o where o->'value'=item.value) then raise exception 'invalid option'; end if;
  end if;
 end loop;
end $$;
create function public.enforce_answers() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin perform validate_answers(new.answers); return new; end $$;
create trigger responses_validate before insert or update on public.responses for each row execute function public.enforce_answers();

create function public.consume_rate(p_bucket text) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;
begin
 delete from rate_buckets where expires_at<now();
 insert into rate_buckets(bucket,hits,expires_at) values(p_bucket,1,now()+interval '1 hour') on conflict(bucket) do update set hits=rate_buckets.hits+1 returning hits into n;
 return n<=10;
end $$;
create function public.submit_response(p_id uuid,p_answers jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare saved jsonb; item record;
begin
 perform validate_answers(p_answers);
 -- Transaction advisory lock serializes identical request IDs across instances.
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select answers into saved from responses where id=p_id;
 if found then
  if saved<>p_answers then raise exception 'idempotency conflict'; end if;
  return p_id;
 end if;
 insert into responses(id,answers) values(p_id,p_answers);
 for item in select key,value from jsonb_each_text(p_answers) where key in ('demand','solution','comment') loop
  insert into demands(response_id,question_id,original_text) values(p_id,item.key,trim(item.value));
 end loop;
 return p_id;
end $$;

create function public.public_statistics() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare k integer; total bigint; distributions jsonb; trend jsonb;
begin
 select suppression_threshold into k from settings where id;
 select count(*) into total from responses;
 -- Exclude an entire question when any populated category is smaller than k.
 -- This prevents recovering a suppressed category by subtracting other bars.
 with counts as (
  select q.id, o->>'value' as value,o->>'label' as label,
    (select count(*) from responses r where r.answers->q.id=o->'value' or (jsonb_typeof(r.answers->q.id)='array' and (r.answers->q.id) @> jsonb_build_array(o->'value'))) as n
  from question_definitions q cross join lateral jsonb_array_elements(q.definition->'options') o where (q.definition->>'aggregate')::boolean
 ), permitted as (select id from counts group by id having min(n) filter(where n>0)>=k), grouped as (
 select c.id,jsonb_agg(jsonb_build_object('value',value,'label',label,'count',n) order by value) bars from counts c join permitted p using(id) where n>=k group by c.id
 ) select coalesce(jsonb_object_agg(id,bars),'{}') into distributions from grouped;
 -- Whole completed weeks only; no live individual timing is released.
 select coalesce(jsonb_agg(jsonb_build_object('week',week,'count',n) order by week),'[]') into trend from (select date_trunc('week',created_at)::date week,count(*) n from responses where created_at<date_trunc('week',now()) group by 1 having count(*)>=k) x;
 return jsonb_build_object('total',case when total>=k then total else null end,'threshold',k,'distributions',distributions,'weekly',trend);
end $$;
create function public.public_demands() returns jsonb language sql security definer set search_path=public,pg_temp as $$ select coalesce(jsonb_agg(jsonb_build_object('id',id,'text',safe_text)),'[]') from (select id,safe_text from demands where status='approved' order by reviewed_at desc limit 100) x $$;

create function public.require_admin(allowed text[]) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare r text;
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'MFA required' using errcode='42501'; end if;
 select role into r from admin_roles where user_id=auth.uid();
 if r is null or not(r=any(allowed)) then raise exception 'forbidden' using errcode='42501'; end if;
 return r;
end $$;
create function public.admin_action(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r text; result jsonb; affected integer; target_id bigint;
begin
 r:=require_admin(array['owner','analyst','moderator']);
 if p_action='session' then return jsonb_build_object('role',r); end if;
 if p_action='overview' then
  result:=jsonb_build_object('role',r,'statistics',case when r in ('owner','analyst') then public_statistics() else null end,'moderation',case when r in ('owner','moderator') then (select jsonb_build_object('pending',count(*) filter(where status='pending'),'approved',count(*) filter(where status='approved'),'rejected',count(*) filter(where status='rejected')) from demands) else null end);
 elsif p_action in ('analytics','export') then
  perform require_admin(array['owner','analyst']); result:=public_statistics();
 elsif p_action='demands' then
  perform require_admin(array['owner','moderator']);
  select coalesce(jsonb_agg(to_jsonb(d)),'[]') into result from (select id,question_id,original_text,safe_text,status from demands where (p_data->>'beforeId' is null or id<(p_data->>'beforeId')::bigint) order by id desc limit 100) d;
 elsif p_action='moderate' then
  perform require_admin(array['owner','moderator']);
  if p_data->>'status' not in ('approved','rejected') then raise exception 'invalid status'; end if;
  if p_data->>'status'='approved' and (coalesce(p_data->>'reviewed','false')<>'true' or length(trim(coalesce(p_data->>'safeText',''))) not between 1 and 1000) then raise exception 'review required'; end if;
  target_id:=(p_data->>'id')::bigint;
  update demands set status=p_data->>'status',safe_text=case when p_data->>'status'='approved' then trim(p_data->>'safeText') else null end,reviewed_by=auth.uid(),reviewed_at=now() where id=target_id;
  if not found then raise exception 'not found'; end if;
  result:=jsonb_build_object('ok',true);
 elsif p_action='settings' then
  perform require_admin(array['owner']); select to_jsonb(s) into result from settings s where id;
 elsif p_action='save_settings' then
  perform require_admin(array['owner']);
  update settings set retention_days=(p_data->>'retentionDays')::integer,suppression_threshold=(p_data->>'threshold')::integer where id;
  result:=jsonb_build_object('ok',true);
 elsif p_action='delete_expired' then
  perform require_admin(array['owner']);
  if coalesce(p_data->>'confirmation','')<>'DELETE EXPIRED' then raise exception 'confirmation required'; end if;
  delete from responses where created_at<now()-make_interval(days=>(select retention_days from settings where id)); get diagnostics affected=row_count;
  delete from rate_buckets where expires_at<now();
  delete from audit_log where created_at<now()-interval '365 days';
  result:=jsonb_build_object('deleted',affected);
 elsif p_action='audit' then
  perform require_admin(array['owner']); select coalesce(jsonb_agg(to_jsonb(a)),'[]') into result from (select * from audit_log order by id desc limit 100) a;
 else raise exception 'unknown action'; end if;
 if p_action in ('moderate','save_settings','delete_expired','export') then insert into audit_log(actor,action,target) values(auth.uid(),p_action,case when target_id is not null then target_id::text else null end); end if;
 return result;
end $$;
revoke execute on function public.validate_answers(jsonb),public.enforce_answers(),public.consume_rate(text),public.submit_response(uuid,jsonb),public.public_statistics(),public.public_demands(),public.require_admin(text[]),public.admin_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_response(uuid,jsonb),public.consume_rate(text) to service_role;
grant execute on function public.public_statistics(),public.public_demands() to anon,authenticated;
grant execute on function public.admin_action(text,jsonb) to authenticated;
