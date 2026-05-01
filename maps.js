export const PHYSICS = {
  tile: 40,
  playerRadius: 14,
  gravity: 1760,
  groundAccel: 1220,
  airAccel: 760,
  maxVx: 520,
  friction: 0.985,
  bounce: 0.68,
  boostImpulse: 670,
};

const WORLD_HEIGHT = 720;
const WALL = 40;

const BASE_MAPS = [
  {
    id: "citrus-drift",
    name: "Citrus Drift",
    width: 4200,
    timeLimitSec: 150,
    spawn: { x: 120, y: 560 },
    finishX: 3960,
    checkpoints: [
      { x: 120, y: 560 },
      { x: 1120, y: 540 },
      { x: 2160, y: 520 },
      { x: 3180, y: 500 },
    ],
    platforms: [
      { x: 0, y: 640, w: 760, h: 40 },
      { x: 840, y: 640, w: 620, h: 40 },
      { x: 1580, y: 640, w: 760, h: 40 },
      { x: 2480, y: 640, w: 640, h: 40 },
      { x: 3260, y: 640, w: 940, h: 40 },
      { x: 480, y: 560, w: 160, h: 40 },
      { x: 760, y: 520, w: 160, h: 40 },
      { x: 1000, y: 480, w: 200, h: 40 },
      { x: 1320, y: 520, w: 200, h: 40 },
      { x: 1640, y: 480, w: 220, h: 40 },
      { x: 1960, y: 520, w: 180, h: 40 },
      { x: 2280, y: 460, w: 220, h: 40 },
      { x: 2600, y: 520, w: 180, h: 40 },
      { x: 2840, y: 460, w: 220, h: 40 },
      { x: 3120, y: 500, w: 220, h: 40 },
      { x: 3420, y: 420, w: 240, h: 40 },
      { x: 3720, y: 500, w: 220, h: 40 },
    ],
  },
  {
    id: "harbor-hop",
    name: "Harbor Hop",
    width: 4400,
    timeLimitSec: 155,
    spawn: { x: 120, y: 560 },
    finishX: 4120,
    checkpoints: [
      { x: 120, y: 560 },
      { x: 1260, y: 520 },
      { x: 2380, y: 500 },
      { x: 3360, y: 520 },
    ],
    platforms: [
      { x: 0, y: 640, w: 540, h: 40 },
      { x: 620, y: 640, w: 500, h: 40 },
      { x: 1200, y: 640, w: 520, h: 40 },
      { x: 1820, y: 640, w: 480, h: 40 },
      { x: 2400, y: 640, w: 560, h: 40 },
      { x: 3060, y: 640, w: 520, h: 40 },
      { x: 3680, y: 640, w: 720, h: 40 },
      { x: 460, y: 540, w: 180, h: 40 },
      { x: 740, y: 460, w: 180, h: 40 },
      { x: 1040, y: 500, w: 160, h: 40 },
      { x: 1320, y: 420, w: 220, h: 40 },
      { x: 1640, y: 500, w: 180, h: 40 },
      { x: 1920, y: 420, w: 220, h: 40 },
      { x: 2240, y: 500, w: 180, h: 40 },
      { x: 2520, y: 420, w: 240, h: 40 },
      { x: 2860, y: 500, w: 180, h: 40 },
      { x: 3120, y: 560, w: 180, h: 40 },
      { x: 3400, y: 460, w: 220, h: 40 },
      { x: 3720, y: 380, w: 240, h: 40 },
      { x: 3980, y: 500, w: 180, h: 40 },
    ],
  },
  {
    id: "summit-sprint",
    name: "Summit Sprint",
    width: 4600,
    timeLimitSec: 160,
    spawn: { x: 120, y: 560 },
    finishX: 4320,
    checkpoints: [
      { x: 120, y: 560 },
      { x: 1380, y: 520 },
      { x: 2500, y: 460 },
      { x: 3500, y: 420 },
    ],
    platforms: [
      { x: 0, y: 640, w: 700, h: 40 },
      { x: 820, y: 640, w: 620, h: 40 },
      { x: 1540, y: 640, w: 600, h: 40 },
      { x: 2260, y: 640, w: 700, h: 40 },
      { x: 3100, y: 640, w: 620, h: 40 },
      { x: 3860, y: 640, w: 740, h: 40 },
      { x: 520, y: 560, w: 180, h: 40 },
      { x: 820, y: 500, w: 220, h: 40 },
      { x: 1140, y: 440, w: 200, h: 40 },
      { x: 1460, y: 500, w: 220, h: 40 },
      { x: 1780, y: 420, w: 200, h: 40 },
      { x: 2080, y: 360, w: 220, h: 40 },
      { x: 2400, y: 440, w: 200, h: 40 },
      { x: 2680, y: 520, w: 220, h: 40 },
      { x: 3000, y: 440, w: 200, h: 40 },
      { x: 3280, y: 360, w: 220, h: 40 },
      { x: 3600, y: 440, w: 200, h: 40 },
      { x: 3880, y: 340, w: 240, h: 40 },
      { x: 4200, y: 440, w: 220, h: 40 },
    ],
  },
  {
    id: "metro-bounce",
    name: "Metro Bounce",
    width: 4300,
    timeLimitSec: 150,
    spawn: { x: 120, y: 560 },
    finishX: 4040,
    checkpoints: [
      { x: 120, y: 560 },
      { x: 1080, y: 520 },
      { x: 2140, y: 480 },
      { x: 3140, y: 480 },
    ],
    platforms: [
      { x: 0, y: 640, w: 840, h: 40 },
      { x: 960, y: 640, w: 680, h: 40 },
      { x: 1760, y: 640, w: 760, h: 40 },
      { x: 2640, y: 640, w: 620, h: 40 },
      { x: 3400, y: 640, w: 900, h: 40 },
      { x: 420, y: 560, w: 180, h: 40 },
      { x: 680, y: 500, w: 160, h: 40 },
      { x: 940, y: 440, w: 200, h: 40 },
      { x: 1240, y: 500, w: 180, h: 40 },
      { x: 1520, y: 560, w: 180, h: 40 },
      { x: 1800, y: 500, w: 200, h: 40 },
      { x: 2120, y: 420, w: 200, h: 40 },
      { x: 2420, y: 340, w: 220, h: 40 },
      { x: 2740, y: 420, w: 200, h: 40 },
      { x: 3040, y: 500, w: 200, h: 40 },
      { x: 3340, y: 420, w: 200, h: 40 },
      { x: 3640, y: 340, w: 220, h: 40 },
      { x: 3940, y: 420, w: 220, h: 40 },
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

