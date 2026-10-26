import { bookingTimes, stockholmDate } from './domain.js';
import { escapeHtml as esc } from './menu-content.js';

export const money = cents => new Intl.NumberFormat('sv-SE',{style:'currency',currency:'SEK',maximumFractionDigits:2}).format(cents/100);
export async function api(action,body) {
  const [name,...query]=action.split('&');
  let response;
  try { response=await fetch('/api/restaurant?action='+encodeURIComponent(name)+(query.length?'&'+query.join('&'):''),{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)}); }
  catch { throw Object.assign(new Error('Vi kunde inte bekräfta om uppgifterna sparades. Ring restaurangen innan du skickar igen.'),{uncertain:true}); }
  if(!response.headers.get('content-type')?.includes('application/json')) throw Object.assign(new Error('Tjänsten är inte aktiverad här ännu.'),{status:response.status,unavailable:true});
  const result=await response.json();
  if(!response.ok) throw Object.assign(new Error(result.error || 'Åtgärden kunde inte slutföras.'),{status:response.status,code:result.code});
  return result;
}
export function wireDate(form) {
  const date=form.elements.date,time=form.elements.time;
  const max=new Date(); max.setUTCDate(max.getUTCDate()+180);
  date.min=stockholmDate();date.max=stockholmDate(max);
  const update=()=>{time.innerHTML='<option value="">Välj tid</option>'+bookingTimes(date.value).map(t=>`<option>${t}</option>`).join('');};
  date.addEventListener('change',update); update();
}
export const contactFields = `<div class="service-fields"><label>Namn<input name="name" required maxlength="100" autocomplete="name"></label><label>Telefon<input name="phone" type="tel" required maxlength="30" autocomplete="tel"></label><label>E-post<input name="email" type="email" required maxlength="150" autocomplete="email"></label><label>Datum<input name="date" type="date" required></label><label>Önskad tid<select name="time" required></select></label></div><label>Önskemål<textarea name="message" maxlength="800" rows="3"></textarea></label><p class="service-note">Vid allergi, ring oss så att personalen kan hjälpa dig.</p>`;

export function mountOrder(container,catalog,{manual=false,onSaved=()=>{}}={}) {
  let draft=null,requestId=crypto.randomUUID();
  container.innerHTML=`<form class="service-form"><p>Välj mat för avhämtning. Betalning sker på plats. Vi behöver bekräfta beställningen och hämtningstiden.</p><div class="order-lines">${catalog.map(x=>`<label class="order-line"><span>${esc(x.name)}<small>${money(x.price)}</small></span><input aria-label="Antal ${esc(x.name)}" data-dish="${esc(x.id)}" type="number" min="0" max="60" value="0" inputmode="numeric"></label>`).join('')}</div><p class="order-total" aria-live="polite">Summa: <strong>0 kr</strong></p>${contactFields}<div class="service-honey" aria-hidden="true"><label>Webbplats<input name="website" tabindex="-1" autocomplete="off"></label></div><label class="service-check"><input type="checkbox" required>Jag förstår att restaurangen behöver bekräfta förfrågan.</label><p class="service-note">Dina kontaktuppgifter och beställningen sparas hos restaurangen för att hantera din förfrågan.</p><button class="button button-wine">Granska beställningen</button></form><section class="order-review" hidden><h2 tabindex="-1">Granska beställningen</h2><pre></pre><p>Betalning på plats. Vänta på restaurangens bekräftelse innan du hämtar maten.</p><button class="button button-wine" data-send>${manual?'Registrera beställning':'Skicka beställningsförfrågan'}</button> <button class="text-link" data-back>Ändra</button></section><p role="status" class="service-result"></p>`;
  const form=container.querySelector('form'),review=container.querySelector('.order-review'),result=container.querySelector('.service-result');
  wireDate(form);
  const lines=()=>[...form.querySelectorAll('[data-dish]')].filter(x=>Number(x.value)>0).map(x=>({id:x.dataset.dish,quantity:Number(x.value)}));
  const total=items=>items.reduce((n,x)=>n+catalog.find(d=>d.id===x.id).price*x.quantity,0);
  form.addEventListener('input',()=>{form.querySelector('.order-total strong').textContent=money(total(lines()));});
  form.addEventListener('submit',event=>{
    event.preventDefault();const items=lines();
    if(!items.length){result.textContent='Välj minst en rätt.';return;}
    if(items.reduce((n,x)=>n+x.quantity,0)>100){result.textContent='Ring oss för beställningar över 100 portioner.';return;}
    requestId=crypto.randomUUID();
    draft={...Object.fromEntries(new FormData(form)),items,total:total(items)};
    review.querySelector('pre').textContent=items.map(x=>`${x.quantity} × ${catalog.find(d=>d.id===x.id).name} — ${money(x.quantity*catalog.find(d=>d.id===x.id).price)}`).join('\n')+`\n\nSumma: ${money(draft.total)}\nBetalas på plats\n\n${draft.date} kl. ${draft.time}\n${draft.name}\n${draft.phone}\n${draft.email}\n${draft.message}`;
    result.textContent='';form.hidden=true;review.hidden=false;review.querySelector('h2').focus();
  });
  review.querySelector('[data-back]').addEventListener('click',()=>{review.hidden=true;form.hidden=false;form.querySelector('input').focus();});
  review.querySelector('[data-send]').addEventListener('click',async()=>{
    const send=review.querySelector('[data-send]'),back=review.querySelector('[data-back]');send.disabled=true;back.disabled=true;result.textContent='Skickar…';
    try {const receipt=await api(manual?'staff-order':'order',{id:requestId,values:draft});review.hidden=true;result.textContent=`Förfrågan mottagen. Nummer ${receipt.id.slice(0,8).toUpperCase()}. ${manual?'Kontakta gästen för att bekräfta beställningen.':'Vänta på restaurangens bekräftelse via telefon eller e-post. Betalning sker på plats.'}`;onSaved(receipt);}
    catch(error){result.textContent=error.message;if(!error.uncertain)send.disabled=false;}
    finally {back.disabled=false;}
  });
}
