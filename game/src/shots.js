// The screenshot scenes behind ?shot=start|play|action|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by an autopilot (flee the
// nearest rock, chase shards, aim ahead of the nearest target and fire), so the frame is what
// a short game really looks like and the same seed always gives the same frame. For the play
// and action scenes a probe world runs first and finds the liveliest moment (most explosion
// particles); the real world is then played to exactly that step, so the shot is a genuine
// frame of the game, not a posed one. The end scene's pilot is clumsy on purpose, so it is
// caught out once the rocks speed up, as a hurried player is.
import { FIELD, SHIP, STEP } from './config.js';
import { createRandom } from './random.js';
import { EVENT_OVER, createWorld } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 30;
const ACTION_SECONDS = 48;
const END_LIMIT_SECONDS = 600;

/** Steer and shoot like a player: flee close rocks, chase shards, lead the target. */
function pilot(state, skill) {
  const ship = state.ship;
  let target = null;
  let targetD = Infinity;
  for (const a of state.asteroids) {
    if (!a.active) continue;
    const d = Math.hypot(a.x - ship.x, a.y - ship.y);
    if (d < targetD) { targetD = d; target = a; }
  }
  for (const s of state.seekers) {
    if (!s.active) continue;
    const d = Math.hypot(s.x - ship.x, s.y - ship.y);
    if (d < targetD) { targetD = d; target = s; }
  }
  let mx = 0;
  let my = 0;
  let threat = null;
  let threatD = Infinity;
  for (const a of state.asteroids) {
    if (!a.active) continue;
    const d = Math.hypot(a.x - ship.x, a.y - ship.y);
    if (d < threatD) { threatD = d; threat = a; }
  }
  for (const s of state.seekers) {
    if (!s.active) continue;
    const d = Math.hypot(s.x - ship.x, s.y - ship.y);
    if (d < threatD) { threatD = d; threat = s; }
  }
  if (skill > 0.5 && threat && threatD < 210) {
    const d = threatD || 1;
    mx = (ship.x - threat.x) / d;
    my = (ship.y - threat.y) / d;
  } else if (skill > 0.5) {
    let gem = null;
    let gemD = 420;
    for (const g of state.gems) {
      if (!g.active) continue;
      const d = Math.hypot(g.x - ship.x, g.y - ship.y);
      if (d < gemD) { gemD = d; gem = g; }
    }
    if (gem) {
      mx = (gem.x - ship.x) / (gemD || 1);
      my = (gem.y - ship.y) / (gemD || 1);
    } else if (target && targetD > 320) {
      mx = (target.x - ship.x) / targetD;
      my = (target.y - ship.y) / targetD;
    } else {
      mx = (FIELD.width / 2 - ship.x) / FIELD.width;
      my = (FIELD.height / 2 - ship.y) / FIELD.height;
    }
  } else {
    // Clumsy pilot: drifts in a slow circle and never dodges.
    mx = Math.cos(state.elapsed * 0.5) * 0.5;
    my = Math.sin(state.elapsed * 0.5) * 0.5;
  }
  const len = Math.hypot(mx, my) || 1;
  mx /= len;
  my /= len;
  let aimX = ship.x + Math.cos(ship.angle) * 200;
  let aimY = ship.y + Math.sin(ship.angle) * 200;
  let firing = false;
  if (target) {
    const flight = targetD / SHIP.bulletSpeed;
    const vx = target.vx ?? 0;
    const vy = target.vy ?? 0;
    aimX = target.x + vx * flight;
    aimY = target.y + vy * flight;
    firing = skill > 0.5 ? targetD < 560 : Math.sin(state.elapsed * 7) > 0.7;
  }
  return { mx, my, aimX, aimY, firing };
}

function countParticles(state) {
  let n = 0;
  for (const p of state.particles) if (p.active) n += 1;
  return n;
}

/** Play `world` forward `seconds` with the pilot; return the step with the most particles. */
function liveliestStep(world, seconds, skill) {
  let bestStep = 0;
  let bestCount = -1;
  const total = Math.floor(seconds / STEP);
  for (let i = 0; i < total; i += 1) {
    if (world.step(STEP, pilot(world.state, skill), false) & EVENT_OVER) break;
    const n = countParticles(world.state);
    if (n > bestCount) {
      bestCount = n;
      bestStep = i + 1;
    }
  }
  return bestStep;
}

/**
 * Set `world` to the named scene (start, play, action or end; any other name is start) and
 * return the screen to draw over it and the best score to show. `seed` replays the same run.
 */
export function stageShot(name, world, seed) {
  world.reset();
  if (name !== 'play' && name !== 'action' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { mx: 0, my: 0, aimX: FIELD.width / 2, aimY: FIELD.height / 2, firing: false }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'end') {
    const limit = END_LIMIT_SECONDS;
    for (let i = 0; i < limit / STEP; i += 1) {
      if (world.step(STEP, pilot(world.state, 0), false) & EVENT_OVER) break;
    }
    return { screen: world.state.lives === 0 ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  const seconds = name === 'action' ? ACTION_SECONDS : PLAY_SECONDS;
  const probe = createWorld(createRandom(seed));
  probe.reset();
  const bestStep = liveliestStep(probe, seconds, 1);
  // No second reset here: the probe ran after two resets (creation + the explicit one),
  // and so has this world (creation in main.js + the reset at the top of stageShot), so
  // the replay below follows the probe's run step for step.
  for (let i = 0; i < bestStep; i += 1) world.step(STEP, pilot(world.state, 1), false);
  return { screen: SCREEN_PLAY, best: world.state.score };
}
