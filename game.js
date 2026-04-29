const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const toast = document.querySelector("#toast");
const resetButton = document.querySelector("#resetButton");
const stageButtons = [...document.querySelectorAll(".stage-tab")];

const TILE = 40;
const WORLD = { cols: 24, rows: 16, width: 960, height: 640 };
const GRAVITY = 1750;
const FRICTION = 0.985;
const MOVE_ACCEL = 1120;
const AIR_ACCEL = 720;
const MAX_VX = 520;
const BOUNCE = 0.72;
const BOOST = 620;

const input = {
  left: false,
  right: false,
  boost: false,
};

const stages = [
  {
    name: "Warm Up",
    start: { x: 72, y: 470 },
    goal: { x: 838, y: 454, w: 72, h: 86 },
    map: [
      "########################",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#...................##.#",
      "#...........#####...##.#",
      "#.......####........##.#",
      "#....###...............#",
      "#..##..................#",
      "#......................#",
      "########################",
      "########################",
    ],
  },
  {
    name: "Pocket Run",
    start: { x: 72, y: 430 },
    goal: { x: 832, y: 166, w: 72, h: 82 },
    map: [
      "########################",
      "#......................#",
      "#......................#",
      "#....................###",
      "#.................##...#",
      "#..............##......#",
      "#..........##..........#",
      "#.......##.............#",
      "#......................#",
      "#..####.......###......#",
      "#......##........##....#",
      "#........##............#",
      "#..........###.....##..#",
      "#......................#",
      "#####...########...#####",
      "########################",
    ],
  },
  {
    name: "High Wall",
    start: { x: 72, y: 470 },
    goal: { x: 842, y: 72, w: 70, h: 78 },
    map: [
      "########################",
      "#......................#",
      "#...................#..#",
      "#.................###..#",
      "#..............##......#",
      "#...........##.........#",
      "#........##............#",
      "#.....##...............#",
      "#......................#",
      "#..###.................#",
      "#.........####.........#",
      "#..................###.#",
      "#.....###..............#",
      "#......................#",
      "############..##########",
      "########################",
    ],
  },
];

let activeStage = 0;
let solids = [];
let lastTime = 0;
let toastTimer = 0;
let cameraShake = 0;

const ball = {
  x: 0,
  y: 0,
  r: 15,
  vx: 0,
  vy: 0,
  grounded: false,
  trail: [],
};

function tileRects(map) {
  const rects = [];
  for (let y = 0; y < map.length; y += 1) {
    let runStart = -1;
    for (let x = 0; x <= map[y].length; x += 1) {
      const filled = map[y][x] === "#";
      if (filled && runStart === -1) runStart = x;
      if ((!filled || x === map[y].length) && runStart !== -1) {
        rects.push({
          x: runStart * TILE,
          y: y * TILE,
          w: (x - runStart) * TILE,
          h: TILE,
        });
        runStart = -1;
      }
    }
  }
  return rects;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1400);
}

function setStage(index, announce = true) {
  activeStage = (index + stages.length) % stages.length;
  solids = tileRects(stages[activeStage].map);
  const { start } = stages[activeStage];
  ball.x = start.x;
  ball.y = start.y;
  ball.vx = 0;
  ball.vy = 0;
  ball.grounded = false;
  ball.trail = [];
  stageButtons.forEach((button, idx) => {
    button.classList.toggle("is-active", idx === activeStage);
    button.setAttribute("aria-pressed", String(idx === activeStage));
  });
  if (announce) showToast(`Stage ${activeStage + 1}: ${stages[activeStage].name}`);
}

function resize() {
  const ratio = window.devicePixelRatio || 1;
  const box = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(box.width * ratio));
  canvas.height = Math.max(1, Math.floor(box.height * ratio));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function circleRectCollision(circle, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= circle.r * circle.r) return null;

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

