// ===================== BỘ MÁY GỢI Ý =====================
const DIM_VI = { AP:'Sức Mạnh Phép Thuật', AD:'Sức Mạnh Công Kích', AS:'Tốc Độ Đánh', CRIT:'Tỉ Lệ Chí Mạng',
  HASTE:'Điểm Hồi Kỹ Năng', HP:'Máu', AR:'Giáp', MR:'Kháng Phép', ONHIT:'hiệu ứng Khi Đánh Trúng', PEN:'xuyên giáp/kháng phép',
  HEALSH:'Sức Mạnh Hồi Máu & Lá Chắn', MANA:'Năng Lượng', BURN:'sát thương thiêu đốt', SUST:'hút máu', MS:'Tốc Độ Di Chuyển',
  TEN:'Kháng Hiệu Ứng', SPELLBLADE:'Kiếm Phép', ACTIVE:'kỹ năng kích hoạt', ITEMDMG:'sát thương từ trang bị', MELEE:'cận chiến' };

const TYPE_CATS = { mage:['ap'], bmage:['ap','tk'], apburst:['ap'], apas:['ap','hy','as'], adc:['ad','as'], onhit:['ad','as','hy'],
  leth:['ad'], adcaster:['ad'], bruiser:['ad','tk'], tank:['tk'], tanksup:['tk'], aptank:['ap','tk'], hpbruiser:['ad','tk'], ench:['ap','tk'] };

// Món gây thiêu đốt theo thứ tự ưu tiên cho từng loại hướng build
const ENSURE_ITEMS = {
  BURN: path => {
    const g = GROUP[path.type];
    if (g === 'ap' || g === 'aptank' || g === 'sup') return ['6653', '2503', '6664', '3068', '3118'];
    if (g === 'tank') return ['3068', '6664', '6653'];                       // đỡ đòn: Hiến Tế trước, Liandry nếu cần thêm
    if (g === 'hpb' || path.type === 'bruiser') return ['3068', '6664'];       // đấu sĩ vật lý: chỉ món Hiến Tế
    return [];                                                                 // xạ thủ / sát thủ vật lý: không có món phù hợp
  },
};
const ENSURE_WHY = {
  '6653': 'thiêu đốt 2% Máu tối đa mỗi giây khi trúng kỹ năng',
  '2503': 'kỹ năng gây sát thương thiêu đốt thêm trong 3 giây',
  '3068': 'liên tục thiêu đốt kẻ địch xung quanh khi giao tranh',
  '6664': 'liên tục thiêu đốt kẻ địch xung quanh khi giao tranh',
  '3118': 'chiêu cuối để lại vùng đất cháy gây sát thương theo thời gian',
};
const CRIT_X = { Yasuo: 2, Yone: 2 }; // nội tại nhân đôi Tỉ Lệ Chí Mạng
const AUG_BY_ID = Object.fromEntries(DATA.AU.map(a => [a.id, a]));
const id = k => String(I[k]);
const dot = (a, b) => Object.keys(a).reduce((s, k) => s + a[k] * (b[k] || 0), 0);

const GROUP = { mage:'ap', bmage:'ap', apburst:'ap', apas:'ap', adc:'ad', onhit:'ad', leth:'ad', adcaster:'ad', bruiser:'ad',
  tank:'tank', tanksup:'tank', aptank:'aptank', hpbruiser:'hpb', ench:'sup' };

// Ái lực chỉ số của hướng build = trộn mẫu loại build + chỉ số trung bình của các món đồ thực tế
function itemAff(ids, typeAff) {
  const agg = {};
  ids.forEach(x => { const f = DATA.IT[x]?.f || {}; for (const k in f) if (k !== 'ACTIVE' && k !== 'MS') agg[k] = (agg[k] || 0) + f[k]; });
  const mx = Math.max(0.001, ...Object.values(agg));
  const aff = {};
  for (const k in agg) aff[k] = 0.5 * agg[k] / mx;
  for (const k in typeAff) aff[k] = (aff[k] || 0) + 0.5 * typeAff[k];
  return aff;
}

