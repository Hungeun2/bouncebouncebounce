import http from "node:http";
import path from "node:path";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { MAPS, PHYSICS, clamp } from "./maps.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 4173);
const TICK_MS = Math.round(1000 / 30);
const STATE_STALE_MS = 30_000;
const MATCH_RESULTS_KEEP_MS = 45_000;
const MAX_PLAYERS_PER_MATCH = 5;
const MIN_PLAYERS_TO_START = 2;
const QUEUE_WAIT_MS = 12_000;
const FALL_RESPAWN_Y = 980;
const FALL_PENALTY_MS = 3000;
const POINTS_BY_RANK = [34, 24, 17, 12, 8];
const DATA_DIR = path.join(__dirname, "data");
const RATINGS_PATH = path.join(DATA_DIR, "ratings.json");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

const PLAYER_COLORS = ["#f4b267", "#4cc9f0", "#f28482", "#84a59d", "#90be6d"];

const players = new Map();
const queue = [];
const matches = new Map();
const playerToMatch = new Map();
const ratingBook = new Map();

let nextMatchId = 1;
let saveTimer = null;

function now() {
  return Date.now();
}

function sanitizeNickname(input) {
  const fallback = "Player";
  if (!input || typeof input !== "string") return fallback;
  const trimmed = input.replace(/[\u0000-\u001f]/g, "").trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, 16);
}

function resolveGrade(rating) {
  if (rating >= 1800) return "Diamond";
  if (rating >= 1350) return "Platinum";
  if (rating >= 980) return "Gold";
  if (rating >= 700) return "Silver";
  return "Bronze";
}

function ensureProfile(playerId, nicknameHint) {
  const known = ratingBook.get(playerId);
  if (known) {
    if (nicknameHint && sanitizeNickname(nicknameHint) !== known.nickname) {
      known.nickname = sanitizeNickname(nicknameHint);
      known.updatedAt = now();
      scheduleSaveRatings();
    }
    return known;
  }

  const profile = {
    playerId,
    nickname: sanitizeNickname(nicknameHint),
    rating: 600,
    matches: 0,
    wins: 0,
    updatedAt: now(),
  };
  ratingBook.set(playerId, profile);
  scheduleSaveRatings();
  return profile;
}

function publicProfile(profile) {
  return {
    playerId: profile.playerId,
    nickname: profile.nickname,
    rating: profile.rating,
    grade: resolveGrade(profile.rating),
    matches: profile.matches,
    wins: profile.wins,
  };
}

function ensurePlayer(playerId, nicknameHint) {
  if (typeof playerId !== "string" || playerId.length < 6 || playerId.length > 80) {
    return null;
  }

  const profile = ensureProfile(playerId, nicknameHint);
  const existing = players.get(playerId);
  if (existing) {
    existing.nickname = profile.nickname;
    existing.lastSeenAt = now();
    return existing;
  }

  const player = {
    playerId,
    nickname: profile.nickname,
    lastSeenAt: now(),
  };
  players.set(playerId, player);
  return player;
}

function scheduleSaveRatings() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    await saveRatings();
  }, 400);
}

