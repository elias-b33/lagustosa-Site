import { menuData } from './menu-data.js';
import { extraMenus } from './extra-menus.js';
import { stockholmDate, bookingTimes, validateBooking, normalize, localAnswer } from './domain.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const bookmark = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21l-7-5-7 5V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1z"></path></svg>';
const savedKey = 'lagustosa.saved.v1';
let saved = new Set();
try { const values = JSON.parse(localStorage.getItem(savedKey) || '[]'); if (Array.isArray(values)) saved = new Set(values.filter(id => menuData.items.some(item => item.id === id))); } catch { /* Private browsing or invalid saved data: use session memory. */ }
let category = new URLSearchParams(location.search).get('meny') || 'pasta';
if (!menuData.categories.some(c => c.id === category)) category = 'pasta';
let savedOnly = false;
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2500); }
function persistSaved() { try { localStorage.setItem(savedKey, JSON.stringify([...saved])); return true; } catch { return false; } }

$('#menu-tabs').innerHTML = menuData.categories.map(c => `<button role="tab" id="tab-${c.id}" data-category="${c.id}" aria-controls="menu-dishes" aria-selected="${c.id === category}" tabindex="${c.id === category ? 0 : -1}">${c.label}</button>`).join('');
function renderMenu() {
  const search = normalize($('#menu-search').value.trim());
  const selected = menuData.categories.find(c => c.id === category);
  const dishes = menuData.items.filter(item => (!savedOnly || saved.has(item.id)) && (search ? normalize(`${item.name} ${item.description}`).includes(search) : savedOnly || item.category === category));
  $$('#menu-tabs button').forEach(button => { button.setAttribute('aria-selected', String(button.dataset.category === category)); button.tabIndex = button.dataset.category === category ? 0 : -1; });
  $('#menu-category-note').textContent = search ? 'Sökresultat i hela menyn' : savedOnly ? 'Dina sparade rätter' : selected.note;
  $('#menu-result-count').textContent = `${dishes.length} ${dishes.length === 1 ? 'rätt' : 'rätter'}`;
  $('#saved-count').textContent = saved.size;
  $('#favorite-filter').setAttribute('aria-pressed', String(savedOnly));
  if (search || savedOnly) { $('#menu-dishes').removeAttribute('aria-labelledby'); $('#menu-dishes').setAttribute('aria-label', search ? 'Sökresultat i hela menyn' : 'Sparade rätter'); }
  else { $('#menu-dishes').setAttribute('aria-labelledby', `tab-${category}`); $('#menu-dishes').removeAttribute('aria-label'); }
  $('#menu-dishes').innerHTML = dishes.length ? dishes.map(item => `<article class="dish">${item.note ? `<span class="dish-tag">${escape(item.note)}</span>` : ''}<div class="dish-line"><h3>${escape(item.name)}</h3><span class="dish-price">${escape(item.priceLabel)}<span class="sr-only"> kronor</span></span></div><p>${escape(item.description)}</p><button class="dish-save" data-save="${item.id}" aria-label="${saved.has(item.id) ? 'Ta bort' : 'Spara'} ${escape(item.name)}${saved.has(item.id) ? ' från sparade rätter' : ''}" aria-pressed="${saved.has(item.id)}">${bookmark}</button></article>`).join('') : `<div class="menu-empty"><h3>${savedOnly ? 'Här samlas dina favoriter.' : 'Ingen rätt hittades.'}</h3><p>${savedOnly ? 'Spara en rätt med bokmärket bredvid priset.' : 'Prova ett annat sökord, som pasta, lax eller mozzarella.'}</p><button class="text-link" id="reset-menu">Visa menyn igen →</button></div>`;
}
function selectCategory(value, updateUrl = true) { category = value; savedOnly = false; $('#menu-search').value = ''; renderMenu(); if (updateUrl && location.protocol !== 'file:') { const url = new URL(location.href); url.searchParams.set('meny', category); history.replaceState(null, '', url); } }
$('#menu-tabs').addEventListener('click', event => { const button = event.target.closest('[data-category]'); if (button) selectCategory(button.dataset.category); });
function tabKeys(event, selector, activate) {
  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
  const tabs = $$(selector), index = tabs.indexOf(event.target); if (index < 0) return;
  event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus(); activate(tabs[next]);
}
$('#menu-tabs').addEventListener('keydown', event => tabKeys(event, '#menu-tabs button', button => selectCategory(button.dataset.category)));
$('#menu-search').addEventListener('input', renderMenu);
$('#favorite-filter').addEventListener('click', () => { savedOnly = !savedOnly; renderMenu(); });
$('#menu-dishes').addEventListener('click', event => {
  const save = event.target.closest('[data-save]');
  if (save) { const id = save.dataset.save; saved.has(id) ? saved.delete(id) : saved.add(id); const persisted = persistSaved(); renderMenu(); $(`[data-save="${id}"]`)?.focus({ preventScroll:true }); toast(saved.has(id) ? persisted ? 'Rätten är sparad i din webbläsare.' : 'Rätten är sparad under det här besöket.' : 'Rätten har tagits bort från dina favoriter.'); }
  if (event.target.closest('#reset-menu')) { savedOnly = false; $('#menu-search').value = ''; renderMenu(); }
});
renderMenu();