function champPaths(champId) {
  const raw = B[champId] || [['bruiser', ['bc', 'sky']]];
  let note = '';
  const manual = [];
  for (const p of raw) {
    if (!Array.isArray(p)) { note = p.note || note; continue; }
    const [type, core, opt = {}] = p;
    const T = PATH_TYPES[type];
    const coreIds = core.map(id);
    const pool = [...(opt.pool || []), ...T.pool].map(id).filter((x, i, arr) => !coreIds.includes(x) && arr.indexOf(x) === i);
    manual.push({ type, label: opt.label || T.label, core: coreIds, pool, aff: T.aff, boots: String(T.boots), critX: CRIT_X[champId] || 1, src: 'manual', champ: champId });
  }
  const db = DATA.DB[champId];
  if (!db || !db.paths.length) { manual.forEach(p => { p.apOK = manual.some(q => ['ap', 'aptank', 'sup'].includes(GROUP[q.type])); }); return { paths: manual, note, augs: [] }; }
  const paths = db.paths.map(p => {
    const core = p.core.map(String), pool = p.pool.map(String).filter(x => DATA.IT[x]);
    const T = PATH_TYPES[p.type] || PATH_TYPES.bruiser;
    return { type: p.type, label: p.label, core, pool, aff: itemAff([...core, ...pool.slice(0, 6)], T.aff), boots: String(p.boots),
      critX: CRIT_X[champId] || 1, src: 'data', wr: p.wr, sets: p.sets, champ: champId };
  });
  // Bổ sung hướng build tự soạn nếu thống kê chưa có nhóm đó (vd: AP + Máu cho tướng đỡ đòn)
  const groups = new Set(paths.map(p => GROUP[p.type]));
  manual.forEach(m => { if (!groups.has(GROUP[m.type])) { paths.push(m); groups.add(GROUP[m.type]); } });
  const ov = OVERRIDES[champId];
  if (ov) {
    const keep = paths.filter(p => !(ov.removeLabels || []).includes(p.label));
    paths.length = 0; paths.push(...keep);
    (ov.add || []).forEach(a => {
      const items = a.items.map(id), T = PATH_TYPES[a.type];
      paths.push({ type: a.type, label: a.label, core: items.slice(0, 2), pool: [...items.slice(2), ...(a.extra || []).map(id)], aff: itemAff(items, T.aff),
        boots: String(a.boots || T.boots), critX: 1, src: 'preset', champ: champId, why: a.why });
    });
  }
  if (HP_BRUISER.includes(champId)) {
    const core = HP_BRUISER_CORE.map(id);
    {
      const T = PATH_TYPES.hpbruiser;
      paths.push({ type: 'hpbruiser', label: T.label, core, pool: T.pool.map(id).filter(x => !core.includes(x)), aff: T.aff, boots: String(T.boots),
        critX: 1, src: 'preset', champ: champId, why: 'Build Đấu sĩ đỡ đòn phổ biến trong Hỗn Loạn: Trái Tim Khổng Thần cộng dồn Máu, Huyết Giáp Chúa Tể đổi Máu thành Sức Mạnh Công Kích, Rìu Đại Mãng Xà gây sát thương theo Máu, Giáp Máu Warmog thêm Máu và hồi phục.', hpb: true });
    }
  }
  // Tướng có kỹ năng tăng theo SMPT hay không (dựa trên việc có hướng build phép thuật)
  const apOK = paths.some(p => ['ap', 'aptank', 'sup'].includes(GROUP[p.type]));
  paths.forEach(p => { p.apOK = apOK; });
  return { paths, note, augs: db.augs || [] };
}

function augProfile(augIds) {
  const A = {}; let crit = 0; let asCap = 0; const forced = []; const merges = []; const ensures = []; const notes = [];
  augIds.filter(Boolean).forEach(aid => {
    const t = AT[aid] || { v: {} };
    for (const k in t.v) A[k] = (A[k] || 0) + t.v[k];
    if (t.cap?.CRIT) crit += t.cap.CRIT;
    if (t.cap?.AS) asCap += t.cap.AS;
    (t.force || []).forEach(k => forced.push({ item: id(k), aug: aid }));
    if (t.ensure) for (const k in t.ensure) ensures.push({ dim: k, min: t.ensure[k], aug: aid });
    if (t.merge) merges.push({ items: t.merge.items.map(id), name: t.merge.name, aug: aid });
    notes.push({ aug: aid, text: t.n || '' });
  });
  return { A, crit, asCap, forced, merges, ensures, notes };
}

