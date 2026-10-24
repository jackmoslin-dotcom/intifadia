-- Additive, repeatable production migration. Run after 001 and 002.
-- Never rerun the old creation migrations or regenerate 002 on production.
begin;

insert into public.question_definitions(id,definition) values ('demonstration_intent_2026_10_28','{"id":"demonstration_intent_2026_10_28","section":5,"label":"هل تنوي المشاركة في المظاهرة السلمية المقترحة يوم 28 أكتوبر 2026؟","type":"single","options":[{"value":"v1","label":"نعم"},{"value":"v2","label":"لا"}],"optional":true,"multiple":false,"maxSelections":1,"exclusiveOptions":[],"storage":"participation_counts (aggregate only; no response link)","aggregate":true}') on conflict(id) do nothing;

create table if not exists public.event_announcement (
 id boolean primary key default true check(id),
 event_date date not null default '2026-10-28' check(event_date='2026-10-28'),
 status text not null check(status in ('proposed','announced','postponed','cancelled')),
 slogan text not null check(length(trim(slogan)) between 1 and 200),
 note text not null check(length(trim(note)) between 1 and 1200)
);
insert into public.event_announcement(id,status,slogan,note)
 values(true,'announced','لا للتخريب، نعم لليبيا الواعية','أعلن المنظم موعد المظاهرة السلمية يوم 28 أكتوبر 2026. لم تُحدَّد في هذا الإعلان ساعة أو نقطة تجمع؛ تابع القناة الرسمية للمستجدات.')
 on conflict(id) do nothing;

-- Only daily counters: no respondent IDs, demographic fields or individual
-- choices. Daily buckets are private and exist only to implement retention.
create table if not exists public.participation_counts (
 bucket_date date primary key,
 yes_count bigint not null default 0 check(yes_count>=0),
 no_count bigint not null default 0 check(no_count>=0)
);
alter table public.event_announcement enable row level security;
alter table public.participation_counts enable row level security;
revoke all on public.event_announcement,public.participation_counts from public,anon,authenticated;

create or replace function public.public_event() returns jsonb language sql security definer set search_path=public,pg_temp as $$
 select to_jsonb(e)-'id' from event_announcement e where id
$$;
revoke all on function public.public_event() from public,anon,authenticated;
grant execute on function public.public_event() to anon,authenticated;

-- The normal validation trigger also prevents accidentally saving individual
-- intentions through direct writes instead of the aggregate-only RPC.
create or replace function public.enforce_answers() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform validate_answers(new.answers);
 if new.answers ? 'demonstration_intent_2026_10_28' then raise exception 'intent must be aggregated'; end if;
 return new;
end $$;

