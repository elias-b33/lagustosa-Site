import { api, mountOrder } from './management-client.js';
import { extraMenus } from './extra-menus.js';
import { renderDailyLunch } from './daily-lunch.js';
import { renderDetailSections } from './menu-content.js';
import { sendBooking } from './booking.js';

export async function sendManagedBooking(values,options) {
  const {requestId,...fields}=values;
  try {await api('book',{id:requestId,values:fields});return {status:'sent'};}
  catch(error) {
    // Only an explicitly unconfigured endpoint may fall back to the old email flow.
    if(error.code==='not_configured' || (error.unavailable && error.status===404)) return sendBooking(fields,options);
    return {status:error.uncertain?'uncertain':'failed',message:error.message};
  }
}
export async function initRestaurantLive() {
  if(location.protocol==='file:' || document.body.hasAttribute('data-offline-copy')) return;
  try {
    const config=await api('config'); if(!config.ready)return;
    for(const section of extraMenus.lunch.sections) if(config.lunch?.[section.title]?.trim()) section.paragraphs=config.lunch[section.title].split('\n').filter(x=>x.trim());
    const daily=document.querySelector('.daily-lunch');if(daily)daily.outerHTML=renderDailyLunch();
    const lunchDocument=document.querySelector('[data-live-lunch]');if(lunchDocument)lunchDocument.innerHTML=renderDetailSections(extraMenus.lunch,2);
    if(config.notice){const p=document.createElement('p');p.className='restaurant-notice wrap';p.textContent=config.notice;const anchor=document.querySelector('.occasion-bar') || document.querySelector('main');anchor?.after(p);}
    const privacy=document.querySelector('#booking-privacy');if(privacy)privacy.textContent='När du skickar en förfrågan sparas namn, kontaktuppgifter och önskemål i restaurangens bokningsregister. En bokningsnotis kan också skickas via FormSubmit till restaurangen. Uppgifterna används för att hantera ditt besök. Ring restaurangen om du vill få hjälp med dina uppgifter.';
    if(config.ordering && config.catalog?.length) {
      const button=document.querySelector('#takeaway-order-open');if(!button)return;
      button.hidden=false;
      button.addEventListener('click',()=>{
        const dialog=document.querySelector('#takeaway-order-dialog');mountOrder(dialog.querySelector('.order-body'),config.catalog);dialog.showModal();
      });
    }
  } catch { /* Static restaurant content remains usable during service outages. */ }
}