function recommendPath(paths, augIds) {
  const { A } = augProfile(augIds);
  const pref = {};
  augIds.filter(Boolean).forEach(aid => { const pr = (AT[aid] || {}).prefer || {}; for (const k in pr) pref[k] = (pref[k] || 0) + pr[k]; });
  const scores = paths.map(p => dot(p.aff, A) + (pref[p.type] || 0));
  const has = augIds.some(Boolean);
  let best = 0;
  scores.forEach((s, i) => { if (s > scores[best]) best = i; });
  const sorted = [...scores].sort((a, b) => b - a);
  const lean = has && paths.length > 1 && sorted[0] >= 0.5 && sorted[0] - sorted[1] >= 0.35;
  return { best, scores, lean };
}

function itemGroups(ids) { return new Set(ids.flatMap(x => DATA.IT[x]?.gr || [])); }

function buildFor(path, augIds) {
  const prof = augProfile(augIds);
  const { A } = prof;
  const slots = [];
  const taken = new Set();
  const push = (itemId, kind, reason) => { if (!taken.has(itemId) && slots.length < 6) { slots.push({ id: itemId, kind, reason }); taken.add(itemId); } };

  const members = s => s.members || [s.id];
  const pushMerge = m => {
    if (m.placed || slots.length >= 6) return;
    m.placed = true;
    const a = AUG_BY_ID[m.aug];
    const names = m.items.map(x => DATA.IT[x].n);
    const isCore = m.items.some(x => path.core.includes(x));
    slots.push({ id: m.items[0], members: m.items, name: m.name, kind: 'merge', core: isCore, augs: [m.aug],
      reason: `Nhiệm vụ lõi «${a.n}»: mua ${names.join(' + ')} → gộp thành ${m.name}, chỉ chiếm 1 ô.${isCore ? ' (Có chứa món Core của hướng build.)' : ''}${m.replaced ? ` Thay cho món Core ${DATA.IT[m.replaced].n} vì cùng nhóm độc nhất, không thể sở hữu cùng lúc.` : ''}` });
    m.items.forEach(x => taken.add(x));
  };
  path.core.forEach(x => {
    const clash = prof.merges.find(m => !m.items.includes(x) && m.items.some(y => DATA.IT[y].gr.some(g => DATA.IT[x].gr.includes(g))));
    if (clash) { clash.replaced = x; pushMerge(clash); return; } // món Core cùng nhóm độc nhất → nhường chỗ cho ô gộp
    const m = prof.merges.find(m => m.items.includes(x));
    if (m) pushMerge(m); else push(x, 'core', path.why ? `Core – ${path.why}` : 'Core – nền tảng bắt buộc của hướng build này.');
  });
  prof.merges.forEach(pushMerge);
  // món bắt buộc theo kỹ năng tướng
  const kit = kitRequirement(path.champ, path, taken);
  if (kit && kit.satisfied) { const s = slots.find(s => (s.members || [s.id]).includes(kit.satisfied)); if (s && !s.members) s.reason += ` Món này cũng đáp ứng kỹ năng tướng: ${kit.k.why}.`; }
  else if (kit) {
    const groups = itemGroups(slots.flatMap(members));
    const pick = kit.list.find(x => !DATA.IT[x].gr.some(g => groups.has(g)));
    if (pick) push(pick, 'kit', `Theo kỹ năng tướng: ${kit.k.why} → cần món có ${kit.spec.label}, ${DATA.IT[pick].n} là lựa chọn tốt nhất.`);
  }
  prof.forced.forEach(({ item, aug }) => {
    const a = AUG_BY_ID[aug];
    if (taken.has(item)) { const s = slots.find(s => (s.members || [s.id]).includes(item)); if (s) { if (!s.members) s.reason += ` Lõi «${a.n}» còn nâng cấp món này.`; (s.augs = s.augs || []).push(aug); } return; }
    push(item, 'force', `Bắt buộc cho lõi «${a.n}»: ${(AT[aug] || {}).n || 'lõi yêu cầu món này.'}`);
    const fs = slots.find(s => s.id === item); if (fs) (fs.augs = fs.augs || []).push(aug);
  });

  // lõi yêu cầu số món tối thiểu có một chỉ số (vd: món gây thiêu đốt)
  const ensureNotes = [];
  const pathCats = [...new Set([...(TYPE_CATS[path.type] || ['ad']), ...[...path.core, ...path.pool.slice(0, 8)].map(x => DATA.IT[x]?.c).filter(Boolean)])];
  const merged = new Map();
  prof.ensures.forEach(en => { const m = merged.get(en.dim); if (!m || en.min > m.min) merged.set(en.dim, en); });
  merged.forEach(en => {
    const a = AUG_BY_ID[en.aug];
    const have = () => slots.flatMap(members).filter(x => DATA.IT[x]?.f[en.dim]).length;
    const order = ENSURE_ITEMS[en.dim](path).filter(x => path.apOK !== false || !['ap', 'hy'].includes(DATA.IT[x].c));
    for (const x of order) {
      if (have() >= en.min || slots.length >= 6) break;
      if (taken.has(x)) continue;
      const groups = itemGroups(slots.flatMap(members));
      if (DATA.IT[x].gr.some(g => groups.has(g))) continue;
      push(x, 'force', `Lõi «${a.n}» cần ${DIM_VI[en.dim]}: ${DATA.IT[x].n} ${ENSURE_WHY[x] || 'đáp ứng yêu cầu của lõi'}.`);
      const es = slots.find(s => s.id === x); if (es) (es.augs = es.augs || []).push(en.aug);
    }
    if (have() < en.min) ensureNotes.push(have()
      ? `Lõi «${a.n}»: hướng build này chỉ lên được ${have()} món gây ${DIM_VI[en.dim]} phù hợp (${path.apOK === false ? 'tướng không có kỹ năng tăng theo SMPT nên không lên Mặt Nạ Đọa Đày Liandry / Đuốc Lửa Đen; ' : ''}Khiên Thái Dương và Áo Choàng Hắc Quang cùng nhóm độc nhất).`
      : `Lõi «${a.n}»: hướng build «${path.label}»${path.apOK === false ? ' (tướng không có kỹ năng tăng theo SMPT)' : ''} không có món gây ${DIM_VI[en.dim]} phù hợp → lõi này kém hiệu quả, nên chọn lõi khác hoặc chuyển sang hướng phép thuật / chống chịu.`);
  });

  const cats = [...new Set([...(TYPE_CATS[path.type] || ['ad']), ...(path.src === 'data' ? [...path.core, ...path.pool.slice(0, 8)].map(x => DATA.IT[x]?.c).filter(Boolean) : [])])];
  const cand = new Map();
  path.pool.forEach((x, i) => cand.set(x, 1 - i * 0.055));
  Object.entries(DATA.IT).forEach(([x, it]) => {
    if (it.boots || cand.has(x) || !cats.includes(it.c)) return;
    if (path.apOK === false && ['ap', 'hy'].includes(it.c)) return;
    if (path.type === 'ench' && !(it.f.HEALSH || it.f.MANA || it.f.AR || it.f.MR)) return;
    cand.set(x, 0.3);
  });

  while (slots.length < 6) {
    const groups = itemGroups(slots.flatMap(members));
    // chỉ số đã có từ các món đã chọn → lõi đẩy chỉ số đó giảm dần (tránh dồn 4 món cùng loại)
    const supplied = {};
    slots.flatMap(members).forEach(x => { const f = DATA.IT[x]?.f || {}; for (const k in f) supplied[k] = (supplied[k] || 0) + f[k]; });
    const critNow = path.critX * (prof.crit + slots.flatMap(members).reduce((s, x) => s + (DATA.IT[x]?.f.CRIT || 0) * 25, 0));
    let best = null;
    for (const [x, base] of cand) {
      if (taken.has(x)) continue;
      const it = DATA.IT[x]; if (!it) continue;
      if (path.apOK === false && ['ap', 'hy'].includes(it.c)) continue;
      if (it.gr.some(g => groups.has(g))) continue;
      let s = base + 0.3 * Object.keys(A).reduce((t, k) => t + (A[k] > 0 ? A[k] / (1 + 0.5 * (supplied[k] || 0)) : A[k]) * (it.f[k] || 0), 0);
      if (it.f.CRIT) {
        if (critNow >= 100) s -= (0.3 * Math.max(A.CRIT || 0, 0) + 0.6) * it.f.CRIT;
        else if (critNow + 25 * path.critX * it.f.CRIT > 100) s -= 0.3 * it.f.CRIT;
      }
      if (prof.asCap && it.f.AS && !it.f.ONHIT) s -= 0.12 * it.f.AS;
      if (!best || s > best.s) best = { x, s, base };
    }
    if (!best) break;
    push(best.x, 'opt', reasonFor(best.x, best.base, augIds, prof));
  }
  // Xếp món của lõi theo thời điểm nhận lõi: lõi ở ô k (cấp 3/7/11/15) → món đó là món thứ k trong thứ tự mua
  const ordered = orderByAugment(slots, augIds);
  return { slots: ordered, boots: bootsFor(path, A), prof, ensureNotes };
}

