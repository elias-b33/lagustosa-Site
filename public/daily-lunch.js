import { stockholmDate } from './domain.js';
import { getDetailMenu, escapeHtml } from './menu-content.js';

const weekdays = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
const dateLabel = new Intl.DateTimeFormat('sv-SE', {
  weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
});

// The weekly menu is shared with the full lunch menu. Only the displayed day changes.
export function getDailyLunch(now = new Date()) {
  const date = stockholmDate(now);
  const calendarDay = new Date(`${date}T12:00:00Z`);
  const weekday = calendarDay.getUTCDay();
  const isLunchDay = weekday >= 2 && weekday <= 5;
  const isWeekend = weekday === 0 || weekday === 6;
  if (!isLunchDay) calendarDay.setUTCDate(calendarDay.getUTCDate() + (2 - weekday + 7) % 7);
  const serviceDate = calendarDay.toISOString().slice(0, 10);
  const dayName = weekdays[calendarDay.getUTCDay()];
  const section = getDetailMenu('lunch').sections.find(section => section.title === dayName);
  return {
    date, serviceDate, weekday,
    kind: isWeekend ? 'weekend' : 'weekday',
    heading: `${isLunchDay ? 'Idag' : 'Nästa lunch'}, ${dateLabel.format(calendarDay)}`,
    notice: weekday === 1 ? 'Vi har stängt på måndagar.' : isWeekend
      ? 'På lördagar och söndagar har vi shoppinglunch. Dagens lunch är tillbaka på tisdag.' : '',
    dishes: section?.paragraphs ?? [],
  };
}

export function renderDailyLunch(now = new Date()) {
  const lunch = getDailyLunch(now);
  return `<section class="daily-lunch" aria-label="Dagens lunchrätter">
    ${lunch.notice ? `<p class="daily-lunch-notice">${escapeHtml(lunch.notice)}</p>` : ''}
    <h3>${escapeHtml(lunch.heading)}</h3>
    <div class="daily-lunch-dishes">${lunch.dishes.length ? lunch.dishes.map(line => {
      const separator = line.indexOf(':');
      return separator < 0 ? `<p>${escapeHtml(line)}</p>`
        : `<p><strong>${escapeHtml(line.slice(0, separator + 1))}</strong>${escapeHtml(line.slice(separator + 1))}</p>`;
    }).join('') : '<p>Ring oss på 072-993 99 93 för dagens rätter.</p>'}</div>
  </section>`;
}
