-- Run once in the restaurant's Supabase SQL editor. No public database access.
begin;
create table public.lg_requests (
  id uuid primary key,
  kind text not null check (kind in ('booking','order')),
  data jsonb not null,
  status text not null default 'new' check (status in ('new','confirmed','preparing','ready','completed','declined','cancelled')),
  source text not null check (source in ('website','staff')),
  email_status text not null default 'pending',
  revision integer not null default 1,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lg_requests_listing on public.lg_requests(kind,created_at desc);
create table public.lg_settings (
  id integer primary key check (id=1),
  data jsonb not null,
  revision integer not null default 1,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.lg_settings(id,data) values(1,'{"notice":"","lunch":{"Tisdag":"","Onsdag":"","Torsdag":"","Fredag":""},"catalog":[],"ordering":false}');
create table public.lg_audit (
  id bigint generated always as identity primary key,
  actor uuid,
  entity text not null,
  record_id text not null,
  action text not null,
  created_at timestamptz not null default now()
);
create table public.lg_rate_limits (key text primary key, hits integer not null, expires_at timestamptz not null);
alter table public.lg_requests enable row level security;
alter table public.lg_settings enable row level security;
alter table public.lg_audit enable row level security;
alter table public.lg_rate_limits enable row level security;
revoke all on public.lg_requests,public.lg_settings,public.lg_audit,public.lg_rate_limits from anon,authenticated;
grant all on public.lg_requests,public.lg_settings,public.lg_audit,public.lg_rate_limits to service_role;
grant usage,select on sequence public.lg_audit_id_seq to service_role;

create function public.lg_track_change() returns trigger language plpgsql set search_path='' as $$
begin
  if TG_OP='UPDATE' then
    NEW.revision=OLD.revision+1;
    NEW.updated_at=now();
  end if;
  insert into public.lg_audit(actor,entity,record_id,action)
    values(NEW.updated_by,TG_TABLE_NAME,NEW.id::text,
      case when TG_TABLE_NAME='lg_requests' then TG_OP||':'||(to_jsonb(NEW)->>'status') else TG_OP end);
  return NEW;
end $$;
create trigger lg_request_changes before insert or update on public.lg_requests for each row execute function public.lg_track_change();
create trigger lg_setting_changes before update on public.lg_settings for each row execute function public.lg_track_change();

create function public.lg_rate_limit(bucket_key text,max_hits integer) returns boolean language plpgsql security definer set search_path='' as $$
declare count_now integer;
begin
  delete from public.lg_rate_limits where expires_at < now()-interval '1 day';
  insert into public.lg_rate_limits as r(key,hits,expires_at) values(bucket_key,1,now()+interval '10 minutes')
    on conflict(key) do update set hits=case when r.expires_at<now() then 1 else r.hits+1 end,
    expires_at=case when r.expires_at<now() then now()+interval '10 minutes' else r.expires_at end
    returning hits into count_now;
  return count_now<=max_hits;
end $$;
revoke all on function public.lg_rate_limit(text,integer) from public,anon,authenticated;
grant execute on function public.lg_rate_limit(text,integer) to service_role;
revoke all on function public.lg_track_change() from public,anon,authenticated;
commit;
