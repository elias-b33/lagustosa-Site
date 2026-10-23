import { menuData } from '../public/menu-data.js';
import { menuPaths, getDetailMenu, escapeHtml } from '../public/menu-content.js';
import { contactLinks } from '../public/contact-data.js';

export const canonicalOrigin = 'https://www.lagustosa.se';
export const restaurantId = `${canonicalOrigin}/#restaurang`;
export const searchDirective = 'index, follow, max-image-preview:large';
export const previewDirective = 'noindex, nofollow';
export const pageMetadata = {
  home: {path:'', title:'La Gustosa | Italiensk restaurang i Borås – meny & lunch', description:'La Gustosa på Sandwallsplats 7 i Borås. Italiensk restaurang och bar med pasta, pizza, dagens lunch och after work. Se menyer och kontakta oss för att boka bord.'},
  all: {path:menuPaths.all, title:'Meny – pasta & pizza i Borås | La Gustosa', description:'Se La Gustosas meny med pasta, pizza, antipasti, risotto och italienska desserter. Rätter och priser på Sandwallsplats 7 i Borås.'},
  lunch: {path:menuPaths.lunch, title:'Dagens lunch i Borås | La Gustosa', description:'Dagens lunch hos La Gustosa på Sandwallsplats 7 i Borås. Se lunchmenyn och vad som ingår. Ring 072-993 99 93 för frågor eller bordsbokning.'},
  weekend: {path:menuPaths.weekend, title:'Shoppinglunch i Borås | La Gustosa', description:'Shoppinglunch hos La Gustosa på Sandwallsplats i Borås. Se helgens meny med mat och dryck, och kontakta oss för att boka bord.'},
  aw: {path:menuPaths.aw, title:'After work i Borås – AW-meny | La Gustosa', description:'After work hos La Gustosa på Sandwallsplats 7 i Borås. Se AW-menyn med mat, vin, öl, cider och alkoholfria alternativ.'},
  drinks: {path:menuPaths.drinks, title:'Dryckesmeny – italienskt vin & bar i Borås | La Gustosa', description:'La Gustosas dryckesmeny med italienska viner, prosecco, öl, cider, kaffedrinkar och alkoholfria alternativ. Restaurang och bar på Sandwallsplats 7 i Borås.'},
};

export function restaurantSchema() {
  return {
    '@type':'Restaurant', '@id':restaurantId,
    name:'La Gustosa', url:`${canonicalOrigin}/`,
    description:'Italiensk restaurang och bar på Sandwallsplats 7 i Borås.',
    telephone:'+46729939993', email:'info@lagustosa.se',
    sameAs:[contactLinks.instagram,contactLinks.facebook], hasMap:contactLinks.map,
    address:{'@type':'PostalAddress',streetAddress:'Sandwallsplats 7',postalCode:'50335',addressLocality:'Borås',addressCountry:'SE'},
    servesCuisine:'Italienskt', currenciesAccepted:'SEK', acceptsReservations:true,
    image:[`${canonicalOrigin}/assets/original/IMG_3423-e1541493955977.jpg`,`${canonicalOrigin}/assets/original/IMG_3417-e1541577336567.jpg`],
    hasMenu:Object.values(menuPaths).map(path => `${canonicalOrigin}/${path}`),
    // The original says "sent" for several closing times. Do not invent times,
    // coordinates, reviews, ratings, dietary promises or reservation availability.
  };
}

export function structuredData(key) {
  const page = pageMetadata[key];
  const url = `${canonicalOrigin}/${page.path}`;
  const graph = [restaurantSchema(),
    {'@type':'WebSite','@id':`${canonicalOrigin}/#webbplats`,url:`${canonicalOrigin}/`,name:'La Gustosa',inLanguage:'sv-SE',publisher:{'@id':restaurantId}},
    {'@type':'WebPage','@id':`${url}#sida`,url,name:page.title,description:page.description,inLanguage:'sv-SE',isPartOf:{'@id':`${canonicalOrigin}/#webbplats`},about:{'@id':restaurantId},mainEntity:{'@id':key === 'home' ? restaurantId : `${url}#meny`}},
  ];
  if (key !== 'home') {
    const menu = getDetailMenu(key);
    graph.push({'@type':'Menu','@id':`${url}#meny`,url,name:menu.title,inLanguage:'sv-SE',hasMenuSection:menu.sections.map(section => ({
      '@type':'MenuSection',name:section.title,
      ...(section.items ? {hasMenuItem:section.items.map(item => ({
        '@type':'MenuItem',name:item.name,
        ...(item.description ? {description:item.description} : {}),
        // Only the à la carte data has unambiguous, individually typed prices.
        ...(Number.isFinite(item.price) ? {offers:{'@type':'Offer',price:item.price,priceCurrency:'SEK'}} : {}),
      }))} : {description:section.paragraphs.join('\n')}),
    }))});
    graph.push({'@type':'BreadcrumbList',itemListElement:[
      {'@type':'ListItem',position:1,name:'La Gustosa',item:`${canonicalOrigin}/`},
      {'@type':'ListItem',position:2,name:menu.title,item:url},
    ]});
  }
  return {'@context':'https://schema.org','@graph':graph};
}

export function seoHead(key, indexable = false) {
  const page = pageMetadata[key];
  const url = `${canonicalOrigin}/${page.path}`;
  const image = `${canonicalOrigin}/assets/original/IMG_3423-e1541493955977.jpg`;
  return `<!-- seo:start -->
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="robots" content="${indexable ? searchDirective : previewDirective}">
  <link rel="canonical" href="${url}">
  <meta property="og:locale" content="sv_SE">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="La Gustosa">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:width" content="1920">
  <meta property="og:image:height" content="1280">
  <meta property="og:image:alt" content="Baren på La Gustosa i Borås">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify(structuredData(key)).replace(/</g,'\\u003c')}</script>
  <!-- seo:end -->`;
}

export function robotsText(indexable = false) {
  if (!indexable) return 'User-agent: *\nDisallow: /\n';
  return `User-agent: *
Allow: /
Disallow: /api/

User-agent: OAI-SearchBot
Allow: /
Disallow: /api/

Sitemap: ${canonicalOrigin}/sitemap.xml
`;
}

export function sitemapXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.values(pageMetadata).map(page=>`  <url><loc>${canonicalOrigin}/${page.path}</loc></url>`).join('\n')}\n</urlset>\n`;
}

export {menuData};
