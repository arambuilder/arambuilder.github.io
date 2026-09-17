// ===================== GIAO DIỆN =====================
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const LEVELS = [3, 7, 11, 15];
const ROLE_VI = [['all','Tất cả'],['Fighter','Đấu sĩ'],['Mage','Pháp sư'],['Assassin','Sát thủ'],['Marksman','Xạ thủ'],['Tank','Đỡ đòn'],['Support','Hỗ trợ']];
const RAR_VI = { S:'Bạc', G:'Vàng', P:'Lăng Kính' };
const CH_BY_ID = Object.fromEntries(DATA.CH.map(c => [c.id, c]));

const state = { champ: 'Ezreal', augs: [null, null, null, null], manualPath: null, pathSrc: null, enemy: { heal: false, shield: false, tank: false }, role: 'all', q: '',
  selSlot: null, prevIds: null, lastAuto: 0, dlgSlot: 0, rar: 'all', aq: '', example: true };

try {
  const saved = JSON.parse(localStorage.getItem('aram-forge') || 'null');
  if (saved && saved.enemy) Object.assign(state.enemy, saved.enemy);
  if (saved && CH_BY_ID[saved.champ]) { state.champ = saved.champ; state.augs = (saved.augs || []).concat([null,null,null,null]).slice(0,4); state.example = false; }
} catch (e) {}
const save = () => { try { localStorage.setItem('aram-forge', JSON.stringify({ champ: state.champ, augs: state.augs, enemy: state.enemy })); } catch (e) {} };

$('#patch').textContent = `bản ${DATA.patch}`;

// ---- Danh sách tướng ----
$('#roleFilters').innerHTML = ROLE_VI.map(([k, v]) => `<button type="button" class="fbtn" data-role="${k}" aria-pressed="${k === 'all'}">${v}</button>`).join('');
$('#roleFilters').addEventListener('click', e => {
  const b = e.target.closest('[data-role]'); if (!b) return;
  state.role = b.dataset.role;
  document.querySelectorAll('#roleFilters .fbtn').forEach(x => x.setAttribute('aria-pressed', x === b));
  renderGrid();
});
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();
$('#champSearch').addEventListener('input', e => { state.q = norm(e.target.value.trim()); renderGrid(); });

