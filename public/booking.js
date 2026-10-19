import { bookingGuestCount, validateBooking } from './domain.js';

export const BOOKING_RECIPIENT = 'ayush.giri2006@gmail.com';
export const BOOKING_ENDPOINT = `https://formsubmit.co/ajax/${BOOKING_RECIPIENT}`;

export function prepareBooking(values) {
  const guests = bookingGuestCount(values);
  const isGroup = guests > 10;
  const date = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${values.date}T12:00:00Z`));
  const name = values.name.trim(), phone = values.phone.trim(), email = values.email.trim();
  const occasion = isGroup ? (values.occasion || '').trim() : '';
  const flexible = isGroup && values.flexibleTime === 'ja';
  const message = (values.message || '').trim();
  const type = isGroup ? 'Gruppförfrågan' : 'Bordsförfrågan';
  const subject = `${type} – ${guests} ${guests === 1 ? 'person' : 'personer'} – ${values.date} kl. ${values.time}`;
  const summary = `${date}, kl. ${values.time}\n${guests} ${guests === 1 ? 'gäst' : 'gäster'}${occasion ? '\nTillfälle: ' + occasion : ''}${flexible ? '\nVi kan vara flexibla med tiden.' : ''}\n\n${name}\n${phone}\n${email}${message ? '\n\nÖnskemål: ' + message : ''}`;
  const body = `Hej La Gustosa!\n\n${isGroup ? 'Vi vill gärna fråga om plats för ett större sällskap:' : 'Jag vill gärna fråga om ett bord:'}\n\n${summary}\n\n${isGroup ? 'Vi inväntar ert besked om plats, meny och upplägg.' : 'Jag inväntar er bokningsbekräftelse.'}\nTack!`;
  return {
    guests, isGroup, subject, summary,
    mailto: `mailto:${BOOKING_RECIPIENT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    payload: {
      _subject: subject, _template: 'table', _replyto: email, _honey: values.website || '',
      Typ: type, Datum: date, 'Önskad tid': values.time, 'Antal gäster': String(guests),
      Namn: name, Telefon: phone, email,
      ...(isGroup ? { Tillfälle: occasion || 'Ej angivet', 'Flexibel tid': flexible ? 'Ja' : 'Nej' } : {}),
      Önskemål: message || 'Inga angivna',
      Status: 'Förfrågan – restaurangen behöver bekräfta plats och tid.',
    },
  };
}

export async function sendBooking(values, { pageUrl, fetchImpl = fetch, now = new Date() } = {}) {
  const error = validateBooking(values, now);
  if (error) return { status: 'invalid', message: error };
  if (values.website) return { status: 'failed', message: 'Förfrågan kunde inte skickas. Ring oss för att boka.' };
  const unavailable = 'Förfrågan kunde inte skickas här. Använd e-postlänken nedan eller ring 072-993 99 93.';
  const uncertain = 'Vi kunde inte bekräfta om förfrågan skickades. Ring 072-993 99 93 innan du skickar igen, så undviker vi dubbla förfrågningar.';
  try {
    const url = new URL(pageUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return { status: 'failed', message: unavailable };
    const request = prepareBooking(values);
    const response = await fetchImpl(BOOKING_ENDPOINT, {
      method: 'POST', mode: 'cors', credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...request.payload, _url: url.origin + url.pathname }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return { status: 'uncertain', message: uncertain };
    const data = await response.json();
    if (data.success === true || data.success === 'true') return { status: 'sent' };
    return { status: 'failed', message: unavailable };
  } catch {
    // A timeout is ambiguous: the provider might already have accepted the email.
    // Never retry automatically or claim that a table has been reserved.
    return { status: 'uncertain', message: uncertain };
  }
}
