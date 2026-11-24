/**
 * 原生 Web Audio API 靜心聲景與呼吸三段音效合成器
 * 零外部音檔依賴，離線雙擊 index.html 亦可正常發聲
 */
(function () {
  window.VowsGame = window.VowsGame || {};

  var ctx = null;
  var enabled = true;
  var volume = 0.5; // 0 ~ 1
  var droneNodes = null;

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

    // 五聲音階柔和長音 (D3 + A3 + F#4)
    var freqs = [146.83, 220.0, 293.66];
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
   * 頌缽共鳴音（多泛音正弦波自然衰減）
   */
  function playBowl(baseFreq, durationSec) {
    if (!enabled || volume <= 0.01) return;
    var audio = ensureContext();
    if (!audio) return;

    var now = audio.currentTime;
    var freq = baseFreq || 432;
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
   * 呼吸音效 1：開始長按吸氣（柔和上行氣息泛音）
   */
  function playInhaleTone() {
    if (!enabled || volume <= 0.01) return;
    var audio = ensureContext();
    if (!audio) return;

    var now = audio.currentTime;
    var osc = audio.createOscillator();
    var osc2 = audio.createOscillator();
    var gain = audio.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(293.66, now); // D4
    osc.frequency.exponentialRampToValueAtTime(440.0, now + 0.85); // A4

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(587.33, now);
    osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.85);

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

    var now = audio.currentTime;
    var osc = audio.createOscillator();
    var gain = audio.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(493.88, now); // B4
    osc.frequency.exponentialRampToValueAtTime(293.66, now + 1.2); // D4

    var peak = Math.max(0.0001, 0.16 * volume);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);

    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + 1.55);

    // 輕敲小引磬配合放手節點
    playChime(587.33);
  }

  /**
   * 呼吸音效 3：完整完成一個光圈（五聲音階上行清音 + 頌缽）
   */
  function playCycleComplete(cycleIndex) {
    if (!enabled || volume <= 0.01) return;
    var baseSeq = [
      [392.0, 587.33],       // 第 1 圈: G4 -> D5
      [440.0, 659.25],       // 第 2 圈: A4 -> E5
      [523.25, 783.99]       // 第 3 圈: C5 -> G5
    ];
    var pair = baseSeq[Math.max(0, Math.min(2, (cycleIndex || 1) - 1))];
    playBowl(pair[0], 2.1);
    setTimeout(function () {
      playChime(pair[1]);
    }, 150);
  }

  /**
   * 蓮花綻放（完成一願的和弦）
   */
  function playLotusBloom() {
    if (!enabled || volume <= 0.01) return;
    var notes = [392.0, 440.0, 587.33, 783.99];
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
    isEnabled: function () { return enabled; },
    getVolume: function () { return volume; },
    playBowl: playBowl,
    playChime: playChime,
    playInhaleTone: playInhaleTone,
    playExhaleTone: playExhaleTone,
    playCycleComplete: playCycleComplete,
    playLotusBloom: playLotusBloom
  };
})();
