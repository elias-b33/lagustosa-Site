import {readFile, writeFile, mkdir, cp} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {menuData, pageMetadata, seoHead, robotsText, sitemapXml} from '../lib/site-seo.mjs';
import {getDetailMenu, renderDetailSections, escapeHtml} from '../public/menu-content.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public');
const bookmark = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21l-7-5-7 5V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1z"></path></svg>';

function initialDishes() {
  return menuData.items.filter(item=>item.category === 'pasta').map(item=>`<article class="dish">${item.note ? `<span class="dish-tag">${escapeHtml(item.note)}</span>` : ''}<div class="dish-line"><h3>${escapeHtml(item.name)}</h3><span class="dish-price">${escapeHtml(item.priceLabel)}<span class="sr-only"> kronor</span></span></div><p>${escapeHtml(item.description)}</p><button class="dish-save" data-save="${item.id}" aria-label="Spara ${escapeHtml(item.name)}" aria-pressed="false">${bookmark}</button></article>`).join('');
}

function menuPage(key, indexable) {
  const menu = getDetailMenu(key);
  const links = Object.entries(pageMetadata).filter(([kind])=>kind !== 'home').map(([kind,page])=>`<a href="../${page.path}"${key === kind ? ' aria-current="page"' : ''}>${escapeHtml(getDetailMenu(kind).title === 'Menyer' ? 'À la carte' : getDetailMenu(kind).title)}</a>`).join('');
  return `<!doctype html>
<html lang="sv"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#242b27">
  ${seoHead(key,indexable)}
  <link rel="icon" type="image/svg+xml" href="../assets/favicon.svg">
  <link rel="stylesheet" href="../assets/fonts/fonts.css">
  <link rel="stylesheet" href="../styles.css">
</head><body>
  <a class="skip-link" href="#innehall">Hoppa till innehållet</a>
  <header class="document-header"><div class="wrap"><a href="../" aria-label="La Gustosa, startsidan"><img src="../assets/original/Artboard-1.svg" width="1303" height="340" alt="La Gustosa — Ristorante Italiano"></a><a href="../#kontakt">Boka bord</a></div></header>
  <main class="menu-document wrap" id="innehall">
    <nav class="breadcrumbs" aria-label="Brödsmulor"><a href="../">La Gustosa</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(menu.title)}</span></nav>
    <h1>${escapeHtml(menu.title)}</h1>
    <p class="document-location">Sandwallsplats 7, Borås</p>
    <nav class="document-menus" aria-label="Våra menyer">${links}</nav>
    ${menu.intro ? `<p class="menu-detail-intro">${escapeHtml(menu.intro)}</p>` : ''}
    ${renderDetailSections(menu,2)}
    <p class="menu-detail-footer"># Vid allergier fråga personalen</p>
    ${key === 'all' ? '<section class="takeaway-copy"><h2>TAKE AWAY</h2><p>Du vet väl att du även kan köpa med de flesta rätterna från oss, du kan räkna med ca. 10% lägre pris.</p></section>' : ''}
    <a class="text-link document-back" href="../#meny">Tillbaka till restaurangen <span aria-hidden="true">←</span></a>
  </main>
  <footer class="document-footer"><div class="wrap"><section><h2>La Gustosa</h2><address>Sandwallsplats 7,<br>50335 Borås</address><p><a href="tel:+46729939993">072-993 99 93</a><br><a href="mailto:bokning@lagustosa.se">bokning@lagustosa.se</a><br><a href="mailto:info@lagustosa.se">info@lagustosa.se</a></p><p>Ring eller maila för att boka ett bord.</p></section><section><h2>Öppettider</h2><dl><div><dt>Måndag</dt><dd>Stängt</dd></div><div><dt>Tisdag</dt><dd>11:30-sent</dd></div><div><dt>Onsdag</dt><dd>11:30-22.00</dd></div><div><dt>Torsdag</dt><dd>11:30-22.00</dd></div><div><dt>Fredag</dt><dd>11:30-sent</dd></div><div><dt>Lördag</dt><dd>12:00-sent</dd></div><div><dt>Söndag</dt><dd>12:00-sent</dd></div></dl></section></div></footer>
</body></html>\n`;
}

export async function generateSeo({output = source, indexable = false} = {}) {
  await mkdir(output,{recursive:true});
  let home = await readFile(path.join(source,'index.html'),'utf8');
  if (!home.includes('<!-- seo:start -->') || !home.includes('<!-- menu:initial:start -->')) throw new Error('Missing SEO generation markers in the home page.');
  home = home.replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/,seoHead('home',indexable));
  home = home.replace(/<!-- menu:initial:start -->[\s\S]*?<!-- menu:initial:end -->/,`<!-- menu:initial:start --><div class="menu-dishes" id="menu-dishes" role="tabpanel" aria-label="Maträtter">${initialDishes()}</div><!-- menu:initial:end -->`);
  await writeFile(path.join(output,'index.html'),home);
  for (const [key,page] of Object.entries(pageMetadata)) {
    if (key === 'home') continue;
    await mkdir(path.join(output,page.path),{recursive:true});
    await writeFile(path.join(output,page.path,'index.html'),menuPage(key,indexable));
  }
  await writeFile(path.join(output,'robots.txt'),robotsText(indexable));
  await writeFile(path.join(output,'sitemap.xml'),sitemapXml());
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const production = process.argv.includes('--production');
  const output = production ? path.join(root,'outputs','La-Gustosa-webbplats') : source;
  if (production) {
    await mkdir(output,{recursive:true});
    await cp(source,output,{recursive:true});
  }
  await generateSeo({output,indexable:production});
  console.log(`${production ? 'Public website export' : 'Preview SEO pages'}: ${output}`);
}
