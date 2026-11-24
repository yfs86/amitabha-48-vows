/**
 * 《無量壽經・四十八願行》完整版資料彙整與視覺配置
 * 合併 VOWS_PART_1 ~ 3，為全部 48 願配置 48 種專屬色彩、8 種願燈樣式與流暢星海座標
 */
(function () {
  window.VowsGame = window.VowsGame || {};

  var SECTIONS = [
    { id: "sec-1", name: "離苦淨土", subtitle: "第 1 ～ 2 願", range: [1, 2] },
    { id: "sec-2", name: "莊嚴色身與神通", subtitle: "第 3 ～ 11 願", range: [3, 11] },
    { id: "sec-3", name: "佛光無量與往生接引", subtitle: "第 12 ～ 22 願", range: [12, 22] },
    { id: "sec-4", name: "國土莊嚴與法辯", subtitle: "第 23 ～ 32 願", range: [23, 32] },
    { id: "sec-5", name: "觸光柔軟與修持利益", subtitle: "第 33 ～ 40 願", range: [33, 40] },
    { id: "sec-6", name: "他方利益與不退轉", subtitle: "第 41 ～ 48 願", range: [41, 48] }
  ];

  // 48 種各不重複的專屬願燈色碼（依 6 大分區呈現豐富層次）
  var VOW_COLORS = [
    // 1-2: 青翠琉璃
    "#5eead4", "#2dd4bf",
    // 3-11: 天青水月與清嵐
    "#93c5fd", "#7dd3fc", "#38bdf8", "#60a5fa", "#818cf8", "#a5b4fc", "#67e8f9", "#22d3ee", "#34d399",
    // 12-22: 佛光暖金與琥珀
    "#fde047", "#facc15", "#fbbf24", "#f59e0b", "#fcd34d", "#fde68a", "#f0c869", "#fb923c", "#f97316", "#eab308", "#fef08a",
    // 23-32: 翡翠寶樹與春櫻粉金
    "#6ee7b7", "#4ade80", "#86efac", "#a7f3d0", "#bef264", "#fda4af", "#fb7185", "#f472b6", "#f9a8d4", "#fecdd3",
    // 33-40: 柔和珊瑚、珍珠月白與霓虹青
    "#fdba74", "#fed7aa", "#fbcfe8", "#e2e8f0", "#cbd5e1", "#99f6e4", "#a5f3fc", "#bae6fd",
    // 41-48: 紫金穹蒼與妙法蓮紫
    "#ddd6fe", "#c4b5fd", "#a78bfa", "#e9d5ff", "#d8b4fe", "#c084fc", "#e879f9", "#f5d0fe"
  ];

  // 8 種截然不同的幾何願燈樣式
  var LAMP_STYLES = [
    { key: "lotus-8", name: "八瓣金蓮燈" },
    { key: "lotus-12", name: "千葉重蓮燈" },
    { key: "palace-lantern", name: "六角琉璃宮燈" },
    { key: "star-mandala", name: "八芒星輪燈" },
    { key: "water-drop", name: "甘露寶瓶燈" },
    { key: "dharma-wheel", name: "金色法輪燈" },
    { key: "cloud-orb", name: "摩尼寶珠燈" },
    { key: "pagoda-lamp", name: "七寶浮屠燈" }
  ];

  var WORLD_W = 3600;
  var WORLD_H = 2400;

  // 6 層×8 座蛇形星海路徑，使相鄰兩願步行順暢不跨大圖
  function computeVowPosition(index) {
    var row = Math.floor(index / 8); // 0..5 (由下往上推進)
    var colRaw = index % 8;
    var col = row % 2 === 0 ? colRaw : 7 - colRaw;

    var baseX = 320 + col * 420;
    var baseY = 2050 - row * 340;
    var waveX = Math.cos(index * 1.15) * 48;
    var waveY = Math.sin(index * 0.85) * 58;

    return {
      x: Math.round(Math.max(180, Math.min(WORLD_W - 180, baseX + waveX))),
      y: Math.round(Math.max(180, Math.min(WORLD_H - 180, baseY + waveY)))
    };
  }

  var rawList = []
    .concat(window.VowsGame.VOWS_PART_1 || [])
    .concat(window.VowsGame.VOWS_PART_2 || [])
    .concat(window.VowsGame.VOWS_PART_3 || []);

  rawList.sort(function (a, b) {
    return a.id - b.id;
  });

  var ALL_48_VOWS = rawList.map(function (vow, idx) {
    // 確保同一排與相鄰願的樣式與色彩皆明顯不同
    var styleObj = LAMP_STYLES[(idx * 3 + Math.floor(idx / 8)) % LAMP_STYLES.length];
    return Object.assign({}, vow, {
      color: VOW_COLORS[idx % VOW_COLORS.length],
      lampStyle: styleObj.key,
      lampStyleName: styleObj.name,
      mapPos: computeVowPosition(idx)
    });
  });

  window.VowsGame.Data = {
    WORLD_W: WORLD_W,
    WORLD_H: WORLD_H,
    SECTIONS: SECTIONS,
    LAMP_STYLES: LAMP_STYLES,
    ALL_48_VOWS: ALL_48_VOWS
  };
})();