const mobileToggle = $('.mobile-toggle');
function closeMobile() { $('#mobile-nav').hidden = true; mobileToggle.setAttribute('aria-expanded', 'false'); mobileToggle.setAttribute('aria-label','Öppna navigeringen'); }
mobileToggle.addEventListener('click', () => { const opened = mobileToggle.getAttribute('aria-expanded') === 'true'; $('#mobile-nav').hidden = opened; mobileToggle.setAttribute('aria-expanded', String(!opened)); mobileToggle.setAttribute('aria-label', opened ? 'Öppna navigeringen' : 'Stäng navigeringen'); });
$('#mobile-nav').addEventListener('click', event => { if (event.target.closest('a,button')) closeMobile(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMobile(); });

function openDialog(dialog) { if (!dialog.open) dialog.showModal(); }
$$('dialog').forEach(dialog => { dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close()); dialog.addEventListener('click', event => { if (event.target !== dialog) return; const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); }); });
const booking = $('#booking-dialog');
function refreshTimes() { const date = $('#booking-date').value; const selected = $('#booking-time').value; const times = bookingTimes(date); $('#booking-time').innerHTML = '<option value="">Välj tid</option>' + times.map(time => `<option value="${time}">${time}</option>`).join(''); if (times.includes(selected)) $('#booking-time').value = selected; $('#booking-error').textContent = date && new Date(`${date}T12:00:00Z`).getUTCDay() === 1 ? 'Vi har stängt på måndagar. Välj gärna en annan dag.' : date && !times.length ? 'För detta datum, ring oss på 072-993 99 93 eller välj en annan dag.' : ''; }
function openBooking() { closeMobile(); if ($('#assistant-dialog').open) $('#assistant-dialog').close(); const now = new Date(), max = new Date(now); max.setUTCDate(max.getUTCDate()+180); $('#booking-date').min = stockholmDate(now); $('#booking-date').max = stockholmDate(max); if ($('#booking-date').value) refreshTimes(); openDialog(booking); }
$$('[data-book]').forEach(button => button.addEventListener('click', openBooking));
$('#booking-date').addEventListener('change', refreshTimes);
$('#booking-form').addEventListener('submit', event => {
  event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); const error = validateBooking(values); if (error) { $('#booking-error').textContent = error; return; }
  const dateLabel = new Intl.DateTimeFormat('sv-SE',{dateStyle:'full',timeZone:'UTC'}).format(new Date(`${values.date}T12:00:00Z`));
  const summary = `${dateLabel}, kl. ${values.time}\n${values.guests} gäster\n\n${values.name.trim()}\n${values.phone.trim()}\n${values.email.trim()}${values.message.trim() ? '\n\nÖnskemål: '+values.message.trim() : ''}`;
  $('#booking-summary').textContent = summary;
  $('#booking-email').href = `mailto:bokning@lagustosa.se?subject=${encodeURIComponent('Bordsförfrågan '+values.date+' kl. '+values.time)}&body=${encodeURIComponent('Hej La Gustosa!\n\nJag vill gärna fråga om ett bord:\n\n'+summary+'\n\nJag inväntar er bekräftelse.\nTack!')}`;
  $('#booking-form').hidden = true; $('#booking-review').hidden = false; $('#booking-email').focus();
});
$('#booking-back').addEventListener('click', () => { $('#booking-review').hidden = true; $('#booking-form').hidden = false; $('#booking-date').focus(); });

