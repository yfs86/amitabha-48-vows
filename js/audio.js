/**
 * 原生 Web Audio API 靜心聲景與六大分區變奏音效合成器
 * 零外部音檔依賴，離線雙擊 index.html 亦可正常發聲
 */
(function () {
  window.VowsGame = window.VowsGame || {};

  var ctx = null;
  var enabled = true;
  var volume = 0.5; // 0 ~ 1
  var droneNodes = null;
  var currentSectionId = "sec-1";
  var lastShimmerTs = 0;

  var DEFAULT_DRONE = [146.83, 220.0, 293.66];
  var DEFAULT_SCALE = [293.66, 329.63, 392.0, 440.0, 523.25, 587.33];

  function getTheme(sectionId) {
    var data = window.VowsGame.Data;
    var themes = data && data.SECTION_THEMES;
    if (themes && themes[sectionId]) return themes[sectionId];
    if (themes && themes["sec-1"]) return themes["sec-1"];
    return { droneFreqs: DEFAULT_DRONE, scale: DEFAULT_SCALE, timbre: "sine" };
  }

  function ensureContext() {
    if (!ctx) {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
      }
    }
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(function () {});
    }
    return ctx;
  }

  function startAmbientDrone() {
    if (!enabled || droneNodes) return;
    var audio = ensureContext();
    if (!audio) return;

    var master = audio.createGain();
    master.gain.setValueAtTime(0.0001, audio.currentTime);
    master.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.032 * volume), audio.currentTime + 2.0);
    master.connect(audio.destination);

    var theme = getTheme(currentSectionId);
    var freqs = theme.droneFreqs || DEFAULT_DRONE;
    var oscs = freqs.map(function (f, idx) {
      var osc = audio.createOscillator();
      var g = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      g.gain.value = idx === 0 ? 0.5 : idx === 1 ? 0.35 : 0.15;
      osc.connect(g);
      g.connect(master);
      osc.start();
      return osc;
    });

    droneNodes = { master: master, oscs: oscs };
  }

  function stopAmbientDrone() {
    if (!droneNodes || !ctx) return;
    try {
      var now = ctx.currentTime;
      droneNodes.master.gain.cancelScheduledValues(now);
      droneNodes.master.gain.setValueAtTime(Math.max(0.0001, droneNodes.master.gain.value), now);
      droneNodes.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      var old = droneNodes;
      droneNodes = null;
      setTimeout(function () {
        old.oscs.forEach(function (o) {
          try { o.stop(); } catch (e) {}
        });
      }, 600);
    } catch (e) {
      droneNodes = null;
    }
  }

  function updateDroneVolume() {
    if (droneNodes && ctx && enabled) {
      var now = ctx.currentTime;
      droneNodes.master.gain.cancelScheduledValues(now);
      droneNodes.master.gain.setTargetAtTime(Math.max(0.0001, 0.032 * volume), now, 0.15);
    }
  }

  /**
   * 依六大分區平滑切換背景底音與音階
   */
  function setSectionTheme(sectionId) {
    if (!sectionId || sectionId === currentSectionId) return;
    currentSectionId = sectionId;
    var theme = getTheme(sectionId);
    if (droneNodes && ctx && enabled) {
      var now = ctx.currentTime;
      var freqs = theme.droneFreqs || DEFAULT_DRONE;
      droneNodes.oscs.forEach(function (osc, idx) {
        var target = freqs[idx] || freqs[0];
        try {
          osc.frequency.cancelScheduledValues(now);
          osc.frequency.setValueAtTime(Math.max(40, osc.frequency.value), now);
          osc.frequency.exponentialRampToValueAtTime(target, now + 1.2);
        } catch (e) {}
      });
    }
  }

  function getScale() {
    return getTheme(currentSectionId).scale || DEFAULT_SCALE;
  }

  /**
   * 頌缽共鳴音（多泛音正弦波自然衰減）
   */
  function playBowl(baseFreq, durationSec) {
    if (!enabled || volume <= 0.01) return;
    var audio = ensureContext();
    if (!audio) return;

    var now = audio.currentTime;
    var scale = getScale();
    var freq = baseFreq || scale[2] || 432;
    var dur = durationSec || 3.4;

    var partials = [
      { ratio: 1.0, amp: 0.28, decay: dur },
      { ratio: 2.756, amp: 0.12, decay: dur * 0.65 },
      { ratio: 5.404, amp: 0.05, decay: dur * 0.35 }
    ];

    partials.forEach(function (p) {
      var osc = audio.createOscillator();
      var gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * p.ratio, now);

      var peak = Math.max(0.0001, p.amp * volume);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(now);
      osc.stop(now + p.decay + 0.05);
    });
  }

  /**
   * 輕柔點擊提示音
   */
  function playChime(freq) {
    if (!enabled || volume <= 0.01) return;
    var audio = ensureContext();
    if (!audio) return;

    var now = audio.currentTime;
    var osc = audio.createOscillator();
    var gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq || 587.33, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.12 * volume), now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  /**
   * 依目前分區五聲音階彈奏清鈴音
   */
  function playScaleNote(stepIndex, durationSec) {
    if (!enabled || volume <= 0.01) return;
    var audio = ensureContext();
    if (!audio) return;

    var theme = getTheme(currentSectionId);
    var scale = theme.scale || DEFAULT_SCALE;
    var idx = Math.abs(stepIndex || 0) % scale.length;
    var freq = scale[idx];
    var dur = durationSec || 0.9;
    var now = audio.currentTime;

    var osc = audio.createOscillator();
    var overtone = audio.createOscillator();
    var gain = audio.createGain();
    var overGain = audio.createGain();

    osc.type = theme.timbre || "sine";
    osc.frequency.setValueAtTime(freq, now);

    overtone.type = "sine";
    overtone.frequency.setValueAtTime(freq * 2, now);
    overGain.gain.value = 0.22;

    var peak = Math.max(0.0001, 0.16 * volume);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    overtone.connect(overGain);
    overGain.connect(gain);
    gain.connect(audio.destination);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + dur + 0.05);
    overtone.stop(now + dur + 0.05);
  }

  /**
   * 溫潤木魚輕叩（用於十念撥珠）
   */
  function playWoodenFish() {
    if (!enabled || volume <= 0.01) return;
    var audio = ensureContext();
    if (!audio) return;

    var now = audio.currentTime;
    var osc = audio.createOscillator();
    var gain = audio.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.085);

    var peak = Math.max(0.0001, 0.22 * volume);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /**
   * 拂塵清亮微光音（內建 120ms 節流，用於淨心拂塵）
   */
  function playBrushShimmer() {
    if (!enabled || volume <= 0.01) return;
    var nowMs = Date.now();
    if (nowMs - lastShimmerTs < 120) return;
    lastShimmerTs = nowMs;

    var audio = ensureContext();
    if (!audio) return;

    var scale = getScale();
    var base = scale[Math.floor(Math.random() * scale.length)] * 2;
    var now = audio.currentTime;
    var osc = audio.createOscillator();
    var gain = audio.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.12, now + 0.14);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.065 * volume), now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  /**
   * 八功德水滴清音（用於願光連線、寶華散供）
   */
  function playWaterDrop(stepIndex) {
    if (!enabled || volume <= 0.01) return;
    var audio = ensureContext();
    if (!audio) return;

    var scale = getScale();
    var freq = scale[Math.abs(stepIndex || 0) % scale.length];
    var now = audio.currentTime;

    var osc = audio.createOscillator();
    var gain = audio.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * 0.78, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.35, now + 0.11);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.15 * volume), now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  /**
   * 法輪撥轉韻律音（用於轉輪調心）
   */
  function playWheelClick(stepIndex) {
    if (!enabled || volume <= 0.01) return;
    var scale = getScale();
    var freq = scale[Math.abs(stepIndex || 0) % scale.length];
    playChime(freq);
  }

  /**
   * 呼吸音效 1：開始長按吸氣（柔和上行氣息泛音）
   */
  function playInhaleTone() {
    if (!enabled || volume <= 0.01) return;
    var audio = ensureContext();
    if (!audio) return;

    var scale = getScale();
    var now = audio.currentTime;
    var osc = audio.createOscillator();
    var osc2 = audio.createOscillator();
    var gain = audio.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(scale[0], now);
    osc.frequency.exponentialRampToValueAtTime(scale[3], now + 0.85);

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(scale[5], now);
    osc2.frequency.exponentialRampToValueAtTime(scale[5] * 1.12, now + 0.85);

    var peak = Math.max(0.0001, 0.14 * volume);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);

    var g2 = audio.createGain();
    g2.gain.value = 0.25;

    osc.connect(gain);
    osc2.connect(g2);
    g2.connect(gain);
    gain.connect(audio.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 1.2);
    osc2.stop(now + 1.2);
  }

  /**
   * 呼吸音效 2：放手呼氣（柔和下行頌缽釋放音）
   */
  function playExhaleTone() {
    if (!enabled || volume <= 0.01) return;
    var audio = ensureContext();
    if (!audio) return;

    var scale = getScale();
    var now = audio.currentTime;
    var osc = audio.createOscillator();
    var gain = audio.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(scale[4], now);
    osc.frequency.exponentialRampToValueAtTime(scale[0], now + 1.2);

    var peak = Math.max(0.0001, 0.16 * volume);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);

    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + 1.55);

    playChime(scale[5]);
  }

  /**
   * 呼吸音效 3：完整完成一個光圈（五聲音階上行清音 + 頌缽）
   */
  function playCycleComplete(cycleIndex) {
    if (!enabled || volume <= 0.01) return;
    var scale = getScale();
    var baseIdx = Math.max(0, Math.min(2, (cycleIndex || 1) - 1));
    playBowl(scale[baseIdx], 2.1);
    setTimeout(function () {
      playChime(scale[baseIdx + 3]);
    }, 150);
  }

  /**
   * 蓮花綻放（完成一願的和弦，隨六大分區音階演奏）
   */
  function playLotusBloom() {
    if (!enabled || volume <= 0.01) return;
    var scale = getScale();
    var notes = [scale[0], scale[2], scale[4], scale[5]];
    notes.forEach(function (n, idx) {
      setTimeout(function () {
        playBowl(n, 2.8);
      }, idx * 170);
    });
  }

  window.VowsGame.Audio = {
    init: function (isEnabled, vol) {
      enabled = isEnabled !== false;
      if (typeof vol === "number") volume = Math.max(0, Math.min(1, vol));
    },
    unlock: function () {
      ensureContext();
      if (enabled) startAmbientDrone();
    },
    setEnabled: function (val) {
      enabled = !!val;
      if (enabled) {
        ensureContext();
        startAmbientDrone();
      } else {
        stopAmbientDrone();
      }
    },
    setVolume: function (val) {
      volume = Math.max(0, Math.min(1, val));
      updateDroneVolume();
    },
    setSectionTheme: setSectionTheme,
    getScale: getScale,
    isEnabled: function () { return enabled; },
    getVolume: function () { return volume; },
    playBowl: playBowl,
    playChime: playChime,
    playScaleNote: playScaleNote,
    playWoodenFish: playWoodenFish,
    playBrushShimmer: playBrushShimmer,
    playWaterDrop: playWaterDrop,
    playWheelClick: playWheelClick,
    playInhaleTone: playInhaleTone,
    playExhaleTone: playExhaleTone,
    playCycleComplete: playCycleComplete,
    playLotusBloom: playLotusBloom
  };
})();
