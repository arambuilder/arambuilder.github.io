import json, re, pathlib, collections
ROOT = pathlib.Path(__file__).parent
d = json.load(open(ROOT/'data/ddragon.json'))
augs = json.load(open(ROOT/'data/augs.json'))['augs']
icons = d['icons']

BURN = {6653, 2503, 3068, 6664, 3118}  # món gây hiệu ứng thiêu đốt / sát thương theo thời gian
ITEMDMG = {6653, 2503, 6655, 3068, 6664, 3075, 4646, 3087, 6672, 3153, 3074, 6698, 3748, 6631, 3152, 3146,
           2502, 3050, 3107, 3084, 3742, 6662, 3181, 3124, 3091, 3115, 3302, 3085, 3094, 3095, 3100, 3078, 3508, 2510, 6699}
SPELLBLADE = {3100, 3078, 6662, 3508, 2510}
# Nhóm độc nhất lấy từ dữ liệu game (CommunityDragon items.cdtb.bin.json, mMaxGroupOwnable = 1)
EXCL = {
  'lastwhisper': ('Xuyên giáp', [3033, 3036, 3071, 3302, 6694]),
  'lifeline': ('Bảo Hiểm Ma Pháp', [2525, 3003, 3053, 3156, 6673]),
  'tear': ('Nước Mắt Nữ Thần', [2526, 3003, 3004, 3119]),
  'voidpen': ('Xuyên kháng phép Hư Không', [3135, 3137, 3302, 8010]),
  'immolate': ('Hiến Tế', [3068, 6664]),
  'spellblade': ('Kiếm Phép', [2510, 3078, 3100, 3508, 6662]),
  'hydra': ('Mãng Xà', [3074, 3748, 6631, 6698]),
  'spellshield': ('Khiên Phép', [3102, 3814]),
}

def feat(x):
    st, tags, desc = x['st'], set(x['tags']), x['d']
    head = desc.split(' | | ')[0]
    f = {}
    def put(k, v):
        if v: f[k] = round(v, 2)
    put('AP', st.get('FlatMagicDamageMod', 0) / 100)
    put('AD', st.get('FlatPhysicalDamageMod', 0) / 60)
    put('AS', st.get('PercentAttackSpeedMod', 0) / 0.5)
    put('CRIT', st.get('FlatCritChanceMod', 0) / 0.25)
    put('HP', st.get('FlatHPPoolMod', 0) / 500)
    put('AR', st.get('FlatArmorMod', 0) / 50)
    put('MR', st.get('FlatSpellBlockMod', 0) / 50)
    put('MANA', st.get('FlatMPPoolMod', 0) / 500)
    m = re.search(r'(\d+) Điểm Hồi Kỹ Năng', head)
    put('HASTE', int(m.group(1)) / 20 if m else 0)
    if 'Sức Mạnh Lá Chắn và Hồi Máu' in head: f['HEALSH'] = 1
    if tags & {'ArmorPenetration', 'MagicPenetration'} or 'Sát Lực' in head: f['PEN'] = 1
    if 'OnHit' in tags: f['ONHIT'] = 1
    if tags & {'LifeSteal', 'SpellVamp'}: f['SUST'] = 1
    if 'NonbootsMovement' in tags: f['MS'] = .5
    if 'Tenacity' in tags: f['TEN'] = 1
    if 'Active' in tags: f['ACTIVE'] = 1
    iid = int(x['id'])
    if iid in BURN: f['BURN'] = 1
    if iid in ITEMDMG: f['ITEMDMG'] = 1
    if iid in SPELLBLADE:
        f['SPELLBLADE'] = 1
        f.pop('ONHIT', None)  # Kiếm Phép không phải hiệu ứng Khi Đánh Trúng thật
    return f

def cat(f):
    ap, ad = f.get('AP', 0), f.get('AD', 0)
    if ap and ad: return 'hy'
    if ap: return 'ap'
    if ad: return 'ad'
    if f.get('AS') or f.get('CRIT'): return 'as'
    return 'tk'

ag = json.load(open(ROOT/'data/builds_aramgg.json'))
for iid, x in ag['extraItems'].items():
    icons['i_' + iid] = x.pop('icon', '')
    d['items'].append(x)

IT = {}
for x in d['items'] + d['boots']:
    f = feat(x)
    groups = [g for g, (vi, ids) in EXCL.items() if int(x['id']) in ids]
    IT[x['id']] = {'n': x['name'], 'g': x['g'], 'f': f, 'c': cat(f), 'gr': groups,
                   'boots': 'Boots' in x['tags'], 'd': x['d'], 'i': icons.get('i_' + x['id'], '')}

CH = [{'id': c['id'], 'n': c['name'], 't': c['title'], 'tags': c['tags'], 'i': icons.get('c_' + c['id'], '')}
      for c in sorted(d['champs'], key=lambda c: c['name'])]

# icon lõi: khớp id, nếu thiếu thì khớp theo tên
byname = {a['nameTRA'].strip().lower(): a['id'] for a in d['cdragonAugs']}
AU = []
for a in augs:
    ic = icons.get('a_%d' % a['id']) or icons.get('a_%d' % byname.get(a['name'].lower(), -1), '')
    AU.append({'id': a['id'], 'n': a['name'], 'r': a['r'], 't': a['t'], 'wr': a['wr'], 'd': a['d'], 'i': ic})

