// =====================================================================================
// ARENA CLASH — PvP tối đa 5 người chơi, đồng bộ realtime qua Firebase Realtime Database
// Kiến trúc: mỗi client chỉ ghi vào node CỦA CHÍNH MÌNH (vị trí, hp, trạng thái) để
// tránh xung đột ghi. Sát thương/skill được phát ra dưới dạng "effect" (đường đạn / AoE),
// và CHÍNH NẠN NHÂN tự trừ máu của mình khi phát hiện va chạm (self-authoritative damage).
// =====================================================================================

const ARENA_W = 900, ARENA_H = 560;
const MAX_PLAYERS = 5;
const WIN_KILLS = 5;
const PLAYER_RADIUS = 18;

const uid = "p_" + Math.random().toString(36).slice(2, 10);
let myName = "";
let myChar = null;
let roomId = null;
let isHost = false;

// ---------------------------------------------------------------------------
// Định nghĩa nhân vật (nguyên tác gốc, lấy cảm hứng theo lối chơi sát thủ / kiếm khách)
// ---------------------------------------------------------------------------
const CHAR_DEFS = {
  hacanh: {
    name: "Hắc Ảnh", color: "#7c5cff", speed: 3.1, maxHp: 100,
    basic: { dmg: 9,  cd: 420,  kind: "aoe_cone", radius: 42, range: 42, label: "Đâm Dao" },
    q:     { dmg: 15, cd: 5000, kind: "line", dashSpeed: 14, radius: 26, dashDist: 170, label: "Ảnh Trảm" },
    e:     { cd: 8000, kind: "stealth", duration: 2000, label: "Ẩn Tung" },
    r:     { dmg: 12, hits: 3, cd: 20000, kind: "blink_multi", radius: 46, range: 260, label: "Đoạt Hồn" }
  },
  doclinh: {
    name: "Độc Hành Kiếm Khách", color: "#ff6a3d", speed: 2.7, maxHp: 120,
    basic: { dmg: 10, cd: 600,  kind: "aoe_cone", radius: 60, range: 60, label: "Chém" },
    q:     { dmg: 18, cd: 4000, kind: "line", dashSpeed: 13, radius: 30, dashDist: 150, label: "Phá Phong" },
    e:     { dmg: 14, cd: 7000, kind: "aoe_self", radius: 90, label: "Cuồng Vũ" },
    r:     { dmg: 16, hits: 3, cd: 20000, kind: "line_multi", radius: 34, dashDist: 130, lifesteal: 0.4, label: "Tuyệt Mệnh Kiếm" }
  }
};

// ---------------------------------------------------------------------------
// HÌNH ẢNH NHÂN VẬT — vector gốc do mình vẽ (không dùng ảnh của bên thứ ba)
// ---------------------------------------------------------------------------
const SVG_HACANH = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <ellipse cx="32" cy="58" rx="16" ry="4" fill="#000000" opacity="0.35"/>
  <polygon points="32,8 47,27 41,56 23,56 17,27" fill="#241d42" stroke="#7c5cff" stroke-width="2.5"/>
  <path d="M17,27 Q10,40 16,54" fill="none" stroke="#4a3a8f" stroke-width="3"/>
  <path d="M47,27 Q54,40 48,54" fill="none" stroke="#4a3a8f" stroke-width="3"/>
  <circle cx="32" cy="21" r="11" fill="#161029" stroke="#7c5cff" stroke-width="2.5"/>
  <path d="M25,20 Q32,15 39,20" fill="none" stroke="#0000" />
  <ellipse cx="36.5" cy="19.5" rx="2.6" ry="1.6" fill="#35e8c9"/>
  <rect x="40" y="30" width="18" height="3.4" rx="1.5" fill="#d8d3ff" transform="rotate(28 40 30)"/>
  <rect x="40" y="30" width="18" height="3.4" rx="1.5" fill="#d8d3ff" transform="rotate(-8 40 30)"/>
