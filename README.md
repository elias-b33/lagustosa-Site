# La Gustosa

En varsam uppdatering av https://www.lagustosa.se/. Originalets vita logotyp, restaurangbilder, centrerade navigation och klassiska känsla är bevarade. Ingen bild är genererad eller retuscherad.

## Köra lokalt

För den färdiga testversionen behövs ingen installation: packa upp `outputs/La-Gustosa-test.zip` och dubbelklicka på `STARTA-HAR.html`. Filen innehåller bilder, typsnitt, menydata och JavaScript. `MOBILVY.html` visar samma fil i en mobilram och ska ligga i samma mapp. Paketet skapas med `node scripts/package-offline.mjs` och kan zippas med operativsystemets vanliga zip-funktion. Inga konton, serverdelar eller nycklar ingår.

Dryckesmeny, veckolunch, shoppinglunch och AW visas i menyfönster på samma sida. `public/extra-menus.js` innehåller originalets kompletterande menyer; `scripts/import-extra-menus.py` återskapar dem från källkopiorna i `reference/`. Menyerna är ögonblicksbilder och behöver uppdateras när restaurangen ändrar dem. Inga länkar navigerar till den gamla webbplatsen. Kontaktlänkar använder telefon eller e-post. Instagram och Facebook visas i sidhuvud och sidfot. Karta och vägbeskrivning öppnas i Google Maps; dessa externa länkar öppnas i en ny flik. Originalets sociala profiler och restaurangens publicerade adress finns i `public/contact-data.js`. Inga sociala widgets eller kartinbäddningar laddas automatiskt.

För utvecklingsservern:

Node.js 22.13 eller senare krävs. Beroenden är låsta i package-lock.json.

```sh
npm run install:ci
npm run dev -- --port 4177 --hostname 127.0.0.1
```

På den här Windows-datorn fungerar inte npm.cmd när det startas genom Sites hjälpskript. Samma installationssteg kan köras direkt genom den installerade CLI-filen:

```powershell
node 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' --prefix . --workspaces=false run install:ci
node scripts/run-framework.mjs dev --port 4177 --hostname 127.0.0.1
```

## Det som fungerar

Instagram och Facebook följer med som en kompakt, genomskinlig sidolist på dator. På mobilen ligger de längst ned till vänster, åtskilda från snabbguiden. Ikonerna är större, har tydliga klickytor och döljs när ett dialogfönster är öppet. Ingen bakgrundsoskärpa eller rullningsanimation används.

- 45 rätter i åtta kategorier med priser från originalets à la carte-meny.
- Sökning över hela menyn och lokalt sparade favoriter.
- Bokningsförfrågan med datum, önskad tid, antal gäster och kontaktuppgifter. Måndagar, passerade datum och tider med för kort framförhållning blockeras. Gästen granskar först och skickar därefter via FormSubmit till ayush.giri2006@gmail.com utan att lämna sidan. Sällskap över tio anger exakt antal, tillfälle och eventuell flexibilitet i tid. Ingen bokning bekräftas automatiskt. Den lokala dubbelklickskopian använder gästens e-postapp.
- Mobilnavigation, lunchflikar, bildgalleri, tangentbordsnavigering, reducerad rörelse samt kontakt- och kartlänkar.
- Galleriet visar tre bilder först och ytterligare 16 via Visa fler bilder. Alla unika foton från originalets galleri ingår tillsammans med de tidigare utvalda bilderna. Exakta dubbletter visas bara en gång. Bilderna är oförändrade originalfiler, laddas vid behov och kan öppnas i bildvisaren. Visa färre bilder finns både över och under den utökade delen. Utvikningen fungerar även utan JavaScript.
- Snabbguide med klickval för pasta, pizza under 190 kr, dagens lunch, bar & alkohol, öppettider och bokning. Den visar fasta uppgifter och menydata utan AI-anrop eller fritextfält.
- Färdig serveranslutning till OpenAI Responses API. API-nyckeln stannar på servern.

## Bokningsförfrågningar

Webbversionen skickar direkt med FormSubmit AJAX efter gästens uttryckliga klick på Skicka förfrågan. Mottagaren är **ayush.giri2006@gmail.com** och gästens e-post sätts som Reply-To, så mottagaren kan svara direkt. Tillfället, önskad tid, exakt antal gäster, kontaktuppgifter och önskemål ingår. Sällskap över tio märks som gruppförfrågningar. Antalsfältets tekniska gräns på 999 är ingen uppgift om restaurangens kapacitet. Restaurangen bedömer plats, tid, meny och upplägg manuellt.