function renderGrid() {
  const list = DATA.CH.filter(c => (state.role === 'all' || c.tags.includes(state.role)) && (!state.q || norm(c.n + ' ' + c.id).includes(state.q)));
  $('#champGrid').innerHTML = list.length ? list.map(c =>
    `<button type="button" class="champ" data-id="${c.id}" aria-current="${c.id === state.champ}" title="${esc(c.n)}"><img src="${c.i}" alt="" loading="lazy"><span>${esc(c.n)}</span></button>`).join('')
    : `<p style="grid-column:1/-1;color:var(--muted);font-size:13px;margin:0">Không tìm thấy tướng phù hợp.</p>`;
}
$('#champGrid').addEventListener('click', e => {
  const b = e.target.closest('.champ'); if (!b) return;
  if (b.dataset.id !== state.champ) {
    state.champ = b.dataset.id; state.augs = [null, null, null, null]; state.manualPath = null; state.pathSrc = null; state.lastAuto = 0;
    state.prevIds = null; state.selSlot = null; state.example = false;
  }
  document.querySelectorAll('.champ').forEach(x => x.setAttribute('aria-current', x.dataset.id === state.champ));
  if (matchMedia('(max-width:900px)').matches) { $('#roster').classList.add('collapsed'); $('#main').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  save(); render();
});
$('#rosterToggle').addEventListener('click', () => $('#roster').classList.toggle('collapsed'));

// ---- Tính toán ----
function compute() {
  const { paths, note } = champPaths(state.champ);
  const rec = recommendPath(paths, state.augs);
  let idx;
  if (state.manualPath != null && state.manualPath < paths.length) idx = state.manualPath;
  else if (rec.lean) { idx = rec.best; state.manualPath = idx; state.pathSrc = 'auto'; } // chỉ tự chọn 1 lần, sau đó giữ cố định
  else idx = Math.min(state.lastAuto, paths.length - 1);
  if (state.manualPath == null) state.lastAuto = idx;
  const build = applyCounters(paths[idx], buildFor(paths[idx], state.augs), state.enemy);
  return { paths, note, rec, idx, build };
}

// ---- Vẽ ----
function render() {
  const c = CH_BY_ID[state.champ];
  const R = compute();
  const { paths, rec, idx, build } = R;
  const suggest = state.augs.some(Boolean) && rec.best !== idx && rec.scores[rec.best] - rec.scores[idx] >= 0.4 ? rec.best : -1;
  const hasAug = state.augs.some(Boolean);

  $('#hero').innerHTML = `<img src="${c.i}" alt="">
    <div class="grow">
      <h2 class="name">${esc(c.n)}</h2>
      <div class="title">${esc(c.t)} · ${paths.length} hướng build${state.example ? ' · <b>đang hiển thị ví dụ</b>' : ''}</div>
      ${R.note ? `<div class="note">${esc(R.note)}</div>` : ''}
    </div>
    <button class="btn" type="button" id="resetAugs" ${hasAug ? '' : 'disabled'}>Làm lại lõi</button>`;
  $('#resetAugs').onclick = () => { state.augs = [null, null, null, null]; if (state.pathSrc === 'auto') { state.manualPath = null; state.pathSrc = null; } state.prevIds = null; save(); render(); };

  $('#tabs').innerHTML = paths.map((p, i) => {
    const isRec = i === suggest || (hasAug && rec.lean && i === rec.best && i === idx);
    const sub = isRec ? `<span class="rec">${i === idx ? 'Hợp với lõi' : 'Lõi gợi ý hướng này'}</span>` : `<small>${p.src === 'data' ? (p.wr ? `Thắng ${p.wr.toFixed(1)}% · ` : '') : p.src === 'preset' ? 'Build phổ biến Hỗn Loạn · ' : 'Hướng bổ sung · '}Core: ${p.core.map(x => esc(DATA.IT[x].n)).join(' + ')}</small>`;
    return `<button type="button" role="tab" class="tab ${suggest >= 0 && i !== suggest && i !== idx ? 'dim' : ''}" data-i="${i}" aria-selected="${i === idx}">${esc(p.label)}${sub}</button>`;
  }).join('');
  $('#tabs').onclick = e => { const b = e.target.closest('.tab'); if (!b) return; state.manualPath = +b.dataset.i; state.pathSrc = 'user'; state.prevIds = null; state.selSlot = null; render(); };

  const prev = state.prevIds;
  const ids = build.slots.flatMap(s => s.members || [s.id]);
  $('#items').innerHTML = build.slots.map((s, i) => {
    const it = DATA.IT[s.id];
    const isNew = prev && (s.members || [s.id]).some(x => !prev.includes(x));
    if (s.kind === 'merge') return `<button type="button" class="slot merge" data-i="${i}" aria-pressed="${state.selSlot === i}">
      <span class="ord">${i + 1}</span>${isNew ? '<span class="new">MỚI</span>' : ''}
      <span class="stack">${s.members.map(x => `<img src="${DATA.IT[x].i}" alt="">`).join('')}</span>
      <span class="nm">${esc(s.name)}</span><span class="tag force">Gộp ${s.members.length} → 1</span></button>`;
    const tag = s.kind === 'counter' ? `<span class="tag counter">${s.tag}</span>` : s.kind === 'core' ? '<span class="tag core">Core</span>' : s.kind === 'kit' ? '<span class="tag core">Theo kỹ năng</span>' : s.kind === 'force' ? '<span class="tag force">Bắt buộc</span>' : '<span class="tag opt">Optional</span>';
    return `<button type="button" class="slot ${s.kind}" data-i="${i}" aria-pressed="${state.selSlot === i}">
      <span class="ord">${i + 1}</span>${isNew ? '<span class="new">MỚI</span>' : ''}
      <img src="${it.i}" alt=""><span class="nm">${esc(it.n)}</span>${tag}</button>`;
  }).join('');
  $('#items').onclick = e => { const b = e.target.closest('.slot'); if (!b) return; const i = +b.dataset.i; state.selSlot = state.selSlot === i ? null : i; render(); };

  const sel = state.selSlot != null ? build.slots[state.selSlot] : null;
  $('#detail').innerHTML = sel && sel.kind === 'merge'
    ? `<div class="detail"><h3>${esc(sel.name)} <span class="gold">· ${sel.members.reduce((t, x) => t + DATA.IT[x].g, 0)} vàng cho ${sel.members.length} món</span></h3><p class="why">${esc(sel.reason)}</p>${sel.members.map(x => `<p class="desc"><b>${esc(DATA.IT[x].n)}:</b> ${esc(DATA.IT[x].d)}</p>`).join('')}</div>`
    : sel ? (() => { const it = DATA.IT[sel.id];
    const ex = it.gr.map(g => `Chỉ được sở hữu 1 món nhóm «${esc(DATA.EXCL[g].n)}»: ${DATA.EXCL[g].ids.map(x => esc(DATA.IT[x].n)).join(', ')}.`).join(' ');
    return `<div class="detail"><h3>${esc(it.n)} <span class="gold">· ${it.g} vàng</span></h3><p class="why">${esc(sel.reason)}</p>${ex ? `<p class="desc" style="color:var(--force)">${ex}</p>` : ''}<p class="desc">${esc(it.d)}</p></div>`; })() : '';

  const bt = DATA.IT[build.boots.id];
  $('#boots').innerHTML = `<img src="${bt.i}" alt=""><span><b>Giày gợi ý: ${esc(bt.n)}</b> — ${esc(build.boots.reason)}</span>`;

  // Lõi
  $('#augs').innerHTML = LEVELS.map((lv, i) => {
    const aid = state.augs[i];
    const locked = i > 0 && !state.augs[i - 1] && !aid;
    if (!aid) return `<button type="button" class="aug ${locked ? 'locked' : ''}" data-i="${i}" ${locked ? 'aria-disabled="true"' : ''}>
        <span class="txt"><span class="lv">Lõi ${i + 1} · Cấp ${lv}</span><span class="plus">${locked ? 'Chọn lõi trước đó' : '+ Chọn lõi'}</span></span></button>`;
    const a = AUG_BY_ID[aid];
    return `<div class="aug filled" data-i="${i}" role="button" tabindex="0">
        ${a.i ? `<img class="r-${a.r}" src="${a.i}" alt="">` : `<span class="noimg r-${a.r}"></span>`}
        <span class="txt"><span class="lv">Lõi ${i + 1} · Cấp ${lv}</span><span class="an">${esc(a.n)}</span><span class="rtext-${a.r}" style="font-size:11.5px;font-weight:600">${RAR_VI[a.r]}</span></span>
        <button type="button" class="x" data-x="${i}" aria-label="Bỏ lõi ${esc(a.n)}">×</button></div>`;
  }).join('');

  // Vì sao
  const why = [];
  const cur = paths[idx];
  if (!hasAug) why.push(`Chưa chọn lõi: ${esc(c.n)} có ${paths.length > 1 ? `${paths.length} hướng build (${paths.map(p => `«${esc(p.label)}»`).join(', ')}). Chọn lõi đầu tiên ở cấp 3 để trang tự chọn hướng phù hợp.` : `hướng build «${esc(cur.label)}». Chọn lõi để 4 món optional được tối ưu theo lõi.`}`);
  else if (suggest >= 0) why.push(`Trang giữ nguyên hướng «${esc(cur.label)}» bạn đang dùng. Các lõi nghiêng về «${esc(paths[suggest].label)}» – <button type="button" class="btn" id="switchRec">Chuyển sang hướng này</button>`);
  else if (state.pathSrc === 'user') why.push(`Bạn đang chọn hướng «${esc(cur.label)}»; trang sẽ giữ hướng này khi bạn thêm lõi.`);
  else if (state.pathSrc === 'auto') why.push(`Lõi đã chọn nghiêng về hướng «${esc(cur.label)}» nên trang chuyển sang và giữ cố định hướng này; các lõi sau chỉ gợi ý chứ không tự đổi hướng.`);
  else if (paths.length > 1) why.push(`Các lõi hiện tại chưa nghiêng rõ về hướng nào, giữ hướng «${esc(cur.label)}» – bạn có thể đổi ở trên.`);
  state.augs.filter(Boolean).forEach(aid => { if ((AT[aid]?.avoid || []).includes(cur.type)) why.push(`<span style="color:var(--force)"><b>Lưu ý – ${esc(AUG_BY_ID[aid].n)}:</b> hướng «${esc(cur.label)}» dựa vào đánh thường, lõi này đổi hết Tốc Độ Đánh thành hồi chiêu nên sẽ làm tướng yếu đi – hợp hơn với hướng dùng kỹ năng.</span>`); });
  (build.ensureNotes || []).forEach(t => why.push(`<span style="color:var(--force)">${esc(t)}</span>`));
  (build.counterNotes || []).forEach(n => why.push(`<b>${{ heal: 'Chống hồi máu', shield: 'Chống lá chắn', tank: 'Chống chống chịu' }[n.key]}:</b> ${esc(n.text)}`));
  document.querySelectorAll('#enemyToggles [data-e]').forEach(b => b.setAttribute('aria-pressed', !!state.enemy[b.dataset.e]));
  if (state.enemy.tank) why.push('<b>Mẹo khi địch trâu:</b> đánh vào tướng máu giấy trước thay vì cố hạ tướng đỡ đòn; mở hộp chọn lõi sẽ thấy các lõi mạnh khi địch nhiều chống chịu được đưa lên đầu.');
  if (cur.src === 'preset') why.push(cur.hpb
    ? '<b>Build Đấu sĩ đỡ đòn:</b> 4 món Core cố định (Trái Tim Khổng Thần, Huyết Giáp Chúa Tể, Rìu Đại Mãng Xà, Giáp Máu Warmog). Ô 5 là đồ tình huống chọn theo đội địch; ô 6 là món thêm nếu bạn bỏ giày cuối trận. Bật các nút «Đội địch có» để trang đổi đồ tình huống cho phù hợp.'
    : `<b>Build phổ biến:</b> ${esc(cur.why)} Khi chưa chọn lõi, 6 ô giữ đúng thứ tự build này; lõi và nút «Đội địch có» chỉ thay đổi các ô Optional.`);
  why.push('Món có nhãn <b>Core</b> luôn giữ nguyên cho hướng build; các món <b>Optional</b> được xếp lại mỗi khi bạn thêm lõi.');
  build.prof.notes.forEach(n => { if (n.text) why.push(`<b>${esc(AUG_BY_ID[n.aug].n)}:</b> ${esc(n.text)}`); });
  state.augs.filter(Boolean).forEach(aid => { const mis = augMisfit(aid, paths);
    if (mis) why.push(`<span style="color:var(--force)"><b>Lưu ý – ${esc(AUG_BY_ID[aid].n)}:</b> lõi này cần build có ${mis.map(d => DIM_VI[d]).join(' hoặc ')}, nhưng không hướng build nào của ${esc(c.n)} dùng chỉ số đó → lõi gần như không phát huy tác dụng.</span>`); });
  const critTotal = build.prof.crit * cur.critX;
  if (critTotal >= 50) why.push(`Lõi đã cho khoảng ${critTotal}% Tỉ Lệ Chí Mạng${cur.critX > 1 ? ' (đã tính nội tại nhân đôi)' : ''} → trang hạn chế món chí mạng thừa vượt 100%.`);
  $('#why').innerHTML = why.map(x => `<li>${x}</li>`).join('');
  const sw = $('#switchRec'); if (sw) sw.onclick = () => { state.manualPath = suggest; state.pathSrc = 'user'; state.prevIds = state.curIds; state.prevIdx = state.curIdx; state.selSlot = null; render(); };

  if (prev && state.prevIdx != null && state.prevIdx !== idx && paths[state.prevIdx]) {
    $('#diff').innerHTML = `<span class="pill add">Chuyển hướng build: «${esc(paths[state.prevIdx].label)}» → «${esc(cur.label)}»</span>`;
  } else if (prev) {
    const add = ids.filter(x => !prev.includes(x)), rem = prev.filter(x => !ids.includes(x));
    $('#diff').innerHTML = add.length || rem.length
      ? add.map(x => `<span class="pill add">+ ${esc(DATA.IT[x].n)}</span>`).join('') + rem.map(x => `<span class="pill rem">${esc(DATA.IT[x].n)}</span>`).join('')
        + rem.map(x => { const c = (build.counterNotes || []).find(n => n.from === x); return `<p class="drop">${esc(c ? `${DATA.IT[x].n} được đổi sang ${DATA.IT[c.to].n} để ${{ heal: 'giảm hồi máu', shield: 'phá lá chắn', tank: 'xuyên thủng lớp chống chịu' }[c.key]} của đội địch.` : dropReason(x, state.augs))}</p>`; }).join('')
      : '<span class="pill">Lõi mới không làm thay đổi bộ đồ</span>';
  } else $('#diff').innerHTML = '';
  state.curIds = ids; state.curIdx = idx; state.prevIdx = null;
}

$('#augs').addEventListener('click', e => {
  const x = e.target.closest('[data-x]');
  if (x) { e.stopPropagation(); const i = +x.dataset.x; state.prevIds = state.curIds; state.prevIdx = state.curIdx; state.augs = state.augs.filter((_, k) => k !== i).concat(null); state.selSlot = null; save(); render(); return; }
  const b = e.target.closest('.aug'); if (!b || b.classList.contains('locked')) return;
  openDlg(+b.dataset.i);
});
$('#augs').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.aug.filled')) { e.preventDefault(); openDlg(+e.target.dataset.i); } });

// ---- Hộp chọn lõi ----
$('#rarFilters').innerHTML = [['all','Tất cả'],['S','Bạc'],['G','Vàng'],['P','Lăng Kính']].map(([k, v]) => `<button type="button" class="fbtn" data-r="${k}" aria-pressed="${k === 'all'}">${v}</button>`).join('');
$('#rarFilters').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b) return; state.rar = b.dataset.r; document.querySelectorAll('#rarFilters .fbtn').forEach(x => x.setAttribute('aria-pressed', x === b)); renderDlg(); });
$('#augSearch').addEventListener('input', e => { state.aq = norm(e.target.value.trim()); renderDlg(); });
$('#dlgClose').onclick = () => $('#augDlg').close();
$('#augDlg').addEventListener('click', e => { if (e.target === $('#augDlg')) $('#augDlg').close(); });

