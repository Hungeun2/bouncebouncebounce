import { PHYSICS, clamp } from "./maps.js";

const PLAYER_KEY = "bounce_online_player_id";
const NICK_KEY = "bounce_online_nickname";

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const queueButton = document.querySelector("#queueButton");
const leaveButton = document.querySelector("#leaveButton");
const nicknameInput = document.querySelector("#nicknameInput");
const queueStatus = document.querySelector("#queueStatus");
const lobbyPanel = document.querySelector("#lobbyPanel");
const gamePanel = document.querySelector("#gamePanel");
const touchHud = document.querySelector("#touchHud");
const mapLabel = document.querySelector("#mapLabel");
const timerLabel = document.querySelector("#timerLabel");
const queueLabel = document.querySelector("#queueLabel");
const gradeChip = document.querySelector("#gradeChip");
const ratingChip = document.querySelector("#ratingChip");
const overlayText = document.querySelector("#overlayText");
const liveRank = document.querySelector("#liveRank");
const globalRank = document.querySelector("#globalRank");

const input = { left: false, right: false, boost: false };

const state = {
  playerId: getOrCreatePlayerId(),
  match: null,
  profile: null,
  queue: { inQueue: false, playersWaiting: 0, position: null },
  globalTop: [],
  cameraX: 0,
  connected: false,
  socket: null,
  reconnectTimer: null,
  predicted: null,
  lastInputAt: 0,
  justFinishedMatchId: null,
};

function getOrCreatePlayerId() {
  const known = localStorage.getItem(PLAYER_KEY);
  if (known) return known;
  const id = `p_${Math.random().toString(36).slice(2, 11)}${Date.now().toString(36).slice(-4)}`;
  localStorage.setItem(PLAYER_KEY, id);
  return id;
}

function getDefaultNick() {
  const saved = localStorage.getItem(NICK_KEY);
  if (saved) return saved;
  return `Player-${state.playerId.slice(-4)}`;
}

function updateNickStorage(name) {
  localStorage.setItem(NICK_KEY, name);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : null,
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

function wsUrl() {
  const url = new URL(window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.search = `?playerId=${encodeURIComponent(state.playerId)}`;
  return url.toString();
}

function connectSocket() {
  if (state.socket && (state.socket.readyState === WebSocket.OPEN || state.socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const socket = new WebSocket(wsUrl());
  state.socket = socket;

  socket.addEventListener("open", () => {
    state.connected = true;
    queueStatus.textContent = "실시간 연결됨";
  });

  socket.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === "state") updateFromServer(payload.state);
    } catch {
      // ignore malformed payloads
    }
  });

  socket.addEventListener("close", () => {
    state.connected = false;
    if (state.reconnectTimer) return;
    state.reconnectTimer = window.setTimeout(() => {
      state.reconnectTimer = null;
      connectSocket();
    }, 800);
  });

  socket.addEventListener("error", () => {
    state.connected = false;
  });
}

async function registerPlayer() {
  const nickname = sanitizeNick(nicknameInput.value || getDefaultNick());
  nicknameInput.value = nickname;
  updateNickStorage(nickname);
  const payload = await api("/api/register", {
    method: "POST",
    body: { playerId: state.playerId, nickname },
  });
  state.profile = payload.profile;
}

function sanitizeNick(name) {
  const cleaned = (name || "")
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 16);
  return cleaned || `Player-${state.playerId.slice(-4)}`;
}