FormSubmit kräver att mottagaren aktiverar formuläret via ett mejl innan leverans. Aktiveringsbegäran för https://lagustosasite.vercel.app/ gjordes 19 oktober 2026. Användaren uppgav aktivering, men det efterföljande tekniska testet fick fortfarande svaret att aktivering krävs. Mottagaren har ombetts slutföra aktiveringen via det senaste mejlet; ett accepterat testutskick återstår. Kontrollera formulärets aktivering och ett tydligt märkt testutskick när mottagare eller domän ändras, även inför flytt till lagustosa.se. Ingen API-nyckel eller Gmail-inloggning finns i koden. Se [FormSubmit-dokumentationen](https://formsubmit.co/documentation).

Svar från tjänsten måste uttryckligen ange success=true innan sidan visar Förfrågan skickad. Detta betyder att tjänsten tagit emot förfrågan, inte att bordet är bokat eller att mejlet säkert ligger i inkorgen. Aktiveringsfel och avslag visas som fel med e-post och telefon som alternativ. Timeout och nätverksfel kan vara tvetydiga; inga automatiska omförsök görs och gästen ombeds ringa före nytt försök. Skicka-knappen spärras under pågående sändning. Ett dolt honeypotfält kompletterar tjänstens spamskydd.

Bokningsuppgifter hålls bara i sidans minne fram till skickandet och skrivs inte till localStorage. FormSubmit förmedlar uppgifterna och anger 30 dagars lagring av inskickade förfrågningar. Detta beskrivs vid skickandet och under Dina uppgifter. Den självständiga testfilen har nätverksspärr och använder enbart ett granskningsbart mejlutkast till samma mottagare.

Logiken finns i public/booking.js, datum- och antalsregler i public/domain.js och gränssnittet i public/index.html och public/app.js. Webbplatsen tillhandahåller inga uppgifter om lediga bord, bordsplaceringar, gruppkapacitet eller betalningar.

## Chatten är dold tills vidare

`FREE_TEXT_CHAT_ENABLED` i `public/app.js` är `false`. Chattgränssnittet är dolt och inert, inga chatthändelser registreras och snabbguiden anropar inte ens AI-konfigurationen. Chatthistorik, skrivfält och chattikon visas inte. Den tidigare chatt- och serverkoden är bevarad för ett eventuellt framtida beslut. Ett senare återinförande behöver kontroll av de lokala fritextsvaren, särskilt negationer och kombinerade ingrediensfilter, innan de blir tillgängliga för gäster.

## Aktivera AI vid ett framtida införande

Serverdelen ingår i den byggda och publicerade versionen, men är avstängd tills ägaren har valt modell och lagt till en nyckel. Ingen nyckel har lagts in, och inga verkliga modellförfrågningar har gjorts under utvecklingen.

Återaktivera först chattgränssnittet uttryckligen efter granskning. Följande runtime-variabler behövs därefter i Sites och en sparad version måste distribueras igen:

| Variabel | Värde |
| --- | --- |
| `AI_ENABLED` | `true` |
| `OPENAI_API_KEY` | Hemlig API-nyckel, markerad som secret |
| `OPENAI_MODEL` | Ett modell-ID som finns tillgängligt för restaurangens API-konto |

Nyckeln ska aldrig läggas i HTML, public/, versionshanterade filer eller frontend-inställningar. Lokalt kan variablerna läggas i `.dev.vars` (ignoreras av Git).

`GET /site-config.json` visar enbart om `/api/assistant` är aktiv. Om chattgränssnittet också är aktiverat byter det då märkning till AI-menyhjälp och informerar om att frågor skickas till OpenAI. Backend använder restaurangens verifierade meny som underlag och `store: false`. Utan nyckel eller vid API-fel används de lokala svaren. Frågor om allergener hänvisas till personalen; assistenten kan aldrig boka eller bekräfta lediga bord. Dessa funktioner används inte av den nuvarande klickguiden.

