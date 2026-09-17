"""Validate package integrity and content links. This does not run either game."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib
import json
import re
import struct
import xml.etree.ElementTree as ET
import zlib

ROOT = Path(__file__).resolve().parents[1]

def check(condition, message):
    if not condition:
        raise AssertionError(message)

def load(name):
    return json.loads((ROOT / name).read_text(encoding='utf-8'))

def validate_png(path):
    data = path.read_bytes()
    check(data[:8] == b'\x89PNG\r\n\x1a\n', f'Bad PNG signature: {path}')
    pos = 8
    ended = False
    while pos < len(data):
        size = struct.unpack('>I', data[pos:pos+4])[0]
        chunk = data[pos+4:pos+8]
        payload = data[pos+8:pos+8+size]
        expected = struct.unpack('>I', data[pos+8+size:pos+12+size])[0]
        check(zlib.crc32(chunk + payload) & 0xffffffff == expected, f'PNG CRC failed: {path}')
        pos += 12 + size
        if chunk == b'IEND':
            ended = True
            break
    check(ended, f'Missing PNG end: {path}')

cw = load('data/clockwork-rivals.json')
lf = load('data/living-frontier.json')
manifest = load('assets/manifest.json')
paths = {item['path'] for item in manifest['assets']}
check(len(paths) == len(manifest['assets']), 'Duplicate manifest paths')
for item in manifest['assets']:
    p = ROOT / item['path']
    check(p.is_file(), f'Missing asset {p}')
    check(p.stat().st_size == item['bytes'], f'Asset size changed: {p}')
    check(hashlib.sha256(p.read_bytes()).hexdigest() == item['sha256'], f'Asset hash changed: {p}')
    if p.suffix == '.png':
        validate_png(p)
        width, height = struct.unpack('>II', p.read_bytes()[16:24])
        check((width, height) == (item['width'], item['height']), f'Wrong dimensions: {p}')
    elif p.suffix == '.svg':
        svg = ET.parse(p).getroot()
        check(svg.tag.endswith('svg') and 'viewBox' in svg.attrib, f'Invalid SVG: {p}')

for game, field in [(cw, 'parts'), (lf, 'cards')]:
    cards = game[field]
    ids = [c['id'] for c in cards]
    check(len(ids) == 10 and len(set(ids)) == 10, f'Expected 10 distinct definitions in {game["game"]}')
    check(sum(c['copies'] for c in cards) == 30, 'Expected 30-card draft deck')
    for card in cards:
        check(card['art'] in paths, f'Unmapped card art: {card["id"]}')
        check(card['rulesText'] and card['effect']['kind'], f'Missing rules: {card["id"]}')
        effect = card['effect']
        for conditional in ['adjacencyBonus', 'companionBonus']:
            if conditional in effect:
                check(effect[conditional]['friendlyDefinition'] in ids, 'Unknown companion reference')
    check(game['rulesVersion'] == '0.1.0', 'Unexpected rules version')

resources = set(cw['setup']['startingResources'])
for card in cw['parts']:
    if card['effect']['kind'] == 'convert':
        for direction in ['input', 'output']:
            amounts = card['effect'][direction]
            check(set(amounts) <= resources, 'Unknown resource')
            check(all(isinstance(n, int) and n > 0 for n in amounts.values()), 'Invalid conversion amount')
check(sum(c['copies'] for c in cw['commissions']) == 12, 'Commission deck mismatch')
check(all(c['art'] in paths for c in cw['commissions']), 'Missing commission art')
check(cw['limits']['maxRounds'] == 8 and cw['limits']['targetPrestige'] == 10, 'Clockwork goals changed')
check(lf['setup']['rounds'] == 6, 'Frontier round count changed')
check(all(c['growthCost'] >= 0 for c in lf['cards']), 'Negative planting cost')

tiles = lf['setup']['habitats']
coords = {(h['q'], h['r']) for h in tiles}
check(len(coords) == 7, 'Map coordinates not unique')
directions = [(1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)]
for h in tiles:
    neighbors = [(h['q']+dq,h['r']+dr) for dq,dr in directions if (h['q']+dq,h['r']+dr) in coords]
    check(len(neighbors) == (6 if h['id'] == 'H0' else 3), 'Incorrect radius-one map topology')
lookup = {h['id']: h for h in tiles}
home0,home1 = [lookup[lf['setup']['homeTiles'][p]] for p in ['P0','P1']]
check(home0['q'] == -home1['q'] and home0['r'] == -home1['r'], 'Homes are not opposite')
check(home0['terrain'] == home1['terrain'] == 'meadow', 'Homes not symmetric Meadow')

class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []
        self.card_count = 0
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ['href','src']:
            if key in attrs:
                self.references.append(attrs[key])
        if tag == 'article' and 'game-card' in attrs.get('class','').split():
            self.card_count += 1

parser = References()
parser.feed((ROOT/'preview.html').read_text())
for ref in parser.references:
    if ref.startswith(('#','https:','http:','data:')):
        continue
    check((ROOT/ref.split('#')[0]).is_file(), f'Broken catalogue reference: {ref}')
check(parser.card_count == 20, 'Preview must show all 20 card definitions')

required = ['README.md','AGENT-START.md','docs/ARCHITECTURE.md','docs/DECISIONS.md',
    'docs/ENGINE-RECOMMENDATION.md','docs/ART-DIRECTION.md','docs/PLAYTEST-PLAN.md',
    'docs/clockwork-rivals/PLAN.md','docs/living-frontier/PLAN.md','contracts/engine-contract.ts']
for file in required:
    check((ROOT/file).is_file(), f'Missing handoff file {file}')
for p in ROOT.rglob('*.md'):
    if any(part in {'node_modules', 'dist', '.local', '.git'} for part in p.relative_to(ROOT).parts):
        continue
    for target in re.findall(r'\]\(([^)]+)\)',p.read_text(encoding='utf-8')):
        if target.startswith(('http:','https:','#','mailto:')):
            continue
        check((p.parent/target).is_file(), f'Broken markdown link in {p}: {target}')

print(json.dumps({'status':'passed','assets':len(manifest['assets']),
    'illustrations':sum(a['kind']=='generated-illustration' for a in manifest['assets']),
    'svg_components':sum(a['kind']=='editable-vector' for a in manifest['assets']),
    'card_definitions':20,'map_tiles':7,'preview_cards':parser.card_count,
    'scope':'Package/data integrity only; no gameplay or balance validation'}, indent=2))