# ===== Build theo thống kê aramgg =====
BOOTS = {int(x['id']) for x in d['boots']}
TOK = [('Heal & Shield', 'ench', 'Hồi máu & lá chắn'), ('Lethality', 'leth', 'Sát lực'), ('On-Hit', 'onhit', 'Khi đánh trúng'),
       ('Bruiser', 'bruiser', 'Đấu sĩ'), ('Crit', 'adc', 'Chí mạng'), ('Tank', 'tank', 'Chống chịu'), ('Hybrid', 'hybrid', 'Lai AD/AP'),
       ('Uncategorized', 'other', 'Phổ biến'), ('AP', 'ap', 'Phép thuật'), ('AD', 'ad', 'Vật lý')]

def tokens(label):
    out, s = [], label
    while s:
        for t, code, vi in TOK:
            if s.startswith(t):
                out.append((code, vi)); s = s[len(t):]; break
        else:
            s = s[1:]
    return out

def infer_type(codes, items):
    c = set(codes)
    if 'ench' in c: return 'ench'
    if 'tank' in c and 'ap' in c: return 'aptank'
    if 'tank' in c: return 'tank'
    if 'ap' in c and 'onhit' in c: return 'apas'
    if 'ap' in c and 'bruiser' in c: return 'bmage'
    if 'ap' in c: return 'mage'
    if 'hybrid' in c: return 'apas'
    if 'leth' in c: return 'leth'
    if 'adc' in c: return 'adc'
    if 'onhit' in c: return 'onhit'
    if 'bruiser' in c: return 'bruiser'
    if 'ad' in c: return 'adcaster'
    # không có nhãn: đoán theo chỉ số trang bị
    agg = {}
    for i in items[:6]:
        for k, v in IT[str(i)]['f'].items(): agg[k] = agg.get(k, 0) + v
    ap, ad, hp = agg.get('AP', 0), agg.get('AD', 0), agg.get('HP', 0)
    if agg.get('HEALSH', 0) >= 2: return 'ench'
    if ap >= ad and ap >= 1.5: return 'bmage' if hp >= 2 else 'mage'
    if ad > ap: return 'adc' if agg.get('CRIT', 0) >= 2 else 'bruiser'
    return 'tank'

TYPE_VI = {'mage':'Phép thuật', 'bmage':'Phép thuật đánh lâu', 'apas':'Phép thuật khi đánh trúng', 'tank':'Chống chịu', 'aptank':'Chống chịu phép thuật',
           'ench':'Hồi máu & lá chắn', 'leth':'Sát lực', 'adc':'Chí mạng', 'onhit':'Khi đánh trúng', 'bruiser':'Đấu sĩ', 'adcaster':'Vật lý'}

DB = {}
for cid, v in ag['champs'].items():
    paths = []
    for bld in v['builds']:
        if not bld['core']: continue
        sets = bld['core']
        nb = [i for i in sets[0]['items'] if i not in BOOTS]
        extra = [i for s in sets[1:] for i in s['items'] if i not in BOOTS]
        core = (nb + [i for i in extra if i not in nb])[:2]
        if any(set(core) == set(p['core']) for p in paths):  # trùng core → gộp kho đồ
            p = next(p for p in paths if set(core) == set(p['core']))
            p['pool'] += [i for i in bld['sit'] if i not in BOOTS and i not in p['pool'] and i not in p['core']]
            continue
        pool = []
        for i in nb[2:] + extra + bld['sit']:
            if i not in BOOTS and i not in core and i not in pool and str(i) in IT: pool.append(i)
        bootc = collections.Counter(i for s in sets for i in s['items'] if i in BOOTS)
        boots = bootc.most_common(1)[0][0] if bootc else next((i for i in bld['sit'] if i in BOOTS), 3047)
        toks = tokens(bld['label'])
        typ = infer_type([t[0] for t in toks], core + pool)
        named = [(code, vi) for code, vi in toks if code != 'other']
        if len(named) > 1: named = [t for t in named if t[0] != 'ad']
        label = ' · '.join(vi for code, vi in named) or TYPE_VI[typ]
        paths.append({'label': label, 'type': typ, 'wr': bld['wr'], 'core': core, 'pool': pool, 'boots': boots,
                      'sets': [{'items': s['items'], 'wr': s['wr'], 'pr': s['pr']} for s in sets]})
    DB[cid] = {'paths': paths, 'augs': v['augs']}

data = 'const DATA=' + json.dumps({'v': d['version'], 'patch': '26.18', 'CH': CH, 'IT': IT, 'AU': AU, 'DB': DB, 'EXCL': {g: {'n': vi, 'ids': [str(i) for i in ids]} for g, (vi, ids) in EXCL.items()}},
                                  ensure_ascii=False, separators=(',', ':')) + ';'
src = ROOT / 'src'
page = (src/'page.html').read_text()
js = '\n'.join([data, (src/'builds.js').read_text(), (src/'augtags.js').read_text(), (src/'kit.js').read_text(), (src/'engine.js').read_text(), (src/'app.js').read_text()])
out = page.replace('/*__SCRIPT__*/', js)
(ROOT/'dist').mkdir(exist_ok=True)
(ROOT/'dist/index.html').write_text(out)
print('size', len(out.encode()) // 1024, 'KB; items', len(IT), 'augs', len(AU), 'no-icon augs', sum(1 for a in AU if not a['i']))