Förfrågningar begränsas till 700 tecken, med en gräns på 20 förfrågningar per besökare och timme samt 200 totalt per serverinstans och timme. Begränsningarna ligger i minnet; vid större offentlig drift bör de flyttas till en gemensam beständig räknare. Sätt också en lämplig kostnadsgräns på API-kontot. Appkoden loggar varken frågor eller nycklar.

Implementationen följer [OpenAI:s API-dokumentation](https://developers.openai.com/api/docs/quickstart) och [reglerna för serverlagrade nycklar](https://developers.openai.com/api/reference/overview).

## Ändra innehåll

| Fil | Innehåll |
| --- | --- |
| `public/index.html` | Sidans text, sektioner, originalbilder och formulär |
| `public/styles.css` | Färger, typografi och responsiva layouter |
| `public/app.js` | Menyfilter, favoriter, bokning, galleri och menyguide |
| `public/menu-data.js` | Alla rätter, priser och restaurangfakta; delad källa för UI och AI |
| `public/domain.js` | Datumregler och lokala svar |
| `lib/restaurant-assistant.mjs` | Skyddad AI-endpoint, begränsningar och prompt |
| `build/sites-worker.ts` | Sites Worker med AI-routning framför Vinext |
| `reference/menu-verified.json` | Källutdrag från menyimporten |
| `reference/assets.json` | Originalfilernas storlek, dimensioner och SHA-256 |
| `reference/gallery-source.json` | Galleriets originaladresser, dimensioner, SHA-256 och dokumenterade dubbletter |

När priser, veckolunch eller öppettider ändras behöver innehållet uppdateras och publiceras igen. Skapa också en ny offlinefil om testpaketet ska få samma ändringar.

Lunchdelen visar dagens fem rätter direkt från veckoschemat i `public/extra-menus.js`. `public/daily-lunch.js` väljer dag med tidszonen Europe/Stockholm, även om besökaren är utomlands. Tisdag–fredag visas dagens rätter; på måndagar visas stängt och nästa tisdags lunch, och på helgen väljs Shoppinglunch. En öppen sida kontrollerar dagbytet varje minut och när fliken blir aktiv igen. Snabbguidens lunchval använder samma innehåll. Veckans lunch kan fortfarande öppnas för att se alla dagar.

Dagbytet sker automatiskt utan AI, server eller ompublicering. Själva veckoschemat är däremot sparat innehåll: nya rätter och priser måste uppdateras när restaurangen ändrar menyn. Funktionen hämtar inte ändringar från den gamla webbplatsen.

## Kontroller

### SEO och AI-sökning

`node scripts/generate-seo.mjs` uppdaterar metadata, restaurangdata i JSON-LD, startsidans första meny och fem fullständiga HTML-menyer. Det körs också automatiskt före utvecklingsservern, bygget och offlinepaketeringen. Innehållet kommer från samma menydata som de interaktiva menyerna. Vanliga klick öppnar fortfarande menyfönstren; länkarna fungerar också som vanliga sidor utan JavaScript.

Förhandsvisningen är privat och behåller `noindex` samt en blockerande `robots.txt`. Det är ingen offentlig SEO-lansering. Kör `node scripts/generate-seo.mjs --production` för att skapa `outputs/La-Gustosa-webbplats/`, en statisk webbplats avsedd för **https://www.lagustosa.se/**. Där aktiveras indexering, sitemap och åtkomst för vanliga sökrobotar samt OAI-SearchBot. Canonical-adresserna pekar på restaurangens riktiga domän. Webbpaketet ska publiceras via en webbserver, inte användas som dubbelklicksversion. Originalwebbplatsen och dess DNS ändras inte av kommandot.

Menysidorna behåller originalets viktiga adresser `/menyer/`, `/dagens-lunch/`, `/shoppinglunch/` och `/afterwork/`; `/dryckesmeny/` tillkommer. Uppdatera `public/menu-data.js` och `public/extra-menus.js` när restaurangen ändrar menyerna och generera om. Öppettiderna återges som originalets text. Strukturerade stängningstider utelämnas eftersom flera dagar bara anger ”sent”. Betyg, recensioner, koordinater och lediga bord har inte hittats på.

Läs `SEO-LANSERING.txt` före publicering på restaurangens domän. SEO och tillåtna sökrobotar ger ingen garanti om indexering, placering eller AI-rekommendationer.

```sh
node --test scripts/verify.test.mjs scripts/seo.test.mjs scripts/booking.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node scripts/run-framework.mjs build
```

22 automatiska tester täcker menydata, SEO, lunchens dagbyte i svensk sommar- och vintertid, måndagsstängt, helglunch, bokningsvalidering, prissökning, allergisvar, avstängd AI, ursprungskontroll, storleksgräns och simulerade API-svar/fel. Den riktiga modellanslutningen behöver provas efter aktivering.

Sidan har även granskats i webbläsare på dator och mobil. Menyfilter, favoriter, mobilnavigation, bokningsgranskning och galleri har provats. Snabbguidens sex val, prisgränsen för pizza, övergången till bokningsformuläret samt att chattfält och chatthistorik är dolda har kontrollerats. Bokningsflödet har provats med testuppgifter utan att registrera något verkligt besök. Ett separat aktiveringsmeddelande har skickats till den mottagaradress användaren angav.

## Publicering

### Vercel

`vercel.json` publicerar den statiska webbplatsen från `public/`. Byggkommandot `node scripts/generate-seo.mjs` uppdaterar startsidan och menysidorna med enbart Node.js; ingen installation av ramverksberoenden behövs. Inställningarna väljer uttryckligen Vercels ramverk "Other" och rätt utdatakatalog. Det vanliga `npm run build` bygger för Sites/Cloudflare och ska inte användas för Vercel-publiceringen.

Projektets Root Directory i Vercel ska vara repots rot. Den anslutna produktionsgrenen är `main`. En push dit utlöser en ny publicering. Kontrollera själva webbplatsen efteråt, inklusive `/`, `/menyer/`, `/afterwork/` och bildfilerna; en grön byggstatus räcker inte för att bekräfta att sidorna fungerar.

Vercel-versionen behåller `noindex` och blockerande `robots.txt` medan den används som förhandsvisning. När den ska ersätta `www.lagustosa.se` behöver domänen kopplas in, lanseringslistan i `SEO-LANSERING.txt` följas och `vercel.json` ändras till byggkommandot `node scripts/generate-seo.mjs --production` med utdatakatalogen `outputs/La-Gustosa-webbplats`.

Menyer, favoriter, snabbguide och bokningsförfrågan via FormSubmit fungerar från den statiska webbplatsen. Den vilande AI-serverdelen ingår inte i Vercel-versionen; den kräver en separat serverintegration innan den kan aktiveras där.

### Sites

Projekt-ID och hostinginställningar finns i `.openai/hosting.json`. Webbplatsen är privat för ägaren. Den ersätter inte lagustosa.se. Använd Sites käll- och publiceringsflöde för att spara och distribuera nya versioner. Behåll `sites()`-integrationen i Vite.

`public/index.html` har `noindex` eftersom detta är en privat arbetsversion. Ta bort det först när restaurangen ska lansera sin publika sida och har kontrollerat innehållet.

## Personalvy, Supabase och takeaway

Personalvyn finns på /admin/ i Vercel-versionen. Den ger den utvalda personalanvändaren tillgång till bokningar, takeaway, aktuell information, veckolunch och avhämtningspriser. Gäster behöver inget konto. Betalning sker på plats; externa Foodora/Wolt-beställningar hanteras hos leverantören.

Supabase SDK och SSR-hjälpare är installerade. API:t använder säkra HttpOnly-cookies och förnyar sessioner på servern. Next/Vinext har även en avgränsad proxy för admin. Hemliga nycklar stannar i servermiljön, och varje personalåtgärd verifierar både Supabase-användar-ID och bekräftad e-postadress.

Aktiveringsstegen finns i supabase/SETUP.txt; databasschemat i supabase/001_restaurant.sql. Tills dessa steg är klara är beställningar avstängda och befintligt mejlformulär används. Gamla mejlbokningar importeras inte. Inga skarpa testbeställningar har skickats under implementationen.

Test: node --test scripts/*.test.mjs. Lokal UI-kontroll görs med tydligt märkta testdata. Cloud-databas, riktig personalinloggning och mejlleverans måste verifieras efter konfiguration.

Under uppsättningen används Elias testkonto. STAFF_EMAIL och STAFF_USER_ID byts tillsammans när Ayush tar över. Den 26 oktober 2026 godkändes samma priser för takeaway som hemsidans matmeny. Vercel kör en engångsinitialisering av den tomma beställningsmenyn; redan redigerade inställningar skrivs aldrig över.
