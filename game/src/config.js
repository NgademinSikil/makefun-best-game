// NOVA DRIFT — tuning, palette and field. One place for every number the game plays by.
export const BEST_KEY = 'nova-drift-best';

export const STEP = 1 / 60;

export const FIELD = { width: 1280, height: 720 };

export const SHIP = {
  radius: 16,
  accel: 1500, // thrust, px/s^2
  maxSpeed: 420,
  drag: 1.6, // velocity retained per second when not thrusting (exponential)
  turn: 14, // aim smoothing, per second
  fireInterval: 0.16,
  rapidInterval: 0.085,
  invulnerable: 2.2, // seconds of mercy after a hit
  bulletSpeed: 760,
  bulletLife: 0.85,
};

export const LIVES = 3;

/** Win the sector by reaching this level; the game then offers endless play. */
export const WIN_LEVEL = 6;
/** Seconds of survival per level, and kills that also push the level up. */
export const LEVEL = { seconds: 22, killsPerLevel: 14, max: 12 };

export const ASTEROID = {
  // radius / hull per size class: 0 large, 1 medium, 2 small
  radius: [52, 30, 17],
  hull: [3, 2, 1],
  score: [50, 30, 20],
  speed: [55, 95, 150],
  speedPerLevel: 7,
  interval: 1.2, // seconds between spawns at level 1
  minInterval: 0.42,
  intervalScale: 0.88, // per level
  gemChance: 0.55, // a destroyed asteroid drops a star shard
  powerChance: 0.07, // ...or, rarely, a power-up
};

export const SEEKER = {
  radius: 15,
  hull: 1,
  score: 80,
  speed: 120,
  speedPerLevel: 9,
  firstLevel: 3, // seekers join from level 3
  interval: 7,
  minInterval: 3.5,
};

export const GEM = { radius: 9, score: 25, magnet: 170, collect: 30, life: 14 };
export const POWERUP = { radius: 15, life: 12, duration: 10 }; // shield lasts until hit

export const COMBO = { window: 4, max: 8 }; // x1..x8, refreshed by kills and pickups

export const POOL = { bullets: 48, asteroids: 40, seekers: 12, gems: 48, powerups: 6, particles: 320, popups: 24 };

export const PALETTE = {
  backdrop: '#05060f',
  nebulaA: '#1b1040',
  nebulaB: '#0a2a4a',
  nebulaC: '#3d0f3d',
  star: '#cfe6ff',
  ship: '#7df9ff',
  shipCore: '#eafcff',
  flame: '#ffb347',
  bullet: '#aefcff',
  asteroid: '#8d7d9b',
  asteroidEdge: '#c9b8d9',
  seeker: '#ff5d7a',
  seekerCore: '#ffd166',
  gem: '#ffd94d',
  shield: '#59c2ff',
  rapid: '#ff9f43',
  spread: '#c77dff',
  text: '#eaf6ff',
  muted: '#9db8d6',
  danger: '#ff5d7a',
  gold: '#ffd94d',
  panel: 'rgba(8, 12, 34, 0.88)',
  panelEdge: 'rgba(125, 249, 255, 0.55)',
};

export const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
