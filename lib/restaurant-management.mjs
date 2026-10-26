import { menuData } from '../public/menu-data.js';
import { validateBooking, bookingGuestCount } from '../public/domain.js';
import { prepareBooking, BOOKING_ENDPOINT } from '../public/booking.js';
import { createRequestAuth } from './supabase-request.mjs';
import { normalizePhone } from '../public/phone.js';
import { createCustomerMailer } from './customer-email.mjs';

export const STAFF_EMAIL = 'ayush.giri2006@gmail.com';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const days = ['Tisdag','Onsdag','Torsdag','Fredag'];
const states = {booking:['new','confirmed','declined','cancelled','completed'],order:['new','confirmed','preparing','ready','completed','declined','cancelled']};
const fail = (status, message) => Object.assign(new Error(message), {status});
const json = (data, status = 200, headers = {}) => Response.json(data, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow',...headers}});
const text = (value, max, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw fail(400,'Kontrollera att alla uppgifter är korrekt ifyllda.');
  return value.trim();
};
const only = (value, keys) => { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k=>!keys.includes(k))) throw fail(400,'Ogiltiga fält.'); };
export function validateSettings(input) {
  only(input,['notice','lunch','catalog','ordering']);
  const notice = text(input.notice,1000);
  if (typeof input.ordering !== 'boolean') throw fail(400,'Välj om beställningar ska vara öppna.');
  only(input.lunch,days);
  const lunch = Object.fromEntries(days.map(day=>[day,text(input.lunch[day] ?? '',3000)]));
  if (!Array.isArray(input.catalog) || input.catalog.length > menuData.items.length) throw fail(400,'Ogiltig beställningsmeny.');
  const seen = new Set();
  const catalog = input.catalog.map(item=>{
    only(item,['id','price']);
    if (!menuData.items.some(d=>d.id===item.id) || seen.has(item.id) || !Number.isSafeInteger(item.price) || item.price < 100 || item.price > 500000) throw fail(400,'Kontrollera rätter och priser.');
    seen.add(item.id); return {id:item.id,price:item.price};
  });
  if (input.ordering && !catalog.length) throw fail(400,'Välj minst en rätt och ett pris innan beställningar öppnas.');
  return {notice,lunch,catalog,ordering:input.ordering};
}
export function validateOrder(input, settings, now = new Date()) {
  only(input,['name','phone','email','date','time','message','items','total','website']);
  const name=text(input.name,100,true),phone=text(input.phone,50,true),email=text(input.email,150,true),message=text(input.message ?? '',800);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400,'Ange en giltig e-postadress.');
  const error=validateBooking({name,phone,email,date:input.date,time:input.time,guests:'1'},now);
  if(error) throw fail(400,error);
  if (input.website || !Array.isArray(input.items) || input.items.length<1 || input.items.length>30) throw fail(400,'Kontrollera beställningen.');
  const seen=new Set();
  const items=input.items.map(line=>{
    only(line,['id','quantity']);
    const price=settings.catalog.find(x=>x.id===line.id)?.price, dish=menuData.items.find(x=>x.id===line.id);
    if(!dish || !price || seen.has(line.id) || !Number.isInteger(line.quantity) || line.quantity<1 || line.quantity>60) throw fail(400,'En rätt eller ett antal är inte tillgängligt. Ladda om menyn.');
    seen.add(line.id);return {id:dish.id,name:dish.name,quantity:line.quantity,price};
  });
  if(items.reduce((n,x)=>n+x.quantity,0)>100) throw fail(400,'Ring oss för beställningar över 100 portioner.');
  const total=items.reduce((n,x)=>n+x.price*x.quantity,0);
  if(input.total!==total) throw fail(409,'Priserna har ändrats. Ladda om menyn och granska beställningen igen.');
  return {name,phone:normalizePhone(phone),email,date:input.date,time:input.time,message,items,total};
}
export function createManagementHandler({env,fetchImpl=fetch,now=()=>new Date()}={}) {
  env={...env,SUPABASE_URL:env?.SUPABASE_URL || env?.NEXT_PUBLIC_SUPABASE_URL,SUPABASE_ANON_KEY:env?.SUPABASE_ANON_KEY || env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,SUPABASE_SERVICE_ROLE_KEY:env?.SUPABASE_SECRET_KEY || env?.SUPABASE_SERVICE_ROLE_KEY};
  const staffEmail=(env.STAFF_EMAIL || STAFF_EMAIL).trim().toLowerCase();
  const configured=Boolean(env?.SUPABASE_URL && env?.SUPABASE_SERVICE_ROLE_KEY && env?.SUPABASE_ANON_KEY && uuid.test(env?.STAFF_USER_ID || '') && env?.PUBLIC_SITE_ORIGIN && env?.RATE_LIMIT_SECRET);
  const base=env?.SUPABASE_URL?.replace(/\/$/,'');
  async function remote(path, options={}, privileged=true) {
    const key=privileged?env.SUPABASE_SERVICE_ROLE_KEY:env.SUPABASE_ANON_KEY;
    const response=await fetchImpl(base+path,{...options,headers:{apikey:key,...(key.startsWith('eyJ')?{Authorization:`Bearer ${key}`} : {}),'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(12000)});
    if(!response.ok) throw fail(response.status===429?429:503,'Tjänsten kunde inte slutföra åtgärden. Försök senare eller ring restaurangen.');
    return response.status===204 ? null : response.json();
  }
  const db=(path,options)=>remote('/rest/v1/'+path,options);
  const customerMailer=createCustomerMailer({env,db,fetchImpl});
  async function staff(request,authSession) {
    const {data:{user},error}=await authSession.client.auth.getUser();
    if(error || !user) throw fail(401,'Logga in igen.');
    if(user.id!==env.STAFF_USER_ID || user.email?.toLowerCase()!==staffEmail || !user.email_confirmed_at) throw fail(403,'Du har inte behörighet till personalvyn.');
    return {id:user.id};
  }
  async function limit(request,action,max) {
    const ip=request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || 'unknown';
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(env.RATE_LIMIT_SECRET+'|'+ip.split(',')[0]+'|'+action));
    const key=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
    const allowed=await db('rpc/lg_rate_limit',{method:'POST',body:JSON.stringify({bucket_key:key,max_hits:max})});
    if(!allowed) throw fail(429,'För många försök. Vänta tio minuter eller ring oss.');
  }
  async function settings() {
    const rows=await db('lg_settings?id=eq.1&select=data,revision');
    if(!rows[0]) throw fail(503,'Inställningarna är inte klara.');
    return rows[0];
  }
  return async function handle(request) {
    const authSession=configured?createRequestAuth(request,env,fetchImpl):null;
    const reply=(...args)=>authSession?authSession.finish(json(...args)):json(...args);
    try {
      const action=new URL(request.url).searchParams.get('action') || 'config';
      if(request.method==='GET' && action==='config') {
        if(!configured) return reply({ready:false,ordering:false});
        const {data}=await settings();
        return reply({ready:true,ordering:data.ordering,customerEmails:customerMailer.enabled,notice:data.notice,lunch:data.lunch,catalog:data.catalog.map(x=>({...x,name:menuData.items.find(d=>d.id===x.id)?.name}))});
      }
      if(!configured) return reply({code:'not_configured',error:'Personalvyn är inte aktiverad ännu. Databas och inloggning behöver anslutas.'},503);
      const mutating=request.method!=='GET';
      if(mutating && (request.headers.get('origin')!==env.PUBLIC_SITE_ORIGIN || !request.headers.get('content-type')?.startsWith('application/json'))) throw fail(403,'Åtgärden måste göras från restaurangens hemsida.');
      let body={};
      if(mutating) {
        if(Number(request.headers.get('content-length') || 0)>40000) throw fail(413,'För mycket information.');
        const raw=await request.text(); if(raw.length>40000) throw fail(413,'För mycket information.');
        try {body=JSON.parse(raw);} catch {throw fail(400,'Ogiltigt format.');}
      }
      if(action==='login' && request.method==='POST') {
        await limit(request,'login',4);if(typeof body.email!=='string'||body.email.trim().toLowerCase()!==staffEmail)throw fail(401,'Inloggningen misslyckades. Kontrollera uppgifterna.');
        const {error}=await authSession.client.auth.signInWithOtp({email:staffEmail,options:{shouldCreateUser:false}});
        if(error) throw fail(error.status===429?429:503,'Koden kunde inte skickas. Kontakta webbansvarig.');
        return reply({message:'En engångskod har begärts till din e-postadress.'});
      }
      if(action==='password' && request.method==='POST') {
        await limit(request,'password',5);
        only(body,['email','password']);text(body.password,256,true);if(typeof body.email!=='string'||body.email.trim().toLowerCase()!==staffEmail)throw fail(401,'Inloggningen misslyckades. Kontrollera uppgifterna.');
        const {data,error}=await authSession.client.auth.signInWithPassword({email:staffEmail,password:body.password});
        if(error || !data.session) throw fail(401,'Inloggningen misslyckades. Kontrollera lösenordet.');
        if(data.user?.id!==env.STAFF_USER_ID || data.user?.email?.toLowerCase()!==staffEmail || !data.user?.email_confirmed_at) {
          await authSession.client.auth.signOut({scope:'local'});throw fail(403,'Kontot har inte behörighet.');
        }
        return reply({ok:true});
      }
      if(action==='verify' && request.method==='POST') {
        await limit(request,'verify',10);
        if(!/^\d{6,10}$/.test(body.code || '')) throw fail(400,'Ange koden från mejlet.');
        const {data,error}=await authSession.client.auth.verifyOtp({type:'email',email:staffEmail,token:body.code});
        if(error || !data.session) throw fail(401,'Koden är felaktig eller har gått ut. Begär en ny kod.');
        if(data.user?.id!==env.STAFF_USER_ID || data.user?.email?.toLowerCase()!==staffEmail || !data.user?.email_confirmed_at) {
          await authSession.client.auth.signOut({scope:'local'});
          throw fail(403,'Kontot har inte behörighet.');
        }
        return reply({ok:true});
      }
      if(action==='logout' && request.method==='POST') {
        const {error}=await authSession.client.auth.signOut({scope:'local'});
        if(error) throw fail(503,'Utloggningen kunde inte bekräftas. Försök igen.');
        return reply({ok:true});
      }
      if(['book','order','staff-book','staff-order'].includes(action) && request.method==='POST') {
        const manual=action.startsWith('staff-'),auth=manual?await staff(request,authSession):null;
        if(!manual) await limit(request,'submit',6);
        only(body,['id','values']); if(!uuid.test(body.id || '')) throw fail(400,'Ogiltigt förfrågningsnummer.');
        const kind=action.endsWith('book')?'booking':'order';
        const config=await settings();
        let data;
        if(kind==='order') {
          if(!manual && !config.data.ordering) throw fail(409,'Beställningar är tillfälligt stängda. Ring oss.');
          data=validateOrder(body.values,config.data,now());
        } else {
          only(body.values,['name','phone','email','date','time','guests','groupSize','occasion','flexibleTime','message','website']);
          for(const key of ['name','phone','email','date','time','guests']) text(body.values[key],150,true);
          for(const key of ['groupSize','occasion','flexibleTime','message','website']) if(body.values[key]!==undefined) text(body.values[key],800);
          const error=validateBooking(body.values,now()); if(error || body.values.website) throw fail(400,error || 'Förfrågan kunde inte skickas.');
          data={...body.values,phone:normalizePhone(body.values.phone),guests:bookingGuestCount(body.values)}; delete data.website;
        }
        const records=await db('lg_requests?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({id:body.id,kind,data,status:'new',source:manual?'staff':'website',updated_by:auth?.id || null})});
        const customerEmailPromise=records.length ? customerMailer.send(body.id,'received') : Promise.resolve('unchanged');
        // Persist first; notification failure must never erase or duplicate a request.
        if(records.length && kind==='booking') {
          let emailStatus='failed';
          try {
            const response=await fetchImpl(BOOKING_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({...prepareBooking(body.values).payload,_url:env.PUBLIC_SITE_ORIGIN}),signal:AbortSignal.timeout(7000)});
            const delivery=await response.json(); if(response.ok && (delivery.success===true || delivery.success==='true')) emailStatus='accepted';
          } catch { /* Staff can always see the persisted booking. */ }
          try { await db(`lg_requests?id=eq.${body.id}`,{method:'PATCH',body:JSON.stringify({email_status:emailStatus})}); } catch { /* Keep uncertain delivery marked in the dashboard. */ }
        }
        const customerEmail=await customerEmailPromise;
        return reply({ok:true,id:body.id,customerEmail,message:'Förfrågan är mottagen. Restaurangen behöver bekräfta den.'},201);
      }
      const auth=await staff(request,authSession);
      if(action==='session' && request.method==='GET') return reply({email:staffEmail});
      if(action==='requests' && request.method==='GET') {
        const params=new URL(request.url).searchParams,kind=params.get('kind');
        if(!states[kind]) throw fail(400,'Ogiltig vy.');
        const offset=Number(params.get('offset') || 0); if(!Number.isInteger(offset)||offset<0||offset>100000) throw fail(400,'Ogiltig sida.');
        const rows=await db(`lg_requests?kind=eq.${kind}&select=*&order=created_at.desc&limit=50&offset=${offset}`);
        return reply({rows,customerMail:await customerMailer.summary(rows.map(row=>row.id))});
      }
      if(action==='status' && request.method==='POST') {
        only(body,['id','status','revision']);
        if(!uuid.test(body.id || '') || !Number.isInteger(body.revision)) throw fail(400,'Ogiltig förfrågan.');
        const rows=await db(`lg_requests?id=eq.${body.id}&select=kind,revision,status`);
        if(!rows[0]) throw fail(404,'Förfrågan hittades inte.');
        if(!states[rows[0].kind].includes(body.status)) throw fail(400,'Ogiltig status.');
        if(rows[0].revision!==body.revision) throw fail(409,'Uppgifterna har ändrats. Uppdatera listan först.');
        if(rows[0].status===body.status) return reply({ok:true,customerEmail:'unchanged'});
        const updated=await db(`lg_requests?id=eq.${body.id}&revision=eq.${body.revision}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:body.status,updated_by:auth.id})});
        if(!updated.length) throw fail(409,'Uppgifterna har ändrats. Uppdatera listan först.');
        const customerEmail=body.status==='confirmed' ? await customerMailer.send(body.id,'confirmed') : 'unchanged';
        return reply({ok:true,customerEmail});
      }
      if(action==='retry-customer-email' && request.method==='POST') {
        only(body,['id']);if(!uuid.test(body.id || ''))throw fail(400,'Ogiltig förfrågan.');
        if(!customerMailer.enabled)throw fail(503,'Kundmejl är inte aktiverade ännu.');
        await limit(request,'email-retry',10);
        return reply({ok:true,customerEmail:await customerMailer.send(body.id)});
      }
      if(action==='settings' && request.method==='GET') return reply({...await settings(),menu:menuData.items.map(x=>({id:x.id,name:x.name,price:x.price*100}))});
      if(action==='settings' && request.method==='POST') {
        only(body,['data','revision']); if(!Number.isInteger(body.revision)) throw fail(400,'Ogiltig version.');
        const data=validateSettings(body.data);
        const updated=await db(`lg_settings?id=eq.1&revision=eq.${body.revision}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({data,updated_by:auth.id})});
        if(!updated.length) throw fail(409,'Informationen har ändrats. Ladda om innan du sparar.');
        return reply({ok:true});
      }
      if(action==='activity' && request.method==='GET') return reply({rows:await db('lg_audit?select=*&order=created_at.desc&limit=50')});
      throw fail(404,'Åtgärden finns inte.');
    } catch(error) { return reply({error:error.status?error.message:'Tjänsten kunde inte nås. Försök senare eller ring restaurangen.'},error.status || 503); }
  };
}