const weekdayContent = $('#lunch-panel').innerHTML;
const weekendContent = '<div class="lunch-price"><span>SHOPPINGLUNCH</span></div><p>Varje Lördag &amp; Söndag mellan Kl. 12.00 – 17.00 har vi vår Shoppinglunch på Sandwallsplats i Borås då vi har ett bättre pris på utvalda rätter samt dryck. Ta en paus i all shopping, eller börja dagen hos oss med dina vänner, kollegor, nära &amp; kära.</p><button class="text-link" data-menu-detail="weekend">Shopping Meny <span aria-hidden="true">→</span></button>';
function selectLunch(kind) { $$('[data-lunch]').forEach(button => { button.setAttribute('aria-selected',String(button.dataset.lunch === kind)); button.tabIndex = button.dataset.lunch === kind ? 0 : -1; }); $('#lunch-panel').innerHTML = kind === 'weekend' ? weekendContent : weekdayContent; $('#lunch-panel').setAttribute('aria-labelledby',kind+'-tab'); }
$$('[data-lunch]').forEach(button => button.addEventListener('click', () => selectLunch(button.dataset.lunch)));
$('.occasion-tabs').addEventListener('keydown',event => tabKeys(event,'[data-lunch]',button => selectLunch(button.dataset.lunch)));
$$('[data-occasion]').forEach(link => link.addEventListener('click', () => selectLunch(link.dataset.occasion)));

function openMenuDetail(kind) {
  const menu = extraMenus[kind]; if (!menu) return;
  const fromGuide = $('#assistant-dialog').open;
  if (fromGuide) $('#assistant-dialog').close();
  const dialog = $('#menu-detail-dialog');
  dialog.dataset.returnToGuide = String(fromGuide);
  $('#menu-detail-title').textContent = menu.title;
  $('#menu-detail-intro').textContent = menu.intro || '';
  $('#menu-detail-intro').hidden = !menu.intro;
  $('#menu-detail-content').innerHTML = menu.sections.map(section => `<section class="detail-section"><h3>${escape(section.title)}</h3>${section.items ? section.items.map(item => `<article class="detail-item"><div class="detail-item-heading"><h4>${escape(item.name)}</h4>${item.priceLabel ? `<span>${escape(item.priceLabel)}</span>` : ''}</div>${item.description ? `<p>${escape(item.description)}</p>` : ''}</article>`).join('') : section.paragraphs.map(text => `<p>${escape(text)}</p>`).join('')}</section>`).join('');
  openDialog(dialog); dialog.scrollTop = 0;
}
// Delegation also covers buttons rendered in lunch tabs and quick-guide content.
document.addEventListener('click', event => {
  const menuButton = event.target.closest('[data-menu-detail]');
  if (menuButton) { event.preventDefault(); openMenuDetail(menuButton.dataset.menuDetail); }
});
$('#menu-detail-dialog').addEventListener('close', () => {
  if ($('#menu-detail-dialog').dataset.returnToGuide === 'true') openDialog($('#assistant-dialog'));
});
$('#directions-open').addEventListener('click', () => openDialog($('#directions-dialog')));