function resolveCollisions() {
  ball.grounded = false;
  for (const rect of solids) {
    const hit = circleRectCollision(ball, rect);
    if (!hit) continue;

    ball.x += hit.nx * hit.depth;
    ball.y += hit.ny * hit.depth;

    const velocityAlongNormal = ball.vx * hit.nx + ball.vy * hit.ny;
    if (velocityAlongNormal < 0) {
      ball.vx -= (1 + BOUNCE) * velocityAlongNormal * hit.nx;
      ball.vy -= (1 + BOUNCE) * velocityAlongNormal * hit.ny;
    }

    if (hit.ny < -0.62) {
      ball.grounded = true;
      if (Math.abs(ball.vy) < 260) ball.vy = -360;
      cameraShake = Math.min(7, cameraShake + 1.5);
    }
  }
}

function update(dt) {
  const accel = ball.grounded ? MOVE_ACCEL : AIR_ACCEL;
  if (input.left) ball.vx -= accel * dt;
  if (input.right) ball.vx += accel * dt;
  ball.vx = clamp(ball.vx * FRICTION, -MAX_VX, MAX_VX);

  if (input.boost && ball.grounded) {
    ball.vy = -BOOST;
    ball.grounded = false;
    cameraShake = 6;
  }

  ball.vy += GRAVITY * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  resolveCollisions();

  if (ball.y > WORLD.height + 140) {
    showToast("다시 튕겨볼까요?");
    setStage(activeStage, false);
  }

  const goal = stages[activeStage].goal;
  const inGoal =
    ball.x + ball.r > goal.x &&
    ball.x - ball.r < goal.x + goal.w &&
    ball.y + ball.r > goal.y &&
    ball.y - ball.r < goal.y + goal.h;

  if (inGoal) {
    if (activeStage === stages.length - 1) {
      showToast("All clear. Nice bounce!");
      setStage(0, false);
    } else {
      setStage(activeStage + 1);
    }
  }

  ball.trail.push({ x: ball.x, y: ball.y });
  if (ball.trail.length > 18) ball.trail.shift();
  cameraShake *= Math.pow(0.02, dt);
}

function drawTile(x, y, w, h) {
  const cols = Math.floor(w / TILE);
  for (let i = 0; i < cols; i += 1) {
    const tx = x + i * TILE;
    ctx.fillStyle = "#c77d57";
    ctx.fillRect(tx + 2, y + 2, TILE - 4, h - 4);
    ctx.fillStyle = "#f1b07d";
    ctx.fillRect(tx + 5, y + 5, TILE - 10, 4);
    ctx.fillRect(tx + 5, y + 5, 4, TILE - 10);
    ctx.fillStyle = "#6e3d31";
    ctx.fillRect(tx + 7, y + 13, TILE - 14, TILE - 20);
    ctx.strokeStyle = "#2b1714";
    ctx.lineWidth = 2;
    ctx.strokeRect(tx + 8, y + 14, TILE - 16, TILE - 22);
    ctx.fillStyle = "rgba(255, 238, 204, 0.22)";
    ctx.fillRect(tx + 14, y + 18, 9, 3);
    ctx.fillRect(tx + 26, y + 24, 5, 8);
  }
}

function drawBackdrop() {
  ctx.fillStyle = "#020203";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.strokeStyle = "rgba(75, 67, 72, 0.34)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(40, 548);
  ctx.lineTo(108, 612);
  ctx.lineTo(176, 494);
  ctx.quadraticCurveTo(220, 432, 272, 452);
  ctx.quadraticCurveTo(334, 328, 418, 372);
  ctx.quadraticCurveTo(500, 246, 594, 318);
  ctx.quadraticCurveTo(638, 220, 710, 282);
  ctx.lineTo(758, 238);
  ctx.lineTo(802, 318);
  ctx.quadraticCurveTo(850, 408, 862, 562);
  ctx.stroke();

  ctx.strokeStyle = "rgba(102, 217, 199, 0.11)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= WORLD.width; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD.height);
    ctx.stroke();
  }
}

