/**
 * 《無量壽經・四十八願行》八種發願禪意互動引擎
 * 包含：息念光環、十念撥珠、淨心拂塵、願光連線、法音和鳴、寶華散供、轉輪調心、經句印心
 * 特色：輕巧靜心（無失敗壓力）、支援滑鼠與觸控、完整清理計時器與監聽器
 */
(function () {
  window.VowsGame = window.VowsGame || {};

  var cleanups = [];

  function registerCleanup(fn) {
    cleanups.push(fn);
  }

  function addListener(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    registerCleanup(function () {
      target.removeEventListener(event, handler, options);
    });
  }

  function safeTimeout(fn, ms) {
    var id = setTimeout(fn, ms);
    registerCleanup(function () {
      clearTimeout(id);
    });
    return id;
  }

  function safeRaf(tickFn) {
    var alive = true;
    var rafId = null;
    function loop(ts) {
      if (!alive) return;
      tickFn(ts, function stop() {
        alive = false;
      });
      if (alive) {
        rafId = requestAnimationFrame(loop);
      }
    }
    rafId = requestAnimationFrame(loop);
    registerCleanup(function () {
      alive = false;
      if (rafId) cancelAnimationFrame(rafId);
    });
  }

  function destroy() {
    while (cleanups.length) {
      var fn = cleanups.pop();
      try { fn(); } catch (e) {}
    }
  }

  function finishRitual(statusEl, onComplete) {
    if (statusEl) {
      statusEl.textContent = "願力圓滿！正在點亮本願蓮燈…";
    }
    if (window.VowsGame.Audio) {
      window.VowsGame.Audio.playLotusBloom();
    }
    safeTimeout(function () {
      destroy();
      if (onComplete) onComplete();
    }, 680);
  }

  /* ==================== 1. 息念光環 (breath) ==================== */
  function mountBreath(container, vow, onComplete) {
    var TOTAL_CYCLES = 2;
    var INHALE_SEC = 3.0;
    var HOLD_SEC = 1.2;
    var EXHALE_SEC = 3.0;
    var accent = vow.color || "#62d2c4";

    var state = {
      cyclesDone: 0,
      phase: "idle",
      isHolding: false,
      elapsed: 0,
      lastTs: 0
    };

    container.innerHTML =
      "<div class='breath-wrapper'>" +
        "<svg id='ritual-breath-svg' class='breath-svg' viewBox='0 0 220 220' width='220' height='220'>" +
          "<g id='ritual-breath-petals'></g>" +
          "<circle cx='110' cy='110' r='76' fill='none' stroke='rgba(148,163,184,0.22)' stroke-width='8' />" +
          "<circle id='ritual-breath-ring' cx='110' cy='110' r='76' fill='none' stroke='" + accent + "' stroke-width='8' stroke-linecap='round' transform='rotate(-90 110 110)' />" +
        "</svg>" +
        "<div class='breath-center'>" +
          "<div id='ritual-breath-main' class='breath-center-main'>長按起息</div>" +
          "<div id='ritual-breath-sub' class='breath-center-sub'>完成 2 輪專注呼吸</div>" +
        "</div>" +
      "</div>" +
      "<div id='ritual-breath-dots' class='cycles-dots'></div>" +
      "<button id='ritual-breath-btn' type='button' class='btn-hold'>長按此處（或空白鍵）吸氣，提示後放開呼氣</button>" +
      "<p id='ritual-breath-status' class='breath-status'>長按上方光環或按鈕開始吸氣，聽見提示後放開完成呼氣。</p>";

    var petalsGroup = container.querySelector("#ritual-breath-petals");
    var ringEl = container.querySelector("#ritual-breath-ring");
    var mainEl = container.querySelector("#ritual-breath-main");
    var subEl = container.querySelector("#ritual-breath-sub");
    var dotsEl = container.querySelector("#ritual-breath-dots");
    var btnEl = container.querySelector("#ritual-breath-btn");
    var svgEl = container.querySelector("#ritual-breath-svg");
    var statusEl = container.querySelector("#ritual-breath-status");

    var totalPetals = 16;
    for (var i = 0; i < totalPetals; i++) {
      var angle = (i * 360) / totalPetals;
      var dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      var rad = ((angle - 90) * Math.PI) / 180;
      dot.setAttribute("cx", (110 + Math.cos(rad) * 92).toFixed(1));
      dot.setAttribute("cy", (110 + Math.sin(rad) * 92).toFixed(1));
      dot.setAttribute("r", "3.8");
      dot.setAttribute("class", "petal-dot");
      petalsGroup.appendChild(dot);
    }

    function updateUI() {
      dotsEl.innerHTML = "";
      for (var c = 0; c < TOTAL_CYCLES; c++) {
        var sp = document.createElement("span");
        sp.className = "cycle-lotus" + (c < state.cyclesDone ? " lit" : "");
        sp.textContent = "🪷";
        dotsEl.appendChild(sp);
      }

      var circumference = 2 * Math.PI * 76;
      var progress = 0;
      var mainText = "長按起息";
      var subText = "完成 " + TOTAL_CYCLES + " 輪專注呼吸 (" + state.cyclesDone + " / " + TOTAL_CYCLES + ")";
      var ringColor = accent;

      if (state.phase === "inhaling") {
        progress = (state.elapsed / INHALE_SEC) * 0.44;
        mainText = "吸氣觀想";
        subText = "持續按住不放 (" + Math.ceil(INHALE_SEC - state.elapsed) + "s)";
      } else if (state.phase === "resting") {
        progress = 0.44 + (state.elapsed / HOLD_SEC) * 0.16;
        mainText = "定心持願";
        subText = "即將圓滿吸氣 (" + Math.ceil(HOLD_SEC - state.elapsed) + "s)";
        ringColor = "#f0c869";
      } else if (state.phase === "wait_release") {
        progress = 0.60;
        mainText = "請放開呼氣";
        subText = "放開按鍵即可隨光呼氣迴向";
        ringColor = "#fde68a";
      } else if (state.phase === "exhaling") {
        progress = 0.60 + (state.elapsed / EXHALE_SEC) * 0.40;
        mainText = "呼氣迴向";
        subText = "正將願力化光迴向十方…";
        ringColor = "#fde68a";
      } else if (state.phase === "done") {
        progress = 1;
        mainText = "願力圓滿";
        subText = "兩輪淨念完成";
        ringColor = "#f0c869";
      }

      ringEl.style.strokeDasharray = circumference.toFixed(1);
      ringEl.style.strokeDashoffset = (circumference * (1 - progress)).toFixed(1);
      ringEl.style.stroke = ringColor;
      mainEl.textContent = mainText;
      subEl.textContent = subText;

      var litCount = state.cyclesDone * 8;
      if (state.phase === "exhaling") {
        litCount += Math.floor((state.elapsed / EXHALE_SEC) * 8);
      }
      var dots = petalsGroup.querySelectorAll(".petal-dot");
      dots.forEach(function (d, idx) {
        var lit = idx < litCount;
        d.classList.toggle("lit", lit);
        d.style.fill = lit ? accent : "";
      });
    }

    function startHold() {
      if (state.phase === "done" || state.phase === "exhaling" || state.phase === "wait_release") return;
      if (!state.isHolding) {
        state.isHolding = true;
        if (state.phase === "idle") {
          state.phase = "inhaling";
          state.elapsed = 0;
          statusEl.textContent = "開始吸氣觀想，請持續按住不放…";
          if (window.VowsGame.Audio) window.VowsGame.Audio.playInhaleTone();
          updateUI();
        }
      }
    }

    function endHold() {
      if (!state.isHolding) return;
      state.isHolding = false;
      if (state.phase === "wait_release") {
        state.phase = "exhaling";
        state.elapsed = 0;
        statusEl.textContent = "已放開，隨光明緩緩呼氣迴向法界…";
        if (window.VowsGame.Audio) window.VowsGame.Audio.playExhaleTone();
        updateUI();
      } else if (state.phase === "inhaling" || state.phase === "resting") {
        state.phase = "idle";
        state.elapsed = 0;
        statusEl.textContent = "氣息尚未聚足，請重新長按起息（不扣進度）。";
        if (window.VowsGame.Audio) window.VowsGame.Audio.playChime(329.63);
        updateUI();
      }
    }

    [btnEl, svgEl].forEach(function (el) {
      addListener(el, "pointerdown", function (e) {
        e.preventDefault();
        startHold();
      });
    });
    addListener(window, "pointerup", endHold);
    addListener(window, "pointercancel", endHold);
    addListener(window, "keydown", function (e) {
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) startHold();
      }
    });
    addListener(window, "keyup", function (e) {
      if (e.code === "Space") {
        e.preventDefault();
        endHold();
      }
    });

    updateUI();
    safeRaf(function (ts, stop) {
      if (!state.lastTs) state.lastTs = ts;
      var dt = Math.min(0.05, (ts - state.lastTs) / 1000);
      state.lastTs = ts;

      if (state.phase === "inhaling" && state.isHolding) {
        state.elapsed += dt;
        if (state.elapsed >= INHALE_SEC) {
          state.phase = "resting";
          state.elapsed = 0;
          statusEl.textContent = "心住淨念中，再輕輕停留片刻…";
          if (window.VowsGame.Audio) window.VowsGame.Audio.playChime(523.25);
        }
      } else if (state.phase === "resting" && state.isHolding) {
        state.elapsed += dt;
        if (state.elapsed >= HOLD_SEC) {
          state.phase = "wait_release";
          state.elapsed = 0;
          statusEl.textContent = "吸氣已滿，請放開按鍵呼氣迴向！";
          if (window.VowsGame.Audio) window.VowsGame.Audio.playChime(659.25);
        }
      } else if (state.phase === "exhaling") {
        state.elapsed += dt;
        if (state.elapsed >= EXHALE_SEC) {
          state.cyclesDone++;
          if (window.VowsGame.Audio) window.VowsGame.Audio.playCycleComplete(state.cyclesDone);
          if (state.cyclesDone >= TOTAL_CYCLES) {
            state.phase = "done";
            updateUI();
            stop();
            finishRitual(statusEl, onComplete);
            return;
          } else {
            state.phase = "idle";
            state.elapsed = 0;
            statusEl.textContent = "第 " + state.cyclesDone + " 個光圈圓滿！請再次長按起息。";
          }
        }
      }
      updateUI();
    });
  }

  /* ==================== 2. 十念撥珠 (beads) ==================== */
  function mountBeads(container, vow, onComplete) {
    var total = vow.id === 18 ? 10 : 6 + (vow.id % 3);
    var accent = vow.color || "#fbbf24";
    var mantraRaw = (vow.vowPrompt && vow.vowPrompt.mantra) ? vow.vowPrompt.mantra.replace(/\s*·\s*/g, "") : "南無阿彌陀佛";
    var doneCount = 0;

    container.innerHTML =
      "<div class='beads-stage'>" +
        "<svg id='ritual-beads-svg' class='beads-svg' viewBox='0 0 300 165' width='300' height='165'></svg>" +
        "<div id='ritual-beads-echo' class='beads-echo'>輕觸發光念珠（或按空白鍵），逐珠起念</div>" +
      "</div>" +
      "<button id='ritual-bead-next-btn' type='button' class='btn-hold'>撥動第 1 顆願珠（0 / " + total + "）</button>" +
      "<p id='ritual-beads-status' class='breath-status'>心隨珠轉，聲聲念珠皆是清淨本願。</p>";

    var svg = container.querySelector("#ritual-beads-svg");
    var echoEl = container.querySelector("#ritual-beads-echo");
    var nextBtn = container.querySelector("#ritual-bead-next-btn");
    var statusEl = container.querySelector("#ritual-beads-status");

    // 珠鍊弧線底軌
    var cord = document.createElementNS("http://www.w3.org/2000/svg", "path");
    cord.setAttribute("d", "M 26 112 Q 150 22 274 112");
    cord.setAttribute("fill", "none");
    cord.setAttribute("stroke", "rgba(240, 200, 105, 0.3)");
    cord.setAttribute("stroke-width", "2.5");
    svg.appendChild(cord);

    var beadEls = [];
    for (var i = 0; i < total; i++) {
      var t = total === 1 ? 0.5 : i / (total - 1);
      // 二次貝茲曲線點位 (P0=(26,112), P1=(150,22), P2=(274,112))
      var bx = (1 - t) * (1 - t) * 26 + 2 * (1 - t) * t * 150 + t * t * 274;
      var by = (1 - t) * (1 - t) * 112 + 2 * (1 - t) * t * 22 + t * t * 112;

      var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "bead-node" + (i === 0 ? " active" : ""));
      g.setAttribute("transform", "translate(" + bx.toFixed(1) + "," + by.toFixed(1) + ")");

      var halo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      halo.setAttribute("r", "16");
      halo.setAttribute("class", "bead-halo");
      halo.style.fill = accent;

      var body = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      body.setAttribute("r", "11");
      body.setAttribute("class", "bead-body");

      var label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("y", "4");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("class", "bead-num");
      label.textContent = String(i + 1);

      g.appendChild(halo);
      g.appendChild(body);
      g.appendChild(label);
      svg.appendChild(g);
      beadEls.push(g);

      (function (idx) {
        addListener(g, "pointerdown", function (e) {
          e.preventDefault();
          if (idx === doneCount) advanceBead();
        });
      })(i);
    }

    function advanceBead() {
      if (doneCount >= total) return;
      var cur = beadEls[doneCount];
      cur.classList.remove("active");
      cur.classList.add("done");
      var body = cur.querySelector(".bead-body");
      if (body) body.style.fill = accent;

      if (window.VowsGame.Audio) {
        window.VowsGame.Audio.playWoodenFish();
        window.VowsGame.Audio.playScaleNote(doneCount, 0.85);
      }

      doneCount++;
      var charIdx = (doneCount - 1) % mantraRaw.length;
      var shownSlice = mantraRaw.slice(0, Math.min(mantraRaw.length, Math.ceil((doneCount / total) * mantraRaw.length)));
      echoEl.textContent = "「" + shownSlice + "」";

      if (doneCount >= total) {
        nextBtn.disabled = true;
        nextBtn.textContent = "念珠圓滿（" + total + " / " + total + "）";
        finishRitual(statusEl, onComplete);
      } else {
        beadEls[doneCount].classList.add("active");
        nextBtn.textContent = "撥動第 " + (doneCount + 1) + " 顆願珠（" + doneCount + " / " + total + "）";
        statusEl.textContent = "已撥第 " + doneCount + " 珠（" + mantraRaw[charIdx] + "），請繼續下念。";
      }
    }

    addListener(nextBtn, "click", advanceBead);
    addListener(window, "keydown", function (e) {
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) advanceBead();
      }
    });
  }

  /* ==================== 3. 淨心拂塵 (wipe) ==================== */
  function mountWipe(container, vow, onComplete) {
    var accent = vow.color || "#93c5fd";
    var w = 280;
    var h = 188;
    var completed = false;
    var drawing = false;
    var lastPt = null;
    var sweepStep = 0;

    container.innerHTML =
      "<div class='wipe-stage'>" +
        "<div class='wipe-underlay' style='border-color:" + accent + "'>" +
          "<div class='wipe-lotus-glyph' style='color:" + accent + "'>✿</div>" +
          "<div class='wipe-reveal-title'>" + vow.title + "</div>" +
          "<div class='wipe-reveal-sub'>" + ((vow.vowPrompt && vow.vowPrompt.mantra) || "心淨則國土淨") + "</div>" +
        "</div>" +
        "<canvas id='ritual-wipe-canvas' class='wipe-canvas' width='" + w + "' height='" + h + "'></canvas>" +
      "</div>" +
      "<div class='wipe-progress-wrap'>" +
        "<div class='wipe-progress-bar'><div id='ritual-wipe-fill' class='wipe-progress-fill' style='background:" + accent + "'></div></div>" +
        "<span id='ritual-wipe-pct' class='wipe-pct'>已拂拭 0%</span>" +
      "</div>" +
      "<button id='ritual-wipe-assist' type='button' class='btn-pill'>輕拂一層塵霧</button>" +
      "<p id='ritual-wipe-status' class='breath-status'>用手指或滑鼠在上方雲霧滑動，拭現清淨本心。</p>";

    var canvas = container.querySelector("#ritual-wipe-canvas");
    var ctx = canvas.getContext("2d");
    var fillEl = container.querySelector("#ritual-wipe-fill");
    var pctEl = container.querySelector("#ritual-wipe-pct");
    var assistBtn = container.querySelector("#ritual-wipe-assist");
    var statusEl = container.querySelector("#ritual-wipe-status");

    // 繪製初始柔霧層
    var mistGrad = ctx.createLinearGradient(0, 0, w, h);
    mistGrad.addColorStop(0, "rgba(30, 41, 68, 0.96)");
    mistGrad.addColorStop(0.5, "rgba(44, 58, 92, 0.94)");
    mistGrad.addColorStop(1, "rgba(24, 34, 58, 0.96)");
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(226, 232, 240, 0.14)";
    for (var s = 0; s < 36; s++) {
      ctx.beginPath();
      ctx.arc((s * 53) % w, (s * 37) % h, 10 + (s % 4) * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = "600 14px 'Noto Serif TC', serif";
    ctx.fillStyle = "rgba(226, 232, 240, 0.7)";
    ctx.textAlign = "center";
    ctx.fillText("輕輕滑動 ・ 拂去塵霧", w / 2, h / 2 + 5);

    function eraseAt(x, y) {
      if (completed) return;
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();
      if (lastPt) {
        ctx.lineWidth = 42;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(lastPt.x, lastPt.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.restore();
      lastPt = { x: x, y: y };
      if (window.VowsGame.Audio) window.VowsGame.Audio.playBrushShimmer();
      checkProgress();
    }

    function checkProgress() {
      if (completed) return;
      var img = ctx.getImageData(0, 0, w, h).data;
      var totalSamples = 0;
      var clearedSamples = 0;
      for (var y = 4; y < h; y += 8) {
        for (var x = 4; x < w; x += 8) {
          totalSamples++;
          var alpha = img[(y * w + x) * 4 + 3];
          if (alpha < 70) clearedSamples++;
        }
      }
      var ratio = clearedSamples / Math.max(1, totalSamples);
      var displayPct = Math.min(100, Math.round((ratio / 0.65) * 100));
      fillEl.style.width = displayPct + "%";
      pctEl.textContent = "已拂拭 " + displayPct + "%";

      if (ratio >= 0.65) {
        completed = true;
        canvas.style.opacity = "0";
        fillEl.style.width = "100%";
        pctEl.textContent = "清淨顯露 100%";
        assistBtn.disabled = true;
        finishRitual(statusEl, onComplete);
      }
    }

    function toCanvasPt(e) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * w,
        y: ((e.clientY - rect.top) / rect.height) * h
      };
    }

    addListener(canvas, "pointerdown", function (e) {
      e.preventDefault();
      drawing = true;
      lastPt = null;
      var pt = toCanvasPt(e);
      eraseAt(pt.x, pt.y);
    });
    addListener(window, "pointermove", function (e) {
      if (!drawing || completed) return;
      var pt = toCanvasPt(e);
      eraseAt(pt.x, pt.y);
    });
    addListener(window, "pointerup", function () {
      drawing = false;
      lastPt = null;
    });
    addListener(window, "pointercancel", function () {
      drawing = false;
      lastPt = null;
    });

    addListener(assistBtn, "click", function () {
      if (completed) return;
      var ys = [36, 94, 152, 65, 125];
      var y = ys[sweepStep % ys.length];
      sweepStep++;
      lastPt = { x: 24, y: y };
      eraseAt(w - 24, y + (sweepStep % 2 === 0 ? -12 : 12));
      lastPt = null;
    });
  }

  /* ==================== 4. 願光連線 (constellation) ==================== */
  function mountConstellation(container, vow, onComplete) {
    var count = 5 + (vow.id % 3); // 5..7 星點
    var accent = vow.color || "#38bdf8";
    var patternType = vow.id % 3;
    var points = [];

    for (var i = 0; i < count; i++) {
      var px, py;
      if (patternType === 0) {
        // 蓮華環星陣
        var a = (Math.PI * 2 * i) / count - Math.PI / 2;
        px = 145 + Math.cos(a) * 84;
        py = 104 + Math.sin(a) * 70;
      } else if (patternType === 1) {
        // 銀河星斗弧
        var t = i / (count - 1);
        px = 36 + t * 218;
        py = 112 - Math.sin(t * Math.PI) * 58 + (i % 2 === 0 ? 12 : -12);
      } else {
        // 放射星芒序
        var stepAng = (Math.PI * 2 * ((i * 2) % count)) / count - Math.PI / 2;
        var rad = i % 2 === 0 ? 82 : 52;
        px = 145 + Math.cos(stepAng) * rad;
        py = 104 + Math.sin(stepAng) * rad * 0.85;
      }
      points.push({ x: px, y: py });
    }

    var currentIdx = 0;
    container.innerHTML =
      "<svg id='ritual-star-svg' class='constellation-svg' viewBox='0 0 290 208' width='290' height='208'>" +
        "<g id='ritual-star-beams'></g>" +
        "<g id='ritual-star-nodes'></g>" +
      "</svg>" +
      "<p id='ritual-star-status' class='breath-status'>請依序點擊閃耀光點（1 / " + count + "），織就願光星網。</p>";

    var beamsGroup = container.querySelector("#ritual-star-beams");
    var nodesGroup = container.querySelector("#ritual-star-nodes");
    var statusEl = container.querySelector("#ritual-star-status");

    // 預畫淡虛線引導輪廓
    for (var g = 0; g < count - 1; g++) {
      var guide = document.createElementNS("http://www.w3.org/2000/svg", "line");
      guide.setAttribute("x1", points[g].x.toFixed(1));
      guide.setAttribute("y1", points[g].y.toFixed(1));
      guide.setAttribute("x2", points[g + 1].x.toFixed(1));
      guide.setAttribute("y2", points[g + 1].y.toFixed(1));
      guide.setAttribute("stroke", "rgba(148, 163, 184, 0.22)");
      guide.setAttribute("stroke-dasharray", "4 4");
      guide.setAttribute("stroke-width", "1.5");
      beamsGroup.appendChild(guide);
    }

    var nodeEls = [];
    points.forEach(function (pt, idx) {
      var node = document.createElementNS("http://www.w3.org/2000/svg", "g");
      node.setAttribute("class", "star-pt" + (idx === 0 ? " active" : ""));
      node.setAttribute("transform", "translate(" + pt.x.toFixed(1) + "," + pt.y.toFixed(1) + ")");

      var ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      ring.setAttribute("r", "18");
      ring.setAttribute("class", "star-pt-ring");
      ring.style.stroke = accent;

      var core = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      core.setAttribute("r", "10");
      core.setAttribute("class", "star-pt-core");

      var num = document.createElementNS("http://www.w3.org/2000/svg", "text");
      num.setAttribute("y", "4");
      num.setAttribute("text-anchor", "middle");
      num.setAttribute("class", "star-pt-num");
      num.textContent = String(idx + 1);

      node.appendChild(ring);
      node.appendChild(core);
      node.appendChild(num);
      nodesGroup.appendChild(node);
      nodeEls.push(node);

      addListener(node, "pointerdown", function (e) {
        e.preventDefault();
        if (idx !== currentIdx) return;

        node.classList.remove("active");
        node.classList.add("done");
        core.style.fill = accent;

        if (idx > 0) {
          var beam = document.createElementNS("http://www.w3.org/2000/svg", "line");
          beam.setAttribute("x1", points[idx - 1].x.toFixed(1));
          beam.setAttribute("y1", points[idx - 1].y.toFixed(1));
          beam.setAttribute("x2", pt.x.toFixed(1));
          beam.setAttribute("y2", pt.y.toFixed(1));
          beam.setAttribute("class", "star-beam");
          beam.style.stroke = accent;
          beamsGroup.appendChild(beam);
        }

        if (window.VowsGame.Audio) {
          window.VowsGame.Audio.playWaterDrop(idx);
        }

        currentIdx++;
        if (currentIdx >= count) {
          // 閉合回到起點星光
          var closeBeam = document.createElementNS("http://www.w3.org/2000/svg", "line");
          closeBeam.setAttribute("x1", points[count - 1].x.toFixed(1));
          closeBeam.setAttribute("y1", points[count - 1].y.toFixed(1));
          closeBeam.setAttribute("x2", points[0].x.toFixed(1));
          closeBeam.setAttribute("y2", points[0].y.toFixed(1));
          closeBeam.setAttribute("class", "star-beam");
          closeBeam.style.stroke = "#f0c869";
          beamsGroup.appendChild(closeBeam);
          finishRitual(statusEl, onComplete);
        } else {
          nodeEls[currentIdx].classList.add("active");
          statusEl.textContent = "願光相續，請點亮第 " + (currentIdx + 1) + " 顆星光（" + currentIdx + " / " + count + "）。";
        }
      });
    });
  }

  /* ==================== 5. 法音和鳴 (chime) ==================== */
  function mountChime(container, vow, onComplete) {
    var BELL_LABELS = ["宮", "商", "角", "徵", "羽"];
    var accent = vow.color || "#6ee7b7";
    var melody = [];
    for (var m = 0; m < 6; m++) {
      melody.push((vow.id + m * 2 + (m % 2)) % 5);
    }
    var step = 0;

    container.innerHTML =
      "<div class='chime-stage'>" +
        "<div id='ritual-chime-arc' class='chime-arc'></div>" +
        "<div id='ritual-chime-dots' class='chime-progress'></div>" +
      "</div>" +
      "<p id='ritual-chime-status' class='breath-status'>請輕敲閃耀的蓮鈴（1 / " + melody.length + "），聆聽寶樹法音。</p>";

    var arcEl = container.querySelector("#ritual-chime-arc");
    var dotsEl = container.querySelector("#ritual-chime-dots");
    var statusEl = container.querySelector("#ritual-chime-status");
    var bellBtns = [];

    for (var b = 0; b < 5; b++) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chime-bell";
      btn.style.setProperty("--bell-offset", Math.abs(b - 2) * 10 + "px");
      btn.innerHTML = "<span class='bell-icon'>🔔</span><span class='bell-name'>" + BELL_LABELS[b] + "</span>";
      arcEl.appendChild(btn);
      bellBtns.push(btn);

      (function (bellIdx) {
        addListener(btn, "pointerdown", function (e) {
          e.preventDefault();
          if (step >= melody.length) return;
          if (window.VowsGame.Audio) {
            window.VowsGame.Audio.playScaleNote(bellIdx, 1.15);
          }
          btn.classList.add("rung");
          safeTimeout(function () { btn.classList.remove("rung"); }, 320);

          if (bellIdx === melody[step]) {
            step++;
            updateChimeUI();
            if (step >= melody.length) {
              finishRitual(statusEl, onComplete);
            } else {
              statusEl.textContent = "清音和鳴！請續敲下一個發光蓮鈴（" + step + " / " + melody.length + "）。";
            }
          } else {
            statusEl.textContent = "法音清越，請依光影輕敲標記之鈴（第 " + (step + 1) + " 音）。";
          }
        });
      })(b);
    }

    function updateChimeUI() {
      bellBtns.forEach(function (btn, idx) {
        var isCue = step < melody.length && idx === melody[step];
        btn.classList.toggle("cue", isCue);
        btn.style.borderColor = isCue ? accent : "";
      });
      dotsEl.innerHTML = "";
      for (var d = 0; d < melody.length; d++) {
        var dot = document.createElement("span");
        dot.className = "chime-step-dot" + (d < step ? " lit" : "");
        if (d < step) dot.style.background = accent;
        dotsEl.appendChild(dot);
      }
    }

    updateChimeUI();
  }

  /* ==================== 6. 寶華散供 (petals) ==================== */
  function mountPetals(container, vow, onComplete) {
    var target = 7 + (vow.id % 3);
    var accent = vow.color || "#f472b6";
    var w = 300;
    var h = 205;
    var caught = 0;
    var completed = false;
    var petals = [];
    var sparks = [];
    var lastTs = 0;

    container.innerHTML =
      "<div class='petals-stage'>" +
        "<canvas id='ritual-petals-canvas' class='petals-canvas' width='" + w + "' height='" + h + "'></canvas>" +
        "<div id='ritual-petals-counter' class='petals-counter'>已承接寶華：0 / " + target + "</div>" +
      "</div>" +
      "<button id='ritual-petals-assist' type='button' class='btn-pill'>合掌承接一瓣蓮華</button>" +
      "<p id='ritual-petals-status' class='breath-status'>輕點或滑過飄落的七寶蓮瓣，收攝入蓮台供養諸佛。</p>";

    var canvas = container.querySelector("#ritual-petals-canvas");
    var ctx = canvas.getContext("2d");
    var counterEl = container.querySelector("#ritual-petals-counter");
    var assistBtn = container.querySelector("#ritual-petals-assist");
    var statusEl = container.querySelector("#ritual-petals-status");

    function spawnPetal(startTop) {
      var palette = [accent, "#fde68a", "#fbcfe8"];
      return {
        x: 28 + Math.random() * (w - 56),
        y: startTop ? -14 - Math.random() * 40 : Math.random() * (h - 60),
        vy: 30 + Math.random() * 24,
        vx: -10 + Math.random() * 20,
        rot: Math.random() * Math.PI * 2,
        vrot: -1.2 + Math.random() * 2.4,
        size: 9 + Math.random() * 4,
        color: palette[Math.floor(Math.random() * palette.length)]
      };
    }

    for (var i = 0; i < 6; i++) {
      petals.push(spawnPetal(false));
    }

    function catchPetalAt(idx) {
      if (completed) return;
      var p = petals[idx];
      for (var s = 0; s < 6; s++) {
        var ang = (Math.PI * 2 * s) / 6;
        sparks.push({ x: p.x, y: p.y, vx: Math.cos(ang) * 48, vy: Math.sin(ang) * 48, life: 1.0, color: p.color });
      }
      petals[idx] = spawnPetal(true);
      caught++;
      counterEl.textContent = "已承接寶華：" + caught + " / " + target;
      if (window.VowsGame.Audio) window.VowsGame.Audio.playWaterDrop(caught);

      if (caught >= target) {
        completed = true;
        assistBtn.disabled = true;
        finishRitual(statusEl, onComplete);
      } else {
        statusEl.textContent = "功德花雨繽紛！已獻供第 " + caught + " 瓣蓮華。";
      }
    }

    function tryHit(clientX, clientY) {
      if (completed) return;
      var rect = canvas.getBoundingClientRect();
      var cx = ((clientX - rect.left) / rect.width) * w;
      var cy = ((clientY - rect.top) / rect.height) * h;
      for (var i = petals.length - 1; i >= 0; i--) {
        if (Math.hypot(petals[i].x - cx, petals[i].y - cy) <= 34) {
          catchPetalAt(i);
          break;
        }
      }
    }

    var pointerActive = false;
    addListener(canvas, "pointerdown", function (e) {
      e.preventDefault();
      pointerActive = true;
      tryHit(e.clientX, e.clientY);
    });
    addListener(canvas, "pointermove", function (e) {
      if (pointerActive) tryHit(e.clientX, e.clientY);
    });
    addListener(window, "pointerup", function () { pointerActive = false; });
    addListener(assistBtn, "click", function () {
      if (petals.length > 0) catchPetalAt(0);
    });

    safeRaf(function (ts, stop) {
      if (!lastTs) lastTs = ts;
      var dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;

      ctx.clearRect(0, 0, w, h);

      // 底部蓮花供盤光暈
      var bowlGrad = ctx.createRadialGradient(w / 2, h - 18, 8, w / 2, h - 18, 82);
      bowlGrad.addColorStop(0, "rgba(240, 200, 105, 0.36)");
      bowlGrad.addColorStop(1, "rgba(15, 23, 42, 0)");
      ctx.fillStyle = bowlGrad;
      ctx.beginPath();
      ctx.arc(w / 2, h - 18, 82, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(240, 200, 105, 0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(w / 2, h - 18, 54, 12, 0, 0, Math.PI);
      ctx.stroke();

      for (var i = 0; i < petals.length; i++) {
        var p = petals[i];
        p.y += p.vy * dt;
        p.x += (p.vx + Math.sin(ts * 0.002 + i) * 14) * dt;
        p.rot += p.vrot * dt;
        if (p.y > h + 16) {
          petals[i] = spawnPetal(true);
          continue;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.88;
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.quadraticCurveTo(p.size * 0.75, 0, 0, p.size);
        ctx.quadraticCurveTo(-p.size * 0.75, 0, 0, -p.size);
        ctx.fill();
        ctx.restore();
      }

      for (var j = sparks.length - 1; j >= 0; j--) {
        var sp = sparks[j];
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.life -= dt * 2.2;
        if (sp.life <= 0) {
          sparks.splice(j, 1);
          continue;
        }
        ctx.fillStyle = sp.color;
        ctx.globalAlpha = sp.life;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 3 * sp.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (completed && sparks.length === 0) {
        stop();
      }
    });
  }

  /* ==================== 7. 轉輪調心 (wheel) ==================== */
  function mountWheel(container, vow, onComplete) {
    var TARGET_DEG = 540; // 1.5 圈柔和轉動
    var accent = vow.color || "#f0c869";
    var totalDeg = 0;
    var lastChimeStep = 0;
    var dragging = false;
    var prevAng = 0;
    var holdingBtn = false;
    var completed = false;
    var lastTs = 0;

    container.innerHTML =
      "<div class='wheel-stage'>" +
        "<svg id='ritual-wheel-svg' class='wheel-svg' viewBox='0 0 220 220' width='220' height='220'>" +
          "<circle cx='110' cy='110' r='96' fill='none' stroke='rgba(148,163,184,0.2)' stroke-width='6' />" +
          "<circle id='ritual-wheel-prog' cx='110' cy='110' r='96' fill='none' stroke='" + accent + "' stroke-width='6' stroke-linecap='round' transform='rotate(-90 110 110)' />" +
          "<g id='ritual-wheel-rotor' transform='translate(110,110) rotate(0)'></g>" +
        "</svg>" +
        "<div id='ritual-wheel-pct' class='wheel-pct'>法輪運轉 0%</div>" +
      "</div>" +
      "<button id='ritual-wheel-btn' type='button' class='btn-hold'>拖曳轉動上方金輪，或長按此處（空白鍵）緩轉</button>" +
      "<p id='ritual-wheel-status' class='breath-status'>順逆皆宜，平緩轉動八輻金法輪至圓滿。</p>";

    var svg = container.querySelector("#ritual-wheel-svg");
    var progEl = container.querySelector("#ritual-wheel-prog");
    var rotor = container.querySelector("#ritual-wheel-rotor");
    var pctEl = container.querySelector("#ritual-wheel-pct");
    var holdBtn = container.querySelector("#ritual-wheel-btn");
    var statusEl = container.querySelector("#ritual-wheel-status");

    // 繪製八輻金輪
    var outer = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    outer.setAttribute("r", "68");
    outer.setAttribute("fill", "rgba(240, 200, 105, 0.08)");
    outer.setAttribute("stroke", accent);
    outer.setAttribute("stroke-width", "3.5");
    rotor.appendChild(outer);

    var inner = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    inner.setAttribute("r", "18");
    inner.setAttribute("fill", "rgba(240, 200, 105, 0.25)");
    inner.setAttribute("stroke", "#fde68a");
    inner.setAttribute("stroke-width", "2.5");
    rotor.appendChild(inner);

    var spokeEls = [];
    for (var s = 0; s < 8; s++) {
      var a = (Math.PI / 4) * s;
      var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", (Math.cos(a) * 18).toFixed(1));
      line.setAttribute("y1", (Math.sin(a) * 18).toFixed(1));
      line.setAttribute("x2", (Math.cos(a) * 76).toFixed(1));
      line.setAttribute("y2", (Math.sin(a) * 76).toFixed(1));
      line.setAttribute("stroke", "rgba(226, 232, 240, 0.45)");
      line.setAttribute("stroke-width", "3");
      line.setAttribute("stroke-linecap", "round");
      rotor.appendChild(line);

      var gem = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      gem.setAttribute("cx", (Math.cos(a) * 78).toFixed(1));
      gem.setAttribute("cy", (Math.sin(a) * 78).toFixed(1));
      gem.setAttribute("r", "5");
      gem.setAttribute("fill", "rgba(148, 163, 184, 0.35)");
      rotor.appendChild(gem);
      spokeEls.push({ line: line, gem: gem });
    }

    var displayAngle = 0;
    function addRotation(deltaDeg) {
      if (completed) return;
      displayAngle += deltaDeg;
      totalDeg += Math.abs(deltaDeg);
      rotor.setAttribute("transform", "translate(110,110) rotate(" + displayAngle.toFixed(1) + ")");

      var ratio = Math.min(1, totalDeg / TARGET_DEG);
      var circ = 2 * Math.PI * 96;
      progEl.style.strokeDasharray = circ.toFixed(1);
      progEl.style.strokeDashoffset = (circ * (1 - ratio)).toFixed(1);
      pctEl.textContent = "法輪運轉 " + Math.round(ratio * 100) + "%";

      var litSpokes = Math.min(8, Math.floor(ratio * 8));
      spokeEls.forEach(function (sp, idx) {
        var lit = idx < litSpokes;
        sp.line.setAttribute("stroke", lit ? accent : "rgba(226, 232, 240, 0.45)");
        sp.gem.setAttribute("fill", lit ? "#fde68a" : "rgba(148, 163, 184, 0.35)");
      });

      var step = Math.floor(totalDeg / 67.5);
      if (step > lastChimeStep) {
        lastChimeStep = step;
        if (window.VowsGame.Audio) window.VowsGame.Audio.playWheelClick(step);
      }

      if (totalDeg >= TARGET_DEG) {
        completed = true;
        holdBtn.disabled = true;
        pctEl.textContent = "法輪圓滿 100%";
        finishRitual(statusEl, onComplete);
      }
    }

    function pointerAngle(e) {
      var rect = svg.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      return Math.atan2(e.clientY - cy, e.clientX - cx);
    }

    addListener(svg, "pointerdown", function (e) {
      e.preventDefault();
      dragging = true;
      prevAng = pointerAngle(e);
    });
    addListener(window, "pointermove", function (e) {
      if (!dragging || completed) return;
      var cur = pointerAngle(e);
      var diff = cur - prevAng;
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      prevAng = cur;
      addRotation(diff * (180 / Math.PI));
    });
    addListener(window, "pointerup", function () { dragging = false; holdingBtn = false; });
    addListener(window, "pointercancel", function () { dragging = false; holdingBtn = false; });

    addListener(holdBtn, "pointerdown", function (e) {
      e.preventDefault();
      holdingBtn = true;
    });
    addListener(window, "keydown", function (e) {
      if (e.code === "Space") {
        e.preventDefault();
        holdingBtn = true;
      }
    });
    addListener(window, "keyup", function (e) {
      if (e.code === "Space") {
        e.preventDefault();
        holdingBtn = false;
      }
    });

    addRotation(0);
    safeRaf(function (ts, stop) {
      if (completed) { stop(); return; }
      if (!lastTs) lastTs = ts;
      var dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      if (holdingBtn) {
        addRotation(150 * dt);
      }
    });
  }

  /* ==================== 8. 經句印心 (inscribe) ==================== */
  function buildInscribeSegments(vow) {
    var mantra = (vow.vowPrompt && vow.vowPrompt.mantra) ? vow.vowPrompt.mantra : "";
    var parts = mantra.split("·");
    var core = (parts[1] || vow.title || "一心不亂").trim().replace(/\s+/g, "");
    if (core.length < 6) {
      core = "南無阿彌陀佛" + core;
    }
    // 將核心詞句穩健切分為 4 個字燈（每格 2~3 字）
    var segments = [];
    if (core.length === 8) {
      segments = [core.slice(0, 2), core.slice(2, 4), core.slice(4, 6), core.slice(6, 8)];
    } else if (core.length === 6) {
      segments = [core.slice(0, 2), core.slice(2, 4), core.slice(4, 6)];
    } else {
      var step = Math.max(2, Math.ceil(core.length / 4));
      for (var i = 0; i < core.length; i += step) {
        segments.push(core.slice(i, i + step));
      }
    }
    return segments;
  }

  function mountInscribe(container, vow, onComplete) {
    var segments = buildInscribeSegments(vow);
    var accent = vow.color || "#fde047";
    var nextIndex = 0;

    // 依 vow.id 做穩定亂序（保證不等於原順序）
    var shuffled = segments.map(function (text, idx) {
      return { text: text, origIdx: idx };
    });
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = (vow.id * 5 + i * 3) % (i + 1);
      var tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }
    if (shuffled.every(function (item, idx) { return item.origIdx === idx; }) && shuffled.length > 1) {
      var swap = shuffled[0];
      shuffled[0] = shuffled[shuffled.length - 1];
      shuffled[shuffled.length - 1] = swap;
    }

    container.innerHTML =
      "<div class='inscribe-stage'>" +
        "<div id='ritual-inscribe-slots' class='inscribe-slots'></div>" +
        "<div id='ritual-inscribe-tiles' class='inscribe-tiles'></div>" +
      "</div>" +
      "<p id='ritual-inscribe-status' class='breath-status'>請依序點選上方願句字燈，將本願印入心田。</p>";

    var slotsEl = container.querySelector("#ritual-inscribe-slots");
    var tilesEl = container.querySelector("#ritual-inscribe-tiles");
    var statusEl = container.querySelector("#ritual-inscribe-status");

    var slotEls = segments.map(function () {
      var slot = document.createElement("div");
      slot.className = "inscribe-slot";
      slot.textContent = "＿";
      slotsEl.appendChild(slot);
      return slot;
    });

    var tileBtns = [];
    shuffled.forEach(function (item) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "inscribe-tile";
      btn.textContent = item.text;
      btn.setAttribute("data-orig", String(item.origIdx));
      tilesEl.appendChild(btn);
      tileBtns.push(btn);

      addListener(btn, "click", function () {
        if (nextIndex >= segments.length || btn.disabled) return;
        if (item.origIdx === nextIndex) {
          btn.disabled = true;
          btn.classList.add("used");
          btn.classList.remove("hint-glow");

          var targetSlot = slotEls[nextIndex];
          targetSlot.textContent = item.text;
          targetSlot.classList.add("filled");
          targetSlot.style.borderColor = accent;
          targetSlot.style.color = accent;

          if (window.VowsGame.Audio) {
            window.VowsGame.Audio.playScaleNote(nextIndex, 0.95);
          }

          nextIndex++;
          if (nextIndex >= segments.length) {
            finishRitual(statusEl, onComplete);
          } else {
            statusEl.textContent = "妙句相契！請繼續點選下一組字燈（" + nextIndex + " / " + segments.length + "）。";
          }
        } else {
          // 柔和提示正確字燈，無錯誤懲罰
          if (window.VowsGame.Audio) window.VowsGame.Audio.playChime(392.0);
          tileBtns.forEach(function (t) {
            t.classList.toggle("hint-glow", Number(t.getAttribute("data-orig")) === nextIndex);
          });
          statusEl.textContent = "先從發光提示的字燈「" + segments[nextIndex] + "」接續即可。";
        }
      });
    });
  }

  /* ==================== 統一掛載入口 ==================== */
  var HANDLERS = {
    breath: mountBreath,
    beads: mountBeads,
    wipe: mountWipe,
    constellation: mountConstellation,
    chime: mountChime,
    petals: mountPetals,
    wheel: mountWheel,
    inscribe: mountInscribe
  };

  function mount(containerEl, vow, onComplete) {
    destroy();
    if (!containerEl || !vow) return;
    containerEl.innerHTML = "";
    containerEl.style.setProperty("--vow-accent", vow.color || "#62d2c4");
    var handler = HANDLERS[vow.ritualType] || mountBreath;
    handler(containerEl, vow, onComplete);
  }

  window.VowsGame.Rituals = {
    mount: mount,
    destroy: destroy
  };
})();
