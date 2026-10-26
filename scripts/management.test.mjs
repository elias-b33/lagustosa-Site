import test from 'node:test';
import assert from 'node:assert/strict';
import {createManagementHandler,validateOrder,validateSettings,STAFF_EMAIL} from '../lib/restaurant-management.mjs';
import {menuData} from '../public/menu-data.js';
const env={NEXT_PUBLIC_SUPABASE_URL:'https://test.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test',STAFF_USER_ID:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',PUBLIC_SITE_ORIGIN:'https://restaurant.test',RATE_LIMIT_SECRET:'only-a-test-secret'};
const config={notice:'',lunch:{},ordering:true,catalog:[{id:menuData.items[0].id,price:19500}]};
const now=new Date('2026-10-26T10:00:00Z');
const values={name:'Testgäst',phone:'0700000000',email:'test@example.com',date:'2026-10-27',time:'18:00',message:'',items:[{id:menuData.items[0].id,quantity:2}],total:39000};
const id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function req(action,body,cookie){return new Request('https://restaurant.test/api/restaurant?action='+action,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json',origin:env.PUBLIC_SITE_ORIGIN}:{}),...(cookie?{cookie}: {})},body:body?JSON.stringify(body):undefined});}
const user={id:env.STAFF_USER_ID,email:STAFF_EMAIL,email_confirmed_at:'2026-10-26',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-10-26'};
const jwt='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:user.id,exp:4102444800})).toString('base64url')+'.test-signature';
const session={access_token:jwt,refresh_token:'test-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user};
const cookie='sb-test-auth-token=base64-'+Buffer.from(JSON.stringify(session)).toString('base64url');
function backend({authUser=user,allow=true,inserted=[]}={}){
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    const u=String(url);calls.push({url:u,options});
    if(u.endsWith('/auth/v1/user'))return Response.json(authUser);
    if(u.includes('/rpc/lg_rate_limit'))return Response.json(allow);
    if(u.includes('/lg_settings'))return Response.json([{data:config,revision:1}]);
    if(u.includes('/lg_requests?on_conflict')){const row=JSON.parse(options.body);if(inserted.some(x=>x.id===row.id))return Response.json([]);inserted.push(row);return Response.json([row]);}
    if(u.includes('/lg_requests'))return Response.json([]);
    throw new Error('Unexpected request: '+u);
  };
  return {handler:createManagementHandler({env,fetchImpl,now:()=>now}),calls,inserted};
}
test('No configuration leaves ordering disabled and does not pretend to save',async()=>{
 const handle=createManagementHandler({env:{},fetchImpl:()=>{throw Error('network forbidden');}});
 assert.deepEqual(await(await handle(req('config'))).json(),{ready:false,ordering:false});
 assert.equal((await handle(req('order',{id,values}))).status,503);
});
test('Anonymous and forged-cookie staff requests never read the database',async()=>{
 const b=backend();
 for(const action of ['session','requests&kind=booking','settings','activity']){
   assert.equal((await b.handler(req(action))).status,401);
   assert.equal((await b.handler(req(action,undefined,'sb-test-auth-token=forged'))).status,401);
 }
 assert.equal(b.calls.length,0);
});
test('Verified identity requires both the exact staff ID and confirmed email',async()=>{
 for(const authUser of [{...user,id:id},{...user,email:'another@example.com'},{...user,email_confirmed_at:null}]){
  const b=backend({authUser});assert.equal((await b.handler(req('settings',undefined,cookie))).status,403);
  assert.equal(b.calls.some(x=>x.url.includes('/rest/v1/')),false);
 }
 const b=backend();assert.equal((await b.handler(req('settings',undefined,cookie))).status,200);
 assert.equal(b.calls[0].url.endsWith('/auth/v1/user'),true);
});
test('Reject cross-origin mutations before touching the database',async()=>{
 const b=backend(),request=req('settings',{data:config,revision:1},cookie);request.headers.set('origin','https://attacker.test');
 assert.equal((await b.handler(request)).status,403);assert.equal(b.calls.length,0);
});
test('Prices are computed on server and disabled/unknown dishes are rejected',()=>{
 assert.equal(validateOrder(values,config,now).total,39000);
 assert.throws(()=>validateOrder({...values,total:1},config,now),e=>e.status===409);
 assert.throws(()=>validateOrder({...values,items:[{id:'unknown',quantity:1}]},config,now),e=>e.status===400);
 assert.throws(()=>validateOrder({...values,items:[{id:values.items[0].id,quantity:1.5}]},config,now),e=>e.status===400);
 assert.throws(()=>validateOrder({...values,items:[values.items[0],values.items[0]]},config,now),e=>e.status===400);
});
test('Retrying an order with its request ID stores only one record',async()=>{
 const b=backend();for(let n=0;n<2;n++)assert.equal((await b.handler(req('order',{id,values}))).status,201);
 assert.equal(b.inserted.length,1);assert.equal(b.inserted[0].status,'new');assert.equal(b.inserted[0].data.total,39000);
 assert.equal(b.calls.find(x=>x.url.includes('/rest/v1/')).options.headers.Authorization,undefined);
});
test('Rate limits block guest submissions and manual submissions require staff',async()=>{
 const b=backend({allow:false});assert.equal((await b.handler(req('order',{id,values}))).status,429);
 assert.equal((await b.handler(req('staff-order',{id,values}))).status,401);assert.equal(b.inserted.length,0);
});
test('Settings cannot contain system settings or arbitrary menu prices',()=>{
 assert.throws(()=>validateSettings({...config,staff:'intruder'}),e=>e.status===400);
 assert.throws(()=>validateSettings({...config,catalog:[]}),e=>e.status===400);
 assert.throws(()=>validateSettings({...config,catalog:[{id:menuData.items[0].id,price:-1}]}),e=>e.status===400);
 assert.equal(validateSettings(config).ordering,true);
});
test('OTP verification stores HttpOnly secure session cookies, never tokens in JSON',async()=>{
 const b=backend();const fetchImpl=async(url,options)=>String(url).endsWith('/auth/v1/verify')?Response.json({...session,user}):b.calls.push({url})&&Response.json(true);
 const handler=createManagementHandler({env,fetchImpl,now:()=>now});
 const response=await handler(req('verify',{code:'123456'}));assert.equal(response.status,200);
 const setCookie=response.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/Secure/);assert.match(setCookie,/SameSite=Strict/);
 assert.deepEqual(await response.json(),{ok:true});assert.match(response.headers.get('cache-control'),/no-store/);
});
test('Password login targets only Ayush and returns no credentials to JavaScript',async()=>{
 let login;
 const fetchImpl=async(url,options)=>{
  if(String(url).includes('/auth/v1/token')){login=JSON.parse(options.body);return Response.json(session);}
  return Response.json(true);
 };
 const response=await createManagementHandler({env,fetchImpl})(req('password',{email:STAFF_EMAIL,password:'test-password-only'}));
 assert.equal(response.status,200);assert.equal(login.email,STAFF_EMAIL);
 assert.deepEqual(await response.json(),{ok:true});assert.match(response.headers.get('set-cookie'),/HttpOnly/);
});
test('Expired sessions refresh on the API and emit new secure cookies',async()=>{
 const expired={...session,expires_at:1,access_token:'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:user.id,exp:1})).toString('base64url')+'.signature'};
 const stale='sb-test-auth-token=base64-'+Buffer.from(JSON.stringify(expired)).toString('base64url');
 let refreshed=false;
 const fetchImpl=async(url)=>{if(String(url).includes('/auth/v1/token')){refreshed=true;return Response.json(session);}if(String(url).endsWith('/auth/v1/user'))return Response.json(user);throw Error('Unexpected request');};
 const response=await createManagementHandler({env,fetchImpl})(req('session',undefined,stale));
 assert.equal(response.status,200);assert.equal(refreshed,true);assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.match(response.headers.get('cache-control'),/no-store/);
});