function openDlg(i) {
  state.dlgSlot = i; state.aq = ''; $('#augSearch').value = '';
  $('#dlgTitle').textContent = `Lõi ${i + 1} · Cấp ${LEVELS[i]} — ${CH_BY_ID[state.champ].n}`;
  renderDlg();
  $('#augDlg').showModal();
  $('#dlgBody').scrollTop = 0;
}
const card = a => { const slot = state.augs.indexOf(a.id); const here = slot === state.dlgSlot; const other = slot >= 0 && !here;
  return `<button type="button" class="acard${here ? ' picked' : ''}${other ? ' taken' : ''}" data-a="${a.id}" ${other ? 'aria-disabled="true"' : ''}>
  ${a.i ? `<img class="r-${a.r}" src="${a.i}" alt="" loading="lazy">` : `<span class="noimg r-${a.r}"></span>`}
  <span style="min-width:0"><span class="an">${esc(a.n)}</span>
  <span class="meta"><span class="rtext-${a.r}" style="font-weight:600">${RAR_VI[a.r]}</span>·<span class="tier">T${a.t}</span>·<span>Thắng ${a.wr.toFixed(1)}%</span>${augMisfit(a.id, champPaths(state.champ).paths) ? '<span style="color:var(--force);font-weight:600">· Ít hợp tướng</span>' : ''}${state.enemy.tank && ANTI_TANK_AUGS.includes(a.id) ? '<span style="color:var(--counter);font-weight:600">· Mạnh khi địch trâu</span>' : ''}</span>
  ${slot >= 0 ? `<span class="pickmark">${here ? '✓ Đang chọn ở ô này' : `Đã chọn ở Lõi ${slot + 1} · Cấp ${LEVELS[slot]}`}</span>` : ''}
  <span class="ad">${esc(a.d)}</span></span></button>`; };