async function loadRatings() {
  try {
    const raw = await readFile(RATINGS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    for (const row of parsed) {
      if (!row || typeof row.playerId !== "string") continue;
      ratingBook.set(row.playerId, {
        playerId: row.playerId,
        nickname: sanitizeNickname(row.nickname),
        rating: Number(row.rating) || 600,
        matches: Number(row.matches) || 0,
        wins: Number(row.wins) || 0,
        updatedAt: Number(row.updatedAt) || now(),
      });
    }
  } catch {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

async function saveRatings() {
  await mkdir(DATA_DIR, { recursive: true });
  const rows = [...ratingBook.values()].sort((a, b) => b.rating - a.rating);
  await writeFile(RATINGS_PATH, JSON.stringify(rows, null, 2), "utf-8");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) {
      throw new Error("BodyTooLarge");
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

function queueIndexOf(playerId) {
  return queue.findIndex((entry) => entry.playerId === playerId);
}

function removeFromQueue(playerId) {
  const idx = queueIndexOf(playerId);
  if (idx >= 0) queue.splice(idx, 1);
}

function createRacePlayer(playerId, index, map) {
  const profile = ensureProfile(playerId);
  const spawn = map.spawn;
  return {
    playerId,
    nickname: profile.nickname,
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    x: spawn.x + index * 20,
    y: spawn.y,
    vx: 0,
    vy: 0,
    grounded: false,
    boostHeld: false,
    input: { left: false, right: false, boost: false },
    progress: 0,
    finishedAt: null,
    finishMs: null,
    rank: null,
    penaltyMs: 0,
  };
}

function pickMap() {
  const idx = Math.floor(Math.random() * MAPS.length);
  return MAPS[idx];
}

function createMatch(playerIds) {
  const map = pickMap();
  const id = `match-${nextMatchId++}`;
  const members = new Map();
  playerIds.forEach((playerId, idx) => {
    members.set(playerId, createRacePlayer(playerId, idx, map));
    playerToMatch.set(playerId, id);
  });

  const stamp = now();
  const match = {
    id,
    map,
    status: "running",
    reason: null,
    createdAt: stamp,
    startedAt: stamp,
    lastTickAt: stamp,
    finishedAt: null,
    players: members,
    results: [],
  };
  matches.set(id, match);
  return match;
}

function findRespawn(map, x) {
  let best = map.checkpoints[0];
  for (const point of map.checkpoints) {
    if (point.x <= x) best = point;
  }
  return best;
}

function circleRectCollision(circle, rect) {
  const nearX = clamp(circle.x, rect.x, rect.x + rect.w);
  const nearY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - nearX;
  const dy = circle.y - nearY;
  const distSq = dx * dx + dy * dy;
  const radiusSq = circle.r * circle.r;
  if (distSq >= radiusSq) return null;

  if (distSq === 0) {
    const left = Math.abs(circle.x - rect.x);
    const right = Math.abs(rect.x + rect.w - circle.x);
    const top = Math.abs(circle.y - rect.y);
    const bottom = Math.abs(rect.y + rect.h - circle.y);
    const min = Math.min(left, right, top, bottom);
    if (min === top) return { nx: 0, ny: -1, depth: circle.r + top };
    if (min === bottom) return { nx: 0, ny: 1, depth: circle.r + bottom };
    if (min === left) return { nx: -1, ny: 0, depth: circle.r + left };
    return { nx: 1, ny: 0, depth: circle.r + right };
  }

  const dist = Math.sqrt(distSq);
  return {
    nx: dx / dist,
    ny: dy / dist,
    depth: circle.r - dist,
  };
}

function resolveCollisions(player, map) {
  player.grounded = false;
  const circle = { x: player.x, y: player.y, r: PHYSICS.playerRadius };
  for (const rect of map.solids) {
    const hit = circleRectCollision(circle, rect);
    if (!hit) continue;

    player.x += hit.nx * hit.depth;
    player.y += hit.ny * hit.depth;
    circle.x = player.x;
    circle.y = player.y;

    const along = player.vx * hit.nx + player.vy * hit.ny;
    if (along < 0) {
      player.vx -= (1 + PHYSICS.bounce) * along * hit.nx;
      player.vy -= (1 + PHYSICS.bounce) * along * hit.ny;
    }

    if (hit.ny < -0.55) {
      player.grounded = true;
      if (Math.abs(player.vy) < 240) player.vy = -300;
    }
  }
}

function advancePlayer(player, map, dt, elapsedMs) {
  if (player.finishedAt) {
    player.progress = 1;
    return;
  }

  const accel = player.grounded ? PHYSICS.groundAccel : PHYSICS.airAccel;
  if (player.input.left) player.vx -= accel * dt;
  if (player.input.right) player.vx += accel * dt;
  player.vx = clamp(player.vx * PHYSICS.friction, -PHYSICS.maxVx, PHYSICS.maxVx);

  if (player.input.boost && !player.boostHeld && player.grounded) {
    player.vy = -PHYSICS.boostImpulse;
    player.grounded = false;
  }
  player.boostHeld = player.input.boost;

  player.vy += PHYSICS.gravity * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  resolveCollisions(player, map);

  player.x = clamp(player.x, PHYSICS.playerRadius, map.width - PHYSICS.playerRadius);

  if (player.y > FALL_RESPAWN_Y) {
    const respawn = findRespawn(map, player.x);
    player.x = respawn.x;
    player.y = respawn.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
    player.penaltyMs += FALL_PENALTY_MS;
  }

  const startX = map.spawn.x;
  const course = Math.max(1, map.finishX - startX);
  player.progress = clamp((player.x - startX) / course, 0, 0.999);

  if (player.x >= map.finishX) {
    player.finishedAt = now();
    player.finishMs = elapsedMs + player.penaltyMs;
    player.rank = -1;
    player.progress = 1;
    player.vx = 0;
    player.vy = 0;
  }
}

function finalizeMatch(match, reason) {
  if (match.status === "finished") return;
  match.status = "finished";
  match.reason = reason;
  match.finishedAt = now();

  const all = [...match.players.values()];
  const done = all.filter((p) => p.finishedAt).sort((a, b) => a.finishMs - b.finishMs);
  const notDone = all
    .filter((p) => !p.finishedAt)
    .sort((a, b) => b.progress - a.progress || b.x - a.x || a.penaltyMs - b.penaltyMs);

  const ordered = [...done, ...notDone];
  match.results = ordered.map((player, idx) => {
    const rank = idx + 1;
    const points = POINTS_BY_RANK[idx] ?? 5;
    player.rank = rank;

    const profile = ensureProfile(player.playerId);
    profile.rating += points;
    profile.matches += 1;
    if (rank === 1) profile.wins += 1;
    profile.updatedAt = now();

    return {
      playerId: player.playerId,
      nickname: profile.nickname,
      rank,
      points,
      finishMs: player.finishMs,
      progress: Number(player.progress.toFixed(3)),
      rating: profile.rating,
      grade: resolveGrade(profile.rating),
    };
  });
  scheduleSaveRatings();
}

function tickMatches() {
  const stamp = now();
  for (const match of matches.values()) {
    if (match.status !== "running") continue;
    const dt = Math.min(0.04, (stamp - match.lastTickAt) / 1000 || 0);
    match.lastTickAt = stamp;
    const elapsedMs = stamp - match.startedAt;

    for (const player of match.players.values()) {
      advancePlayer(player, match.map, dt, elapsedMs);
    }

    const doneCount = [...match.players.values()].filter((player) => player.finishedAt).length;
    if (doneCount === match.players.size) {
      finalizeMatch(match, "all-finished");
      continue;
    }

    if (elapsedMs >= match.map.timeLimitSec * 1000) {
      finalizeMatch(match, "timeout");
    }
  }
}

function runMatchmaking() {
  const stamp = now();
  for (let i = queue.length - 1; i >= 0; i -= 1) {
    const entry = queue[i];
    const player = players.get(entry.playerId);
    if (!player || stamp - player.lastSeenAt > STATE_STALE_MS) {
      queue.splice(i, 1);
    }
  }

  if (queue.length < MIN_PLAYERS_TO_START) return;

  const shouldStart =
    queue.length >= MAX_PLAYERS_PER_MATCH || stamp - queue[0].joinedAt >= QUEUE_WAIT_MS;
  if (!shouldStart) return;

  const bundle = queue.splice(0, Math.min(MAX_PLAYERS_PER_MATCH, queue.length));
  const playerIds = bundle.map((entry) => entry.playerId);
  createMatch(playerIds);
}

function cleanupStaleData() {
  const stamp = now();

  for (const [id, match] of matches.entries()) {
    if (match.status === "finished" && stamp - match.finishedAt > MATCH_RESULTS_KEEP_MS) {
      for (const playerId of match.players.keys()) {
        const mapped = playerToMatch.get(playerId);
        if (mapped === id) playerToMatch.delete(playerId);
      }
      matches.delete(id);
    }
  }
}

function getGlobalTop() {
  return [...ratingBook.values()]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10)
    .map(publicProfile);
}

function snapshotMatch(match) {
  const elapsedMs = now() - match.startedAt;
  const remainingMs = Math.max(0, match.map.timeLimitSec * 1000 - elapsedMs);
  const liveRanking = [...match.players.values()]
    .sort((a, b) => {
      if (a.finishedAt && b.finishedAt) return a.finishMs - b.finishMs;
      if (a.finishedAt) return -1;
      if (b.finishedAt) return 1;
      return b.progress - a.progress || b.x - a.x;
    })
    .map((player, idx) => ({
      playerId: player.playerId,
      nickname: player.nickname,
      rank: player.rank > 0 ? player.rank : idx + 1,
      progress: Number(player.progress.toFixed(3)),
      finishMs: player.finishMs,
    }));

  return {
    id: match.id,
    status: match.status,
    reason: match.reason,
    elapsedMs,
    remainingMs,
    map: {
      id: match.map.id,
      name: match.map.name,
      width: match.map.width,
      height: match.map.height,
      finishX: match.map.finishX,
      timeLimitSec: match.map.timeLimitSec,
      solids: match.map.solids,
      checkpoints: match.map.checkpoints,
    },
    players: [...match.players.values()].map((player) => ({
      playerId: player.playerId,
      nickname: player.nickname,
      color: player.color,
      x: Number(player.x.toFixed(2)),
      y: Number(player.y.toFixed(2)),
      vx: Number(player.vx.toFixed(2)),
      vy: Number(player.vy.toFixed(2)),
      progress: Number(player.progress.toFixed(3)),
      rank: player.rank,
      finishMs: player.finishMs,
    })),
    liveRanking,
    results: match.results,
  };
}

function buildState(playerId) {
  const profile = ensureProfile(playerId);
  const queuePos = queueIndexOf(playerId);
  const matchId = playerToMatch.get(playerId);
  const match = matchId ? matches.get(matchId) : null;
  if (matchId && !match) playerToMatch.delete(playerId);

  return {
    ok: true,
    serverTime: now(),
    profile: publicProfile(profile),
    queue: {
      inQueue: queuePos >= 0,
      playersWaiting: queue.length,
      position: queuePos >= 0 ? queuePos + 1 : null,
    },
    match: match ? snapshotMatch(match) : null,
    globalTop: getGlobalTop(),
  };
}

async function serveFile(reqPath, res) {
  const clean = reqPath === "/" ? "/index.html" : reqPath;
  const target = path.normalize(path.join(__dirname, clean));
  if (!target.startsWith(__dirname)) {
    sendJson(res, 400, { ok: false, error: "Invalid path" });
    return;
  }

  try {
    const fileInfo = await stat(target);
    if (!fileInfo.isFile()) {
      sendJson(res, 404, { ok: false, error: "Not found" });
      return;
    }
    const ext = path.extname(target);
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    const payload = await readFile(target);
    res.writeHead(200, { "Content-Type": mime });
    res.end(payload);
  } catch {
    sendJson(res, 404, { ok: false, error: "Not found" });
  }
}

async function handleApi(req, res, urlObj) {
  if (urlObj.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, status: "up", players: players.size, queue: queue.length });
    return;
  }

  if (req.method === "POST" && urlObj.pathname === "/api/register") {
    try {
      const body = await readBody(req);
      const player = ensurePlayer(body.playerId, body.nickname);
      if (!player) {
        sendJson(res, 400, { ok: false, error: "Invalid player id" });
        return;
      }
      const profile = ensureProfile(player.playerId, body.nickname);
      player.nickname = profile.nickname;
      sendJson(res, 200, { ok: true, profile: publicProfile(profile) });
    } catch {
      sendJson(res, 400, { ok: false, error: "Invalid request" });
    }
    return;
  }

  if (req.method === "GET" && urlObj.pathname === "/api/state") {
    const playerId = urlObj.searchParams.get("playerId") || "";
    const player = ensurePlayer(playerId);
    if (!player) {
      sendJson(res, 400, { ok: false, error: "Invalid player id" });
      return;
    }
    sendJson(res, 200, buildState(player.playerId));
    return;
  }

  if (req.method === "POST" && urlObj.pathname === "/api/queue/join") {
    try {
      const body = await readBody(req);
      const player = ensurePlayer(body.playerId, body.nickname);
      if (!player) {
        sendJson(res, 400, { ok: false, error: "Invalid player id" });
        return;
      }

      const matchId = playerToMatch.get(player.playerId);
      if (matchId) {
        const match = matches.get(matchId);
        if (match && match.status === "running") {
          sendJson(res, 409, { ok: false, error: "Match already running" });
          return;
        }
        playerToMatch.delete(player.playerId);
      }

      if (queueIndexOf(player.playerId) === -1) {
        queue.push({ playerId: player.playerId, joinedAt: now() });
      }
      sendJson(res, 200, { ok: true, queued: true });
    } catch {
      sendJson(res, 400, { ok: false, error: "Invalid request" });
    }
    return;
  }

  if (req.method === "POST" && urlObj.pathname === "/api/queue/leave") {
    try {
      const body = await readBody(req);
      const player = ensurePlayer(body.playerId);
      if (!player) {
        sendJson(res, 400, { ok: false, error: "Invalid player id" });
        return;
      }
      removeFromQueue(player.playerId);
      sendJson(res, 200, { ok: true, queued: false });
    } catch {
      sendJson(res, 400, { ok: false, error: "Invalid request" });
    }
    return;
  }

  if (req.method === "POST" && urlObj.pathname === "/api/input") {
    try {
      const body = await readBody(req);
      const player = ensurePlayer(body.playerId);
      if (!player) {
        sendJson(res, 400, { ok: false, error: "Invalid player id" });
        return;
      }
      const matchId = playerToMatch.get(player.playerId);
      if (!matchId) {
        sendJson(res, 200, { ok: true, ignored: true });
        return;
      }
      const match = matches.get(matchId);
      if (!match || match.status !== "running") {
        sendJson(res, 200, { ok: true, ignored: true });
        return;
      }
      const racer = match.players.get(player.playerId);
      if (!racer) {
        sendJson(res, 200, { ok: true, ignored: true });
        return;
      }
      racer.input.left = Boolean(body.left);
      racer.input.right = Boolean(body.right);
      racer.input.boost = Boolean(body.boost);
      sendJson(res, 200, { ok: true });
    } catch {
      sendJson(res, 400, { ok: false, error: "Invalid request" });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Unknown API route" });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  res.setHeader("Cache-Control", "no-store");

  if (requestUrl.pathname.startsWith("/api/")) {
    await handleApi(req, res, requestUrl);
    return;
  }

  await serveFile(requestUrl.pathname, res);
});

await loadRatings();
setInterval(tickMatches, TICK_MS);
setInterval(runMatchmaking, 1000);
setInterval(cleanupStaleData, 5000);

server.listen(PORT, () => {
  console.log(`Bounce Arena server listening on http://localhost:${PORT}`);
});