function formatMs(ms) {
  if (typeof ms !== "number" || ms <= 0) return "00:00";
  const sec = Math.floor(ms / 1000);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function setOverlay(message) {
  overlayText.textContent = message;
}

function renderLists() {
  const rankRows = state.match?.status === "finished" ? state.match.results : state.match?.liveRanking;
  renderOrderedList(
    liveRank,
    rankRows,
    (row) =>
      `${row.rank}위 ${row.nickname} · ${
        row.finishMs != null ? `${(row.finishMs / 1000).toFixed(1)}s` : `${Math.round(row.progress * 100)}%`
      }${row.points ? ` · +${row.points}p` : ""}`,
  );
  renderOrderedList(globalRank, state.globalTop, (row) => `${row.nickname} · ${row.rating} RP (${row.grade})`);
}

function renderOrderedList(target, rows, formatter) {
  target.textContent = "";
  if (!rows || rows.length === 0) {
    const li = document.createElement("li");
    li.textContent = "-";
    target.append(li);
    return;
  }
  rows.slice(0, 8).forEach((row) => {
    const li = document.createElement("li");
    li.textContent = formatter(row);
    target.append(li);
  });
}

function updatePanels() {
  const inMatch = state.match?.status === "running";
  lobbyPanel.classList.toggle("is-hidden", inMatch);
  gamePanel.classList.toggle("is-hidden", !inMatch);
  touchHud.classList.toggle("is-hidden", !inMatch);

  if (state.profile) {
    gradeChip.textContent = state.profile.grade;
    ratingChip.textContent = `${state.profile.rating} RP`;
  }

  if (state.match?.status === "running") {
    mapLabel.textContent = state.match.map.name;
    timerLabel.textContent = formatMs(state.match.remainingMs);
    queueStatus.textContent = "매치 진행중입니다. 1위로 골인하면 최대 승점을 획득합니다.";
    queueButton.disabled = true;
    queueButton.classList.remove("is-queued");
    queueButton.textContent = "진행중";
    setOverlay(`${state.match.map.name} · ${formatMs(state.match.remainingMs)}`);
  } else if (state.match?.status === "finished") {
    mapLabel.textContent = state.match.map.name;
    timerLabel.textContent = "FIN";
    queueStatus.textContent = "결과 확인 후 다시 매칭을 눌러 다음 라운드에 참가하세요.";
    queueButton.disabled = false;
    queueButton.classList.remove("is-queued");
    queueButton.textContent = "다음 매칭";
    setOverlay("MATCH END");
  } else if (state.queue.inQueue) {
    mapLabel.textContent = "Waiting";
    timerLabel.textContent = "--:--";
    const pos = state.queue.position ? `${state.queue.position}번째` : "대기중";
    queueStatus.textContent = `${pos} · 최소 2명부터 매칭됩니다.`;
    queueButton.disabled = false;
    queueButton.classList.add("is-queued");
    queueButton.textContent = "매칭 취소";
    setOverlay("MATCHMAKING");
  } else {
    mapLabel.textContent = "Waiting";
    timerLabel.textContent = "--:--";
    queueStatus.textContent = "매칭 버튼을 눌러 레이스를 시작하세요.";
    queueButton.disabled = false;
    queueButton.classList.remove("is-queued");
    queueButton.textContent = "매칭 시작";
    setOverlay("QUEUE UP TO START");
  }

  queueLabel.textContent = `${state.queue.playersWaiting}명`;
}

function updateFromServer(payload) {
  state.connected = true;
  state.profile = payload.profile;
  state.queue = payload.queue;
  state.match = payload.match;
  state.globalTop = payload.globalTop;

  if (state.match?.status === "running") {
    const me = state.match.players.find((player) => player.playerId === state.playerId);
    if (me) {
      state.predicted = {
        x: me.x,
        y: me.y,
        vx: me.vx,
        vy: me.vy,
        grounded: false,
      };
    }
  } else {
    state.predicted = null;
  }

  if (!state.match && state.justFinishedMatchId) {
    state.justFinishedMatchId = null;
  }

  if (state.match?.status === "finished") {
    state.justFinishedMatchId = state.match.id;
  }

  renderLists();
  updatePanels();
}

function integratePrediction(dt) {
  if (!state.match || state.match.status !== "running" || !state.predicted) return;
  const map = state.match.map;
  const player = state.predicted;
  const accel = player.grounded ? PHYSICS.groundAccel : PHYSICS.airAccel;
  if (input.left) player.vx -= accel * dt;
  if (input.right) player.vx += accel * dt;
  player.vx = clamp(player.vx * PHYSICS.friction, -PHYSICS.maxVx, PHYSICS.maxVx);
  if (input.boost && player.grounded) {
    player.vy = -PHYSICS.boostImpulse;
    player.grounded = false;
  }
  player.vy += PHYSICS.gravity * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.x = clamp(player.x, PHYSICS.playerRadius, map.width - PHYSICS.playerRadius);
}

function bindHold(button, key) {
  const setValue = (value) => {
    input[key] = value;
    button.classList.toggle("is-pressed", value);
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    setValue(true);
    sendInput();
  });
  button.addEventListener("pointerup", () => {
    setValue(false);
    sendInput();
  });
  button.addEventListener("pointercancel", () => {
    setValue(false);
    sendInput();
  });
  button.addEventListener("lostpointercapture", () => {
    setValue(false);
    sendInput();
  });
}