</svg>`;

const SVG_DOCLINH = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <ellipse cx="32" cy="58" rx="16" ry="4" fill="#000000" opacity="0.35"/>
  <path d="M18,26 L8,16 L14,40 Z" fill="#4a2410" stroke="#ff6a3d" stroke-width="2"/>
  <polygon points="30,9 47,25 41,56 21,56 15,25" fill="#3a1f10" stroke="#ff6a3d" stroke-width="2.5"/>
  <circle cx="30" cy="20" r="11" fill="#20130a" stroke="#ff6a3d" stroke-width="2.5"/>
  <path d="M22,13 Q30,7 38,13 L36,17 Q30,13 24,17 Z" fill="#150c06"/>
  <rect x="44" y="14" width="5" height="38" rx="1.5" fill="#ffe0bf" stroke="#ff6a3d" stroke-width="1.5" transform="rotate(28 44 14)"/>
  <rect x="41" y="12" width="9" height="4" rx="1" fill="#7a3a12" transform="rotate(28 41 12)"/>
</svg>`;

function svgToImage(svg) {
  const img = new Image();
  img.src = "data:image/svg+xml;utf8," + encodeURIComponent(svg.trim());
  return img;
}

const CHAR_SPRITES = { hacanh: svgToImage(SVG_HACANH), doclinh: svgToImage(SVG_DOCLINH) };

// ---------------------------------------------------------------------------
// Quản lý màn hình
// ---------------------------------------------------------------------------
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ---------------------------------------------------------------------------
// MÀN HÌNH LOGIN
// ---------------------------------------------------------------------------
const elName = document.getElementById("input-name");
const elRoom = document.getElementById("input-room");
const elLoginError = document.getElementById("login-error");

function randomRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

document.getElementById("btn-create-room").onclick = () => {
  myName = elName.value.trim().slice(0, 12);
  if (!myName) return (elLoginError.textContent = "Nhập tên trước đã!");
  roomId = randomRoomCode();
  enterCharSelect();
};

document.getElementById("btn-join-room").onclick = async () => {
  myName = elName.value.trim().slice(0, 12);
  const code = elRoom.value.trim().toUpperCase();
  if (!myName) return (elLoginError.textContent = "Nhập tên trước đã!");
  if (!code) return (elLoginError.textContent = "Nhập mã phòng để vào!");
  const snap = await db.ref(`rooms/${code}/players`).get();
  const players = snap.exists() ? snap.val() : {};
  if (Object.keys(players).length >= MAX_PLAYERS) {
    return (elLoginError.textContent = "Phòng đã đầy (tối đa 5 người)!");
  }
  roomId = code;
  elLoginError.textContent = "";
  enterCharSelect();
};

function enterCharSelect() {
  showScreen("screen-select");
}

// ---------------------------------------------------------------------------
// MÀN HÌNH CHỌN NHÂN VẬT
// ---------------------------------------------------------------------------
document.querySelectorAll(".char-portrait").forEach(el => {
  const key = el.classList.contains("hacanh") ? "hacanh" : "doclinh";
  el.style.backgroundImage = `url("${CHAR_SPRITES[key].src}")`;
  el.style.backgroundSize = "auto 88%";
  el.style.backgroundRepeat = "no-repeat";
  el.style.backgroundPosition = "center";
});

document.querySelectorAll(".char-card").forEach(card => {
  card.onclick = () => {
    document.querySelectorAll(".char-card").forEach(c => c.classList.remove("selected"));
    card.classList.add("selected");
    myChar = card.dataset.char;
    document.getElementById("btn-ready").disabled = false;
  };
});

document.getElementById("btn-ready").onclick = () => {
  joinRoom();
};

function joinRoom() {
  const def = CHAR_DEFS[myChar];
  const spawn = randomSpawn();
  const playerRef = db.ref(`rooms/${roomId}/players/${uid}`);
  playerRef.set({
    name: myName, char: myChar, x: spawn.x, y: spawn.y, angle: 0,
    hp: def.maxHp, maxHp: def.maxHp, kills: 0, deaths: 0, alive: true, joinedAt: Date.now()
  });
  playerRef.onDisconnect().remove();

  db.ref(`rooms/${roomId}/status`).get().then(snap => {
    if (!snap.exists()) {
      isHost = true;
      db.ref(`rooms/${roomId}/status`).set({ phase: "lobby" });
    }
  });

  document.getElementById("lobby-room-code").textContent = roomId;
  showScreen("screen-lobby");
  listenLobby();
  listenStatus();
}

function randomSpawn() {
  const margin = 60;
  return {
    x: margin + Math.random() * (ARENA_W - margin * 2),
    y: margin + Math.random() * (ARENA_H - margin * 2)
  };
}

