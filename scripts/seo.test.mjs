import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {canonicalOrigin,pageMetadata,structuredData,robotsText,sitemapXml,seoHead} from '../lib/site-seo.mjs';
import {getDetailMenu,escapeHtml} from '../public/menu-content.js';
import {contactLinks} from '../public/contact-data.js';

const publicRoot=fileURLToPath(new URL('../public/',import.meta.url));
const stripMarkup=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<[^>]+>/g,'');

test('Every menu is delivered as readable HTML without executing JavaScript',async()=>{
  for(const [key,page] of Object.entries(pageMetadata)) {
    const html=await readFile(path.join(publicRoot,page.path,'index.html'),'utf8');
    assert.equal((html.match(/<h1\b/g)||[]).length,1,key);
    assert.equal((html.match(/rel="canonical"/g)||[]).length,1,key);
    assert(html.includes(`href="${canonicalOrigin}/${page.path}"`),key);
    assert.match(html,/<html lang="sv">/);
    const data=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert(data['@graph'].some(entity=>entity['@type']==='Restaurant'));
    if(key==='home')continue;
    const visible=stripMarkup(html);
    for(const section of getDetailMenu(key).sections) {
      for(const item of section.items||[]) {
        assert(visible.includes(escapeHtml(item.name)),`${key}: missing ${item.name}`);
        if(item.priceLabel)assert(visible.includes(escapeHtml(item.priceLabel)));
        if(item.description)assert(visible.includes(escapeHtml(item.description)));
      }
    }
    assert(!/<script[^>]+src=/.test(html),'Menu page must not require scripts');
  }
});

test('Restaurant data contains verified facts and never invents ratings or closing times',()=>{
  for(const key of Object.keys(pageMetadata)) {
    const data=structuredData(key);
    const restaurant=data['@graph'][0];
    assert.equal(restaurant.address.addressLocality,'Borås');
    assert.equal(restaurant.telephone,'+46729939993');
    for(const field of ['aggregateRating','review','geo','openingHoursSpecification'])assert(!(field in restaurant));
    if(key==='all') {
      const items=data['@graph'].find(entity=>entity['@type']==='Menu').hasMenuSection.flatMap(section=>section.hasMenuItem);
      assert.equal(items.length,45);
      assert(items.every(item=>item.offers.priceCurrency==='SEK'&&item.offers.price>0));
    }
  }
});

test('Preview remains unindexed; the production export allows search crawlers',async()=>{
  assert.equal(await readFile(path.join(publicRoot,'robots.txt'),'utf8'),robotsText(false));
  assert.match(seoHead('home'),/noindex, nofollow/);
  assert.match(seoHead('home',true),/index, follow, max-image-preview:large/);
  assert.doesNotMatch(seoHead('home',true),/noindex/);
  assert.match(robotsText(true),/User-agent: OAI-SearchBot\nAllow: \/\nDisallow: \/api\//);
  assert.doesNotMatch(robotsText(true),/^Disallow: \/$/m);
  const urls=[...sitemapXml().matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>match[1]);
  assert.equal(urls.length,6);
  assert.equal(new Set(urls).size,urls.length);
  assert(urls.every(url=>url.startsWith(canonicalOrigin+'/')&&!url.includes('?')&&!url.includes('#')));
});

test('Menu navigation stays local; only verified social and map links may open externally',async()=>{
  for(const page of Object.values(pageMetadata)) {
    const directory=path.join(publicRoot,page.path);
    const html=await readFile(path.join(directory,'index.html'),'utf8');
    for (const [anchor,href] of html.matchAll(/<a\b[^>]*href="(https?:[^\"]+)"[^>]*>/gi)) {
      assert(Object.values(contactLinks).includes(href.replaceAll('&amp;','&')),href);
      assert.match(anchor,/target="_blank"/);
      assert.match(anchor,/rel="noopener noreferrer"/);
    }
    for(const [,reference] of html.matchAll(/(?:href|src)="(\.{1,2}\/[^"#]*)(?:#[^"]*)?"/g)) {
      const file=path.resolve(directory,reference);
      assert(!path.relative(publicRoot,file).startsWith('..'));
      await access(file.endsWith(path.sep)||reference.endsWith('/')?path.join(file,'index.html'):file);
    }
  }
});