function reasonFor(itemId, base, augIds, prof) {
  const it = DATA.IT[itemId];
  let top = null;
  augIds.filter(Boolean).forEach(aid => {
    const v = (AT[aid] || {}).v || {};
    const c = dot(v, it.f);
    if (c > 0 && (!top || c > top.c)) top = { aid, c, dims: Object.keys(v).filter(k => v[k] > 0 && it.f[k]) };
  });
  if (top && top.c * 0.3 >= 0.1) {
    return `Được đẩy lên nhờ lõi «${AUG_BY_ID[top.aid].n}» (tận dụng ${top.dims.map(d => DIM_VI[d]).join(', ')}).`;
  }
  if (base >= 0.8) return 'Món được người chơi hướng build này mua nhiều nhất (thống kê aramgg) trong số món còn lại.';
  if (base < 0.4) return 'Bổ sung ngoài kho đồ mặc định vì hợp với các lõi đã chọn.';
  return 'Món optional phù hợp để hoàn thiện bộ đồ.';
}

function bootsFor(path, A) {
  const adTypes = ['adc', 'onhit', 'apas'];
  if (path.type === 'mage' && (A.PEN || 0) < 0) return { id: '3158', reason: 'Lõi đã cho xuyên kháng phép → đổi Giày Pháp Sư sang Giày Khai Sáng Ionia.' };
  if (A.AS2HASTE) return { id: '3006', reason: 'Lõi đổi Tốc Độ Đánh thành Điểm Hồi Kỹ Năng → 30% Tốc Độ Đánh của Giày Cuồng Nộ được đổi thành hồi chiêu (thường nhiều hơn 10 Điểm Hồi Kỹ Năng của Giày Khai Sáng Ionia).' };
  if ((A.AS || 0) >= 1 && adTypes.includes(path.type)) return { id: '3006', reason: 'Lõi thiên về đánh thường → Giày Cuồng Nộ.' };
  if ((A.HASTE || 0) >= 1 && !adTypes.includes(path.type)) return { id: '3158', reason: 'Lõi thiên về hồi chiêu → Giày Khai Sáng Ionia cộng dồn tốt.' };
  const def = { 3020:'Giày Pháp Sư – xuyên kháng phép cho pháp sư.', 3006:'Giày Cuồng Nộ – tốc đánh cho lối đánh thường.',
    3158:'Giày Khai Sáng Ionia – hồi chiêu kỹ năng và phép bổ trợ.', 3047:'Giày Thép Gai – mặc định; đổi sang Giày Thủy Ngân nếu địch nhiều khống chế/phép.',
    3111:'Giày Thủy Ngân – kháng hiệu ứng khi lao vào mở giao tranh.' };
  return { id: path.boots, reason: def[path.boots] || '' };
}

