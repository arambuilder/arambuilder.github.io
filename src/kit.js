// ===== Trang bị bắt buộc theo kỹ năng tướng =====
// need: loại chỉ số kỹ năng tăng sức mạnh theo; why: giải thích hiển thị cho người chơi
const KIT = {
  Lucian:      { need: 'crit', why: 'Chiêu cuối Thanh Trừng mạnh lên theo chỉ số chí mạng' },
  Yasuo:       { need: 'crit', why: 'Nội tại nhân đôi Tỉ Lệ Chí Mạng, nên Sát Thương Chí Mạng là nguồn sát thương chính' },
  Yone:        { need: 'crit', why: 'Nội tại nhân đôi Tỉ Lệ Chí Mạng, nên Sát Thương Chí Mạng là nguồn sát thương chính' },
  Tryndamere:  { need: 'crit', why: 'Bộ kỹ năng (hồi máu, giảm hồi chiêu) dựa trên chí mạng' },
  Jhin:        { need: 'crit', why: 'Nội tại chuyển Tỉ Lệ Chí Mạng thành Sức Mạnh Công Kích, phát bắn thứ 4 luôn chí mạng' },
  Gangplank:   { need: 'crit', why: 'Kỹ năng Q Đấu Súng có thể chí mạng' },
  Caitlyn:     { need: 'crit', why: 'Phát bắn Headshot tăng sát thương theo chí mạng' },
  Chogath:     { need: 'hp', why: 'Chiêu cuối cộng dồn Máu và kỹ năng tăng theo Máu cộng thêm' },
  Sion:        { need: 'hp', why: 'Nội tại cộng dồn Máu và kỹ năng tăng theo Máu tối đa' },
  DrMundo:     { need: 'hp', why: 'Hầu hết kỹ năng tăng theo Máu cộng thêm' },
  TahmKench:   { need: 'hp', why: 'Nội tại và các kỹ năng tăng theo Máu cộng thêm' },
  Sett:        { need: 'hp', why: 'Chiêu cuối và lá chắn W tăng theo Máu cộng thêm' },
  Zac:         { need: 'hp', why: 'Sát thương kỹ năng tăng theo Máu tối đa' },
  Malphite:    { need: 'armor', why: 'Kỹ năng W, E và lá chắn nội tại tăng theo Giáp' },
  Rammus:      { need: 'armor', why: 'Sát thương kỹ năng tăng theo Giáp' },
  Taric:       { need: 'armor', why: 'Nội tại và kỹ năng tăng theo Giáp cộng thêm' },
  Galio:       { need: 'mr', why: 'Lá chắn và kỹ năng tăng theo Kháng Phép' },
  Ryze:        { need: 'mana', why: 'Kỹ năng tăng sát thương theo Năng Lượng cộng thêm' },
  Kassadin:    { need: 'mana', why: 'Chiêu cuối tăng sát thương theo Năng Lượng tối đa' },
  Cassiopeia:  { need: 'mana', why: 'Cần lượng Năng Lượng lớn để spam kỹ năng liên tục' },
  Anivia:      { need: 'mana', why: 'Chiêu cuối tiêu hao Năng Lượng liên tục' },
  Ezreal:      { need: 'mana', why: 'Spam Q liên tục, Nước Mắt được cộng dồn rất nhanh' },
  Jayce:       { need: 'mana', why: 'Spam kỹ năng liên tục, Nước Mắt được cộng dồn rất nhanh' },
  Singed:      { need: 'mana', why: 'Kỹ năng Q tiêu hao Năng Lượng liên tục' },
};
// Món đáp ứng từng loại (món đầu tiên phù hợp hướng build sẽ được chọn); "ok" = món khác cũng tính là đã đáp ứng
const KIT_ITEMS = {
  crit:  { ad: ['3031'], ok: ['3031'], label: 'Sát Thương Chí Mạng' },
  hp:    { tk: ['3084', '3083'], ad: ['3084', '3083'], ok: ['3084', '3083'], label: 'Máu cộng thêm' },
  armor: { tk: ['3075', '3143', '6665'], ok: ['3075', '3143', '6665', '3742', '2502'], label: 'Giáp' },
  mr:    { tk: ['4401', '2504', '6665'], ok: ['4401', '2504', '6665', '8020'], label: 'Kháng Phép' },
  mana:  { ap: ['3003', '6657'], ad: ['3004'], tk: ['3119'], ok: ['3003', '6657', '3004', '3119', '2526'], label: 'Năng Lượng' },
};
const KIT_PATH = { mage:'ap', bmage:'ap', apburst:'ap', apas:'ap', aptank:'tk', tank:'tk', tanksup:'tk',
  adc:'ad', onhit:'ad', leth:'ad', adcaster:'ad', bruiser:'ad', hpbruiser:'ad', ench:null };

function kitRequirement(champId, path, taken) {
  const k = KIT[champId]; if (!k) return null;
  const spec = KIT_ITEMS[k.need];
  let side = KIT_PATH[path.type];
  if (k.need === 'crit') {
    // chỉ áp dụng cho hướng build có dùng chí mạng
    const critItems = [...path.core, ...path.pool.slice(0, 6)].filter(x => DATA.IT[x]?.f.CRIT).length;
    if (!(path.type === 'adc' || critItems >= 2)) return null;
    side = 'ad';
  }
  if (k.need === 'hp' && side === 'ad' && !['bruiser', 'hpbruiser'].includes(path.type)) return null;
  const list = spec[side]; if (!list) return null;
  if ([...taken].some(x => spec.ok.includes(x))) return { satisfied: [...taken].find(x => spec.ok.includes(x)), k, spec };
  return { list, k, spec };
}
