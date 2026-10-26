-- Run once after 001_restaurant.sql. Existing requests are not emailed retroactively.
begin;
create table public.lg_customer_mail (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.lg_requests(id) on delete cascade,
  request_revision integer not null,
  kind text not null check (kind in ('booking','order')),
  event text not null check (event in ('received','confirmed')),
  data jsonb not null,
  payload jsonb,
  state text not null default 'pending' check (state in ('pending','sending','accepted','failed','uncertain','review','superseded')),
  provider_id text,
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  unique (request_id,request_revision,event)
);
create index lg_customer_mail_request on public.lg_customer_mail(request_id,created_at desc);
alter table public.lg_customer_mail enable row level security;
revoke all on public.lg_customer_mail from public,anon,authenticated;
grant all on public.lg_customer_mail to service_role;

create function public.lg_queue_customer_mail() returns trigger language plpgsql set search_path='' as $$
begin
  if TG_OP='INSERT' then
    insert into public.lg_customer_mail(request_id,request_revision,kind,event,data)
      values(NEW.id,NEW.revision,NEW.kind,'received',NEW.data);
  elsif NEW.status is distinct from OLD.status and NEW.status='confirmed' then
    insert into public.lg_customer_mail(request_id,request_revision,kind,event,data)
      values(NEW.id,NEW.revision,NEW.kind,'confirmed',NEW.data);
  end if;
  return NEW;
end $$;
create trigger lg_customer_email_queue after insert or update on public.lg_requests
  for each row execute function public.lg_queue_customer_mail();
revoke all on function public.lg_queue_customer_mail() from public,anon,authenticated;

-- Claim at most one message. Row locks stop simultaneous clicks from sending twice.
-- Never retry outside Resend's 24-hour idempotency window (use 23 hours for margin).
create function public.lg_claim_customer_mail(target_request uuid,target_event text default null)
returns setof public.lg_customer_mail language plpgsql security definer set search_path='' as $$
begin
  update public.lg_customer_mail m set state='superseded'
    from public.lg_requests r where m.request_id=target_request and r.id=m.request_id
      and m.state in ('pending','failed','uncertain')
      and ((m.event='received' and r.status<>'new') or
        (m.event='confirmed' and (r.status not in ('confirmed','preparing','ready','completed') or exists (
          select 1 from public.lg_customer_mail newer where newer.request_id=m.request_id
            and newer.event='confirmed' and newer.request_revision>m.request_revision))));
  update public.lg_customer_mail set state='review'
    where request_id=target_request and state in ('pending','failed','uncertain','sending')
      and (created_at<now()-interval '23 hours' or first_attempt_at<now()-interval '23 hours');
  return query
    with candidate as (
      select m.id from public.lg_customer_mail m join public.lg_requests r on r.id=m.request_id
      where m.request_id=target_request and (target_event is null or m.event=target_event)
        and (m.state in ('pending','failed','uncertain') or
          (m.state='sending' and m.last_attempt_at<now()-interval '1 minute'))
        and (m.last_attempt_at is null or m.last_attempt_at<now()-interval '10 seconds')
        and ((m.event='received' and r.status='new') or
          (m.event='confirmed' and r.status in ('confirmed','preparing','ready','completed') and not exists (
            select 1 from public.lg_customer_mail newer where newer.request_id=m.request_id
              and newer.event='confirmed' and newer.request_revision>m.request_revision)))
      order by m.created_at desc limit 1 for update of m skip locked
    )
    update public.lg_customer_mail m set state='sending',
      first_attempt_at=coalesce(m.first_attempt_at,now()),last_attempt_at=now()
      from candidate c where m.id=c.id returning m.*;
end $$;
revoke all on function public.lg_claim_customer_mail(uuid,text) from public,anon,authenticated;
grant execute on function public.lg_claim_customer_mail(uuid,text) to service_role;
commit;
