import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public');
const output = path.join(root, 'outputs', 'La-Gustosa-test');
await mkdir(output, {recursive: true});
const mime = {'.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.ttf':'font/ttf','.woff2':'font/woff2'};
const embedded = new Map();
async function dataUrl(file) {
  if (!embedded.has(file)) {
    const bytes = await readFile(file);
    const encoded = `data:${mime[path.extname(file)]};base64,${bytes.toString('base64')}`;
    assert.deepEqual(Buffer.from(encoded.split(',')[1], 'base64'), bytes);
    embedded.set(file, encoded);
  }
  return embedded.get(file);
}
let html = await readFile(path.join(source, 'index.html'), 'utf8');
for (const match of [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"?#]+)"/g)]) {
  if (match[1].endsWith('.css')) continue;
  html = html.replaceAll(match[1], await dataUrl(path.resolve(source, match[1])));
}
let fonts = await readFile(path.join(source, 'assets/fonts/fonts.css'), 'utf8');
for (const match of [...fonts.matchAll(/url\(([^)]+)\)/g)]) {
  fonts = fonts.replace(match[0], `url(${await dataUrl(path.resolve(source, 'assets/fonts', match[1]))})`);
}
const css = await readFile(path.join(source, 'styles.css'), 'utf8');
html = html.replace('<link rel="stylesheet" href="./assets/fonts/fonts.css">', `<style>\n${fonts}\n</style>`)
  .replace('<link rel="stylesheet" href="./styles.css">', `<style>\n${css}\n</style>`)
  .replace('  <script type="module" src="./app.js"></script>', '');
const bundle = await build({entryPoints:[path.join(source,'app.js')],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',charset:'utf8',legalComments:'inline'});
const script = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const licenses = await Promise.all(['CormorantGaramond-OFL.txt','DMSans-OFL.txt'].map(name=>readFile(path.join(source,'assets/fonts',name),'utf8')));
html = html.replace('</body>', `<script>\n${script}\n</script>\n<!-- Embedded font licenses\n${licenses.join('\n\n')}\n-->\n</body>`);
// This copy never needs a server or network connection for its content.
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; font-src data:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; connect-src \'none\'; base-uri \'none\'; form-action \'none\'">');
assert(!/(?:src|href)="\.\//.test(html), 'Unbundled dependency');
assert(!/href=["']https?:/i.test(html), 'External navigation');
assert(!/<script[^>]+src=/.test(html), 'External script');
await writeFile(path.join(output, 'STARTA-HAR.html'), html);
await writeFile(path.join(output, 'MOBILVY.html'), await readFile(path.join(root,'scripts/offline-mobile.html'),'utf8'));
await writeFile(path.join(output,'LAS-MIG.txt'), '\ufeff' + `LA GUSTOSA – TESTVERSION\n\n1. Packa upp zip-filen om du fått den som zip.\n2. Dubbelklicka på STARTA-HAR.html.\n\nSidan öppnas i din vanliga webbläsare. Ingen installation, inget konto och ingen server behövs. Bilder, typsnitt och menyer ingår i filen och fungerar utan internet.\n\nMOBILVY.html visar sidan i en mobilram på datorn, ungefär som en 6,3-tumsmobil. Låt den ligga i samma mapp som STARTA-HAR.html.\n\nTesta menyflikar, sökning, favoriter, snabbguide, galleri och bokningsformulär. Dryckesmeny, veckolunch, shoppinglunch och AW öppnas på samma sida.\n\nBokningsformuläret låter dig granska en förfrågan. Det reserverar inget bord och skickar inget automatiskt. Knappen ”Öppna i din e-postapp” förbereder ett mejl till bokning@lagustosa.se. Om du själv skickar mejlet går det till restaurangen. Telefon- och e-postlänkar öppnar din vanliga app.\n\nMenyerna är en kopia av originalets innehåll, kontrollerat 19 oktober 2026. Ändringar hos restaurangen hämtas inte automatiskt.\n\nDu kan även skicka enbart STARTA-HAR.html till någon annan; den innehåller allt som behövs för själva sidan.\n`);
console.log(JSON.stringify({output,htmlBytes:Buffer.byteLength(html),embeddedAssets:embedded.size}));