const photos = $$('[data-gallery]').map(button => ({ src:button.querySelector('img').src, alt:button.querySelector('img').alt, title:button.querySelector('img').alt }));
let photoIndex = 0;
function showPhoto(index) { photoIndex = (index+photos.length)%photos.length; const photo = photos[photoIndex]; $('#gallery-large').src=photo.src; $('#gallery-large').alt=photo.alt; $('#gallery-caption').textContent=`${photo.title} — ${photoIndex+1} / ${photos.length}`; }
$$('[data-gallery]').forEach(button => button.addEventListener('click', () => { showPhoto(Number(button.dataset.gallery)); openDialog($('#gallery-dialog')); }));
$('#gallery-prev').addEventListener('click', () => showPhoto(photoIndex-1)); $('#gallery-next').addEventListener('click', () => showPhoto(photoIndex+1));
$('#gallery-dialog').addEventListener('keydown',event => { if (event.key === 'ArrowLeft') showPhoto(photoIndex-1); if (event.key === 'ArrowRight') showPhoto(photoIndex+1); });

// Kept for a future chat launch. The current guide only uses explicit click choices.
const FREE_TEXT_CHAT_ENABLED = false;
function guideDishes(kind) {
  let items = menuData.items.filter(item => item.category === kind);
  if (kind === 'pizza') items = items.filter(item => item.price < 190).sort((a,b) => a.price-b.price);
  return '<ul class="guide-dish-list">' + items.slice(0,3).map(item => `<li><span>${escape(item.name)}</span><strong>${escape(item.priceLabel)}</strong></li>`).join('') + `</ul><a class="text-link" href="#meny" data-guide-category="${kind}">Se alla ${kind === 'pasta' ? 'pastarätter' : 'pizzor'} <span aria-hidden="true">→</span></a>`;
}
const guideSections = {
  pasta: { title:'Pasta', html:() => guideDishes('pasta') },
  pizza: { title:'Pizza under 190 kr', html:() => guideDishes('pizza') },
  lunch: { title:'Dagens lunch', html:() => weekdayContent },
  bar: { title:'Bar & alkohol', html:() => $('#guide-bar-content').innerHTML },
  hours: { title:'Öppettider', html:() => $('.hours dl').outerHTML + '<a class="text-link" href="#kontakt">Kontakt & hitta hit <span aria-hidden="true">→</span></a>' },
};
$$('[data-guide-topic]').forEach(button => button.addEventListener('click', () => {
  const topic = button.dataset.guideTopic;
  if (topic === 'booking') { openBooking(); return; }
  const section = guideSections[topic]; if (!section) return;
  $$('[data-guide-topic][aria-pressed]').forEach(choice => choice.setAttribute('aria-pressed',String(choice === button)));
  $('#guide-content').innerHTML = `<h3 id="guide-topic-title">${escape(section.title)}</h3>` + section.html();
  $('#guide-content').hidden = false;
}));
$('#guide-content').addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]'); if (!link) return;
  if (link.dataset.guideCategory) selectCategory(link.dataset.guideCategory);
  $('#assistant-dialog').close();
});