function sendInput() {
  if (state.match?.status !== "running") return;
  const now = performance.now();
  if (now - state.lastInputAt < 24) return;
  state.lastInputAt = now;
  if (state.socket && state.socket.readyState === WebSocket.OPEN) {
    state.socket.send(JSON.stringify({ type: "input", ...input }));
    return;
  }
  api("/api/input", {
    method: "POST",
    body: { playerId: state.playerId, ...input },
  }).catch(() => {});
}

async function toggleQueue() {
  if (state.match?.status === "running") return;
  const nickname = sanitizeNick(nicknameInput.value);
  nicknameInput.value = nickname;
  updateNickStorage(nickname);
  await registerPlayer();
  if (state.queue.inQueue) {
    await api("/api/queue/leave", { method: "POST", body: { playerId: state.playerId } });
  } else {
    await api("/api/queue/join", {
      method: "POST",
      body: { playerId: state.playerId, nickname },
    });
  }
}

function bindControls() {
  bindHold(document.querySelector("#leftButton"), "left");
  bindHold(document.querySelector("#rightButton"), "right");

  queueButton.addEventListener("click", async () => {
    try {
      await toggleQueue();
    } catch (error) {
      queueStatus.textContent = error.message || "매칭 처리 중 오류가 발생했습니다.";
    }
  });

  leaveButton.addEventListener("click", async () => {
    try {
      if (state.queue.inQueue) {
        await api("/api/queue/leave", { method: "POST", body: { playerId: state.playerId } });
      }
      if (state.socket?.readyState === WebSocket.OPEN) {
        state.socket.close();
      }
      state.match = null;
      state.predicted = null;
      updatePanels();
    } catch (error) {
      queueStatus.textContent = error.message || "나가는 중 오류가 발생했습니다.";
    }
  });

  nicknameInput.addEventListener("change", () => {
    const nickname = sanitizeNick(nicknameInput.value);
    nicknameInput.value = nickname;
    updateNickStorage(nickname);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") input.left = true;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") input.right = true;
    sendInput();
  });
  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") input.left = false;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") input.right = false;
    sendInput();
  });
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawBackground(map, camX) {
  ctx.fillStyle = "#f8e8d2";
  ctx.fillRect(camX, 0, canvas.width, map.height);

  const lineStep = 160;
  ctx.strokeStyle = "rgba(26, 135, 126, 0.2)";
  ctx.lineWidth = 2;
  for (let x = Math.floor(camX / lineStep) * lineStep; x < camX + map.width; x += lineStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, map.height);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(197, 124, 64, 0.22)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(camX, 560);
  for (let x = camX; x < camX + 1800; x += 200) {
    const y = 500 + Math.sin(x * 0.008) * 90;
    ctx.quadraticCurveTo(x + 100, y, x + 200, 540 + Math.cos(x * 0.006) * 40);
  }
  ctx.stroke();
}

function drawSolid(rect) {
  const tile = PHYSICS.tile;
  const cols = Math.max(1, Math.floor(rect.w / tile));
  for (let i = 0; i < cols; i += 1) {
    const tx = rect.x + i * tile;
    ctx.fillStyle = "#d18759";
    ctx.fillRect(tx + 1, rect.y + 1, tile - 2, rect.h - 2);
    ctx.fillStyle = "#efc295";
    ctx.fillRect(tx + 4, rect.y + 4, tile - 8, 5);
    ctx.fillStyle = "#8f4f34";
    ctx.fillRect(tx + 8, rect.y + 13, tile - 16, tile - 18);
    ctx.strokeStyle = "#3d2318";
    ctx.lineWidth = 2;
    ctx.strokeRect(tx + 8, rect.y + 13, tile - 16, tile - 18);
  }
}