function drawGoal(goal) {
  const pulse = 0.5 + Math.sin(performance.now() * 0.006) * 0.5;
  ctx.fillStyle = "rgba(102, 217, 199, 0.14)";
  ctx.fillRect(goal.x - 8, goal.y - 8, goal.w + 16, goal.h + 16);
  ctx.strokeStyle = `rgba(102, 217, 199, ${0.55 + pulse * 0.35})`;
  ctx.lineWidth = 4;
  ctx.strokeRect(goal.x, goal.y, goal.w, goal.h);
  ctx.fillStyle = "#f3eadf";
  ctx.font = "700 18px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.fillText("GOAL", goal.x + goal.w / 2, goal.y + goal.h / 2 + 6);
}

function drawBall() {
  for (let i = 0; i < ball.trail.length; i += 1) {
    const p = ball.trail[i];
    const alpha = i / ball.trail.length;
    ctx.fillStyle = `rgba(246, 195, 95, ${alpha * 0.18})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, ball.r * alpha, 0, Math.PI * 2);
    ctx.fill();
  }

  const gradient = ctx.createRadialGradient(
    ball.x - 6,
    ball.y - 7,
    3,
    ball.x,
    ball.y,
    ball.r + 4,
  );
  gradient.addColorStop(0, "#fff4cf");
  gradient.addColorStop(0.34, "#f6c35f");
  gradient.addColorStop(1, "#b74638");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#321712";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function draw() {
  const sx = canvas.width / WORLD.width;
  const sy = canvas.height / WORLD.height;
  const scale = Math.min(sx, sy);
  const offsetX = (canvas.width - WORLD.width * scale) / 2;
  const offsetY = (canvas.height - WORLD.height * scale) / 2;
  const shakeX = (Math.random() - 0.5) * cameraShake;
  const shakeY = (Math.random() - 0.5) * cameraShake;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawBackdrop();
  drawGoal(stages[activeStage].goal);
  solids.forEach((rect) => drawTile(rect.x, rect.y, rect.w, rect.h));
  drawBall();

  ctx.fillStyle = "rgba(243, 234, 223, 0.86)";
  ctx.font = "700 18px ui-sans-serif, system-ui";
  ctx.textAlign = "left";
  ctx.fillText(`STAGE ${activeStage + 1}`, 22, 72);
  ctx.fillStyle = "rgba(185, 170, 159, 0.8)";
  ctx.font = "500 14px ui-sans-serif, system-ui";
  ctx.fillText(stages[activeStage].name, 22, 94);

  ctx.restore();
}

function loop(now) {
  const dt = Math.min(0.024, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function bindHold(button, key) {
  const set = (value) => {
    input[key] = value;
    button.classList.toggle("is-pressed", value);
  };

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    set(true);
  });
  button.addEventListener("pointerup", () => set(false));
  button.addEventListener("pointercancel", () => set(false));
  button.addEventListener("lostpointercapture", () => set(false));
}

function bindControls() {
  bindHold(document.querySelector("#leftButton"), "left");
  bindHold(document.querySelector("#rightButton"), "right");
  bindHold(document.querySelector("#boostButton"), "boost");

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") input.left = true;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") input.right = true;
    if (event.key === " " || event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
      input.boost = true;
      event.preventDefault();
    }
    if (event.key.toLowerCase() === "r") setStage(activeStage);
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") input.left = false;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") input.right = false;
    if (event.key === " " || event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
      input.boost = false;
    }
  });

  resetButton.addEventListener("click", () => setStage(activeStage));
  stageButtons.forEach((button) => {
    button.addEventListener("click", () => setStage(Number(button.dataset.stage)));
  });
}

window.addEventListener("resize", resize);
window.addEventListener("orientationchange", resize);

bindControls();
resize();
setStage(0, false);
showToast("좌우 이동 + BOOST로 골인!");
requestAnimationFrame(loop);