function augSuit(aid, paths) {
  const t = AT[aid]; const a = AUG_BY_ID[aid];
  const fit = t ? Math.max(...paths.map(p => dot(p.aff, t.v))) : 0;
  return fit + (5 - a.t) * 0.1 + (a.wr - 50) * 0.02;
}

// Lõi cần một chỉ số mà không hướng build nào của tướng dùng tới
function augMisfit(aid, paths) {
  const need = (AT[aid] || {}).need;
  if (!need) return null;
  return paths.some(p => need.some(k => p.aff[k])) ? null : need;
}

// Vì sao một món bị đẩy khỏi bộ đồ
function dropReason(itemId, augIds) {
  const it = DATA.IT[itemId];
  let worst = null;
  augIds.filter(Boolean).forEach(aid => {
    const v = (AT[aid] || {}).v || {};
    const neg = Object.keys(v).filter(k => v[k] < 0 && it.f[k]);
    const c = neg.reduce((s, k) => s + v[k] * it.f[k], 0);
    if (neg.length && (!worst || c < worst.c)) worst = { aid, c, neg };
  });
  if (worst) return `${it.n} bị thay ra vì lõi «${AUG_BY_ID[worst.aid].n}» làm giảm giá trị ${worst.neg.map(d => DIM_VI[d]).join(', ')} của món này.`;
  return `${it.n} bị thay ra vì có món khác hợp với các lõi vừa chọn hơn (món này không bị lõi làm giảm giá trị).`;
}