function drawFinish(map) {
  const pulse = 0.5 + Math.sin(performance.now() * 0.007) * 0.5;
  const x = map.finishX;
  ctx.fillStyle = `rgba(31, 138, 131, ${0.2 + pulse * 0.2})`;
  ctx.fillRect(x - 22, 120, 44, map.height - 160);
  ctx.strokeStyle = `rgba(31, 138, 131, ${0.5 + pulse * 0.45})`;
  ctx.lineWidth = 5;
  ctx.strokeRect(x - 12, 110, 24, map.height - 150);
  ctx.fillStyle = "#165e58";
  ctx.font = '700 24px "Trebuchet MS", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("FINISH", x, 84);
}

function drawCheckpoints(map) {
  ctx.strokeStyle = "rgba(232, 142, 64, 0.42)";
  ctx.lineWidth = 3;
  for (const cp of map.checkpoints) {
    ctx.beginPath();
    ctx.moveTo(cp.x, map.height - 110);
    ctx.lineTo(cp.x, map.height - 70);
    ctx.stroke();
  }
}

function drawPlayer(player, isMe) {
  const radius = PHYSICS.playerRadius;
  const gradient = ctx.createRadialGradient(player.x - 4, player.y - 5, 3, player.x, player.y, radius + 4);
  gradient.addColorStop(0, "#fff4d7");
  gradient.addColorStop(0.4, player.color);
  gradient.addColorStop(1, "#9b3d2f");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = isMe ? "#1f8a83" : "#573327";
  ctx.lineWidth = isMe ? 4 : 2;
  ctx.stroke();

  ctx.fillStyle = "#2f2a28";
  ctx.font = '600 13px "Trebuchet MS", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(player.nickname, player.x, player.y - 20);
}

function drawMatch(match) {
  const map = match.map;
  const me = state.predicted || match.players.find((player) => player.playerId === state.playerId);
  const sx = canvas.width / map.width;
  const sy = canvas.height / map.height;
  const scale = Math.min(1.2, Math.max(sx, sy));
  const visibleWidth = canvas.width / scale;
  const targetCam = clamp((me?.x ?? 0) - visibleWidth * 0.38, 0, map.width - visibleWidth);
  state.cameraX = targetCam;

  const offsetX = (canvas.width - visibleWidth * scale) / 2;
  const offsetY = (canvas.height - map.height * scale) / 2;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  ctx.translate(-state.cameraX, 0);

  drawBackground(map, state.cameraX);
  drawCheckpoints(map);
  drawFinish(map);

  const viewLeft = state.cameraX - PHYSICS.tile;
  const viewRight = state.cameraX + visibleWidth + PHYSICS.tile;
  for (const rect of map.solids) {
    if (rect.x + rect.w < viewLeft || rect.x > viewRight) continue;
    drawSolid(rect);
  }

  for (const player of match.players) {
    drawPlayer(player, player.playerId === state.playerId);
  }
}

function drawLobby() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#fff1de");
  grad.addColorStop(1, "#f7e8d2");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#9b5a38";
  ctx.font = '700 34px "Trebuchet MS", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("Bounce Arena", canvas.width / 2, canvas.height / 2 - 10);
  ctx.fillStyle = "#5f5853";
  ctx.font = '500 18px "Trebuchet MS", sans-serif';
  ctx.fillText("Queue up and race with up to 5 players", canvas.width / 2, canvas.height / 2 + 24);
}

function frame() {
  if (state.match) drawMatch(state.match);
  else drawLobby();
  requestAnimationFrame(frame);
}

async function init() {
  nicknameInput.value = sanitizeNick(getDefaultNick());
  bindControls();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("orientationchange", resizeCanvas);

  try {
    await registerPlayer();
  } catch {
    queueStatus.textContent = "초기 연결에 실패했습니다. 잠시 후 자동 재시도됩니다.";
  }

  updatePanels();
  renderLists();
  requestAnimationFrame(frame);
  connectSocket();
  window.setInterval(() => {
    if (state.socket?.readyState !== WebSocket.OPEN) connectSocket();
  }, 3000);
  let last = performance.now();
  const predictionLoop = (now) => {
    const dt = Math.min(0.033, (now - last) / 1000 || 0);
    last = now;
    integratePrediction(dt);
    requestAnimationFrame(predictionLoop);
  };
  requestAnimationFrame(predictionLoop);
}

init();
