/**
 * 《無量壽經・四十八願行》完整版資料彙整與視覺配置
 * 合併 VOWS_PART_1 ~ 3，為全部 48 願配置：
 * - 48 種專屬色彩、8 種願燈樣式與流暢星海座標
 * - 6 大分區聲景與光氛主題（SECTION_THEMES）
 * - 8 種依願義設計的發願儀式（RITUAL_META / VOW_RITUAL_MAP，相鄰絕不重複）
 * - 4 種思惟體驗模式（quiz / reflect / sutra-fill / contemplate）
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

  // 六大分區聲景（音階、底音和弦、音色）與極樂天幕氛圍
  var SECTION_THEMES = {
    "sec-1": {
      id: "sec-1",
      accent: "#5eead4",
      bgTop: "#050914",
      bgBottom: "#0a1728",
      zoneGlow: "rgba(45, 212, 191, 0.10)",
      droneFreqs: [146.83, 220.0, 293.66], // D3, A3, D4（靜謐沉穩）
      scale: [293.66, 329.63, 392.0, 440.0, 523.25, 587.33],
      timbre: "sine"
    },
    "sec-2": {
      id: "sec-2",
      accent: "#7dd3fc",
      bgTop: "#060b1d",
      bgBottom: "#0f2140",
      zoneGlow: "rgba(56, 189, 248, 0.11)",
      droneFreqs: [164.81, 246.94, 329.63], // E3, B3, E4（水月清朗）
      scale: [329.63, 392.0, 440.0, 493.88, 587.33, 659.25],
      timbre: "sine"
    },
    "sec-3": {
      id: "sec-3",
      accent: "#fbbf24",
      bgTop: "#090d1f",
      bgBottom: "#1e1b38",
      zoneGlow: "rgba(251, 191, 36, 0.12)",
      droneFreqs: [130.81, 196.0, 261.63], // C3, G3, C4（佛光溫暖莊嚴）
      scale: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25],
      timbre: "triangle"
    },
    "sec-4": {
      id: "sec-4",
      accent: "#6ee7b7",
      bgTop: "#06101e",
      bgBottom: "#102836",
      zoneGlow: "rgba(110, 231, 183, 0.11)",
      droneFreqs: [174.61, 261.63, 349.23], // F3, C4, F4（寶樹和鳴清風）
      scale: [349.23, 392.0, 440.0, 523.25, 587.33, 698.46],
      timbre: "sine"
    },
    "sec-5": {
      id: "sec-5",
      accent: "#fdba74",
      bgTop: "#0b0f22",
      bgBottom: "#231936",
      zoneGlow: "rgba(253, 186, 116, 0.11)",
      droneFreqs: [196.0, 293.66, 392.0], // G3, D4, G4（柔軟慈悲暖流）
      scale: [392.0, 440.0, 493.88, 587.33, 659.25, 783.99],
      timbre: "sine"
    },
    "sec-6": {
      id: "sec-6",
      accent: "#c4b5fd",
      bgTop: "#0c1028",
      bgBottom: "#1f1c48",
      zoneGlow: "rgba(196, 181, 253, 0.13)",
      droneFreqs: [220.0, 329.63, 440.0], // A3, E4, A4（穹蒼法忍開闊）
      scale: [440.0, 493.88, 523.25, 659.25, 783.99, 880.0],
      timbre: "triangle"
    }
  };

  // 8 種依願義設計的發願禪意互動
  var RITUAL_META = {
    breath: { key: "breath", name: "息念光環", shortHint: "長按吸氣、放手呼氣，以呼吸定心" },
    beads: { key: "beads", name: "十念撥珠", shortHint: "輕觸撥動發光念珠，聲聲相續" },
    wipe: { key: "wipe", name: "淨心拂塵", shortHint: "滑動拂去塵霧，顯露本心清淨" },
    constellation: { key: "constellation", name: "願光連線", shortHint: "依序點亮星點，織就光明願網" },
    chime: { key: "chime", name: "法音和鳴", shortHint: "隨光音引導輕敲蓮鈴，五音和鳴" },
    petals: { key: "petals", name: "寶華散供", shortHint: "接引飄落七寶蓮瓣，入蓮台供養" },
    wheel: { key: "wheel", name: "轉輪調心", shortHint: "撥轉或長按緩轉法輪，願心不退" },
    inscribe: { key: "inscribe", name: "經句印心", shortHint: "依序點選金字法句，印入心田" }
  };

  // 第 1 ～ 48 願對應的發願互動（相鄰願絕不重複）
  var VOW_RITUAL_MAP = [
    "breath", "wheel",
    "wipe", "wheel", "constellation", "wipe", "chime", "constellation", "petals", "breath", "beads",
    "constellation", "breath", "petals", "wheel", "wipe", "chime", "beads", "constellation", "petals", "wipe", "inscribe",
    "petals", "beads", "inscribe", "wheel", "constellation", "chime", "inscribe", "chime", "wipe", "petals",
    "breath", "beads", "wheel", "inscribe", "petals", "wipe", "breath", "constellation",
    "chime", "breath", "beads", "petals", "constellation", "chime", "wheel", "inscribe"
  ];

  // 階段一「思惟」4 種體驗模式
  var ASK_MODE_META = {
    quiz: { key: "quiz", label: "法義思辨" },
    reflect: { key: "reflect", label: "修心情境" },
    "sutra-fill": { key: "sutra-fill", label: "經文印證" },
    contemplate: { key: "contemplate", label: "靜心直觀" }
  };

  var CONTEMPLATE_IDS = [12, 18, 28, 33, 40, 48];
  var SUTRA_FILL_IDS = [3, 7, 13, 17, 23, 27, 31, 36, 42, 46];
  var REFLECT_IDS = [2, 5, 8, 10, 15, 20, 24, 29, 34, 38, 43, 47];

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

  var GENERIC_CLAUSES = {
    "設我得佛": true,
    "不取正覺": true,
    "若不爾者": true,
    "若不如是": true,
    "國中天人": true,
    "國中菩薩": true,
    "聞我名字": true,
    "壽終之後": true,
    "他方國土諸菩薩眾": true,
    "十方眾生": true,
    "欲生我國": true
  };

  function extractCoreClause(sutraText) {
    var parts = (sutraText || "").split(/[，。、；]/).map(function (s) {
      return s.trim();
    }).filter(function (s) {
      return s.length >= 3 && s.length <= 10 && !GENERIC_CLAUSES[s];
    });
    if (parts.length === 0) return "";
    // 優先選擇 4~8 字的精華句，若無則取第一個符合句
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].length >= 4 && parts[i].length <= 8) {
        return parts[i];
      }
    }
    return parts[0];
  }

  function resolveAskMode(id) {
    if (CONTEMPLATE_IDS.indexOf(id) !== -1) return "contemplate";
    if (SUTRA_FILL_IDS.indexOf(id) !== -1) return "sutra-fill";
    if (REFLECT_IDS.indexOf(id) !== -1) return "reflect";
    return "quiz";
  }

  var rawList = []
    .concat(window.VowsGame.VOWS_PART_1 || [])
    .concat(window.VowsGame.VOWS_PART_2 || [])
    .concat(window.VowsGame.VOWS_PART_3 || []);

  rawList.sort(function (a, b) {
    return a.id - b.id;
  });

  // 預先抽取各願核心經句供 sutra-fill 當干擾項
  var clausePool = rawList.map(function (v) {
    return { id: v.id, clause: extractCoreClause(v.sutraText) };
  }).filter(function (item) {
    return item.clause.length >= 4 && item.clause.length <= 8;
  });

  function buildSutraFillData(vow) {
    var target = extractCoreClause(vow.sutraText);
    if (!target) return null;
    var maskedText = vow.sutraText.replace(target, "＿＿＿＿");
    var distractors = [];
    for (var step = 1; step < clausePool.length && distractors.length < 2; step++) {
      var pick = clausePool[(vow.id * 7 + step * 5) % clausePool.length];
      if (pick.id !== vow.id && pick.clause !== target && distractors.indexOf(pick.clause) === -1) {
        distractors.push(pick.clause);
      }
    }
    var options = [
      { text: target, isCorrect: true },
      { text: distractors[0] || "隨念即至", isCorrect: false },
      { text: distractors[1] || "常修梵行", isCorrect: false }
    ];
    // 依 vow.id 做穩定洗牌，避免正解固定在第一位
    var shift = vow.id % 3;
    var ordered = [options[shift], options[(shift + 1) % 3], options[(shift + 2) % 3]];
    return {
      target: target,
      maskedText: maskedText,
      choices: ordered
    };
  }

  var ALL_48_VOWS = rawList.map(function (vow, idx) {
    // 確保同一排與相鄰願的樣式與色彩皆明顯不同
    var styleObj = LAMP_STYLES[(idx * 3 + Math.floor(idx / 8)) % LAMP_STYLES.length];
    var ritualKey = VOW_RITUAL_MAP[idx] || "breath";
    var ritualMeta = RITUAL_META[ritualKey] || RITUAL_META.breath;
    var askMode = resolveAskMode(vow.id);
    var askMeta = ASK_MODE_META[askMode] || ASK_MODE_META.quiz;
    var sutraFill = askMode === "sutra-fill" ? buildSutraFillData(vow) : null;
    if (askMode === "sutra-fill" && !sutraFill) {
      askMode = "quiz";
      askMeta = ASK_MODE_META.quiz;
    }

    return Object.assign({}, vow, {
      color: VOW_COLORS[idx % VOW_COLORS.length],
      lampStyle: styleObj.key,
      lampStyleName: styleObj.name,
      mapPos: computeVowPosition(idx),
      ritualType: ritualKey,
      ritualName: ritualMeta.name,
      ritualHint: ritualMeta.shortHint,
      askMode: askMode,
      askModeLabel: askMeta.label,
      sutraFill: sutraFill,
      sectionTheme: SECTION_THEMES[vow.sectionId] || SECTION_THEMES["sec-1"]
    });
  });

  window.VowsGame.Data = {
    WORLD_W: WORLD_W,
    WORLD_H: WORLD_H,
    SECTIONS: SECTIONS,
    SECTION_THEMES: SECTION_THEMES,
    LAMP_STYLES: LAMP_STYLES,
    RITUAL_META: RITUAL_META,
    ASK_MODE_META: ASK_MODE_META,
    ALL_48_VOWS: ALL_48_VOWS
  };
})();
