/**
 * 《無量壽經・四十八願行》主控制器（完整 48 願版）
 * 管理：本地存檔、首頁/地圖切換、三階段闖關、呼吸三段音效、48 願星圖、法卡分區篩選
 */
(function () {
  window.VowsGame = window.VowsGame || {};

  var STORAGE_KEY = "amitabha_48_vows_demo_v1";

  function getDefaultStartPos() {
    var vows = window.VowsGame.Data && window.VowsGame.Data.ALL_48_VOWS;
    if (vows && vows[0]) {
      return { x: vows[0].mapPos.x - 100, y: vows[0].mapPos.y + 60 };
    }
    return { x: 220, y: 2110 };
  }

  var state = loadState();
  var activeVow = null;
  var activeNearVow = null;
  var activeCardFilter = "all";

  // 思惟階段狀態
  var lineIndex = 0;
  var typedChars = 0;
  var typingTimer = null;
  var questionAnswered = false;

  // 發願階段呼吸狀態 (3 輪: 吸氣3.5s -> 持願1.5s -> 等待放手 -> 呼氣3.5s)
  var TOTAL_BREATHS = 3;
  var INHALE_SEC = 3.5;
  var HOLD_SEC = 1.5;
  var EXHALE_SEC = 3.5;
  var breathState = {
    cyclesDone: 0,
    phase: "idle", // idle | inhaling | resting | wait_release | exhaling | done
    isHolding: false,
    phaseElapsed: 0,
    lastTs: 0,
    rafId: null
  };

  function loadState() {
    var fallbackPos = getDefaultStartPos();
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {
          completedIds: [],
          completedDates: {},
          soundEnabled: true,
          volume: 0.5,
          playerPos: fallbackPos
        };
      }
      var parsed = JSON.parse(raw);
      return {
        completedIds: Array.isArray(parsed.completedIds) ? parsed.completedIds : [],
        completedDates: parsed.completedDates || {},
        soundEnabled: parsed.soundEnabled !== false,
        volume: typeof parsed.volume === "number" ? parsed.volume : 0.5,
        playerPos: parsed.playerPos || fallbackPos
      };
    } catch (e) {
      return {
        completedIds: [],
        completedDates: {},
        soundEnabled: true,
        volume: 0.5,
        playerPos: fallbackPos
      };
    }
  }

  function saveState() {
    try {
      if (window.VowsGame.Map) {
        state.playerPos = window.VowsGame.Map.getPlayerPosition();
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function $(id) {
    return document.getElementById(id);
  }

  function showModal(id) {
    $(id).classList.remove("hidden");
  }

  function hideModal(id) {
    $(id).classList.add("hidden");
  }

  function getNextTargetVow() {
    var vows = window.VowsGame.Data.ALL_48_VOWS;
    for (var i = 0; i < vows.length; i++) {
      if (state.completedIds.indexOf(vows[i].id) === -1) return vows[i];
    }
    return null;
  }

  function updateTitleUI() {
    var next = getNextTargetVow();
    var btnStart = $("btn-start");
    var badge = $("title-cards-badge");

    if (state.completedIds.length === 0) {
      btnStart.textContent = "開始發願";
    } else if (next) {
      btnStart.textContent = "繼續修行 · " + next.vowLabel;
    } else {
      btnStart.textContent = "重溫極樂願海 (四十八願圓滿)";
    }

    if (badge) {
      badge.textContent = state.completedIds.length + " / 48";
    }
  }

  function updateMapHUD() {
    var next = getNextTargetVow();
    var secEl = $("hud-section");
    var targetEl = $("hud-target-title");
    var pureEl = $("hud-pureland-status");

    if (next) {
      secEl.textContent = next.section;
      targetEl.textContent = "尋訪 " + next.vowLabel + " · " + next.title;
    } else {
      secEl.textContent = "四十八願圓滿";
      targetEl.textContent = "極樂淨土已現莊嚴 · 歡迎自由重溫";
    }
    pureEl.textContent = "極樂莊嚴度：" + state.completedIds.length + " / 48";

    renderProgressTrack();
    updateInteractButton(activeNearVow);
  }

  function renderProgressTrack() {
    var container = $("map-progress-track");
    if (!container) return;
    container.innerHTML = "";
    var data = window.VowsGame.Data;

    data.SECTIONS.forEach(function (sec, idx) {
      var vowsInSec = data.ALL_48_VOWS.filter(function (v) { return v.sectionId === sec.id; });
      var doneInSec = vowsInSec.filter(function (v) { return state.completedIds.indexOf(v.id) !== -1; }).length;

      var dot = document.createElement("button");
      dot.type = "button";
      var allDone = doneInSec === vowsInSec.length;
      var partial = doneInSec > 0 && !allDone;
      dot.className = "progress-node" + (allDone ? " done" : (partial ? " next" : ""));
      dot.title = sec.name + "（" + doneInSec + "/" + vowsInSec.length + "）點擊開啟星圖";
      dot.innerHTML = "<span>" + (idx + 1) + "</span>";
      dot.addEventListener("click", openStarMap);
      container.appendChild(dot);
    });
  }

  function updateInteractButton(nearVow) {
    activeNearVow = nearVow;
    var btn = $("btn-interact-vow");
    if (!btn) return;
    if (!nearVow) {
      btn.classList.add("hidden");
      return;
    }
    var isDone = state.completedIds.indexOf(nearVow.id) !== -1;
    btn.textContent = (isDone ? "重溫 " : "參悟 ") + nearVow.vowLabel + " · " + nearVow.title;
    btn.classList.remove("hidden");
  }

  function enterMapScreen() {
    if (window.VowsGame.Audio) window.VowsGame.Audio.unlock();
    $("screen-title").classList.add("hidden");
    $("screen-map").classList.remove("hidden");
    window.VowsGame.Map.start();
    updateMapHUD();
  }

  function backToTitleScreen() {
    saveState();
    window.VowsGame.Map.stop();
    $("screen-map").classList.add("hidden");
    $("screen-title").classList.remove("hidden");
    updateTitleUI();
  }

  /* ==================== 三階段闖關：思惟 -> 發願 -> 莊嚴 ==================== */

  function openEncounter(vow) {
    activeVow = vow;
    if (window.VowsGame.Audio) window.VowsGame.Audio.playChime(523.25);

    $("enc-vow-badge").textContent = vow.vowLabel + " · " + vow.title;
    $("enc-lotus-name").textContent = vow.lotusName + "（" + vow.section + " · " + vow.lampStyleName + "）";

    setEncounterStage("ask");
    initAskStage(vow);
    showModal("modal-encounter");
  }

  function closeEncounter() {
    stopTyping();
    stopBreathLoop();
    hideModal("modal-encounter");
    activeVow = null;
    updateMapHUD();
  }

  function setEncounterStage(stage) {
    ["ask", "still", "realize"].forEach(function (s) {
      $("enc-stage-" + s).classList.toggle("hidden", s !== stage);
      $("enc-phase-" + s).classList.toggle("active", s === stage);
    });
  }

  // --- 階段一：思惟 ---
  function initAskStage(vow) {
    lineIndex = 0;
    questionAnswered = false;
    $("ask-question-area").classList.add("hidden");
    $("ask-feedback-box").classList.add("hidden");
    $("btn-to-still").classList.add("hidden");
    $("ask-dialogue-box").classList.remove("hidden");
    startTypingLine(vow.introLines[0]);
  }

  function stopTyping() {
    if (typingTimer) {
      clearInterval(typingTimer);
      typingTimer = null;
    }
  }

  function startTypingLine(text) {
    stopTyping();
    typedChars = 0;
    var textEl = $("ask-dialogue-text");
    var hintEl = $("ask-dialogue-hint");
    textEl.textContent = "";
    hintEl.textContent = "點擊文字框可加速顯示";

    typingTimer = setInterval(function () {
      typedChars++;
      textEl.textContent = text.slice(0, typedChars);
      if (typedChars >= text.length) {
        stopTyping();
        hintEl.textContent = lineIndex < activeVow.introLines.length - 1 ? "點擊繼續下一段 ›" : "點擊進入法義思惟 ›";
      }
    }, 24);
  }

  function handleDialogueClick() {
    if (!activeVow) return;
    var currentLine = activeVow.introLines[lineIndex];
    if (typedChars < currentLine.length) {
      stopTyping();
      typedChars = currentLine.length;
      $("ask-dialogue-text").textContent = currentLine;
      $("ask-dialogue-hint").textContent = lineIndex < activeVow.introLines.length - 1 ? "點擊繼續下一段 ›" : "點擊進入法義思惟 ›";
      return;
    }

    if (lineIndex < activeVow.introLines.length - 1) {
      lineIndex++;
      if (window.VowsGame.Audio) window.VowsGame.Audio.playChime(587.33);
      startTypingLine(activeVow.introLines[lineIndex]);
    } else {
      showAskQuestion();
    }
  }

  function showAskQuestion() {
    $("ask-dialogue-box").classList.add("hidden");
    var qArea = $("ask-question-area");
    qArea.classList.remove("hidden");
    $("ask-question-prompt").textContent = activeVow.question.prompt;

    var list = $("ask-choices-list");
    list.innerHTML = "";
    activeVow.question.choices.forEach(function (choice) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.textContent = choice.text;
      btn.addEventListener("click", function () {
        if (questionAnswered) return;
        var fb = $("ask-feedback-box");
        fb.classList.remove("hidden", "correct", "gentle");
        fb.textContent = choice.feedback;

        var allBtns = list.querySelectorAll(".choice-btn");
        allBtns.forEach(function (b) { b.classList.remove("selected-wrong", "selected-right"); });

        if (choice.isCorrect) {
          questionAnswered = true;
          btn.classList.add("selected-right");
          fb.classList.add("correct");
          $("btn-to-still").classList.remove("hidden");
          if (window.VowsGame.Audio) window.VowsGame.Audio.playBowl(523.25, 2.2);
        } else {
          btn.classList.add("selected-wrong");
          fb.classList.add("gentle");
          if (window.VowsGame.Audio) window.VowsGame.Audio.playChime(329.63);
        }
      });
      list.appendChild(btn);
    });
  }

  // --- 階段二：發願（呼吸光環三段音效：長按吸氣 / 放手呼氣 / 完整光圈） ---
  function initStillStage(vow) {
    setEncounterStage("still");
    $("still-title").textContent = vow.vowPrompt.title;
    $("still-guide").textContent = vow.vowPrompt.guide;
    $("still-mantra").textContent = vow.vowPrompt.mantra;

    breathState.cyclesDone = 0;
    breathState.phase = "idle";
    breathState.isHolding = false;
    breathState.phaseElapsed = 0;
    breathState.lastTs = 0;

    buildBreathPetals();
    updateBreathUI();
    startBreathLoop();
  }

  function buildBreathPetals() {
    var group = $("breath-petals-group");
    if (!group) return;
    group.innerHTML = "";
    var total = 24;
    for (var i = 0; i < total; i++) {
      var angle = (i * 360) / total;
      var dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      var rad = ((angle - 90) * Math.PI) / 180;
      var r = 92;
      dot.setAttribute("cx", (110 + Math.cos(rad) * r).toFixed(1));
      dot.setAttribute("cy", (110 + Math.sin(rad) * r).toFixed(1));
      dot.setAttribute("r", "3.5");
      dot.setAttribute("class", "petal-dot");
      dot.setAttribute("data-idx", String(i));
      group.appendChild(dot);
    }
  }

  function updateBreathUI() {
    var dotsContainer = $("breath-cycles-dots");
    if (dotsContainer) {
      dotsContainer.innerHTML = "";
      for (var i = 0; i < TOTAL_BREATHS; i++) {
        var span = document.createElement("span");
        span.className = "cycle-lotus" + (i < breathState.cyclesDone ? " lit" : "");
        span.textContent = "🪷";
        dotsContainer.appendChild(span);
      }
    }

    var circle = $("breath-progress-circle");
    var circumference = 2 * Math.PI * 76;
    var progress = 0;
    var mainLabel = "長按起息";
    var subLabel = "完成 3 輪專注呼吸 (" + breathState.cyclesDone + " / " + TOTAL_BREATHS + ")";
    var ringColor = activeVow && activeVow.color ? activeVow.color : "#62d2c4";

    if (breathState.phase === "inhaling") {
      progress = (breathState.phaseElapsed / INHALE_SEC) * 0.42;
      mainLabel = "吸氣觀想";
      subLabel = "持續按住不放 (" + Math.ceil(INHALE_SEC - breathState.phaseElapsed) + "s)";
      ringColor = "#62d2c4";
    } else if (breathState.phase === "resting") {
      progress = 0.42 + (breathState.phaseElapsed / HOLD_SEC) * 0.18;
      mainLabel = "定心持願";
      subLabel = "即將圓滿吸氣 (" + Math.ceil(HOLD_SEC - breathState.phaseElapsed) + "s)";
      ringColor = "#f0c869";
    } else if (breathState.phase === "wait_release") {
      progress = 0.60;
      mainLabel = "請放開呼氣";
      subLabel = "放開按鍵即可隨光呼氣迴向";
      ringColor = "#fde68a";
    } else if (breathState.phase === "exhaling") {
      progress = 0.60 + (breathState.phaseElapsed / EXHALE_SEC) * 0.40;
      mainLabel = "呼氣迴向";
      subLabel = "正將願力化光迴向十方…";
      ringColor = "#fde68a";
    } else if (breathState.phase === "done") {
      progress = 1;
      mainLabel = "願力圓滿";
      subLabel = "三輪淨念完成，正在點亮願海法卡…";
      ringColor = "#f0c869";
    }

    if (circle) {
      circle.style.strokeDasharray = circumference.toFixed(1);
      circle.style.strokeDashoffset = (circumference * (1 - progress)).toFixed(1);
      circle.style.stroke = ringColor;
    }

    $("breath-center-text").textContent = mainLabel;
    $("breath-phase-sub").textContent = subLabel;

    var litCount = breathState.cyclesDone * 8;
    if (breathState.phase === "exhaling") {
      litCount += Math.floor((breathState.phaseElapsed / EXHALE_SEC) * 8);
    }
    var dots = document.querySelectorAll("#breath-petals-group .petal-dot");
    dots.forEach(function (d, idx) {
      d.classList.toggle("lit", idx < litCount);
    });
  }

  function startBreathHold() {
    if (breathState.phase === "done" || breathState.phase === "exhaling" || breathState.phase === "wait_release") return;
    if (!breathState.isHolding) {
      breathState.isHolding = true;
      if (breathState.phase === "idle") {
        breathState.phase = "inhaling";
        breathState.phaseElapsed = 0;
        $("breath-status-msg").textContent = "開始吸氣觀想，請持續按住不放…";
        if (window.VowsGame.Audio) window.VowsGame.Audio.playInhaleTone();
        updateBreathUI();
      }
    }
  }

  function endBreathHold() {
    if (!breathState.isHolding) return;
    breathState.isHolding = false;

    if (breathState.phase === "wait_release") {
      // 放手觸發呼氣與放手音效
      breathState.phase = "exhaling";
      breathState.phaseElapsed = 0;
      $("breath-status-msg").textContent = "已放開，隨光明緩緩呼氣迴向法界…";
      if (window.VowsGame.Audio) window.VowsGame.Audio.playExhaleTone();
      updateBreathUI();
      return;
    }

    if (breathState.phase === "inhaling" || breathState.phase === "resting") {
      breathState.phase = "idle";
      breathState.phaseElapsed = 0;
      $("breath-status-msg").textContent = "氣息尚未聚足，請重新長按起息（不扣進度）。";
      if (window.VowsGame.Audio) window.VowsGame.Audio.playChime(329.63);
      updateBreathUI();
    }
  }

  function stopBreathLoop() {
    if (breathState.rafId) {
      cancelAnimationFrame(breathState.rafId);
      breathState.rafId = null;
    }
  }

  function breathTick(ts) {
    if ($("enc-stage-still").classList.contains("hidden")) return;
    if (!breathState.lastTs) breathState.lastTs = ts;
    var dt = Math.min(0.05, (ts - breathState.lastTs) / 1000);
    breathState.lastTs = ts;

    if (breathState.phase === "inhaling" && breathState.isHolding) {
      breathState.phaseElapsed += dt;
      if (breathState.phaseElapsed >= INHALE_SEC) {
        breathState.phase = "resting";
        breathState.phaseElapsed = 0;
        $("breath-status-msg").textContent = "心住淨念中，再輕輕停留片刻…";
        if (window.VowsGame.Audio) window.VowsGame.Audio.playChime(523.25);
      }
    } else if (breathState.phase === "resting" && breathState.isHolding) {
      breathState.phaseElapsed += dt;
      if (breathState.phaseElapsed >= HOLD_SEC) {
        breathState.phase = "wait_release";
        breathState.phaseElapsed = 0;
        $("breath-status-msg").textContent = "吸氣已滿，請放開按鍵（或空白鍵）呼氣迴向！";
        if (window.VowsGame.Audio) window.VowsGame.Audio.playChime(659.25);
      }
    } else if (breathState.phase === "exhaling") {
      breathState.phaseElapsed += dt;
      if (breathState.phaseElapsed >= EXHALE_SEC) {
        breathState.cyclesDone++;
        // 完整完成一個光圈的音效
        if (window.VowsGame.Audio) window.VowsGame.Audio.playCycleComplete(breathState.cyclesDone);

        if (breathState.cyclesDone >= TOTAL_BREATHS) {
          breathState.phase = "done";
          $("breath-status-msg").textContent = "三輪呼吸光圈圓滿！正在點亮本願蓮燈…";
          updateBreathUI();
          stopBreathLoop();
          setTimeout(enterRealizeStage, 750);
          return;
        } else {
          breathState.phase = "idle";
          breathState.phaseElapsed = 0;
          $("breath-status-msg").textContent = "第 " + breathState.cyclesDone + " 個光圈圓滿！請再次長按起息。";
        }
      }
    }

    updateBreathUI();
    breathState.rafId = requestAnimationFrame(breathTick);
  }

  function startBreathLoop() {
    stopBreathLoop();
    breathState.lastTs = 0;
    $("breath-status-msg").textContent = "長按下方按鈕（或空白鍵）開始吸氣，聽見提示後放開完成呼氣。";
    breathState.rafId = requestAnimationFrame(breathTick);
  }

  // --- 階段三：莊嚴（頒發願海法卡） ---
  function enterRealizeStage() {
    if (!activeVow) return;
    setEncounterStage("realize");

    if (state.completedIds.indexOf(activeVow.id) === -1) {
      state.completedIds.push(activeVow.id);
      var now = new Date();
      state.completedDates[activeVow.id] = now.getFullYear() + "/" + (now.getMonth() + 1) + "/" + now.getDate();
      saveState();
    }

    if (window.VowsGame.Audio) window.VowsGame.Audio.playLotusBloom();

    $("realize-card-tag").textContent = activeVow.cardTag + " · " + activeVow.section + " · " + activeVow.lampStyleName;
    $("realize-vow-title").textContent = activeVow.vowLabel + "｜" + activeVow.title;
    $("realize-sutra").textContent = "「" + activeVow.sutraText + "」";
    $("realize-vernacular").textContent = activeVow.vernacular;
    $("realize-reflection").textContent = activeVow.reflection;
    $("realize-pureland-reward").textContent = "✨ 極樂莊嚴變化：" + activeVow.purelandReward;

    var next = getNextTargetVow();
    var btnNext = $("btn-realize-next");
    if (next) {
      btnNext.textContent = "繼續前往 " + next.vowLabel + " ›";
    } else {
      btnNext.textContent = "四十八願圓滿 · 查看星圖";
    }
    btnNext.classList.remove("hidden");
  }

  /* ==================== 四十八願星圖（可點擊前往任意願燈） ==================== */

  function openStarMap() {
    if (window.VowsGame.Audio) window.VowsGame.Audio.playChime(587.33);
    var container = $("starmap-sections-container");
    container.innerHTML = "";

    var data = window.VowsGame.Data;
    var next = getNextTargetVow();
    $("starmap-summary").textContent = "修行進度：" + state.completedIds.length + " / 48 願已點亮（點擊任一願星即可移動前往該蓮燈附近）";

    data.SECTIONS.forEach(function (sec) {
      var secEl = document.createElement("div");
      secEl.className = "starmap-section";

      var vowsInSec = data.ALL_48_VOWS.filter(function (v) { return v.sectionId === sec.id; });
      var doneInSec = vowsInSec.filter(function (v) { return state.completedIds.indexOf(v.id) !== -1; }).length;

      var header = document.createElement("div");
      header.className = "starmap-section-header";
      header.innerHTML = "<h4>" + sec.name + "</h4><span>" + sec.subtitle + "（" + doneInSec + "/" + vowsInSec.length + "）</span>";
      secEl.appendChild(header);

      var grid = document.createElement("div");
      grid.className = "starmap-nodes";

      vowsInSec.forEach(function (v) {
        var node = document.createElement("button");
        node.type = "button";
        var isDone = state.completedIds.indexOf(v.id) !== -1;
        var isNext = next && next.id === v.id;

        var cls = "star-node";
        if (isDone) cls += " done";
        else if (isNext) cls += " next";
        else cls += " open-node";

        node.className = cls;
        node.style.borderColor = isDone ? v.color : "";
        node.innerHTML =
          "<div class='star-top-row'><span class='star-num'>" + v.id + "</span><i class='star-color-dot' style='background:" + v.color + "'></i></div>" +
          "<div class='star-name'>" + v.title + "</div>" +
          "<div class='star-tag'>" + v.lampStyleName + " · " + (isDone ? "已點亮" : (isNext ? "建議下一願" : "可前往")) + "</div>";

        node.addEventListener("click", function () {
          hideModal("modal-starmap");
          if ($("screen-map").classList.contains("hidden")) {
            enterMapScreen();
          }
          window.VowsGame.Map.teleportNear(v);
          saveState();
          updateMapHUD();
        });

        grid.appendChild(node);
      });

      secEl.appendChild(grid);
      container.appendChild(secEl);
    });

    showModal("modal-starmap");
  }

  /* ==================== 願海法卡圖鑑（含 6 分區篩選） ==================== */

  function renderCardsFilterTabs() {
    var tabsEl = $("cards-filter-tabs");
    if (!tabsEl) return;
    tabsEl.innerHTML = "";
    var data = window.VowsGame.Data;

    var filters = [{ id: "all", name: "全部 (48)" }].concat(
      data.SECTIONS.map(function (s) { return { id: s.id, name: s.name }; })
    );

    filters.forEach(function (f) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-tab" + (activeCardFilter === f.id ? " active" : "");
      btn.textContent = f.name;
      btn.addEventListener("click", function () {
        activeCardFilter = f.id;
        renderCardsFilterTabs();
        renderCardsGrid();
      });
      tabsEl.appendChild(btn);
    });
  }

  function renderCardsGrid() {
    var grid = $("cards-grid-container");
    grid.innerHTML = "";
    var vows = window.VowsGame.Data.ALL_48_VOWS.filter(function (v) {
      return activeCardFilter === "all" || v.sectionId === activeCardFilter;
    });

    vows.forEach(function (v) {
      var isDone = state.completedIds.indexOf(v.id) !== -1;
      var card = document.createElement("button");
      card.type = "button";
      card.className = "dharma-card-item" + (isDone ? " unlocked" : " locked");
      if (isDone) {
        card.style.borderColor = v.color;
      }

      if (isDone) {
        card.innerHTML =
          "<div class='card-mini-tag'><i class='star-color-dot' style='background:" + v.color + "'></i> " + v.cardTag + " · " + v.lampStyleName + "</div>" +
          "<div class='card-mini-num'>" + v.vowLabel + "</div>" +
          "<div class='card-mini-title'>" + v.title + "</div>" +
          "<div class='card-mini-foot'>點擊閱讀經文與法義</div>";
        card.addEventListener("click", function () {
          showCardDetail(v);
        });
      } else {
        card.innerHTML =
          "<div class='card-mini-tag'><i class='star-color-dot' style='background:" + v.color + "'></i> " + v.lampStyleName + "</div>" +
          "<div class='card-mini-num'>" + v.vowLabel + "</div>" +
          "<div class='card-mini-title'>" + v.title + "</div>" +
          "<div class='card-mini-foot'>點亮此願燈即可收錄法卡</div>";
      }
      grid.appendChild(card);
    });
  }

  function openCardsModal() {
    if (window.VowsGame.Audio) window.VowsGame.Audio.playChime(587.33);
    $("card-detail-panel").classList.add("hidden");
    $("cards-summary").textContent = "已收集願海法卡：" + state.completedIds.length + " / 48 張";
    renderCardsFilterTabs();
    renderCardsGrid();
    showModal("modal-cards");
  }

  function showCardDetail(vow) {
    if (window.VowsGame.Audio) window.VowsGame.Audio.playBowl(493.88, 1.8);
    $("detail-tag").textContent = vow.cardTag + " · " + vow.lampStyleName;
    $("detail-title").textContent = vow.vowLabel + " · " + vow.title;
    $("detail-section").textContent = vow.lotusName + "（" + vow.section + "）";
    $("detail-sutra").textContent = "「" + vow.sutraText + "」";
    $("detail-vernacular").textContent = vow.vernacular;
    $("detail-reflection").textContent = vow.reflection;
    $("detail-date").textContent = "圓滿日期：" + (state.completedDates[vow.id] || "今日");
    $("card-detail-panel").classList.remove("hidden");
    $("card-detail-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* ==================== 設定視窗 ==================== */

  function openSettingsModal() {
    $("toggle-sound").checked = state.soundEnabled;
    var pct = Math.round(state.volume * 100);
    $("slider-volume").value = String(pct);
    $("volume-value-label").textContent = pct + "%";
    showModal("modal-settings");
  }

  /* ==================== 初始化綁定 ==================== */

  function init() {
    if (window.VowsGame.Audio) {
      window.VowsGame.Audio.init(state.soundEnabled, state.volume);
    }

    window.VowsGame.Map.init($("map-canvas"), {
      getState: function () { return state; },
      onNearVowChange: function (vow) { updateInteractButton(vow); },
      onInteractVow: function (vow) { openEncounter(vow); }
    });

    if (state.playerPos) {
      window.VowsGame.Map.setPlayerPosition(state.playerPos.x, state.playerPos.y);
    }

    updateTitleUI();

    // 首頁按鈕
    $("btn-start").addEventListener("click", enterMapScreen);
    $("btn-open-starmap-title").addEventListener("click", openStarMap);
    $("btn-open-cards-title").addEventListener("click", openCardsModal);
    $("btn-open-settings-title").addEventListener("click", openSettingsModal);

    // 地圖 HUD 按鈕
    $("btn-back-title").addEventListener("click", backToTitleScreen);
    $("btn-open-starmap-map").addEventListener("click", openStarMap);
    $("btn-open-cards-map").addEventListener("click", openCardsModal);
    $("btn-open-settings-map").addEventListener("click", openSettingsModal);
    $("btn-interact-vow").addEventListener("click", function () {
      if (activeNearVow) openEncounter(activeNearVow);
    });

    // 闖關視窗
    $("btn-close-encounter").addEventListener("click", closeEncounter);
    $("ask-dialogue-box").addEventListener("click", handleDialogueClick);
    $("btn-to-still").addEventListener("click", function () {
      if (activeVow) initStillStage(activeVow);
    });

    // 發願長按控制（滑鼠 / 觸控 / 空白鍵）
    var holdBtn = $("breath-hold-btn");
    var ringSvg = $("breath-ring-svg");
    [holdBtn, ringSvg].forEach(function (el) {
      if (!el) return;
      el.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        startBreathHold();
      });
    });
    window.addEventListener("pointerup", endBreathHold);
    window.addEventListener("pointercancel", endBreathHold);

    window.addEventListener("keydown", function (e) {
      if (e.code === "Space" && !$("modal-encounter").classList.contains("hidden") && !$("enc-stage-still").classList.contains("hidden")) {
        e.preventDefault();
        if (!e.repeat) startBreathHold();
      }
    });
    window.addEventListener("keyup", function (e) {
      if (e.code === "Space" && !$("modal-encounter").classList.contains("hidden") && !$("enc-stage-still").classList.contains("hidden")) {
        e.preventDefault();
        endBreathHold();
      }
    });

    // 莊嚴階段按鈕
    $("btn-realize-map").addEventListener("click", closeEncounter);
    $("btn-realize-next").addEventListener("click", function () {
      var next = getNextTargetVow();
      closeEncounter();
      if (next) {
        window.VowsGame.Map.setCompassTarget(next.id);
      } else {
        openStarMap();
      }
    });

    // 星圖 / 法卡關閉
    $("btn-close-starmap").addEventListener("click", function () { hideModal("modal-starmap"); });
    $("btn-close-cards").addEventListener("click", function () { hideModal("modal-cards"); });
    $("btn-close-card-detail").addEventListener("click", function () { $("card-detail-panel").classList.add("hidden"); });

    // 設定控制
    $("btn-close-settings").addEventListener("click", function () { hideModal("modal-settings"); });
    $("toggle-sound").addEventListener("change", function (e) {
      state.soundEnabled = e.target.checked;
      window.VowsGame.Audio.setEnabled(state.soundEnabled);
      saveState();
    });
    $("slider-volume").addEventListener("input", function (e) {
      var pct = Number(e.target.value);
      state.volume = pct / 100;
      $("volume-value-label").textContent = pct + "%";
      window.VowsGame.Audio.setVolume(state.volume);
      saveState();
    });
    $("btn-test-bowl").addEventListener("click", function () {
      window.VowsGame.Audio.unlock();
      window.VowsGame.Audio.playBowl(432, 3.4);
    });
    $("btn-reset-progress").addEventListener("click", function () {
      if (window.confirm("確定要清除目前的四十八願修行進度，從第一願重新開始嗎？")) {
        state.completedIds = [];
        state.completedDates = {};
        state.playerPos = getDefaultStartPos();
        window.VowsGame.Map.resetPosition();
        saveState();
        updateTitleUI();
        updateMapHUD();
        hideModal("modal-settings");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