// ===================== ĐỒ KHẮC CHẾ HỒI MÁU / LÁ CHẮN =====================
const COUNTER = {
  heal: { ids: ['3033', '6609', '3165', '3075'], tag: 'Giảm hồi máu', group: 'grievous',
    why: 'Đội địch hồi máu mạnh → cần hiệu ứng Vết Thương Sâu (giảm 40% hồi máu).' },
  shield: { ids: ['6695'], tag: 'Phá lá chắn', group: null,
    why: 'Đội địch tạo lá chắn mạnh → Kiếm Ác Xà làm giảm lá chắn của tướng địch.' },
};
const cosine = (a, b) => { let d = 0, na = 0, nb = 0; for (const k in a) { na += a[k] * a[k]; d += a[k] * (b[k] || 0); } for (const k in b) nb += b[k] * b[k]; return na && nb ? d / Math.sqrt(na * nb) : 0; };

function applyCounters(path, build, enemy) {
  const slots = build.slots.map(s => ({ ...s }));
  const notes = [];
  const cats = [...new Set([...(TYPE_CATS[path.type] || []), ...[...path.core, ...path.pool.slice(0, 8)].map(x => DATA.IT[x]?.c).filter(Boolean)])];
  const all = () => slots.flatMap(s => s.members || [s.id]);
  for (const key of ['heal', 'shield']) {
    if (!enemy[key]) continue;
    const C = COUNTER[key];
    const have = all().find(x => C.ids.includes(x));
    if (have) { notes.push({ key, text: `Bộ đồ đã có ${DATA.IT[have].n} – đủ để khắc chế ${key === 'heal' ? 'hồi máu' : 'lá chắn'}, không cần đổi.` }); continue; }
    // chọn món khắc chế hợp hướng build nhất
    const opts = C.ids.filter(x => cats.includes(DATA.IT[x].c) && !(path.apOK === false && ['ap', 'hy'].includes(DATA.IT[x].c)) && !(DATA.IT[x].f.CRIT && (path.aff.CRIT || 0) < 0.3)).sort((a, b) => cosine(DATA.IT[b].f, path.aff) - cosine(DATA.IT[a].f, path.aff));
    if (!opts.length) {
      notes.push({ key, text: key === 'shield'
        ? 'Hướng build này không có món phá lá chắn phù hợp (Kiếm Ác Xà chỉ dành cho tướng vật lý) → ưu tiên dồn sát thương/xuyên thấu để phá lá chắn nhanh.'
        : 'Hướng build này không có món giảm hồi máu phù hợp → nhờ đồng đội mua, hoặc dùng Phép bổ trợ Thiêu Đốt.' });
      continue;
    }
    const pick = opts[0];
    const itP = DATA.IT[pick];
    // thay vào ô Optional có vai trò giống nhất; ưu tiên ô xếp sau (ít quan trọng hơn)
    let best = null;
    slots.forEach((s, i) => {
      if (s.kind !== 'opt') return;
      const others = all().filter(x => x !== s.id);
      const conflict = itP.gr.some(g => others.some(o => DATA.IT[o]?.gr.includes(g)));
      if (conflict) return;
      const sc = cosine(DATA.IT[s.id].f, itP.f) + i * 0.08;
      if (!best || sc > best.sc) best = { i, sc };
    });
    if (!best) { notes.push({ key, text: `Không còn ô Optional để thay bằng ${itP.n} (các ô đều là Core/Bắt buộc).` }); continue; }
    const old = slots[best.i];
    slots[best.i] = { id: pick, kind: 'counter', tag: C.tag,
      reason: `${C.why} Thay cho ${DATA.IT[old.id].n} vì hai món có vai trò chỉ số gần nhau nhất trong các món Optional. Nên mua sớm (món thứ 2–3) nếu địch hồi phục mạnh ngay từ đầu.` };
    notes.push({ key, from: old.id, to: pick, text: `Thay ${DATA.IT[old.id].n} → ${itP.n}: ${C.why}` });
  }
  if (enemy.tank) antiTank(path, slots, notes, all);
  return { ...build, slots, counterNotes: notes };
}

