import {parsePhoneNumberFromString, getCountries, getCountryCallingCode} from './vendor/phone-library.js';

export const phoneError = 'Ange ett giltigt telefonnummer och kontrollera landskoden, till exempel 070 123 45 67 för Sverige.';

// Do not extract a plausible number from arbitrary text or accept extensions.
export function parseContactPhone(value, country = 'SE') {
  if (typeof value !== 'string' || value.length > 50) return null;
  const raw = value.trim();
  if (!raw || !/^\+?[\d\s().-]+$/.test(raw)) return null;
  const number = raw.replace(/^00/, '+');
  try {
    const parsed = parsePhoneNumberFromString(number, {defaultCountry:country === 'international' ? undefined : country, extract:false});
    return parsed?.isValid() && !parsed.ext ? parsed : null;
  } catch { return null; }
}
export const normalizePhone = (value, country = 'SE') => parseContactPhone(value, country)?.number || '';

export function wirePhone(form) {
  const input = form.elements.phone;
  if (!input || input.dataset.phoneReady) return;
  input.dataset.phoneReady = 'true';
  input.maxLength = 50;
  input.setAttribute('aria-label', 'Telefonnummer');
  input.autocomplete = 'tel-national';
  input.inputMode = 'tel';
  input.placeholder = '070 123 45 67';
  const control = document.createElement('span');
  control.className = 'phone-control';
  const country = document.createElement('select');
  country.setAttribute('aria-label', 'Landskod');
  const names = new Intl.DisplayNames(['sv'], {type:'region'});
  const countries = getCountries().sort((a,b)=>names.of(a).localeCompare(names.of(b),'sv'));
  for (const code of countries) {
    const option = new Option(`+${getCountryCallingCode(code)} ${names.of(code)}`,code,code==='SE',code==='SE');
    country.add(option);
  }
  country.add(new Option('Annan kod', 'international'));
  input.before(control);
  control.append(country,input);
  const help = document.createElement('small');
  help.className = 'phone-help';
  help.id = 'phone-help-' + crypto.randomUUID();
  help.textContent = 'Du kan börja med 0 eller klistra in hela numret med +landskod.';
  const feedback = document.createElement('small');
  feedback.className = 'phone-feedback';
  feedback.id = 'phone-feedback-' + crypto.randomUUID();
  feedback.setAttribute('aria-live','polite');
  control.after(help,feedback);
  input.setAttribute('aria-describedby',help.id+' '+feedback.id);
  const clear = () => { input.setCustomValidity('');input.removeAttribute('aria-invalid');feedback.textContent=''; };
  const check = (showEmpty = false) => {
    const parsed = parseContactPhone(input.value,country.value);
    clear();
    if (parsed) {
      country.value = parsed.country || 'international';
      input.value = parsed.country ? parsed.nationalNumber : parsed.number;
    } else if (input.value.trim() || showEmpty) {
      input.setCustomValidity(phoneError);
      input.setAttribute('aria-invalid','true');
      feedback.textContent = phoneError;
    }
    return parsed;
  };
  input.addEventListener('input',clear);
  input.addEventListener('blur',()=>check());
  country.addEventListener('change',()=>{input.placeholder=country.value==='SE'?'070 123 45 67':country.value==='international'?'+landskod och nummer':'Telefonnummer';check();});
  input.addEventListener('invalid',()=>check(true));
  form.addEventListener('submit',event=>{
    if (!check(true)) {event.preventDefault();event.stopImmediatePropagation();input.reportValidity();}
  },true);
  form.addEventListener('formdata',event=>{event.formData.set('phone',normalizePhone(input.value,country.value));});
  form.addEventListener('reset',()=>{clear();});
}
