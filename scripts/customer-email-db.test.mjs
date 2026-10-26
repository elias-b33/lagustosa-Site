import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('Private transactional outbox queues once, locks claims and suppresses obsolete or expired mail',async()=>{
 const db=new PGlite();
 try {
  await db.exec('create role anon;create role authenticated;create role service_role;');
  await db.exec(await readFile(new URL('../supabase/001_restaurant.sql',import.meta.url),'utf8'));
  const oldId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  await db.query("insert into lg_requests(id,kind,data,source) values($1,'booking','{}','website')",[oldId]);
  await db.exec(await readFile(new URL('../supabase/002_customer_email.sql',import.meta.url),'utf8'));
  assert.equal((await db.query('select * from lg_customer_mail')).rows.length,0,'No retroactive emails');
  for(const role of ['anon','authenticated']){
   const {rows}=await db.query("select has_table_privilege($1,'public.lg_customer_mail','SELECT') as readable,has_function_privilege($1,'public.lg_claim_customer_mail(uuid,text)','EXECUTE') as executable",[role]);
   assert.equal(rows[0].readable,false);assert.equal(rows[0].executable,false);
  }
  await db.query("insert into lg_requests(id,kind,data,source) values($1,'booking','{}','website')",[id]);
  await db.query("insert into lg_requests(id,kind,data,source) values($1,'booking','{}','website') on conflict do nothing",[id]);
  assert.equal((await db.query('select * from lg_customer_mail')).rows.length,1);
  const claim=()=>db.query('select * from lg_claim_customer_mail($1,null)',[id]);
  const first=await claim();assert.equal(first.rows.length,1);assert.equal(first.rows[0].event,'received');
  assert.equal((await claim()).rows.length,0,'Already sending cannot be claimed twice');
  await db.query("update lg_customer_mail set state='uncertain',last_attempt_at=now()-interval '11 seconds' where request_id=$1",[id]);
  assert.equal((await claim()).rows[0].id,first.rows[0].id,'Retry keeps idempotency key');
  await db.query("update lg_customer_mail set state='accepted' where request_id=$1",[id]);
  assert.equal((await claim()).rows.length,0,'Accepted email never sent again');
  await db.query("update lg_requests set status='confirmed' where id=$1",[id]);
  await db.query("update lg_requests set status='confirmed' where id=$1",[id]);
  assert.equal((await db.query("select * from lg_customer_mail where event='confirmed'")).rows.length,1,'No duplicate confirmation for same status');
  await db.query("update lg_requests set status='cancelled' where id=$1",[id]);
  assert.equal((await claim()).rows.length,0,'Cancelled confirmation cannot be sent later');
  assert.equal((await db.query("select state from lg_customer_mail where event='confirmed'")).rows[0].state,'superseded');
  await db.query("update lg_requests set status='confirmed' where id=$1",[id]);
  await db.query("update lg_customer_mail set created_at=now()-interval '24 hours' where state='pending'");
  assert.equal((await claim()).rows.length,0,'Stale mail requires manual review');
  assert.equal((await db.query("select state from lg_customer_mail order by request_revision desc limit 1")).rows[0].state,'review');
 } finally {await db.close();}
});
