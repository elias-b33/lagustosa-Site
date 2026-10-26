import { menuData } from './menu-data.js';
import { normalizePhone, phoneError } from './phone.js';

export function stockholmDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type).value).join('-');
}

function isBookingDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function bookingGuestCount(values) {
  const value = String(values.guests === 'group' ? values.groupSize ?? '' : values.guests ?? '').trim();
  return /^\d{1,3}$/.test(value) ? Number(value) : NaN;
}

export function bookingTimes(date, now = new Date()) {
  if (!isBookingDate(date)) return [];
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (day === 1 || date < stockholmDate(now)) return [];
  let start = day === 0 || day === 6 ? 12 * 60 : 11 * 60 + 30;
  if (date === stockholmDate(now)) {
    const current = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now).split(':').map(Number);
    start = Math.max(start, Math.ceil((current[0] * 60 + current[1] + 60) / 30) * 30);
  }
  const times = [];
  for (let minutes = start; minutes <= 20 * 60 + 30; minutes += 30) times.push(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
  return times;
}

export function validateBooking(values, now = new Date()) {
  const limit = new Date(now); limit.setUTCDate(limit.getUTCDate() + 180);
  if (!isBookingDate(values.date) || values.date < stockholmDate(now) || values.date > stockholmDate(limit)) return 'Välj ett datum från idag och högst sex månader framåt.';
  if (new Date(`${values.date}T12:00:00Z`).getUTCDay() === 1) return 'Vi har stängt på måndagar. Välj gärna en annan dag.';
  if (!bookingTimes(values.date, now).includes(values.time)) return 'Välj en av de önskade tiderna. För bokning med kort varsel, ring oss.';
  const guests = bookingGuestCount(values);
  if (!Number.isInteger(guests) || guests < (values.guests === 'group' ? 11 : 1) || guests > 999) return values.guests === 'group' ? 'Ange antal personer i sällskapet, minst 11. För fler än 999 personer, ring oss.' : 'Ange ett giltigt antal gäster.';
  if (!values.name?.trim() || !values.phone?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email || '')) return 'Fyll i namn, telefon och en giltig e-postadress.';
  if (!normalizePhone(values.phone)) return phoneError;
  if (values.name.length > 100 || values.phone.length > 50 || values.email.length > 150 || (values.message || '').length > 800 || (values.occasion || '').length > 80) return 'Korta ner uppgifterna eller önskemålen och försök igen.';
  return '';
}

export const normalize = text => text.toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const allergyPattern = /allerg|gluten|celiak|laktos|mjolkfri|mjolkprotein|notfri|notallerg|vegan|celiac|dairy.free|nut.free/;

export function localAnswer(question) {
  const q = normalize(question);
  const info = menuData.restaurant;
  if (allergyPattern.test(q)) return { text: 'Vi vill att det ska bli rätt för dig. Menyn har ingen fullständig allergenlista, så jag kan inte bekräfta om en rätt är säker för dig. Ring personalen på 072-993 99 93 och berätta vad du behöver.', action: 'contact' };
  if (/boka|bokning|reservation|lediga|ledigt/.test(q)) return { text: 'Du kan förbereda en bordsförfrågan här eller ringa 072-993 99 93. Restaurangen behöver bekräfta bokningen. Jag har inte tillgång till lediga bord.', action: 'book' };
  if (/shopping|helg|weekend/.test(q)) return { text: info.weekend, action: 'weekend' };
  if (/lunch/.test(q)) return { text: info.lunch, action: 'lunch' };
  if (/oppet|stang|oppnar|stanger|m[aå]ndag|tisdag|onsdag|torsdag|fredag|lordag|sondag/.test(q)) return { text: info.hours, action: 'contact' };
  if (/after.?work|aperitivo|\baw\b/.test(q)) return { text: 'Vi har en särskild after work-meny. Ring oss på 072-993 99 93 för aktuella tider och erbjudanden.', action: 'aw' };
  if (/adress|hitta|ligger|parkering|telefon|kontakt/.test(q)) return { text: `Du hittar oss på ${info.address}. Telefon: ${info.phone}. För frågor om parkering och tillgänglighet, ring gärna restaurangen.`, action: 'contact' };
  if (/take.?away|hamta|avhamtning|hem/.test(q)) return { text: 'Det går att ta med de flesta rätterna. Ring 072-993 99 93 för att beställa och få aktuellt pris och hämtningstid. Dagens lunch som take away kostar 119 kr.', action: 'contact' };
  if (/vin|dryck|ol\b|prosecco/.test(q)) return { text: 'Vinerna kommer från Italien och många serveras på glas. I originalets dryckesmeny finns bland annat Chianti, Valpolicella Ripasso och Pinot Grigio. Fråga personalen om ett vin som passar din rätt.', action: 'drinks' };
  let category = menuData.categories.find(c => q.includes(normalize(c.label)))?.id;
  if (/forratt|dela/.test(q)) category = 'antipasti';
  if (/dessert|sott|efterratt/.test(q)) category = 'dolci';
  if (/barn/.test(q)) category = 'barn';
  let items = menuData.items.filter(item => !category || item.category === category);
  const budget = q.match(/(?:under|max|hogst|budget)\s*(\d{2,4})/);
  if (budget) items = items.filter(item => q.includes('under') ? item.price < Number(budget[1]) : item.price <= Number(budget[1]));
  if (/vegetar/.test(q)) {
    // Only quote explicitly named dishes; don't infer dietary suitability from a partial ingredient list.
    items = items.filter(item => /vegetar/i.test(item.name));
    return { text: 'På menyn finns ' + items.map(item => `${item.name} (${item.price} kr)`).join(' och ') + '. Be personalen bekräfta ingredienserna, även i ostar och såser.', action: 'menu' };
  }
  if (!category && !budget) {
    const stopwords = new Set(['jag','vill','har','ni','vad','finns','med','och','att','det','som','kan','visa','kostar','nagot','rekommendera','ratt']);
    const words = q.split(/\W+/).filter(w => w.length > 2 && !stopwords.has(w));
    items = items.map(item => ({ item, score: words.reduce((n,w) => n + (normalize(item.name).includes(w) ? 3 : normalize(item.description).includes(w) ? 1 : 0), 0) })).filter(entry => entry.score > 0).sort((a,b) => b.score-a.score).map(entry => entry.item);
  }
  if (!items.length) return { text: 'Jag hittar ingen säker träff i menyn. Prova en rätt, en ingrediens eller en kategori, till exempel ”pasta” eller ”pizza under 190 kr”. För andra frågor hjälper personalen gärna till på 072-993 99 93.', action: 'menu' };
  return { text: 'Här är några rätter från menyn:\n\n' + items.slice(0, 4).map(item => `${item.name} — ${item.price} kr\n${item.description}`).join('\n\n'), action: 'menu', category };
}