// ===================== CHỐNG ĐỘI HÌNH NHIỀU CHỐNG CHỊU =====================
// Mỗi hướng build: món xuyên % (đánh vào Giáp/Kháng Phép) + món sát thương theo % Máu
const ANTI_TANK = {
  adc:      { pen: '3036', hp: '3153' },
  onhit:    { pen: '3302', hp: '3153', hp2: '6672' },
  leth:     { pen: '6694' },
  adcaster: { pen: '6694' },
  bruiser:  { pen: '3071', hp: '3153', hpNeedAS: true },
  hpbruiser:{ pen: '3071', hp: '3153', hpNeedAS: true },
  mage:     { pen: '3135', hp: '6653' },
  apburst:  { pen: '3135', hp: '6653' },
  bmage:    { pen: '3135', hp: '6653' },
  apas:     { pen: '3135', hp: '3302' },
  tank:     { team: '8020' },
  tanksup:  { team: '8020' },
  aptank:   { pen: '3135', team: '8020' },
  ench:     {},
};
const ANTI_TANK_AUGS = [1084, 1028, 1133, 2098, 1325, 1195, 2083];
const isFlatLeth = x => /Sát Lực/.test((DATA.IT[x]?.d || '').split(' | | ')[0]);
const isAntiTank = x => ['3036','3033','6694','3071','3302','3135','3137','8010','3153','6672','6653','8020'].includes(x);

