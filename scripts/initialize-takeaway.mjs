// One-time activation authorized by the owner on 2026-10-26:
// food menu prices, pickup, payment at the restaurant. Never overwrite staff edits.
import { menuData } from '../public/menu-data.js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url || !key){console.log('Takeaway initialization skipped: server configuration is absent.');process.exit(0);}
const headers={apikey:key,...(key.startsWith('eyJ')?{Authorization:`Bearer ${key}`} : {}),'Content-Type':'application/json'};
const endpoint=url.replace(/\/$/,'')+'/rest/v1/lg_settings';
const read=await fetch(endpoint+'?id=eq.1&select=data,revision',{headers,signal:AbortSignal.timeout(15000)});
if(!read.ok)throw Error('Takeaway configuration could not be read; no changes made.');
const [current]=await read.json();
if(!current)throw Error('Restaurant schema has not been initialized.');
if(current.revision!==1 || current.data.ordering || current.data.catalog.length){
 console.log('Takeaway settings already managed; preserving them.');
}else{
 const catalog=menuData.items.map(item=>({id:item.id,price:Math.round(item.price*100)}));
 const response=await fetch(endpoint+'?id=eq.1&revision=eq.1',{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({data:{...current.data,catalog,ordering:true},updated_by:process.env.STAFF_USER_ID}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Takeaway initialization failed.');
 const updated=await response.json();
 console.log(updated.length?`Takeaway initialized with ${catalog.length} food dishes at menu prices.`:'Concurrent staff edit preserved; initialization skipped.');
}
