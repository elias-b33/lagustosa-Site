import {api,mountOrder,money,wireDate,contactFields} from '../management-client.js';
import {escapeHtml as esc} from '../menu-content.js';
const $=s=>document.querySelector(s), message=$('#staff-message'),content=$('#staff-content');
const labels={new:'Ny förfrågan',confirmed:'Bekräftad',preparing:'Tillagas',ready:'Klar för hämtning',completed:'Avslutad',declined:'Nekad',cancelled:'Avbokad'};
let view='booking',offset=0,rows=[],settings=null,customerMail={enabled:false,ready:false,rows:[]};
const mailLabels={pending:'Väntar på utskick',sending:'Utskick pågår',accepted:'Lämnat till mejltjänsten',failed:'Kunde inte skickas',uncertain:'Utskicket kunde inte bekräftas',review:'Kontakta gästen manuellt',superseded:'Ersatt av ett senare besked'};
function mailResult(state){return state==='accepted'?'Kundmejlet har lämnats till mejltjänsten.':state==='disabled'?'Kundmejl är inte aktiverade. Kontakta gästen.':state==='unchanged'?'Inget nytt mejl skickades. Kontrollera mejlstatusen nedan.':'Kundmejlet kunde inte bekräftas. Kontrollera mejlstatusen eller kontakta gästen.';}
function mailHistory(row){
  if(!customerMail.enabled||!customerMail.ready)return '';
  const history=customerMail.rows.filter(m=>m.request_id===row.id);
  const latest=history[0];
  return '<div class="customer-mail-state">'+(history.length?history.map(m=>`<p>${m.event==='received'?'Mottagningsmejl':'Bekräftelsemejl'}: ${esc(mailLabels[m.state]||'Okänd status')}</p>`).join(''):'<p>Ingen automatisk mejlhistorik för denna förfrågan.</p>')+(latest&&['pending','failed','uncertain','sending'].includes(latest.state)?`<button type="button" class="text-link" data-retry-mail="${row.id}">Försök skicka kundmejlet igen</button>`:'')+'</div>';
}
function signedOut(){ $('#workspace').hidden=true;$('#logout').hidden=true;$('#login-panel').hidden=false;content.replaceChildren();$('#staff-dialog-body').replaceChildren();$('#staff-dialog').close();rows=[];settings=null; }
function errorText(error){message.textContent=error.message;if(error.status===401||error.status===403)signedOut();}
async function action(button,work){button.disabled=true;message.textContent='';try{await work();}catch(error){errorText(error);}finally{button.disabled=false;}}
$('#password-form').addEventListener('submit',event=>{event.preventDefault();const password=event.target.elements.password.value,email=event.target.elements.email.value;event.target.elements.password.value='';action(event.target.querySelector('button'),async()=>{await api('password',{email,password});await start();});});
$('#request-code').addEventListener('click',event=>action(event.target,async()=>{const result=await api('login',{email:$('#password-form').elements.email.value});message.textContent=result.message;$('#verify-form').hidden=false;$('#verify-form input').focus();}));
$('#verify-form').addEventListener('submit',event=>{event.preventDefault();action(event.target.querySelector('button'),async()=>{await api('verify',{code:event.target.elements.code.value});event.target.reset();await start();});});
$('#logout').addEventListener('click',event=>action(event.target,async()=>{await api('logout',{});signedOut();message.textContent='Du är utloggad från den här vyn.';}));
async function start(){await api('session');$('#login-panel').hidden=true;$('#workspace').hidden=false;$('#logout').hidden=false;message.textContent='';await load();}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.view;offset=0;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-current',b===button?'page':'false'));load().catch(errorText);}));
$('#refresh').addEventListener('click',event=>action(event.target,load));
const dialog=$('#staff-dialog');dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
async function load(){
  content.setAttribute('aria-busy','true');
  try{
    if(view==='settings'){settings=await api('settings');renderSettings();return;}
    if(view==='activity'){const data=await api('activity');content.innerHTML='<h2>Senaste ändringar</h2>'+ (data.rows.length?'<ul class="activity-list">'+data.rows.map(x=>`<li><time>${esc(new Date(x.created_at).toLocaleString('sv-SE'))}</time> ${esc(x.entity==='lg_settings'?'Information & meny':x.action.split(':')[0]==='INSERT'?'Ny förfrågan':'Uppdaterad förfrågan')} — ${esc(labels[x.action.split(':')[1]]||'sparad')}</li>`).join('')+'</ul>':'<p>Inga ändringar finns ännu.</p>');return;}
    const data=await api('requests&kind='+view+'&offset='+offset);rows=data.rows;customerMail=data.customerMail||{enabled:false,ready:false,rows:[]};
    content.innerHTML=`<div class="staff-heading"><h2>${view==='booking'?'Bordsbokningar':'Takeaway'}</h2><button class="button button-wine" id="manual-new">${view==='booking'?'Lägg in bokning':'Lägg in beställning'}</button></div><p class="service-note">${customerMail.enabled&&customerMail.ready?'Nya förfrågningar får ett mottagningsmejl. Välj Bekräftad för att godkänna datum och tid och skicka bekräftelsemejl. Vid andra statusändringar behöver du kontakta gästen själv.':customerMail.enabled?'Kundmejl behöver slutföras i databasen. Kontakta gästen via telefon eller e-post tills mejlstatus visas här.':'Automatiska kundmejl är inte aktiverade ännu. Kontakta gästen via telefon eller e-post för att bekräfta.'}</p><label class="staff-filter">Visa <select id="status-filter"><option value="all">Alla statusar</option><option value="active">Pågående</option><option value="new">Nya förfrågningar</option></select></label><div id="request-list"></div><div class="staff-pagination"><button id="previous" ${offset===0?'disabled':''}>Föregående</button><span>${offset+1}–${offset+rows.length}</span><button id="next" ${rows.length<50?'disabled':''}>Nästa</button></div>`;
    renderRows();$('#status-filter').addEventListener('change',renderRows);$('#manual-new').addEventListener('click',()=>manual().catch(errorText));
    $('#previous').addEventListener('click',()=>{offset=Math.max(0,offset-50);load().catch(errorText);});$('#next').addEventListener('click',()=>{offset+=50;load().catch(errorText);});
  }finally{content.removeAttribute('aria-busy');}
}
function renderRows(){
  const filter=$('#status-filter').value,visible=rows.filter(x=>filter==='all'||filter==='new'&&x.status==='new'||filter==='active'&&['new','confirmed','preparing','ready'].includes(x.status));
  $('#request-list').innerHTML=visible.length?visible.map(row=>{
    const d=row.data,states=Object.keys(labels).filter(s=>row.kind==='order'||!['preparing','ready'].includes(s));
    return `<article class="request-row"><div class="request-heading"><h3>${esc(d.date)} <span>kl. ${esc(d.time)}</span></h3><span class="request-state">${labels[row.status]}</span></div><p><strong>${esc(d.name)}</strong> · ${row.kind==='booking'?esc(d.guests)+' gäster':money(d.total)+' · betalas på plats'} · ${row.source==='staff'?'Registrerad av personal':'Från hemsidan'}</p><p><a href="tel:${esc(d.phone.replace(/[^+0-9]/g,''))}">${esc(d.phone)}</a> · <a href="mailto:${esc(d.email)}">${esc(d.email)}</a></p>${d.items?'<ul>'+d.items.map(x=>`<li>${x.quantity} × ${esc(x.name)} — ${money(x.quantity*x.price)}</li>`).join('')+'</ul>':''}${d.occasion?'<p>Tillfälle: '+esc(d.occasion)+'</p>':''}${d.flexibleTime==='ja'?'<p>Flexibel med tiden</p>':''}${d.message?'<p class="request-notes">'+esc(d.message)+'</p>':''}${row.kind==='booking'&&row.email_status!=='accepted'?'<p class="service-note">Mejlnotisen är inte bekräftad. Förfrågan finns sparad här.</p>':''}${mailHistory(row)}<form data-status="${row.id}"><label>Status<select name="status">${states.map(s=>`<option value="${s}" ${s===row.status?'selected':''}>${labels[s]}</option>`).join('')}</select></label><button class="button button-wine">Spara status</button></form><small>Nr ${row.id.slice(0,8).toUpperCase()} · ${esc(new Date(row.created_at).toLocaleString('sv-SE'))}</small></article>`;
  }).join(''):'<p class="staff-empty">Inga förfrågningar i den här vyn.</p>';
  document.querySelectorAll('[data-status]').forEach(form=>form.addEventListener('submit',event=>{event.preventDefault();const row=rows.find(x=>x.id===form.dataset.status);action(form.querySelector('button'),async()=>{const result=await api('status',{id:row.id,status:form.elements.status.value,revision:row.revision});await load();message.textContent='Status sparad. '+(form.elements.status.value==='confirmed'?mailResult(result.customerEmail):'Kontakta gästen om beskedet behöver förmedlas.');});}));
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-retry-mail]');if(button)action(button,async()=>{const result=await api('retry-customer-email',{id:button.dataset.retryMail});await load();message.textContent=mailResult(result.customerEmail);});});
async function manual(){
  $('#staff-dialog-title').textContent=view==='booking'?'Lägg in bordsförfrågan':'Lägg in takeaway';
  const target=$('#staff-dialog-body');
  if(view==='order'){settings=await api('settings');const catalog=settings.data.catalog.map(x=>({...x,name:settings.menu.find(d=>d.id===x.id).name}));if(!catalog.length){message.textContent='Välj rätter och priser under Information & meny först.';return;}mountOrder(target,catalog,{manual:true,onSaved:()=>load().catch(errorText)});}
  else{
    target.innerHTML=`<form class="service-form">${contactFields}<label>Antal gäster<input type="number" name="guests" min="1" max="999" required value="2"></label><button class="button button-wine">Registrera förfrågan</button><p role="status"></p></form>`;
    const form=target.querySelector('form'),id=crypto.randomUUID();wireDate(form);
    form.addEventListener('submit',event=>{event.preventDefault();action(form.querySelector('button'),async()=>{await api('staff-book',{id,values:Object.fromEntries(new FormData(form))});dialog.close();await load();message.textContent='Bordsförfrågan registrerad.';});});
  }
  dialog.showModal();
}
function renderSettings(){
  const d=settings.data;
  content.innerHTML=`<h2>Information & meny</h2><p>Ändra aktuell information, veckolunch och rätter för avhämtning. Övrig webbdesign och systeminställningar hanteras separat.</p><form id="settings-form" class="service-form"><label>Aktuell information på hemsidan<textarea name="notice" maxlength="1000" rows="3">${esc(d.notice)}</textarea></label><h3>Veckans lunch</h3><p class="service-note">En rätt per rad. Lämna tomt för att använda sidans ursprungliga veckomeny.</p>${['Tisdag','Onsdag','Torsdag','Fredag'].map(day=>`<label>${day}<textarea name="lunch-${day}" maxlength="3000" rows="5">${esc(d.lunch[day]||'')}</textarea></label>`).join('')}<h3>Takeaway</h3><label class="service-check"><input type="checkbox" name="ordering" ${d.ordering?'checked':''}>Ta emot beställningsförfrågningar på hemsidan</label><p class="service-note">Välj vilka rätter som går att beställa och ange restaurangens avhämtningspris. Betalning på plats.</p><div class="catalog-editor">${settings.menu.map(item=>{const selected=d.catalog.find(x=>x.id===item.id);return `<div class="catalog-row"><label class="service-check"><input type="checkbox" data-catalog="${esc(item.id)}" ${selected?'checked':''}>${esc(item.name)}</label><label>Pris i kr<input type="number" min="1" max="5000" step="0.01" data-price="${esc(item.id)}" value="${((selected?.price ?? item.price)/100).toFixed(2)}"></label></div>`;}).join('')}</div><button class="button button-wine">Spara information & meny</button></form>`;
  $('#settings-form').addEventListener('submit',event=>{event.preventDefault();const form=event.target;action(form.querySelector('button'),async()=>{const values=new FormData(form),catalog=[...form.querySelectorAll('[data-catalog]:checked')].map(x=>({id:x.dataset.catalog,price:Math.round(Number([...form.querySelectorAll('[data-price]')].find(p=>p.dataset.price===x.dataset.catalog).value)*100)}));await api('settings',{revision:settings.revision,data:{notice:values.get('notice'),ordering:values.has('ordering'),lunch:Object.fromEntries(['Tisdag','Onsdag','Torsdag','Fredag'].map(day=>[day,values.get('lunch-'+day)])),catalog}});await load();message.textContent='Informationen är sparad och visas vid nästa sidladdning.';});});
}
start().catch(error=>{signedOut();if(error.status!==401)errorText(error);});
// Do not retain private records on a hidden tab after the session expires.
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('#workspace').hidden)api('session').catch(errorText);});
setInterval(()=>{if(!document.hidden&&!$('#workspace').hidden&&!dialog.open&&['booking','order'].includes(view)&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))load().catch(errorText);},30000);