function antiTank(path, slots, notes, all) {
  const T = ANTI_TANK[path.type] || {};
  const push = text => notes.push({ key: 'tank', text });
  const wants = [];
  if (T.pen) wants.push({ id: T.pen, role: 'pen', why: path.type.startsWith('a') && ['adc','adcaster'].includes(path.type) || ['leth','bruiser','onhit'].includes(path.type)
      ? 'xuyên Giáp theo % – hiệu quả hơn Sát Lực khi địch nhiều Giáp' : 'xuyên Kháng Phép theo % – phá lớp Kháng Phép dày của tướng đỡ đòn' });
  const hpId = T.hpNeedAS && (path.aff.AS || 0) < 0.2 ? null : T.hp;
  if (hpId) wants.push({ id: hpId, alt: T.hp2, role: 'hp', why: 'gây sát thương theo % Máu – càng trâu càng mất nhiều máu' });
  if (T.team) wants.push({ id: T.team, role: 'team', why: 'khiến tướng địch quanh bạn nhận thêm 12% sát thương phép – giúp cả đội phá tướng trâu' });
  if (!wants.length) { push('Hướng build hỗ trợ không có món chống chống chịu hiệu quả → tập trung hồi máu/tạo lá chắn cho người gây sát thương chính của đội.'); return; }

  const flat = all().filter(isFlatLeth);
  if (['leth', 'adcaster'].includes(path.type) && flat.length >= 2)
    push(`Bộ đồ có ${flat.length} món Sát Lực cố định (${flat.map(x => DATA.IT[x].n).join(', ')}) – Sát Lực giảm hiệu quả rõ rệt trước tướng nhiều Giáp; nếu tướng có hướng «Đấu sĩ» hoặc «Chí mạng», cân nhắc chuyển sang.`);
  for (const w of wants) {
    let pick = w.id;
    const ids = all();
    if (ids.includes(pick) && w.alt && !ids.includes(w.alt)) pick = w.alt;
    const itP = DATA.IT[pick];
    if (ids.includes(pick)) { push(`Bộ đồ đã có ${itP.n} (${w.why}).`); continue; }
    // món cùng nhóm độc nhất đã có trong bộ đồ
    const same = slots.findIndex(s => !s.members && DATA.IT[s.id].gr.some(g => itP.gr.includes(g)));
    if (same >= 0) {
      const s = slots[same];
      if (s.kind === 'opt' && !isAntiTank(s.id)) {
        slots[same] = { id: pick, kind: 'counter', tag: ({ pen: 'Xuyên thủng', hp: 'Theo % Máu', team: 'Tăng ST phép' })[w.role], reason: `Địch nhiều chống chịu → ${itP.n}: ${w.why}. Thay cho ${DATA.IT[s.id].n} vì cùng nhóm độc nhất.` };
        notes.push({ key: 'tank', from: s.id, to: pick, text: `Thay ${DATA.IT[s.id].n} → ${itP.n}: ${w.why}.` });
      } else {
        push(`Giữ ${DATA.IT[s.id].n} (${s.kind === 'core' ? 'món Core' : s.kind === 'counter' ? 'đang dùng để khắc chế' : 'đã có tác dụng xuyên thấu'}) – không thể lên thêm ${itP.n} vì cùng nhóm độc nhất.`);
      }
      continue;
    }
    // chọn ô Optional kém hiệu quả nhất trước tướng trâu: ưu tiên món Sát Lực cố định, bỏ qua món chống chống chịu
    let best = null;
    slots.forEach((s, i) => {
      if (s.kind !== 'opt' || isAntiTank(s.id)) return;
      const sc = (isFlatLeth(s.id) ? 2 : 0) + i * 0.15 + cosine(DATA.IT[s.id].f, itP.f) * 0.5 - (DATA.IT[s.id].f.HP || 0) * 0.3;
      if (!best || sc > best.sc) best = { i, sc };
    });
    if (!best) { push(`Không còn ô Optional để thay bằng ${itP.n}.`); continue; }
    const old = slots[best.i];
    slots[best.i] = { id: pick, kind: 'counter', tag: ({ pen: 'Xuyên thủng', hp: 'Theo % Máu', team: 'Tăng ST phép' })[w.role],
      reason: `Địch nhiều chống chịu → ${itP.n}: ${w.why}. Thay cho ${DATA.IT[old.id].n}${isFlatLeth(old.id) ? ' vì Sát Lực cố định mất tác dụng trước tướng nhiều Giáp' : ' vì là món ít hiệu quả nhất trước tướng trâu'}.` };
    notes.push({ key: 'tank', from: old.id, to: pick, text: `Thay ${DATA.IT[old.id].n} → ${itP.n}: ${w.why}.` });
  }
}

const AUG_LEVELS = [3, 7, 11, 15];
function orderByAugment(slots, augIds) {
  const slotOf = s => Math.min(...(s.augs || []).map(a => augIds.indexOf(a)).filter(i => i >= 0));
  const tied = slots.map((s, i) => ({ s, i, k: slotOf(s) })).filter(t => Number.isFinite(t.k));
  if (!tied.length) return slots;
  const out = slots.filter(s => !tied.some(t => t.s === s));
  tied.sort((a, b) => a.k - b.k || a.i - b.i);
  const used = {};
  tied.forEach(({ s, i, k }) => {
    // lõi ở ô k → món thứ k+1; chỉ kéo món lên sớm hơn, không đẩy món vốn đã ở vị trí sớm xuống sau
    let pos = Math.min(k + (used[k] || 0), i, out.length);
    used[k] = (used[k] || 0) + 1;
    out.splice(pos, 0, s);
    const aid = s.augs.find(a => augIds.indexOf(a) === k), a = AUG_BY_ID[aid];
    s.reason = s.reason.replace(/ Xếp ở ô \d+.*$/, '') + ` Xếp ở ô ${pos + 1} vì lõi «${a.n}» được chọn ở Lõi ${k + 1} (cấp ${AUG_LEVELS[k]})${k === 0 ? ' – ngay đầu trận, nên ưu tiên mua sớm nhất' : `, lúc đó bạn thường đã xong khoảng ${k} món trước`}.`;
  });
  return out;
}