create or replace function public.submit_response(p_id uuid,p_answers jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare saved jsonb; item record; ordinary jsonb; intention text;
begin
 perform validate_answers(p_answers);
 intention:=p_answers->>'demonstration_intent_2026_10_28';
 ordinary:=p_answers-'demonstration_intent_2026_10_28';
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select answers into saved from responses where id=p_id;
 if found then
  if saved<>ordinary then raise exception 'idempotency conflict'; end if;
  -- A retry never alters counters, even if the caller changes intention.
  -- We deliberately do not keep an intention hash linked to this UUID.
  return p_id;
 end if;
 insert into responses(id,answers,consent_version) values(p_id,ordinary,'civic-v2-2026-10-28');
 for item in select key,value from jsonb_each_text(ordinary) where key in ('demand','solution','comment') loop
  insert into demands(response_id,question_id,original_text) values(p_id,item.key,trim(item.value));
 end loop;
 if intention is not null then
  insert into participation_counts(bucket_date,yes_count,no_count)
   values((now() at time zone 'UTC')::date,case when intention='v1' then 1 else 0 end,case when intention='v2' then 1 else 0 end)
   on conflict(bucket_date) do update set yes_count=participation_counts.yes_count+excluded.yes_count,no_count=participation_counts.no_count+excluded.no_count;
 end if;
 return p_id;
end $$;

create or replace function public.statistics_snapshot(p_private boolean default false) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare k integer; total bigint; q record; o jsonb; n bigint; denom bigint; bars jsonb; allowed boolean;
 distributions jsonb:='{}'; trend jsonb; y bigint; no_n bigint; participation jsonb:=null; texts jsonb:='{}';
begin
 if p_private then perform require_admin(array['owner','analyst']); end if;
 select suppression_threshold into k from settings where id;
 select count(*) into total from responses;
 for q in select id,definition from question_definitions where id<>'demonstration_intent_2026_10_28' loop
  select count(*) into denom from responses where answers ? q.id;
  if q.definition->>'type'='text' then
   if p_private then texts:=texts||jsonb_build_object(q.id,jsonb_build_object('answered',denom,'percent',case when total>0 then round(100.0*denom/total,1) else null end)); end if;
   continue;
  end if;
  bars:='[]'; allowed:=(p_private or denom>=k);
  for o in select value from jsonb_array_elements(q.definition->'options') loop
   select count(*) into n from responses r where r.answers->q.id=o->'value' or (jsonb_typeof(r.answers->q.id)='array' and r.answers->q.id @> jsonb_build_array(o->'value'));
   if n>0 and n<k and not p_private then allowed:=false; end if;
   if p_private or n>0 then bars:=bars||jsonb_build_array(jsonb_build_object('value',o->>'value','label',o->>'label','count',n,'answered',denom,'percent',case when denom>0 then round(100.0*n/denom,1) else null end)); end if;
  end loop;
  if allowed then distributions:=distributions||jsonb_build_object(q.id,bars); end if;
 end loop;
 select coalesce(sum(yes_count),0),coalesce(sum(no_count),0) into y,no_n from participation_counts;
 denom:=y+no_n;
 if p_private or (denom>=k and (y=0 or y>=k) and (no_n=0 or no_n>=k)) then
  participation:=jsonb_build_object('answered',denom,'yes',y,'no',no_n,'yesPercent',case when denom>0 then round(100.0*y/denom,1) else null end,'noPercent',case when denom>0 then round(100.0*no_n/denom,1) else null end);
  distributions:=distributions||jsonb_build_object('demonstration_intent_2026_10_28',jsonb_build_array(jsonb_build_object('value','v1','label','نعم','count',y,'answered',denom,'percent',participation->'yesPercent'),jsonb_build_object('value','v2','label','لا','count',no_n,'answered',denom,'percent',participation->'noPercent')));
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('week',x.week,'count',x.n) order by x.week),'[]') into trend from (select date_trunc('week',created_at)::date week,count(*) n from responses where p_private or created_at<date_trunc('week',now()) group by 1 having p_private or count(*)>=k) x;
 return jsonb_build_object('total',case when p_private or total>=k then total else null end,'threshold',k,'private',p_private,'distributions',distributions,'weekly',trend,'demonstration',participation,'textCompletion',texts,'incomplete',null);
end $$;
revoke all on function public.statistics_snapshot(boolean) from public,anon,authenticated;
create or replace function public.public_statistics() returns jsonb language sql security definer set search_path=public,pg_temp as $$ select statistics_snapshot(false) $$;

create or replace function public.admin_action(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r text; result jsonb; affected integer; target_id bigint;
begin
 r:=require_admin(array['owner','analyst','moderator']);
 if p_action='session' then return jsonb_build_object('role',r); end if;
 if p_action='overview' then
  result:=jsonb_build_object('role',r,'statistics',case when r in ('owner','analyst') then statistics_snapshot(true) else null end,'moderation',case when r in ('owner','moderator') then (select jsonb_build_object('pending',count(*) filter(where status='pending'),'approved',count(*) filter(where status='approved'),'rejected',count(*) filter(where status='rejected')) from demands) else null end);
 elsif p_action in ('analytics','export') then
  perform require_admin(array['owner','analyst']); result:=statistics_snapshot(true);
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
 elsif p_action='event_settings' then
  perform require_admin(array['owner']); result:=public_event();
 elsif p_action='save_event' then
  perform require_admin(array['owner']);
  update event_announcement set status=p_data->>'status',slogan=trim(p_data->>'slogan'),note=trim(p_data->>'note') where id;
  result:=public_event();
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
  delete from participation_counts where bucket_date+1 <= ((now() at time zone 'UTC')::date-(select retention_days from settings where id));
  delete from rate_buckets where expires_at<now();
  delete from audit_log where created_at<now()-interval '365 days';
  result:=jsonb_build_object('deleted',affected);
 elsif p_action='audit' then
  perform require_admin(array['owner']); select coalesce(jsonb_agg(to_jsonb(a)),'[]') into result from (select * from audit_log order by id desc limit 100) a;
 else raise exception 'unknown action'; end if;
 if p_action in ('moderate','save_settings','save_event','delete_expired','export') then insert into audit_log(actor,action,target) values(auth.uid(),p_action,case when target_id is not null then target_id::text else null end); end if;
 return result;
end $$;


-- Explicit grants; new helpers are never callable by browser roles.
revoke all on function public.enforce_answers(),public.submit_response(uuid,jsonb),public.public_statistics(),public.admin_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_response(uuid,jsonb) to service_role;
grant execute on function public.public_statistics() to anon,authenticated;
grant execute on function public.admin_action(text,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
