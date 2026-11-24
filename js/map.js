/**
 * 極樂願海 2D Canvas 探索地圖引擎（完整 48 願版）
 * 1. 支援點擊／輕觸畫布直接走到目標點（含落點水波提示）
 * 2. 支援鍵盤 (WASD / 方向鍵 / Shift 加速 / Space 互動)
 * 3. 支援 8 種幾何願燈樣式 × 48 種專屬色彩
 */
(function () {
  window.VowsGame = window.VowsGame || {};

  var INTERACT_RADIUS = 72;

  var canvas = null;
  var ctx = null;
  var width = 0;
  var height = 0;
  var dpr = 1;
  var rafId = null;
  var running = false;

  var player = { x: 220, y: 2110, vx: 0, vy: 0, speed: 240, trail: [] };
  var camera = { x: 0, y: 0 };
  var keys = {};
  var pointerDown = false;
  var moveTarget = null; // { x, y } 點擊後自動前往的世界座標
  var clickRipples = []; // 落點波紋特效
  var customTargetId = null;

  var stars = [];
  var goldPetals = [];
  var trees = [];
  var time = 0;
  var lastTs = 0;

  var getStateFn = null;
  var onNearVowChangeFn = null;
  var onInteractVowFn = null;
  var currentNearVow = null;

  function getWorldSize() {
    var data = window.VowsGame.Data;
    return {
      w: data ? data.WORLD_W : 3600,
      h: data ? data.WORLD_H : 2400
    };
  }

  function hexToRgba(hex, alpha) {
    var clean = (hex || "#f0c869").replace("#", "");
    if (clean.length === 3) {
      clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    }
    var r = parseInt(clean.slice(0, 2), 16) || 240;
    var g = parseInt(clean.slice(2, 4), 16) || 200;
    var b = parseInt(clean.slice(4, 6), 16) || 105;
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function initDecorations() {
    var world = getWorldSize();
    stars = [];
    for (var i = 0; i < 320; i++) {
      stars.push({
        x: Math.random() * world.w,
        y: Math.random() * world.h,
        r: 0.7 + Math.random() * 2.0,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.4
      });
    }

    goldPetals = [];
    for (var j = 0; j < 85; j++) {
      goldPetals.push({
        x: Math.random() * world.w,
        y: Math.random() * world.h,
        vx: -14 + Math.random() * 28,
        vy: 14 + Math.random() * 22,
        size: 2.5 + Math.random() * 3.5,
        rot: Math.random() * Math.PI * 2
      });
    }

    trees = [];
    for (var t = 0; t < 18; t++) {
      trees.push({
        x: 240 + ((t * 530) % (world.w - 480)),
        y: 260 + Math.floor(t / 6) * 680 + (t % 2) * 140,
        s: 0.85 + (t % 3) * 0.14
      });
    }
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function getDirectionText(dx, dy) {
    var angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle >= -22.5 && angle < 22.5) return "東方";
    if (angle >= 22.5 && angle < 67.5) return "東南方";
    if (angle >= 67.5 && angle < 112.5) return "南方";
    if (angle >= 112.5 && angle < 157.5) return "西南方";
    if (angle >= 157.5 || angle < -157.5) return "西方";
    if (angle >= -157.5 && angle < -112.5) return "西北方";
    if (angle >= -112.5 && angle < -67.5) return "北方";
    return "東北方";
  }

  function update(dt) {
    time += dt;
    var world = getWorldSize();
    var state = getStateFn ? getStateFn() : { completedIds: [] };
    var vows = window.VowsGame.Data.ALL_48_VOWS;

    // 1. 鍵盤輸入優先；一旦按鍵即取消點擊尋路
    var mx = 0;
    var my = 0;
    if (keys["ArrowLeft"] || keys["KeyA"]) mx -= 1;
    if (keys["ArrowRight"] || keys["KeyD"]) mx += 1;
    if (keys["ArrowUp"] || keys["KeyW"]) my -= 1;
    if (keys["ArrowDown"] || keys["KeyS"]) my += 1;

    if (mx !== 0 || my !== 0) {
      moveTarget = null;
    }

    var len = Math.hypot(mx, my);
    var mult = (keys["ShiftLeft"] || keys["ShiftRight"]) ? 1.55 : 1.0;

    if (len > 0) {
      mx /= len;
      my /= len;
      player.vx = mx * player.speed * mult;
      player.vy = my * player.speed * mult;
      player.x = Math.max(60, Math.min(world.w - 60, player.x + player.vx * dt));
      player.y = Math.max(60, Math.min(world.h - 60, player.y + player.vy * dt));
    } else if (moveTarget) {
      // 2. 點擊直接走到所點擊的地方
      var tdx = moveTarget.x - player.x;
      var tdy = moveTarget.y - player.y;
      var tdist = Math.hypot(tdx, tdy);
      if (tdist <= 8) {
        player.x = moveTarget.x;
        player.y = moveTarget.y;
        player.vx = 0;
        player.vy = 0;
        moveTarget = null;
      } else {
        var step = Math.min(tdist, player.speed * 1.1 * dt);
        player.vx = (tdx / tdist) * player.speed * 1.1;
        player.vy = (tdy / tdist) * player.speed * 1.1;
        player.x = Math.max(60, Math.min(world.w - 60, player.x + (tdx / tdist) * step));
        player.y = Math.max(60, Math.min(world.h - 60, player.y + (tdy / tdist) * step));
      }
    } else {
      player.vx = 0;
      player.vy = 0;
    }

    if (Math.hypot(player.vx, player.vy) > 10 && Math.random() < 0.45) {
      player.trail.push({ x: player.x, y: player.y + 8, life: 1.0 });
    }

    for (var t = player.trail.length - 1; t >= 0; t--) {
      player.trail[t].life -= dt * 1.5;
      if (player.trail[t].life <= 0) player.trail.splice(t, 1);
    }

    for (var r = clickRipples.length - 1; r >= 0; r--) {
      clickRipples[r].life -= dt * 1.4;
      if (clickRipples[r].life <= 0) clickRipples.splice(r, 1);
    }

    // 七寶金瓣飄落
    for (var p = 0; p < goldPetals.length; p++) {
      var gp = goldPetals[p];
      gp.x += (gp.vx + Math.sin(time + p) * 10) * dt;
      gp.y += gp.vy * dt;
      gp.rot += dt * 0.9;
      if (gp.y > world.h + 20) {
        gp.y = -20;
        gp.x = Math.random() * world.w;
      }
    }

    // 相機平滑跟隨
    var targetCamX = Math.max(0, Math.min(Math.max(0, world.w - width), player.x - width / 2));
    var targetCamY = Math.max(0, Math.min(Math.max(0, world.h - height), player.y - height / 2));
    if (width >= world.w) targetCamX = -(width - world.w) / 2;
    if (height >= world.h) targetCamY = -(height - world.h) / 2;

    camera.x += (targetCamX - camera.x) * Math.min(1, dt * 7);
    camera.y += (targetCamY - camera.y) * Math.min(1, dt * 7);

    // 偵測附近願燈
    var nearest = null;
    var nearestDist = Infinity;
    for (var i = 0; i < vows.length; i++) {
      var v = vows[i];
      var d = Math.hypot(v.mapPos.x - player.x, v.mapPos.y - player.y);
      if (d < INTERACT_RADIUS && d < nearestDist) {
        nearest = v;
        nearestDist = d;
      }
    }

    var prevId = currentNearVow ? currentNearVow.id : null;
    var nextId = nearest ? nearest.id : null;
    if (prevId !== nextId) {
      currentNearVow = nearest;
      if (onNearVowChangeFn) onNearVowChangeFn(nearest, state);
    }

    updateCompassUI(state);
  }

  function resolveCompassTarget(state) {
    var vows = window.VowsGame.Data.ALL_48_VOWS;
    if (customTargetId) {
      for (var c = 0; c < vows.length; c++) {
        if (vows[c].id === customTargetId) return vows[c];
      }
    }
    for (var i = 0; i < vows.length; i++) {
      if (state.completedIds.indexOf(vows[i].id) === -1) return vows[i];
    }
    return null;
  }

  function updateCompassUI(state) {
    var compassEl = document.getElementById("hud-compass");
    if (!compassEl) return;
    var nextTarget = resolveCompassTarget(state);

    if (!nextTarget) {
      compassEl.textContent = "四十八願圓滿 · 歡迎自由巡禮重溫";
      return;
    }

    var dx = nextTarget.mapPos.x - player.x;
    var dy = nextTarget.mapPos.y - player.y;
    var dist = Math.hypot(dx, dy);
    if (dist < INTERACT_RADIUS) {
      compassEl.textContent = "已抵達「" + nextTarget.lotusName + "」· 可開始參悟";
    } else {
      var steps = Math.max(1, Math.round(dist / 22));
      compassEl.textContent = "願光指引 " + getDirectionText(dx, dy) + "（" + nextTarget.vowLabel + "）· 約 " + steps + " 步";
    }
  }

  /* ==================== 8 種願燈幾何繪製 ==================== */
  function drawLampGeometry(style, r, color, isDone, isNext) {
    var strokeColor = isDone ? color : (isNext ? color : hexToRgba(color, 0.55));
    var fillAlpha = isDone ? 0.36 : (isNext ? 0.22 : 0.1);
    var fillColor = hexToRgba(color, fillAlpha);

    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = fillColor;
    ctx.lineWidth = isDone ? 2 : (isNext ? 1.8 : 1.3);

    if (style === "lotus-8" || style === "lotus-12") {
      var count = style === "lotus-12" ? 12 : 8;
      var spin = time * (isDone ? 0.14 : 0.04);
      for (var i = 0; i < count; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 / count) * i + spin);
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.quadraticCurveTo(r * 0.32, -r * 0.55, 0, -r * 0.92);
        ctx.quadraticCurveTo(-r * 0.32, -r * 0.55, 0, -4);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      if (style === "lotus-12") {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (style === "palace-lantern") {
      // 六角琉璃宮燈
      ctx.beginPath();
      for (var h = 0; h < 6; h++) {
        var ang = (Math.PI / 3) * h - Math.PI / 2;
        var px = Math.cos(ang) * r * 0.78;
        var py = Math.sin(ang) * r * 0.92;
        if (h === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 燈頂蓋與流蘇
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, -r * 0.95);
      ctx.lineTo(r * 0.45, -r * 0.95);
      ctx.moveTo(0, r * 0.92);
      ctx.lineTo(0, r * 1.18);
      ctx.stroke();
    } else if (style === "star-mandala") {
      // 八芒星輪燈
      var spikes = 8;
      ctx.beginPath();
      for (var s = 0; s < spikes * 2; s++) {
        var rad = (s % 2 === 0 ? r * 0.95 : r * 0.42);
        var a = (Math.PI / spikes) * s + time * 0.08;
        var sx = Math.cos(a) * rad;
        var sy = Math.sin(a) * rad;
        if (s === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (style === "water-drop") {
      // 甘露寶瓶燈
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.96);
      ctx.bezierCurveTo(r * 0.72, -r * 0.15, r * 0.78, r * 0.82, 0, r * 0.88);
      ctx.bezierCurveTo(-r * 0.78, r * 0.82, -r * 0.72, -r * 0.15, 0, -r * 0.96);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, r * 0.18, r * 0.28, 0, Math.PI * 2);
      ctx.stroke();
    } else if (style === "dharma-wheel") {
      // 八輻法輪燈
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2);
      ctx.stroke();
      for (var sp = 0; sp < 8; sp++) {
        var wa = (Math.PI / 4) * sp + time * 0.12;
        ctx.beginPath();
        ctx.moveTo(Math.cos(wa) * r * 0.2, Math.sin(wa) * r * 0.2);
        ctx.lineTo(Math.cos(wa) * r * 0.96, Math.sin(wa) * r * 0.96);
        ctx.stroke();
      }
    } else if (style === "cloud-orb") {
      // 祥雲摩尼寶珠燈
      ctx.beginPath();
      ctx.arc(0, -r * 0.08, r * 0.54, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // 底座三弧祥雲
      for (var c = -1; c <= 1; c++) {
        ctx.beginPath();
        ctx.arc(c * r * 0.4, r * 0.52, r * 0.26, Math.PI, 0, false);
        ctx.stroke();
      }
    } else {
      // 七寶浮屠塔燈 pagoda-lamp
      for (var tier = 0; tier < 3; tier++) {
        var w = r * (0.88 - tier * 0.22);
        var y = r * (0.48 - tier * 0.42);
        ctx.beginPath();
        ctx.moveTo(-w, y);
        ctx.lineTo(0, y - r * 0.34);
        ctx.lineTo(w, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.72);
      ctx.lineTo(0, -r * 1.05);
      ctx.stroke();
    }
  }

  function drawVowLamp(vow, isDone, isNext, isNear) {
    var cx = vow.mapPos.x;
    var cy = vow.mapPos.y;
    var radius = isNear ? 34 : 28;
    var color = vow.color || "#f0c869";

    ctx.save();
    ctx.translate(cx, cy);

    // 外圍聖光暈（每一願使用各自專屬色彩）
    var pulse = 1 + Math.sin(time * 2.4 + vow.id * 0.4) * 0.08;
    var glowR = radius * (isDone ? 2.2 : (isNext ? 2.1 * pulse : 1.55));
    var grad = ctx.createRadialGradient(0, 0, radius * 0.15, 0, 0, glowR);
    grad.addColorStop(0, hexToRgba(color, isDone ? 0.62 : (isNext ? 0.5 : 0.22)));
    grad.addColorStop(1, "rgba(7, 11, 24, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();

    // 若為目前指南目標或已靠近，加一圈外環提示
    if (isNext || isNear) {
      ctx.strokeStyle = hexToRgba(color, isNear ? 0.9 : 0.55);
      ctx.lineWidth = isNear ? 2.2 : 1.4;
      ctx.setLineDash(isNear ? [] : [4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, radius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 繪製 8 種不同樣式願燈
    drawLampGeometry(vow.lampStyle, radius, color, isDone, isNext);

    // 中心燈芯火珠
    ctx.beginPath();
    ctx.arc(0, 0, isDone ? 6.5 : 4.8, 0, Math.PI * 2);
    ctx.fillStyle = isDone ? "#ffffff" : hexToRgba(color, isNext ? 0.95 : 0.65);
    ctx.fill();
    if (isDone) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawPureLandTrees(doneCount) {
    if (doneCount < 27) return;
    var alpha = doneCount >= 40 ? 0.82 : 0.52;
    trees.forEach(function (tr, idx) {
      ctx.save();
      ctx.translate(tr.x, tr.y);
      ctx.scale(tr.s, tr.s);
      ctx.globalAlpha = alpha;

      ctx.strokeStyle = "rgba(240, 200, 105, 0.55)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 24);
      ctx.lineTo(0, -14);
      ctx.stroke();

      for (var k = 0; k < 3; k++) {
        var r = 24 - k * 5;
        var y = -18 - k * 11;
        var g = ctx.createRadialGradient(0, y, 2, 0, y, r);
        g.addColorStop(0, idx % 2 === 0 ? "rgba(167, 243, 208, 0.5)" : "rgba(240, 200, 105, 0.48)");
        g.addColorStop(1, "rgba(15, 23, 42, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function render() {
    if (!ctx) return;
    var state = getStateFn ? getStateFn() : { completedIds: [] };
    var completed = state.completedIds || [];
    var doneCount = completed.length;
    var vows = window.VowsGame.Data.ALL_48_VOWS;
    var world = getWorldSize();

    // 隨完成進度漸亮的極樂天幕
    var bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    if (doneCount === 0) {
      bgGrad.addColorStop(0, "#050814");
      bgGrad.addColorStop(1, "#0b1224");
    } else if (doneCount < 18) {
      bgGrad.addColorStop(0, "#070d1f");
      bgGrad.addColorStop(1, "#101b38");
    } else if (doneCount < 36) {
      bgGrad.addColorStop(0, "#091129");
      bgGrad.addColorStop(1, "#162447");
    } else {
      bgGrad.addColorStop(0, "#0c1534");
      bgGrad.addColorStop(1, "#1c2a54");
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // 星空微光
    for (var s = 0; s < stars.length; s++) {
      var st = stars[s];
      if (st.x < camera.x - 20 || st.x > camera.x + width + 20 || st.y < camera.y - 20 || st.y > camera.y + height + 20) continue;
      var tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * st.speed + st.phase));
      ctx.fillStyle = "rgba(226, 232, 240, " + (tw * 0.72).toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 第 4 願後：七寶池金色水波
    if (doneCount >= 4) {
      ctx.strokeStyle = "rgba(125, 211, 252, 0.14)";
      ctx.lineWidth = 1.5;
      for (var w = 0; w < 4; w++) {
        var rr = ((time * 28 + w * 95) % 360) + 40;
        ctx.beginPath();
        ctx.ellipse(world.w * 0.5, world.h * 0.55, rr * 1.6, rr * 0.8, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 第 18 願後：中央金色接引光柱
    if (completed.indexOf(18) !== -1 || doneCount >= 18) {
      var v18 = vows[17];
      var bx = v18 ? v18.mapPos.x : world.w * 0.5;
      var by = v18 ? v18.mapPos.y : world.h * 0.5;
      var beam = ctx.createLinearGradient(bx, by - 550, bx, by + 30);
      beam.addColorStop(0, "rgba(240, 200, 105, 0)");
      beam.addColorStop(0.5, "rgba(240, 200, 105, 0.15)");
      beam.addColorStop(1, "rgba(240, 200, 105, 0.34)");
      ctx.fillStyle = beam;
      ctx.fillRect(bx - 55, by - 550, 110, 580);
    }

    // 第 48 願圓滿：穹蒼曼荼羅雙光輪
    if (completed.indexOf(48) !== -1 || doneCount >= 48) {
      ctx.save();
      ctx.translate(world.w * 0.5, world.h * 0.5);
      ctx.rotate(time * 0.04);
      ctx.strokeStyle = "rgba(240, 200, 105, 0.16)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 720, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 520, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    drawPureLandTrees(doneCount);

    // 48 願星海連線
    ctx.save();
    for (var i = 0; i < vows.length - 1; i++) {
      var a = vows[i];
      var b = vows[i + 1];
      var bothDone = completed.indexOf(a.id) !== -1 && completed.indexOf(b.id) !== -1;
      ctx.beginPath();
      ctx.moveTo(a.mapPos.x, a.mapPos.y);
      ctx.lineTo(b.mapPos.x, b.mapPos.y);
      if (bothDone) {
        ctx.strokeStyle = hexToRgba(a.color, 0.62);
        ctx.lineWidth = 2.4;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
        ctx.lineWidth = 1.4;
        ctx.setLineDash([6, 8]);
      }
      ctx.stroke();
    }
    ctx.restore();

    var targetVow = resolveCompassTarget(state);
    var targetId = targetVow ? targetVow.id : null;

    // 繪製可視範圍內的願燈
    for (var vIdx = 0; vIdx < vows.length; vIdx++) {
      var vow = vows[vIdx];
      if (
        vow.mapPos.x < camera.x - 140 ||
        vow.mapPos.x > camera.x + width + 140 ||
        vow.mapPos.y < camera.y - 140 ||
        vow.mapPos.y > camera.y + height + 140
      ) {
        continue;
      }

      var isDone = completed.indexOf(vow.id) !== -1;
      var isNext = vow.id === targetId;
      var isNear = currentNearVow && currentNearVow.id === vow.id;

      drawVowLamp(vow, isDone, isNext, isNear);

      ctx.font = "600 13px 'Noto Serif TC', serif";
      ctx.textAlign = "center";
      ctx.fillStyle = isDone ? vow.color : (isNext ? "#ffffff" : "rgba(226, 232, 240, 0.75)");
      ctx.fillText(vow.vowLabel + " · " + vow.title, vow.mapPos.x, vow.mapPos.y + 52);
    }

    // 點擊目的地指示線與水波
    if (moveTarget) {
      ctx.save();
      ctx.strokeStyle = "rgba(98, 210, 196, 0.35)";
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(moveTarget.x, moveTarget.y);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(240, 200, 105, 0.78)";
      ctx.beginPath();
      ctx.arc(moveTarget.x, moveTarget.y, 7 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (var rp = 0; rp < clickRipples.length; rp++) {
      var rip = clickRipples[rp];
      ctx.strokeStyle = "rgba(240, 200, 105, " + (rip.life * 0.7).toFixed(2) + ")";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(rip.x, rip.y, (1 - rip.life) * 28 + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 飄落金瓣
    if (doneCount >= 27) {
      for (var gpIdx = 0; gpIdx < goldPetals.length; gpIdx++) {
        var gp = goldPetals[gpIdx];
        if (gp.x < camera.x - 20 || gp.x > camera.x + width + 20 || gp.y < camera.y - 20 || gp.y > camera.y + height + 20) continue;
        ctx.save();
        ctx.translate(gp.x, gp.y);
        ctx.rotate(gp.rot);
        ctx.fillStyle = "rgba(253, 230, 138, 0.55)";
        ctx.beginPath();
        ctx.ellipse(0, 0, gp.size, gp.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 玩家光跡
    for (var tr = 0; tr < player.trail.length; tr++) {
      var pt = player.trail[tr];
      ctx.fillStyle = "rgba(98, 210, 196, " + (pt.life * 0.35).toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4 * pt.life, 0, Math.PI * 2);
      ctx.fill();
    }

    drawPlayerSprite(player.x, player.y);
    ctx.restore();

    if (doneCount === 0) {
      var fog = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.28, width / 2, height / 2, Math.max(width, height) * 0.78);
      fog.addColorStop(0, "rgba(7, 11, 24, 0)");
      fog.addColorStop(1, "rgba(5, 8, 20, 0.42)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, width, height);
    }
  }

  function drawPlayerSprite(x, y) {
    var bob = Math.sin(time * 3.5) * 2.5;
    ctx.save();
    ctx.translate(x, y + bob);

    ctx.fillStyle = "rgba(98, 210, 196, 0.26)";
    ctx.beginPath();
    ctx.ellipse(0, 18 - bob * 0.5, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    var aura = ctx.createRadialGradient(0, -4, 3, 0, -4, 24);
    aura.addColorStop(0, "rgba(240, 200, 105, 0.45)");
    aura.addColorStop(1, "rgba(98, 210, 196, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, -4, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(-10, 14);
    ctx.quadraticCurveTo(-8, -2, 0, -4);
    ctx.quadraticCurveTo(8, -2, 10, 14);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#f0c869";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, -1);
    ctx.quadraticCurveTo(0, 5, 7, 9);
    ctx.stroke();

    ctx.fillStyle = "#fef3c7";
    ctx.beginPath();
    ctx.arc(0, -10, 6.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function loop(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    var dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    update(dt);
    render();
    rafId = requestAnimationFrame(loop);
  }

  function setTargetFromScreenPoint(clientX, clientY, allowQuickOpen) {
    var world = getWorldSize();
    var wx = Math.max(60, Math.min(world.w - 60, clientX + camera.x));
    var wy = Math.max(60, Math.min(world.h - 60, clientY + camera.y));

    if (allowQuickOpen && currentNearVow) {
      var dLamp = Math.hypot(wx - currentNearVow.mapPos.x, wy - currentNearVow.mapPos.y);
      if (dLamp < 44) {
        if (onInteractVowFn) onInteractVowFn(currentNearVow);
        return;
      }
    }

    moveTarget = { x: wx, y: wy };
    clickRipples.push({ x: wx, y: wy, life: 1.0 });
  }

  function bindEvents() {
    window.addEventListener("resize", resize);

    window.addEventListener("keydown", function (e) {
      keys[e.code] = true;
      if (running && (e.code === "Space" || e.code === "Enter") && currentNearVow) {
        var enc = document.getElementById("modal-encounter");
        if (enc && enc.classList.contains("hidden")) {
          e.preventDefault();
          if (onInteractVowFn) onInteractVowFn(currentNearVow);
        }
      }
    });

    window.addEventListener("keyup", function (e) {
      keys[e.code] = false;
    });

    canvas.addEventListener("pointerdown", function (e) {
      if (!running) return;
      if (window.VowsGame.Audio) window.VowsGame.Audio.unlock();
      pointerDown = true;
      setTargetFromScreenPoint(e.clientX, e.clientY, true);
    });

    window.addEventListener("pointermove", function (e) {
      if (!running || !pointerDown) return;
      setTargetFromScreenPoint(e.clientX, e.clientY, false);
    });

    window.addEventListener("pointerup", function () {
      pointerDown = false;
    });

    window.addEventListener("pointercancel", function () {
      pointerDown = false;
    });
  }

  window.VowsGame.Map = {
    init: function (canvasEl, options) {
      canvas = canvasEl;
      ctx = canvas.getContext("2d");
      getStateFn = options.getState;
      onNearVowChangeFn = options.onNearVowChange;
      onInteractVowFn = options.onInteractVow;
      initDecorations();
      resize();
      bindEvents();
    },
    start: function () {
      if (running) return;
      running = true;
      lastTs = 0;
      keys = {};
      pointerDown = false;
      resize();
      rafId = requestAnimationFrame(loop);
    },
    stop: function () {
      running = false;
      keys = {};
      pointerDown = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    },
    setPlayerPosition: function (x, y) {
      var world = getWorldSize();
      if (typeof x === "number" && typeof y === "number") {
        player.x = Math.max(60, Math.min(world.w - 60, x));
        player.y = Math.max(60, Math.min(world.h - 60, y));
        moveTarget = null;
      }
    },
    getPlayerPosition: function () {
      return { x: Math.round(player.x), y: Math.round(player.y) };
    },
    setCompassTarget: function (vowId) {
      customTargetId = vowId || null;
    },
    teleportNear: function (vow) {
      if (!vow) return;
      var world = getWorldSize();
      customTargetId = vow.id;
      player.x = Math.max(60, Math.min(world.w - 60, vow.mapPos.x - 42));
      player.y = Math.max(60, Math.min(world.h - 60, vow.mapPos.y + 42));
      moveTarget = { x: vow.mapPos.x, y: vow.mapPos.y };
      player.trail = [];
    },
    getNearVow: function () {
      return currentNearVow;
    },
    resetPosition: function () {
      var vows = window.VowsGame.Data.ALL_48_VOWS;
      var first = vows[0];
      player.x = first ? first.mapPos.x - 100 : 220;
      player.y = first ? first.mapPos.y + 60 : 2110;
      player.trail = [];
      moveTarget = null;
      customTargetId = null;
      currentNearVow = null;
    }
  };
})();