// ---------------------------------------------------------------------------
// LOBBY
// ---------------------------------------------------------------------------
function listenLobby() {
  db.ref(`rooms/${roomId}/players`).on("value", snap => {
    const players = snap.val() || {};
    const list = document.getElementById("lobby-player-list");
    list.innerHTML = "";
    Object.entries(players).forEach(([pid, p]) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${escapeHtml(p.name)}${pid === uid ? " (Bạn)" : ""}</span><span class="tag">${CHAR_DEFS[p.char].name}</span>`;
      list.appendChild(li);
    });
  });
}

document.getElementById("btn-start-game").onclick = () => {
  db.ref(`rooms/${roomId}/status`).set({ phase: "playing", startedAt: Date.now() });
};

function listenStatus() {
  db.ref(`rooms/${roomId}/status`).on("value", snap => {
    const status = snap.val();
    if (!status) return;
    if (status.phase === "playing" && !gameStarted) {
      startGame();
    } else if (status.phase === "ended") {
      endGame(status);
    } else if (status.phase === "lobby" && gameStarted) {
      // back to lobby (after end -> restart flow)
    }
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------------------------------------------------------------------------
// GAME STATE (client-local)
// ---------------------------------------------------------------------------
let gameStarted = false;
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
canvas.width = ARENA_W;
canvas.height = ARENA_H;

const remotePlayers = {}; // pid -> latest data from firebase
const effects = {};       // effectId -> effect data (local mirror)
const attackAnim = {};    // pid -> { angle, start, slot } — hoạt ảnh vung vũ khí
const sparks = [];        // { x, y, start } — particle khi trúng đòn
const keys = {};
let mouseX = ARENA_W / 2, mouseY = ARENA_H / 2;

let me = null; // local authoritative copy of my own player state
const cooldowns = { basic: 0, q: 0, e: 0, r: 0 };
let stealthUntil = 0;
let deadUntil = 0;

function startGame() {
  gameStarted = true;
  showScreen("screen-game");

  const def = CHAR_DEFS[myChar];
  db.ref(`rooms/${roomId}/players/${uid}`).get().then(snap => {
    me = snap.val();
    listenPlayers();
    listenEffects();
    listenHeals();
    lastMoveWrite = 0;
    requestAnimationFrame(loop);
  });
}

function listenPlayers() {
  db.ref(`rooms/${roomId}/players`).on("value", snap => {
    const data = snap.val() || {};
    for (const pid in data) {
      if (pid === uid) continue;
      remotePlayers[pid] = data[pid];
    }
    for (const pid in remotePlayers) {
      if (!data[pid]) delete remotePlayers[pid];
    }
    updateScoreboard(data);
    checkWinCondition(data);
  });
}

function listenEffects() {
  const ref = db.ref(`rooms/${roomId}/effects`);
  ref.on("child_added", snap => {
    const eff = snap.val();
    eff.id = snap.key;
    effects[eff.id] = eff;
    eff._processedSelf = false;
    if (eff.owner !== uid) triggerAttackAnim(eff.owner, eff.angle || 0, eff.skill);
    // owner cleans up its own effect after life expires
    if (eff.owner === uid) {
      setTimeout(() => db.ref(`rooms/${roomId}/effects/${eff.id}`).remove(), eff.life + 200);
    }
  });
  ref.on("child_removed", snap => { delete effects[snap.key]; });
}

function triggerAttackAnim(pid, angle, slot) {
  attackAnim[pid] = { angle, start: performance.now(), slot };
}

// ---------------------------------------------------------------------------
// INPUT (bàn phím + chuột cho PC, joystick ảo + nút chạm cho mobile)
// ---------------------------------------------------------------------------
const isTouchDevice = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
if (isTouchDevice) document.body.classList.add("touch-mode");

window.addEventListener("keydown", e => { keys[e.key.toLowerCase()] = true; handleSkillKey(e.key.toLowerCase()); });
window.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener("mousemove", e => {
  const r = canvas.getBoundingClientRect();
  mouseX = (e.clientX - r.left) * (canvas.width / r.width);
  mouseY = (e.clientY - r.top) * (canvas.height / r.height);
});
canvas.addEventListener("mousedown", () => castSkill("basic"));

function handleSkillKey(k) {
  if (k === "q") castSkill("q");
  if (k === "e") castSkill("e");
  if (k === "r") castSkill("r");
}

// Hướng ngắm hợp nhất: PC dùng vị trí chuột, mobile tự ngắm địch gần nhất
function getAimAngle() {
  if (!me) return 0;
  if (!isTouchDevice) return Math.atan2(mouseY - me.y, mouseX - me.x);
  const enemy = findNearestEnemy(9999);
  if (enemy) return Math.atan2(enemy.y - me.y, enemy.x - me.x);
  return me.angle || 0;
}

// ---- Joystick ảo (di chuyển) ----
let joyDX = 0, joyDY = 0, joyActive = false, joyPointerId = null;
const joyBase = document.getElementById("joystick-base");
const joyKnob = document.getElementById("joystick-knob");

function joyUpdate(clientX, clientY) {
  const r = joyBase.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = clientX - cx, dy = clientY - cy;
  const max = r.width / 2;
  const dist = Math.min(max, Math.hypot(dx, dy));
  const ang = Math.atan2(dy, dx);
  dx = Math.cos(ang) * dist; dy = Math.sin(ang) * dist;
  joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  joyDX = dist < 6 ? 0 : dx / max;
  joyDY = dist < 6 ? 0 : dy / max;
}
function joyReset() {
  joyActive = false; joyPointerId = null; joyDX = 0; joyDY = 0;
  joyKnob.style.transform = "translate(0px, 0px)";
}
if (joyBase) {
  joyBase.addEventListener("touchstart", e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joyActive = true; joyPointerId = t.identifier;
    joyUpdate(t.clientX, t.clientY);
  }, { passive: false });
  joyBase.addEventListener("touchmove", e => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === joyPointerId) joyUpdate(t.clientX, t.clientY);
  }, { passive: false });
  joyBase.addEventListener("touchend", e => {
    for (const t of e.changedTouches) if (t.identifier === joyPointerId) joyReset();
  });
  joyBase.addEventListener("touchcancel", joyReset);
}

// ---- Nút chạm skill ----
function bindMobileButton(id, slot) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("touchstart", e => { e.preventDefault(); castSkill(slot); }, { passive: false });
  el.addEventListener("click", () => castSkill(slot));
}
bindMobileButton("btn-mobile-basic", "basic");
bindMobileButton("btn-mobile-q", "q");
bindMobileButton("btn-mobile-e", "e");
bindMobileButton("btn-mobile-r", "r");

// ---------------------------------------------------------------------------
// SKILL CASTING (mỗi client chỉ tạo effect, không trực tiếp trừ máu người khác)
// ---------------------------------------------------------------------------
function castSkill(slot) {
  if (!me || !me.alive) return;
  const now = Date.now();
  if (now < cooldowns[slot]) return;

  const def = CHAR_DEFS[myChar];
  const skillDef = def[slot];
  const angle = getAimAngle();
  me.angle = angle;

  cooldowns[slot] = now + skillDef.cd;
  updateSkillUI();
  triggerAttackAnim(uid, angle, slot);

  const baseEffect = {
    owner: uid, ownerName: myName, char: myChar, skill: slot,
    createdAt: now, x: me.x, y: me.y, angle
  };

  if (skillDef.kind === "projectile") {
    pushEffect({ ...baseEffect, kind: "projectile",
      vx: Math.cos(angle) * skillDef.speed, vy: Math.sin(angle) * skillDef.speed,
      dmg: skillDef.dmg, radius: skillDef.radius, life: (skillDef.range / skillDef.speed) * (1000 / 60) });
  } else if (skillDef.kind === "aoe_cone" || skillDef.kind === "aoe_self") {
    const cx = skillDef.kind === "aoe_self" ? me.x : me.x + Math.cos(angle) * skillDef.range * 0.4;
    const cy = skillDef.kind === "aoe_self" ? me.y : me.y + Math.sin(angle) * skillDef.range * 0.4;
    pushEffect({ ...baseEffect, kind: "aoe", x: cx, y: cy, dmg: skillDef.dmg, radius: skillDef.radius, life: 220 });
    if (skillDef.kind === "aoe_cone") dashSelf(angle, 8); // nhích nhẹ theo hướng chém
  } else if (skillDef.kind === "line") {
    const endX = me.x + Math.cos(angle) * skillDef.dashDist;
    const endY = me.y + Math.sin(angle) * skillDef.dashDist;
    pushEffect({ ...baseEffect, kind: "line", ex: endX, ey: endY, dmg: skillDef.dmg, radius: skillDef.radius, life: 260 });
    animateDash(me.x, me.y, endX, endY, 220);
  } else if (skillDef.kind === "stealth") {
    stealthUntil = now + skillDef.duration;
    writeMyState({ stealth: true });
    setTimeout(() => writeMyState({ stealth: false }), skillDef.duration);
  } else if (skillDef.kind === "blink_multi") {
    let target = findNearestEnemy(skillDef.range);
    let tx = target ? target.x - Math.cos(angle) * 40 : me.x + Math.cos(angle) * 80;
    let ty = target ? target.y - Math.sin(angle) * 40 : me.y + Math.sin(angle) * 80;
    tx = clamp(tx, PLAYER_RADIUS, ARENA_W - PLAYER_RADIUS);
    ty = clamp(ty, PLAYER_RADIUS, ARENA_H - PLAYER_RADIUS);
    me.x = tx; me.y = ty;
    writeMyState({ x: tx, y: ty });
    for (let i = 0; i < skillDef.hits; i++) {
      setTimeout(() => pushEffect({ ...baseEffect, kind: "aoe", x: me.x, y: me.y, dmg: skillDef.dmg, radius: skillDef.radius, life: 200, createdAt: Date.now() }), i * 180);
    }
  } else if (skillDef.kind === "line_multi") {
    for (let i = 0; i < skillDef.hits; i++) {
      setTimeout(() => {
        const a2 = getAimAngle();
        const ex = me.x + Math.cos(a2) * skillDef.dashDist;
        const ey = me.y + Math.sin(a2) * skillDef.dashDist;
        pushEffect({ ...baseEffect, kind: "line", ex, ey, dmg: skillDef.dmg, radius: skillDef.radius,
          life: 220, createdAt: Date.now(), lifesteal: skillDef.lifesteal, angle: a2 });
        animateDash(me.x, me.y, ex, ey, 180);
        triggerAttackAnim(uid, a2, slot);
      }, i * 260);
    }
  }
}

function pushEffect(eff) {
  const ref = db.ref(`rooms/${roomId}/effects`).push();
  ref.set(eff);
}

function dashSelf(angle, dist) {
  me.x = clamp(me.x + Math.cos(angle) * dist, PLAYER_RADIUS, ARENA_W - PLAYER_RADIUS);
  me.y = clamp(me.y + Math.sin(angle) * dist, PLAYER_RADIUS, ARENA_H - PLAYER_RADIUS);
}

function animateDash(x1, y1, x2, y2, duration) {
  const start = performance.now();
  function step(t) {
    const p = Math.min(1, (t - start) / duration);
    me.x = clamp(x1 + (x2 - x1) * p, PLAYER_RADIUS, ARENA_W - PLAYER_RADIUS);
    me.y = clamp(y1 + (y2 - y1) * p, PLAYER_RADIUS, ARENA_H - PLAYER_RADIUS);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function findNearestEnemy(maxRange) {
  let best = null, bestD = maxRange;
  for (const pid in remotePlayers) {
    const p = remotePlayers[pid];
    if (!p.alive) continue;
    const d = Math.hypot(p.x - me.x, p.y - me.y);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ---------------------------------------------------------------------------
// VÒNG LẶP GAME
// ---------------------------------------------------------------------------
let lastMoveWrite = 0;

function loop(ts) {
  if (!gameStarted) return;
  updateMovement();
  processEffectsAgainstMe();
  render();
  updateSkillUI();
  requestAnimationFrame(loop);
}

function updateMovement() {
  if (!me || !me.alive) return;
  const def = CHAR_DEFS[myChar];
  let dx = 0, dy = 0;
  if (keys["w"] || keys["arrowup"]) dy -= 1;
  if (keys["s"] || keys["arrowdown"]) dy += 1;
  if (keys["a"] || keys["arrowleft"]) dx -= 1;
  if (keys["d"] || keys["arrowright"]) dx += 1;
  if (joyDX || joyDY) { dx = joyDX; dy = joyDY; }
  const len = Math.hypot(dx, dy);
  if (len > 0.05) {
    const n = Math.min(1, len);
    me.x = clamp(me.x + (dx / len) * def.speed * n, PLAYER_RADIUS, ARENA_W - PLAYER_RADIUS);
    me.y = clamp(me.y + (dy / len) * def.speed * n, PLAYER_RADIUS, ARENA_H - PLAYER_RADIUS);
    if (isTouchDevice && !findNearestEnemy(9999)) me.angle = Math.atan2(dy, dx);
  }
  if (!isTouchDevice || findNearestEnemy(9999)) me.angle = getAimAngle();

  const now = performance.now();
  if (now - lastMoveWrite > 70) {
    lastMoveWrite = now;
    writeMyState({ x: me.x, y: me.y, angle: me.angle });
  }
}

function writeMyState(partial) {
  db.ref(`rooms/${roomId}/players/${uid}`).update(partial);
  Object.assign(me, partial);
}

const processedEffects = new Set();

function processEffectsAgainstMe() {
  if (!me || !me.alive) return;
  const now = Date.now();
  for (const id in effects) {
    const eff = effects[id];
    if (eff.owner === uid) continue;
    if (processedEffects.has(id)) continue;
    if (now - eff.createdAt > eff.life) continue;

    let hit = false;
    const t = (now - eff.createdAt) / 1000;

    if (eff.kind === "projectile") {
      const px = eff.x + eff.vx * t * 60, py = eff.y + eff.vy * t * 60;
      hit = Math.hypot(px - me.x, py - me.y) < (eff.radius + PLAYER_RADIUS);
    } else if (eff.kind === "aoe") {
      hit = Math.hypot(eff.x - me.x, eff.y - me.y) < (eff.radius + PLAYER_RADIUS * 0.5);
    } else if (eff.kind === "line") {
      hit = pointToSegmentDist(me.x, me.y, eff.x, eff.y, eff.ex, eff.ey) < (eff.radius + PLAYER_RADIUS * 0.5);
    }

    if (hit) {
      processedEffects.add(id);
      applyDamageToSelf(eff.dmg, eff.owner, eff.ownerName, eff.lifesteal);
    }
  }
}

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function applyDamageToSelf(dmg, attackerId, attackerName, lifestealPct) {
  const ref = db.ref(`rooms/${roomId}/players/${uid}/hp`);
  ref.transaction(hp => Math.max(0, (hp || me.hp) - dmg)).then(res => {
    const newHp = res.snapshot.val();
    me.hp = newHp;
    sparks.push({ x: me.x, y: me.y, start: performance.now() });
    pushKillfeed(`${attackerName} gây ${dmg} sát thương lên ${myName}`);
    if (lifestealPct) {
      db.ref(`rooms/${roomId}/heals`).push({ to: attackerId, amount: Math.round(dmg * lifestealPct) });
    }
    if (newHp <= 0 && me.alive) {
      handleMyDeath(attackerId, attackerName);
    }
  });
}

function handleMyDeath(attackerId, attackerName) {
  me.alive = false;
  writeMyState({ alive: false, deaths: (me.deaths || 0) + 1 });
  db.ref(`rooms/${roomId}/players/${attackerId}/kills`).transaction(k => (k || 0) + 1);
  pushKillfeed(`☠ ${attackerName} đã hạ gục ${myName}`);
  setTimeout(respawnMe, 2500);
}

function respawnMe() {
  const def = CHAR_DEFS[myChar];
  const spawn = randomSpawn();
  me.hp = def.maxHp; me.alive = true; me.x = spawn.x; me.y = spawn.y;
  writeMyState({ hp: def.maxHp, alive: true, x: spawn.x, y: spawn.y });
}

// Nhận heal (dùng cho lifesteal của Tuyệt Mệnh Kiếm)
function listenHeals() {
  db.ref(`rooms/${roomId}/heals`).on("child_added", snap => {
    const h = snap.val();
    if (h.to === uid) {
      const def = CHAR_DEFS[myChar];
      db.ref(`rooms/${roomId}/players/${uid}/hp`).transaction(hp => Math.min(def.maxHp, (hp || 0) + h.amount));
    }
    snap.ref.remove();
  });
}

// ---------------------------------------------------------------------------
// RENDER
// ---------------------------------------------------------------------------
function render() {
  ctx.clearRect(0, 0, ARENA_W, ARENA_H);

  // nền lưới đấu trường
  ctx.fillStyle = "#0a0815";
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  ctx.strokeStyle = "#1c1730";
  ctx.lineWidth = 1;
  for (let x = 0; x < ARENA_W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_H); ctx.stroke(); }
  for (let y = 0; y < ARENA_H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA_W, y); ctx.stroke(); }

  // hiệu ứng chiêu thức
  const now = Date.now();
  for (const id in effects) {
    const eff = effects[id];
    const age = now - eff.createdAt;
    if (age > eff.life) continue;
    const t = age / 1000;
    const alpha = 1 - age / eff.life;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = eff.owner === uid ? "#35e8c9" : "#ff4d6d";
    ctx.strokeStyle = ctx.fillStyle;

    if (eff.kind === "projectile") {
      const px = eff.x + eff.vx * t * 60, py = eff.y + eff.vy * t * 60;
      ctx.beginPath(); ctx.arc(px, py, eff.radius * 0.5, 0, Math.PI * 2); ctx.fill();
    } else if (eff.kind === "aoe") {
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(eff.x, eff.y, eff.radius * (0.4 + alpha * 0.6), 0, Math.PI * 2); ctx.stroke();
    } else if (eff.kind === "line") {
      ctx.lineWidth = eff.radius * 0.5;
      ctx.beginPath(); ctx.moveTo(eff.x, eff.y); ctx.lineTo(eff.ex, eff.ey); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // người chơi khác
  for (const pid in remotePlayers) {
    drawPlayer(remotePlayers[pid], false, pid);
  }
  // chính mình
  if (me) drawPlayer(me, true, uid);

  // particle khi trúng đòn
  drawSparks();
}

function drawSparks() {
  const now = performance.now();
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    const age = now - s.start;
    if (age > 350) { sparks.splice(i, 1); continue; }
    const p = age / 350;
    ctx.globalAlpha = 1 - p;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const r = 6 + p * 20;
      ctx.beginPath();
      ctx.arc(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ff4d6d";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawPlayer(p, isMe, pid) {
  const def = CHAR_DEFS[p.char];
  const sprite = CHAR_SPRITES[p.char];
  if (!p.alive) return;

  const now = performance.now();
  const anim = attackAnim[pid];
  const animAge = anim ? now - anim.start : 9999;
  const swinging = animAge < 220;

  // hoạt ảnh nhấp nhô khi đứng yên/di chuyển (idle bob)
  const bob = Math.sin(now / 180 + (pid ? pid.length : 0)) * 1.6;
  // khi vung vũ khí, nhân vật hơi lao nhẹ về phía trước rồi trở lại
  const lungeP = swinging ? Math.sin((animAge / 220) * Math.PI) : 0;
  const angle = swinging ? anim.angle : (p.angle || 0);
  const drawX = p.x + Math.cos(angle) * lungeP * 6;
  const drawY = p.y + Math.sin(angle) * lungeP * 6 + bob;

  ctx.globalAlpha = (p.stealth && !isMe) ? 0.18 : (p.stealth && isMe ? 0.5 : 1);

  // vòng sáng dưới chân theo màu nhân vật
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + PLAYER_RADIUS * 0.9, PLAYER_RADIUS * 0.9, PLAYER_RADIUS * 0.35, 0, 0, Math.PI * 2);
  ctx.fillStyle = def.color + "55";
  ctx.fill();

  // vệt vung vũ khí (arc) khi đang đánh
  if (swinging) {
    const p2 = animAge / 220;
    ctx.globalAlpha *= (1 - p2) * 0.9;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_RADIUS + 14 + p2 * 10, angle - 0.9, angle + 0.9);
    ctx.stroke();
    ctx.globalAlpha = (p.stealth && !isMe) ? 0.18 : (p.stealth && isMe ? 0.5 : 1);
  }

  // hình nhân vật (vector gốc), xoay theo hướng nhìn
  if (sprite && sprite.complete) {
    const size = PLAYER_RADIUS * 2.6;
    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.rotate(angle);
    ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(drawX, drawY, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = def.color;
    ctx.fill();
  }

  ctx.lineWidth = isMe ? 3 : 0;
  if (isMe) {
    ctx.beginPath();
    ctx.arc(drawX, drawY, PLAYER_RADIUS + 3, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }

  ctx.globalAlpha = 1;

  // tên + thanh máu mini
  ctx.font = "11px 'Be Vietnam Pro', sans-serif";
  ctx.fillStyle = "#eae7f7";
  ctx.textAlign = "center";
  ctx.fillText(p.name, p.x, p.y - 30);

  const w = 34, h = 4;
  ctx.fillStyle = "#00000090";
  ctx.fillRect(p.x - w / 2, p.y - 24, w, h);
  ctx.fillStyle = "#35e8c9";
  ctx.fillRect(p.x - w / 2, p.y - 24, w * Math.max(0, p.hp / p.maxHp), h);
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
function updateSkillUI() {
  if (!me) return;
  document.getElementById("hp-bar-fill").style.width = Math.max(0, (me.hp / CHAR_DEFS[myChar].maxHp) * 100) + "%";
  document.getElementById("hp-bar-text").textContent = `${Math.max(0, Math.round(me.hp))} / ${CHAR_DEFS[myChar].maxHp}`;

  const now = Date.now();
  [["basic", "slot-basic"], ["q", "slot-q"], ["e", "slot-e"], ["r", "slot-r"]].forEach(([slot, elId]) => {
    const el = document.getElementById(elId);
    const remain = cooldowns[slot] - now;
    const def = CHAR_DEFS[myChar][slot];
    if (remain > 0) {
      el.classList.add("cooling");
      el.style.setProperty("--cd", (remain / def.cd) * 100 + "%");
    } else {
      el.classList.remove("cooling");
    }
  });
}

function updateScoreboard(data) {
  const board = document.getElementById("scoreboard");
  board.innerHTML = "";
  const arr = Object.entries(data).sort((a, b) => (b[1].kills || 0) - (a[1].kills || 0));
  arr.forEach(([pid, p]) => {
    const row = document.createElement("div");
    row.className = "score-row" + (pid === uid ? " me" : "");
    row.innerHTML = `<span>${escapeHtml(p.name)}</span><span>${p.kills || 0} hạ gục</span>`;
    board.appendChild(row);
  });
}

function pushKillfeed(msg) {
  const feed = document.getElementById("killfeed");
  const div = document.createElement("div");
  div.className = "kill-msg";
  div.textContent = msg;
  feed.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

// ---------------------------------------------------------------------------
// KẾT THÚC TRẬN
// ---------------------------------------------------------------------------
function checkWinCondition(data) {
  for (const pid in data) {
    if ((data[pid].kills || 0) >= WIN_KILLS) {
      db.ref(`rooms/${roomId}/status`).transaction(cur => {
        if (cur && cur.phase === "playing") {
          return { phase: "ended", winner: pid, winnerName: data[pid].name };
        }
        return cur;
      });
      break;
    }
  }
}

function endGame(status) {
  gameStarted = false;
  showScreen("screen-end");
  document.getElementById("end-title").textContent = `🏆 ${status.winnerName || "?"} chiến thắng!`;
  db.ref(`rooms/${roomId}/players`).get().then(snap => {
    const data = snap.val() || {};
    const list = document.getElementById("end-scoreboard");
    list.innerHTML = "";
    Object.entries(data).sort((a, b) => (b[1].kills || 0) - (a[1].kills || 0)).forEach(([pid, p]) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${escapeHtml(p.name)}</span><span class="tag">${p.kills || 0} hạ gục / ${p.deaths || 0} chết</span>`;
      list.appendChild(li);
    });
  });
}

document.getElementById("btn-back-lobby").onclick = () => {
  const def = CHAR_DEFS[myChar];
  const spawn = randomSpawn();
  writeMyState({ hp: def.maxHp, alive: true, kills: 0, deaths: 0, x: spawn.x, y: spawn.y });
  db.ref(`rooms/${roomId}/status`).set({ phase: "lobby" });
  showScreen("screen-lobby");
};

// kích hoạt lắng nghe heal khi vào phòng
db.ref().root; // no-op để chắc chắn `db` đã sẵn sàng trước khi gán listener bên dưới
document.addEventListener("DOMContentLoaded", () => {});