function renderDlg() {
  const { paths } = champPaths(state.champ);
  const pool = DATA.AU.filter(a => (state.rar === 'all' || a.r === state.rar) && (!state.aq || norm(a.n + ' ' + a.d).includes(state.aq)));
  const cp = champPaths(state.champ);
  const statTop = cp.augs.map(x => pool.find(a => a.id === x)).filter(Boolean);
  const top = (statTop.length ? statTop.slice(0, 12) : [...pool].sort((a, b) => augSuit(b.id, paths) - augSuit(a.id, paths)).slice(0, 9)).slice(0, state.aq ? 0 : 12);
  const all = [...pool].sort((a, b) => a.t - b.t || b.wr - a.wr);
  const tankTop = state.enemy.tank && !state.aq ? ANTI_TANK_AUGS.map(x => pool.find(a => a.id === x)).filter(Boolean) : [];
  const picked = state.augs.map((x, i) => x ? { a: AUG_BY_ID[x], i } : null).filter(Boolean);
  $('#dlgBody').innerHTML =
    (picked.length ? `<h4>Lõi bạn đã chọn</h4><div class="picked-row">${picked.map(({ a, i }) => `<span class="pchip${i === state.dlgSlot ? ' cur' : ''}">${a.i ? `<img class="r-${a.r}" src="${a.i}" alt="">` : ''}<span><small>Lõi ${i + 1} · Cấp ${LEVELS[i]}</small>${esc(a.n)}</span></span>`).join('')}</div>` : '') +
    (tankTop.length ? `<h4>Mạnh khi địch nhiều chống chịu</h4><div class="alist">${tankTop.map(card).join('')}</div>` : '') +
    (top.length ? `<h4>${statTop.length ? 'Lõi đề xuất theo thống kê aramgg cho' : 'Hợp với'} ${esc(CH_BY_ID[state.champ].n)}</h4><div class="alist">${top.map(card).join('')}</div>` : '') +
    `<h4>${state.aq ? `Kết quả (${all.length})` : `Tất cả lõi (${all.length}) · xếp theo bậc T1→T5`}</h4>` +
    (all.length ? `<div class="alist">${all.map(card).join('')}</div>` : '<p style="color:var(--muted);margin:0">Không có lõi nào khớp.</p>');
}
$('#dlgBody').addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b || b.getAttribute('aria-disabled') === 'true') return;
  if (+b.dataset.a === state.augs[state.dlgSlot]) { $('#augDlg').close(); return; }
  state.prevIds = state.curIds; state.prevIdx = state.curIdx;
  state.augs[state.dlgSlot] = +b.dataset.a; state.selSlot = null; state.example = false;
  $('#augDlg').close(); save(); render();
});

renderGrid();
render();

$('#enemyToggles').addEventListener('click', e => {
  const b = e.target.closest('[data-e]'); if (!b) return;
  state.prevIds = state.curIds; state.prevIdx = state.curIdx;
  state.enemy[b.dataset.e] = !state.enemy[b.dataset.e]; state.selSlot = null; save(); render();
});
