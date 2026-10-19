import { menuData } from './menu-data.js';
import { extraMenus } from './extra-menus.js';

export const menuPaths = {
  all: 'menyer/',
  lunch: 'dagens-lunch/',
  weekend: 'shoppinglunch/',
  aw: 'afterwork/',
  drinks: 'dryckesmeny/',
};

export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

export function getDetailMenu(kind) {
  if (kind === 'all') return {
    title: 'Menyer',
    sections: menuData.categories.map(category => ({
      title: category.label,
      items: menuData.items.filter(item => item.category === category.id),
    })),
  };
  return Object.hasOwn(extraMenus, kind) ? extraMenus[kind] : null;
}

// Used by both the interactive menus and the ordinary HTML menu pages.
export function renderDetailSections(menu, headingLevel = 3) {
  return menu.sections.map(section => `<section class="detail-section"><h${headingLevel}>${escapeHtml(section.title)}</h${headingLevel}>${section.items ? section.items.map(item => `<article class="detail-item"><div class="detail-item-heading"><h${headingLevel + 1}>${escapeHtml(item.name)}</h${headingLevel + 1}>${item.priceLabel ? `<span>${escapeHtml(item.priceLabel)}</span>` : ''}</div>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}</article>`).join('') : section.paragraphs.map(text => `<p>${escapeHtml(text)}</p>`).join('')}</section>`).join('');
}
