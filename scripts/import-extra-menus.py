"""Copy the remaining original menu text into local data, without guessing prices."""
from pathlib import Path
from html.parser import HTMLParser
import json
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]


class Node:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def find(self, predicate):
        for child in self.children:
            if isinstance(child, Node):
                if predicate(child):
                    yield child
                yield from child.find(predicate)

    def text(self):
        return ''.join(child.text() if isinstance(child, Node) else child for child in self.children)


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag == 'br':
            node.children.append('\n')
        if tag not in ('area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'):
            self.stack.append(node)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                if tag in ('p', 'div'):
                    self.stack[index].children.append('\n')
                self.stack = self.stack[:index]
                return

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def has_class(node, value):
    return value in node.attrs.get('class', '').split()


def plain(node):
    return unicodedata.normalize('NFC', re.sub(r'\s+', ' ', node.text()).strip())


def paragraphs(node):
    return [unicodedata.normalize('NFC', re.sub(r'[^\S\n]+', ' ', line).strip()) for line in node.text().splitlines() if line.strip()]


def read(name):
    return Document((ROOT / 'reference' / (name + '.html')).read_text(encoding='utf-8')).root


def panel_sections(document, selected=None):
    sections = []
    titles = list(document.find(lambda n: has_class(n, 'panel-title')))
    for title in titles:
        anchor = next(title.find(lambda n: n.tag == 'a'), None)
        if not anchor:
            continue
        panel_id = anchor.attrs.get('href', '')[1:]
        if selected is not None and panel_id not in selected:
            continue
        panel = next(document.find(lambda n: n.attrs.get('id') == panel_id))
        dish_titles = list(panel.find(lambda n: has_class(n, 'item-title')))
        if dish_titles:
            prices = list(panel.find(lambda n: has_class(n, 'item-price')))
            descriptions = list(panel.find(lambda n: has_class(n, 'item-info')))
            assert len(dish_titles) == len(prices) == len(descriptions), panel_id
            sections.append({'title': plain(title), 'items': [
                {'name': plain(name), 'priceLabel': plain(price), 'description': '\n'.join(paragraphs(description))}
                for name, price, description in zip(dish_titles, prices, descriptions)
            ]})
        groups = list(panel.find(lambda n: has_class(n, 'item-group-title')))
        tables = list(panel.find(lambda n: n.tag == 'table'))
        assert len(groups) == len(tables), panel_id
        for group, table in zip(groups, tables):
            items = []
            for row in table.find(lambda n: n.tag == 'tr'):
                cells = list(row.find(lambda n: n.tag == 'td'))
                if len(cells) >= 2:
                    items.append({'name': plain(cells[0]), 'priceLabel': plain(cells[1]), 'description': ''})
                elif len(cells) == 1 and items:
                    items[-1]['description'] = '\n'.join(paragraphs(cells[0]))
            if items:
                sections.append({'title': plain(group), 'items': items})
    return sections


lunch_document = read('dagens-lunch')
lunch_sections = []
for p in lunch_document.find(lambda n: n.tag == 'p' and 'text-align: center' in n.attrs.get('style', '')):
    text = plain(p)
    if not text:
        continue
    if text in ('Måndag : Stängt', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Veckans (tis-fre)', 'Lördag'):
        lunch_sections.append({'title': text, 'paragraphs': []})
    elif lunch_sections and not text.startswith('# Vid allergier'):
        lunch_sections[-1]['paragraphs'].append(text)
assert len(lunch_sections) == 7

menus = {
    'drinks': {'title': 'Dryckesmeny', 'sections': panel_sections(read('menyer'), {'collapse9', 'collapse10', 'collapse11'})},
    'lunch': {'title': 'DAGENS LUNCH VECKOSCHEMA', 'intro': 'Tisdag – Fredag\n11:30 – 14:30\nDagens 129:-\nPensionärspris, Studentrabatt och Take Away (Dagens) – 119:-', 'sections': lunch_sections},
    'weekend': {'title': 'SHOPPINGLUNCH', 'intro': 'Varje Lördag & Söndag mellan Kl. 12.00 – 17.00 har vi vår Shoppinglunch på Sandwallsplats i Borås då vi har ett bättre pris på utvalda rätter samt dryck. Ta en paus i all shopping, eller börja dagen hos oss med dina vänner, kollegor, nära & kära.', 'sections': panel_sections(read('shoppinglunch'))},
    'aw': {'title': 'AW Meny', 'sections': panel_sections(read('afterwork'))},
}
assert all(menu['sections'] for menu in menus.values())
serialized = json.dumps(menus, ensure_ascii=False, indent=2)
(ROOT / 'public' / 'extra-menus.js').write_text('export const extraMenus = ' + serialized + ';\n', encoding='utf-8')
print(json.dumps({key: {'sections': len(value['sections']), 'items': sum(len(section.get('items', [])) for section in value['sections'])} for key, value in menus.items()}, ensure_ascii=False))
