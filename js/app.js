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
    if (window.VowsGame.Audio) {
      if (window.VowsGame.Audio.setSectionTheme) {
        window.VowsGame.Audio.setSectionTheme(vow.sectionId);
      }
      window.VowsGame.Audio.playChime(523.25);
    }

    var card = document.querySelector("#modal-encounter .encounter-card");
    if (card) {
      card.style.setProperty("--vow-accent", vow.color || "#f0c869");
    }

    $("enc-vow-badge").textContent = vow.vowLabel + " · " + vow.title;
    $("enc-lotus-name").textContent = vow.lotusName + "（" + vow.section + " · " + vow.lampStyleName + " · " + vow.ritualName + "）";

    setEncounterStage("ask");
    initAskStage(vow);
    showModal("modal-encounter");
  }

  function closeEncounter() {
    stopTyping();
    if (window.VowsGame.Rituals && window.VowsGame.Rituals.destroy) {
      window.VowsGame.Rituals.destroy();
    }
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

  // --- 階段一：思惟（支援 4 種體驗模式：quiz / reflect / sutra-fill / contemplate） ---
  function initAskStage(vow) {
    lineIndex = 0;
    questionAnswered = false;
    $("ask-mode-badge").textContent = vow.askModeLabel || "法義思辨";
    $("ask-question-area").classList.add("hidden");
    $("ask-contemplate-area").classList.add("hidden");
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

  function getAskDoneHint(vow) {
    if (vow.askMode === "contemplate") return "點擊靜觀本願經文 ›";
    if (vow.askMode === "sutra-fill") return "點擊進入經文印證 ›";
    if (vow.askMode === "reflect") return "點擊進入修心體會 ›";
    return "點擊進入法義思惟 ›";
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
        hintEl.textContent = lineIndex < activeVow.introLines.length - 1 ? "點擊繼續下一段 ›" : getAskDoneHint(activeVow);
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
      $("ask-dialogue-hint").textContent = lineIndex < activeVow.introLines.length - 1 ? "點擊繼續下一段 ›" : getAskDoneHint(activeVow);
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
    var mode = activeVow.askMode || "quiz";

    if (mode === "contemplate") {
      var contArea = $("ask-contemplate-area");
      contArea.classList.remove("hidden");
      $("contemplate-sutra").textContent = "「" + activeVow.sutraText + "」";
      $("contemplate-note").textContent = "靜心體會這句誓願的力量，隨後將以「" + activeVow.ritualName + "」發起清淨願心。";
      if (window.VowsGame.Audio) window.VowsGame.Audio.playBowl(493.88, 2.0);
      return;
    }

    var qArea = $("ask-question-area");
    qArea.classList.remove("hidden");
    var promptEl = $("ask-question-prompt");
    var list = $("ask-choices-list");
    list.innerHTML = "";

    if (mode === "sutra-fill" && activeVow.sutraFill) {
      var sf = activeVow.sutraFill;
      promptEl.innerHTML = "經文印證：請選出空缺處的本願經句——<br><span class='sutra-fill-quote'>「" + sf.maskedText.replace("＿＿＿＿", "<span id='sutra-fill-blank' class='sutra-fill-blank'>＿＿＿＿</span>") + "」</span>";

      sf.choices.forEach(function (choice) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "choice-btn";
        btn.textContent = choice.text;
        btn.addEventListener("click", function () {
          if (questionAnswered) return;
          var fb = $("ask-feedback-box");
          fb.classList.remove("hidden", "correct", "gentle");
          var allBtns = list.querySelectorAll(".choice-btn");
          allBtns.forEach(function (b) { b.classList.remove("selected-wrong", "selected-right"); });

          if (choice.isCorrect) {
            questionAnswered = true;
            btn.classList.add("selected-right");
            var blank = $("sutra-fill-blank");
            if (blank) {
              blank.textContent = choice.text;
              blank.classList.add("filled");
            }
            fb.textContent = "法句契合！「" + activeVow.vernacular + "」";
            fb.classList.add("correct");
            $("btn-to-still").classList.remove("hidden");
            if (window.VowsGame.Audio) window.VowsGame.Audio.playBowl(523.25, 2.2);
          } else {
            btn.classList.add("selected-wrong");
            fb.textContent = "這句出自他願經文，再對照「" + activeVow.title + "」的願義試試看。";
            fb.classList.add("gentle");
            if (window.VowsGame.Audio) window.VowsGame.Audio.playChime(329.63);
          }
        });
        list.appendChild(btn);
      });
      return;
    }

    if (mode === "reflect") {
      promptEl.textContent = activeVow.question.prompt.replace(/^思惟：/, "修心體會：");
      activeVow.question.choices.forEach(function (choice) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "choice-btn";
        btn.textContent = choice.text;
        btn.addEventListener("click", function () {
          if (questionAnswered) return;
          questionAnswered = true;
          var allBtns = list.querySelectorAll(".choice-btn");
          allBtns.forEach(function (b) { b.classList.remove("selected-wrong", "selected-right"); });
          btn.classList.add("selected-right");

          var fb = $("ask-feedback-box");
          fb.classList.remove("hidden", "correct", "gentle");
          fb.textContent = choice.feedback + " 帶著這份覺照，繼續前行發願。";
          fb.classList.add("correct");
          $("btn-to-still").classList.remove("hidden");
          if (window.VowsGame.Audio) window.VowsGame.Audio.playBowl(493.88, 2.0);
        });
        list.appendChild(btn);
      });
      return;
    }

    // 預設 quiz 模式
    promptEl.textContent = activeVow.question.prompt;
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

  // --- 階段二：發願（八種依願義設計的禪意互動） ---
  function initStillStage(vow) {
    setEncounterStage("still");
    $("still-ritual-badge").textContent = vow.ritualName || "息念光環";
    $("still-title").textContent = vow.vowPrompt.title;
    $("still-guide").textContent = vow.vowPrompt.guide;
    $("still-mantra").textContent = vow.vowPrompt.mantra;

    if (window.VowsGame.Rituals && window.VowsGame.Rituals.mount) {
      window.VowsGame.Rituals.mount($("still-ritual-stage"), vow, enterRealizeStage);
    }
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
          "<div class='star-tag'>" + v.ritualName + " · " + (isDone ? "已點亮" : (isNext ? "建議下一願" : "可前往")) + "</div>";

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
    $("btn-contemplate-next").addEventListener("click", function () {
      if (activeVow) initStillStage(activeVow);
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
