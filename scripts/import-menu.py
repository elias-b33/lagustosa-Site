"""Import the downloaded original menu. Does not fetch or infer prices."""
from pathlib import Path
import html
import json
import re
import unicodedata

root = Path(__file__).resolve().parents[1]
source = (root / 'reference/menyer.html').read_text(encoding='utf-8')
def plain(value):
    return unicodedata.normalize('NFC', re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', value))).strip())

categories = [
    {'id': 'pasta', 'label': 'Pasta', 'note': 'Pasta'},
    {'id': 'pizza', 'label': 'Pizza', 'note': 'Pizza'},
    {'id': 'antipasti', 'label': 'Antipasti / Förrätt', 'note': 'Antipasti / Förrätt'},
    {'id': 'sallad', 'label': 'Insalate', 'note': 'Insalate'},
    {'id': 'risotto', 'label': 'Risotto', 'note': 'Risotto'},
    {'id': 'grill', 'label': 'Carne / Pesce', 'note': 'Carne / Pesce'},
    {'id': 'dolci', 'label': 'Dolce / Dessert', 'note': 'Dolce / Dessert'},
    {'id': 'barn', 'label': 'Bambini', 'note': 'Bambini'},
]
mapping = ['antipasti', 'sallad', 'pasta', 'pasta', 'risotto', 'pizza', 'grill', 'barn', 'dolci']
panels = list(re.finditer(r'<h4 class="panel-title">([\s\S]*?)</h4>', source))
items = []
for index, category in enumerate(mapping):
    segment = source[panels[index].end():panels[index + 1].start()]
    titles = list(re.finditer(r'<p class="item-title">([\s\S]*?)</p>', segment))
    for n, title in enumerate(titles):
        block = segment[title.end():titles[n + 1].start() if n + 1 < len(titles) else len(segment)]
        price_match = re.search(r'<p class="item-price">([\s\S]*?)</p>', block)
        if not price_match or not re.search(r'\d+', plain(price_match[1])):
            raise ValueError('No verified price for ' + plain(title[1]))
        description_match = re.search(r'<div class="col-xs-12 item-info">([\s\S]*?)</div>', block)
        name = plain(title[1])
        price_label = plain(price_match[1])
        items.append({'id': f'{category}-{n+1}' if index != 3 else f'pasta-oven-{n+1}', 'category': category, 'name': name, 'price': int(re.search(r'\d+', price_label)[0]), 'priceLabel': price_label, 'description': plain(description_match[1]) if description_match else '', 'note': 'Pasta (UGNSBAKAT)' if index == 3 else ''})

data = {'source': 'https://www.lagustosa.se/menyer/', 'checkedAt': '2026-10-19', 'categories': categories, 'items': items, 'restaurant': {'name': 'La Gustosa', 'address': 'Sandwallsplats 7, 503 35 Borås', 'phone': '072-993 99 93', 'email': 'bokning@lagustosa.se', 'hours': 'Måndag stängt. Tisdag 11.30–sent. Onsdag och torsdag 11.30–22.00. Fredag 11.30–sent. Lördag och söndag 12.00–sent. Ring för kvällens stängningstid.', 'lunch': 'Tisdag–fredag 11.30–14.30. Dagens lunch 129 kr. Pensionär, student och dagens take away 119 kr. Sallad, hembakat bröd, smör, bordsvatten, kaffe och Tårta Margherita ingår.', 'weekend': 'Shoppinglunch lördag–söndag 12.00–17.00 enligt shoppinglunchsidan. Rättspecifika priser finns på https://www.lagustosa.se/shoppinglunch/.', 'booking': 'Bokning via telefon eller e-postförfrågan. Ett bord är inte bokat förrän restaurangen bekräftat. Inga uppgifter om lediga bord finns.', 'allergens': 'Ingen fullständig verifierad allergenlista finns. Gäster måste alltid fråga personalen. Bekräfta aldrig att en rätt är allergensäker, glutenfri, mjölkfri eller vegansk.', 'afterwork': 'After work finns. Tiderna på originalsidorna är motstridiga; hänvisa till telefon för aktuell tid.'}}
serialized = json.dumps(data, ensure_ascii=False, indent=2)
(root / 'public/menu-data.js').write_text('export const menuData = ' + serialized + ';\n', encoding='utf-8')
(root / 'reference/menu-verified.json').write_text(serialized, encoding='utf-8')
print(f'Imported {len(items)} verified dishes across {len(categories)} categories.')