let aiEndpoint = null, configChecked = false, chatBusy = false;
async function checkAI() {
  if (configChecked) return; configChecked = true;
  try { const response = await fetch('./site-config.json', { signal:AbortSignal.timeout(2500) }); if (!response.ok) return; const config = await response.json(); if (typeof config.assistantApi === 'string' && config.assistantApi.startsWith('/') && !config.assistantApi.startsWith('//')) { aiEndpoint = config.assistantApi; $('#assistant-mode').textContent = 'AI-menyhjälp från OpenAI'; $('#chat-note').textContent = 'Din fråga skickas till OpenAI. AI kan ha fel. Skriv inga känsliga uppgifter. Fråga alltid personalen om allergier.'; } } catch { /* Static preview and offline mode intentionally retain local answers. */ }
}
$$('[data-assistant]').forEach(button => button.addEventListener('click', () => { openDialog($('#assistant-dialog')); if (FREE_TEXT_CHAT_ENABLED) checkAI(); }));
function appendMessage(text, role, answer) {
  const node = document.createElement('div'); node.className=`chat-message ${role}`; node.textContent=text;
  const actions = { menu:['Visa menyn','#meny'], contact:['Kontakt & öppettider','#kontakt'] };
  const detailActions = { lunch:'Veckans lunch', weekend:'Shopping Meny', aw:'AW Meny', drinks:'Dryckesmeny' };
  if (answer?.action === 'book') { const button = document.createElement('button'); button.className='text-link'; button.textContent='Förbered en bordsförfrågan →'; button.addEventListener('click',openBooking); node.append(document.createElement('br'),button); }
  else if (detailActions[answer?.action]) { const button=document.createElement('button'); button.textContent=detailActions[answer.action]+' →'; button.className='text-link'; button.dataset.menuDetail=answer.action; node.append(document.createElement('br'),button); }
  else if (actions[answer?.action]) { const [label,href] = actions[answer.action]; const link=document.createElement('a'); link.textContent=label+' →'; link.href=href; link.className='text-link'; link.addEventListener('click',()=> { $('#assistant-dialog').close(); if(answer.category) selectCategory(answer.category); }); node.append(document.createElement('br'),link); }
  const messages=$('#chat-messages'); messages.append(node); messages.scrollTop=messages.scrollHeight; return node;
}
async function ask(question) {
  question = question.trim().slice(0,700); if (!question || chatBusy) return;
  chatBusy=true; appendMessage(question,'user'); $('#chat-input').value=''; $('#chat-form button').disabled=true; $$('.quick-prompts button').forEach(button=>button.disabled=true);
  const pending=appendMessage('Ett ögonblick…','assistant');
  try {
    let answer;
    if (aiEndpoint) {
      try { const response=await fetch(aiEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question}),signal:AbortSignal.timeout(18000)}); if(!response.ok) throw new Error('Unavailable'); const payload=await response.json(); if(typeof payload.text !== 'string' || !payload.text) throw new Error('Empty answer'); answer={text:payload.text}; }
      catch { answer=localAnswer(question); answer.text='AI-hjälpen är tillfälligt otillgänglig. Här är ett svar från den lokala menyguiden:\n\n'+answer.text; }
    } else answer=localAnswer(question);
    pending.remove(); appendMessage(answer.text,'assistant',answer);
  } finally { chatBusy=false; pending.remove(); $('#chat-form button').disabled=false; $$('.quick-prompts button').forEach(button=>button.disabled=false); }
}
if (FREE_TEXT_CHAT_ENABLED) {
  $('#quick-guide').hidden = true;
  $('#chat-features').hidden = false;
  $('#chat-features').inert = false;
  $('#assistant-dialog').classList.add('chat-enabled');
  $('#assistant-title').textContent = 'Menyguide';
  $('#guide-privacy').textContent = 'Menyguiden använder lokala svar tills en AI-tjänst har anslutits. Om AI är aktiverad visas det i guiden, och din fråga skickas till OpenAI för att skapa ett svar. Skriv inte personliga eller känsliga uppgifter i chatten.';
  $('#chat-form').addEventListener('submit',event=> { event.preventDefault(); ask($('#chat-input').value); });
  $$('[data-prompt]').forEach(button=>button.addEventListener('click',()=>ask(button.dataset.prompt)));
}
$('#privacy-open').addEventListener('click',()=>openDialog($('#privacy-dialog')));
$('#clear-saved').addEventListener('click',()=> { saved.clear(); try { localStorage.removeItem(savedKey); } catch {} renderMenu(); $('#privacy-status').textContent='Dina sparade rätter har rensats.'; });
$('#year').textContent=new Date().getFullYear();
