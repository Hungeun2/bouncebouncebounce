export const PHYSICS = {
  tile: 40,
  playerRadius: 13,
  gravity: 1780,
  groundAccel: 2200,
  airAccel: 1500,
  maxVx: 920,
  friction: 0.97,
  bounce: 0.68,
  boostImpulse: 1320,
};

const WORLD_HEIGHT = 720;
const WALL = 40;

const BASE_MAPS = [
  {
    id: "citrus-drift",
    name: "Citrus Drift",
    width: 3000,
    timeLimitSec: 95,
    spawn: { x: 120, y: 560 },
    finishX: 2740,
    checkpoints: [
      { x: 120, y: 560 },
      { x: 780, y: 540 },
      { x: 1560, y: 520 },
      { x: 2260, y: 500 },
    ],
    platforms: [
      { x: 0, y: 640, w: 620, h: 40 },
      { x: 700, y: 640, w: 540, h: 40 },
      { x: 1360, y: 640, w: 560, h: 40 },
      { x: 2020, y: 640, w: 520, h: 40 },
      { x: 2600, y: 640, w: 400, h: 40 },
      { x: 360, y: 560, w: 140, h: 40 },
      { x: 620, y: 500, w: 140, h: 40 },
      { x: 860, y: 460, w: 180, h: 40 },
      { x: 1120, y: 500, w: 180, h: 40 },
      { x: 1420, y: 460, w: 180, h: 40 },
      { x: 1700, y: 500, w: 180, h: 40 },
      { x: 1960, y: 440, w: 180, h: 40 },
      { x: 2240, y: 500, w: 160, h: 40 },
      { x: 2460, y: 440, w: 160, h: 40 },
    ],
  },
  {
    id: "harbor-hop",
    name: "Harbor Hop",
    width: 3200,
    timeLimitSec: 100,
    spawn: { x: 120, y: 560 },
    finishX: 2920,
    checkpoints: [
      { x: 120, y: 560 },
      { x: 880, y: 520 },
      { x: 1740, y: 500 },
      { x: 2400, y: 520 },
    ],
    platforms: [
      { x: 0, y: 640, w: 500, h: 40 },
      { x: 580, y: 640, w: 460, h: 40 },
      { x: 1120, y: 640, w: 480, h: 40 },
      { x: 1700, y: 640, w: 420, h: 40 },
      { x: 2200, y: 640, w: 500, h: 40 },
      { x: 2800, y: 640, w: 400, h: 40 },
      { x: 360, y: 540, w: 160, h: 40 },
      { x: 620, y: 460, w: 160, h: 40 },
      { x: 900, y: 500, w: 140, h: 40 },
      { x: 1180, y: 420, w: 180, h: 40 },
      { x: 1440, y: 500, w: 160, h: 40 },
      { x: 1700, y: 420, w: 180, h: 40 },
      { x: 1980, y: 500, w: 160, h: 40 },
      { x: 2240, y: 420, w: 200, h: 40 },
      { x: 2520, y: 500, w: 160, h: 40 },
      { x: 2760, y: 440, w: 160, h: 40 },
    ],
  },
  {
    id: "summit-sprint",
    name: "Summit Sprint",
    width: 3300,
    timeLimitSec: 100,
    spawn: { x: 120, y: 560 },
    finishX: 3020,
    checkpoints: [
      { x: 120, y: 560 },
      { x: 920, y: 520 },
      { x: 1840, y: 460 },
      { x: 2480, y: 420 },
    ],
    platforms: [
      { x: 0, y: 640, w: 560, h: 40 },
      { x: 680, y: 640, w: 520, h: 40 },
      { x: 1320, y: 640, w: 500, h: 40 },
      { x: 1900, y: 640, w: 520, h: 40 },
      { x: 2540, y: 640, w: 520, h: 40 },
      { x: 3140, y: 640, w: 160, h: 40 },
      { x: 420, y: 560, w: 160, h: 40 },
      { x: 700, y: 500, w: 180, h: 40 },
      { x: 980, y: 440, w: 160, h: 40 },
      { x: 1240, y: 500, w: 180, h: 40 },
      { x: 1520, y: 420, w: 160, h: 40 },
      { x: 1760, y: 360, w: 180, h: 40 },
      { x: 2040, y: 440, w: 160, h: 40 },
      { x: 2300, y: 520, w: 180, h: 40 },
      { x: 2560, y: 440, w: 160, h: 40 },
      { x: 2820, y: 360, w: 180, h: 40 },
    ],
  },
  {
    id: "metro-bounce",
    name: "Metro Bounce",
    width: 3000,
    timeLimitSec: 95,
    spawn: { x: 120, y: 560 },
    finishX: 2740,
    checkpoints: [
      { x: 120, y: 560 },
      { x: 800, y: 520 },
      { x: 1600, y: 480 },
      { x: 2240, y: 480 },
    ],
    platforms: [
      { x: 0, y: 640, w: 640, h: 40 },
      { x: 760, y: 640, w: 540, h: 40 },
      { x: 1400, y: 640, w: 560, h: 40 },
      { x: 2040, y: 640, w: 520, h: 40 },
      { x: 2660, y: 640, w: 340, h: 40 },
      { x: 380, y: 560, w: 160, h: 40 },
      { x: 620, y: 500, w: 140, h: 40 },
      { x: 880, y: 440, w: 180, h: 40 },
      { x: 1160, y: 500, w: 160, h: 40 },
      { x: 1420, y: 560, w: 160, h: 40 },
      { x: 1680, y: 500, w: 180, h: 40 },
      { x: 1960, y: 420, w: 180, h: 40 },
      { x: 2240, y: 340, w: 180, h: 40 },
      { x: 2520, y: 420, w: 160, h: 40 },
      { x: 2760, y: 500, w: 160, h: 40 },
    ],
  },
];

function withBounds(map) {
  const solids = [
    { x: 0, y: WORLD_HEIGHT - WALL, w: map.width, h: WALL },
    { x: 0, y: 0, w: WALL, h: WORLD_HEIGHT },
    { x: map.width - WALL, y: 0, w: WALL, h: WORLD_HEIGHT },
    ...map.platforms.map((platform) => ({ ...platform })),
  ].sort((a, b) => a.x - b.x);

  return {
    ...map,
    height: WORLD_HEIGHT,
    wall: WALL,
    solids,
  };
}

export const MAPS = BASE_MAPS.map(withBounds);

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
