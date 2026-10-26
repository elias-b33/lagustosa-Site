import test from 'node:test';
import assert from 'node:assert/strict';
import {createCustomerMailer,customerMessage,customerEmailEnabled} from '../lib/customer-email.mjs';
const env={RESEND_API_KEY:'re_test',CUSTOMER_EMAIL_FROM:'La Gustosa <bokning@example.com>'};
const mail={id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',request_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',kind:'booking',event:'received',data:{name:'Testgäst',email:'test@example.com',date:'2026-10-27',time:'18:00',guests:2}};
test('No account configuration sends nothing and exposes no secret',async()=>{
 const no=()=>{throw Error('No network allowed');};
 const sender=createCustomerMailer({env:{},db:no,fetchImpl:no});
 assert.equal(await sender.send(mail.request_id),'disabled');
 assert.deepEqual(await sender.summary([mail.request_id]),{enabled:false,ready:false,rows:[]});
 assert.equal(customerEmailEnabled({...env,CUSTOMER_EMAIL_FROM:'bad\r\nBcc: victim@example.com'}),false);
});
test('Receipt and confirmation accurately describe booking and pay-on-pickup orders',()=>{
 const received=customerMessage(mail);assert.match(received.text,/ännu inte bekräftad/);assert.match(received.text,/2 gäster/);
 const confirmed=customerMessage({...mail,event:'confirmed'});assert.match(confirmed.subject,/bordsbokning är bekräftad/);assert.doesNotMatch(confirmed.text,/ännu inte bekräftad/);
 const order=customerMessage({...mail,kind:'order',event:'confirmed',data:{...mail.data,items:[{name:'Pizza',price:19900,quantity:2}],total:39800}});
 assert.match(order.text,/betalar på plats/);assert.match(order.text,/2 × Pizza/);assert.match(order.text,/398/);
});
test('Payload is persisted before sending and retries reuse the same key and exact payload',async()=>{
 let stored=null;const sent=[],events=[];
 const db=async(path,options)=>{if(path.startsWith('rpc/'))return [{...mail,payload:stored}];const patch=JSON.parse(options.body);events.push(patch);if(patch.payload)stored=patch.payload;return null;};
 const fetchImpl=async(url,options)=>{assert.ok(stored);assert.equal(url,'https://api.resend.com/emails');sent.push(options);return Response.json({id:'email-1'});};
 assert.equal(await createCustomerMailer({env,db,fetchImpl}).send(mail.request_id),'accepted');
 assert.equal(await createCustomerMailer({env:{...env,CUSTOMER_EMAIL_FROM:'Changed <other@example.com>'},db,fetchImpl}).send(mail.request_id),'accepted');
 assert.equal(sent[0].headers['Idempotency-Key'],sent[1].headers['Idempotency-Key']);assert.equal(sent[0].body,sent[1].body);
 assert.equal(events.at(-1).state,'accepted');assert.equal(events.at(-1).provider_id,'email-1');
});
test('Network ambiguity and rejected mail never masquerade as sent',async()=>{
 for(const [fetchImpl,expected] of [[async()=>{throw Error('timeout');},'uncertain'],[async()=>Response.json({message:'quota'}, {status:429}),'failed'],[async()=>Response.json({message:'down'}, {status:503}),'uncertain']]){
  let state;const db=async(path,options)=>path.startsWith('rpc/')?[mail]:(state=JSON.parse(options.body).state,null);
  assert.equal(await createCustomerMailer({env,db,fetchImpl}).send(mail.request_id),expected);assert.equal(state,expected);
 }
});
test('Unclaimed or unconfigured database records cannot trigger a send',async()=>{
 const fetchImpl=()=>{throw Error('Must not send');};
 assert.equal(await createCustomerMailer({env,db:async()=>[],fetchImpl}).send(mail.request_id),'unchanged');
 const sender=createCustomerMailer({env,db:async()=>{throw Error('migration missing');},fetchImpl});
 assert.equal(await sender.send(mail.request_id),'setup_required');assert.equal((await sender.summary([mail.request_id])).ready,false);
});
test('Unable to persist the frozen payload prevents sending',async()=>{
 let sends=0;const db=async(path)=>{if(path.startsWith('rpc/'))return [mail];throw Error('database down');};
 assert.equal(await createCustomerMailer({env,db,fetchImpl:async()=>{sends++;}}).send(mail.request_id),'uncertain');assert.equal(sends,0);
});
