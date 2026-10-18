# La Gustosa

En varsam uppdatering av https://www.lagustosa.se/. Originalets vita logotyp, restaurangbilder, centrerade navigation och klassiska känsla är bevarade. Ingen bild är genererad eller retuscherad.

## Köra lokalt

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

- 45 rätter i åtta kategorier med priser från originalets à la carte-meny.
- Sökning över hela menyn och lokalt sparade favoriter.
- Bokningsförfrågan med datum, önskad tid, antal gäster och kontaktuppgifter. Måndagar, passerade datum och tider med för kort framförhållning blockeras. Formuläret skapar ett granskningsbart mailto-utkast. Gästen skickar själv från sin e-postapp; ingen bokning bekräftas automatiskt.
- Mobilnavigation, lunchflikar, bildgalleri, tangentbordsnavigering, reducerad rörelse samt kontakt- och kartlänkar.
- Snabbguide med klickval för pasta, pizza under 190 kr, dagens lunch, bar & alkohol, öppettider och bokning. Den visar fasta uppgifter och menydata utan AI-anrop eller fritextfält.
- Färdig serveranslutning till OpenAI Responses API. API-nyckeln stannar på servern.

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

När priser eller öppettider ändras behöver innehållet uppdateras och publiceras igen. Lunchens veckorätter länkar till restaurangens uppdaterade originalmeny i stället för att använda ett snabbt inaktuellt veckoschema.

## Kontroller

```sh
node --test scripts/verify.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node scripts/run-framework.mjs build
```

Nio automatiska tester täcker menydata, Stockholmsdatum, måndagsstängt, bokningsvalidering, prissökning, allergisvar, avstängd AI, ursprungskontroll, storleksgräns och simulerade API-svar/fel. Den riktiga modellanslutningen behöver provas efter aktivering.

Sidan har även granskats i webbläsare på dator och mobil. Menyfilter, favoriter, mobilnavigation, bokningsgranskning och galleri har provats. Snabbguidens sex val, prisgränsen för pizza, övergången till bokningsformuläret samt att chattfält och chatthistorik är dolda har kontrollerats. Inga bokningsmeddelanden har skickats.

## Publicering

Projekt-ID och hostinginställningar finns i `.openai/hosting.json`. Webbplatsen är privat för ägaren. Den ersätter inte lagustosa.se. Använd Sites käll- och publiceringsflöde för att spara och distribuera nya versioner. Behåll `sites()`-integrationen i Vite.

`public/index.html` har `noindex` eftersom detta är en privat arbetsversion. Ta bort det först när restaurangen ska lansera sin publika sida och har kontrollerat innehållet.
