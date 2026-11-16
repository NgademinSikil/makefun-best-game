// NOVA DRIFT's rules and state, with no drawing and no browser in it: the ship's drift
// physics, bullets, splitting asteroids, chasing seekers, star shards, power-ups, the combo
// multiplier, levels and the sector-clear win. step() advances one fixed step and returns
// what happened as bit flags, so the caller can react (sound, announcements) without the
// world knowing about screens. Nothing here allocates after createWorld returns.
import {
  ASTEROID, COMBO, FIELD, GEM, LIVES, LEVEL, POOL, POWERUP, SEEKER, SHIP, WIN_LEVEL,
} from './config.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WIN = 4;
export const EVENT_LEVEL = 8;
export const EVENT_SHOOT = 16;
export const EVENT_PICKUP = 32;
export const EVENT_POWER = 64;
export const EVENT_EXPLODE = 128;

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function angleLerp(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * Math.min(1, t);
}

export function createWorld(random) {
  const ship = {
    x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0, angle: -Math.PI / 2,
    invulnerable: 0, shield: false, rapid: 0, spread: 0, fireTimer: 0, thrusting: false,
  };
  const bullets = [];
  for (let i = 0; i < POOL.bullets; i += 1) bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  const asteroids = [];
  for (let i = 0; i < POOL.asteroids; i += 1) {
    asteroids.push({ active: false, size: 0, x: 0, y: 0, vx: 0, vy: 0, rot: 0, rotV: 0, hull: 1, verts: new Array(9).fill(1) });
  }
  const seekers = [];
  for (let i = 0; i < POOL.seekers; i += 1) seekers.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, hull: 1, rot: 0 });
  const gems = [];
  for (let i = 0; i < POOL.gems; i += 1) gems.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  const powerups = [];
  for (let i = 0; i < POOL.powerups; i += 1) powerups.push({ active: false, kind: 'shield', x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  const particles = [];
  for (let i = 0; i < POOL.particles; i += 1) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff' });
  const popups = [];
  for (let i = 0; i < POOL.popups; i += 1) popups.push({ active: false, x: 0, y: 0, life: 0, text: '', color: '#fff' });

  const state = {
    ship, bullets, asteroids, seekers, gems, powerups, particles, popups,
    score: 0, combo: 1, comboTimer: 0, kills: 0, lives: LIVES, level: 1,
    elapsed: 0, won: false, shake: 0, asteroidTimer: 1, seekerTimer: 4,
  };

  function reset() {
    ship.x = FIELD.width / 2;
    ship.y = FIELD.height / 2;
    ship.vx = 0; ship.vy = 0; ship.angle = -Math.PI / 2;
    ship.invulnerable = 0; ship.shield = false; ship.rapid = 0; ship.spread = 0; ship.fireTimer = 0;
    for (const list of [bullets, asteroids, seekers, gems, powerups, particles, popups]) {
      for (const item of list) item.active = false;
    }
    state.score = 0; state.combo = 1; state.comboTimer = 0; state.kills = 0;
    state.lives = LIVES; state.level = 1; state.elapsed = 0; state.won = false; state.shake = 0;
    state.asteroidTimer = 1.2; state.seekerTimer = 5;
    // Opening field: a few rocks already drifting so the first seconds feel alive.
    for (let i = 0; i < 6; i += 1) spawnAsteroid(0, true);
  }

  function free(list) {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }

  function burst(x, y, color, count, speed, size) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (!p) return;
      const a = random() * TAU;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true; p.x = x; p.y = y;
      p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
      p.maxLife = 0.4 + random() * 0.5; p.life = p.maxLife;
      p.size = size * (0.6 + random() * 0.8); p.color = color;
    }
  }

  function popup(x, y, text, color) {
    const p = free(popups);
    if (!p) return;
    p.active = true; p.x = x; p.y = y; p.life = 1.1; p.text = text; p.color = color;
  }

  function spawnAsteroid(size, anywhere) {
    const a = free(asteroids);
    if (!a) return;
    const r = ASTEROID.radius[size];
    let x; let y; let angle;
    if (anywhere) {
      x = 80 + random() * (FIELD.width - 160);
      y = 80 + random() * (FIELD.height - 160);
      angle = random() * TAU;
    } else {
      const edge = Math.floor(random() * 4);
      if (edge === 0) { x = -r; y = random() * FIELD.height; angle = (random() - 0.5) * 1.6; }
      else if (edge === 1) { x = FIELD.width + r; y = random() * FIELD.height; angle = Math.PI + (random() - 0.5) * 1.6; }
      else if (edge === 2) { x = random() * FIELD.width; y = -r; angle = Math.PI / 2 + (random() - 0.5) * 1.6; }
      else { x = random() * FIELD.width; y = FIELD.height + r; angle = -Math.PI / 2 + (random() - 0.5) * 1.6; }
    }
    const speed = ASTEROID.speed[size] + ASTEROID.speedPerLevel * (state.level - 1) * (0.7 + random() * 0.6);
    a.active = true; a.size = size; a.x = x; a.y = y;
    a.vx = Math.cos(angle) * speed; a.vy = Math.sin(angle) * speed;
    a.rot = random() * TAU; a.rotV = (random() - 0.5) * 1.6; a.hull = ASTEROID.hull[size];
    for (let i = 0; i < a.verts.length; i += 1) a.verts[i] = 0.72 + random() * 0.45;
  }

  function spawnSeeker() {
    const s = free(seekers);
    if (!s) return;
    const edge = Math.floor(random() * 4);
    const r = SEEKER.radius;
    if (edge === 0) { s.x = -r; s.y = random() * FIELD.height; }
    else if (edge === 1) { s.x = FIELD.width + r; s.y = random() * FIELD.height; }
    else if (edge === 2) { s.x = random() * FIELD.width; s.y = -r; }
    else { s.x = random() * FIELD.width; s.y = FIELD.height + r; }
    s.active = true; s.vx = 0; s.vy = 0; s.hull = SEEKER.hull; s.rot = 0;
  }

  function dropLoot(x, y, size) {
    if (random() < ASTEROID.powerChance) {
      const p = free(powerups);
      if (p) {
        const kinds = ['shield', 'rapid', 'spread'];
        p.active = true; p.kind = kinds[Math.floor(random() * kinds.length)];
        p.x = x; p.y = y; p.vx = (random() - 0.5) * 40; p.vy = 30 + random() * 40; p.life = POWERUP.life;
      }
      return;
    }
    if (size === 2 || random() < ASTEROID.gemChance) {
      const g = free(gems);
      if (g) {
        g.active = true; g.x = x; g.y = y;
        const a = random() * TAU;
        g.vx = Math.cos(a) * 60; g.vy = Math.sin(a) * 60; g.life = GEM.life;
      }
    }
  }

  function destroyAsteroid(a, events) {
    const r = ASTEROID.radius[a.size];
    const points = ASTEROID.score[a.size] * state.combo;
    state.score += points;
    state.kills += 1;
    state.combo = Math.min(COMBO.max, state.combo + 1);
    state.comboTimer = COMBO.window;
    burst(a.x, a.y, '#c9b8d9', a.size === 0 ? 26 : 14, 260, 3);
    burst(a.x, a.y, '#ffd94d', 6, 180, 2);
    popup(a.x, a.y, `+${points}`, '#ffd94d');
    dropLoot(a.x, a.y, a.size);
    if (a.size < 2) {
      for (let i = 0; i < 2; i += 1) {
        const child = free(asteroids);
        if (!child) break;
        const angle = random() * TAU;
        const speed = ASTEROID.speed[a.size + 1] * (0.8 + random() * 0.5);
        child.active = true; child.size = a.size + 1; child.x = a.x; child.y = a.y;
        child.vx = Math.cos(angle) * speed; child.vy = Math.sin(angle) * speed;
        child.rot = random() * TAU; child.rotV = (random() - 0.5) * 2.4;
        child.hull = ASTEROID.hull[a.size + 1];
        for (let v = 0; v < child.verts.length; v += 1) child.verts[v] = 0.72 + random() * 0.45;
      }
    }
    a.active = false;
    return events | EVENT_EXPLODE;
  }

  function fireBullet(angle) {
    const b = free(bullets);
    if (!b) return;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    b.active = true;
    b.x = ship.x + nx * (SHIP.radius + 8);
    b.y = ship.y + ny * (SHIP.radius + 8);
    b.vx = nx * SHIP.bulletSpeed + ship.vx * 0.35;
    b.vy = ny * SHIP.bulletSpeed + ship.vy * 0.35;
    b.life = SHIP.bulletLife;
  }

  function hitShip(events) {
    if (ship.shield) {
      ship.shield = false;
      ship.invulnerable = 1.2;
      burst(ship.x, ship.y, '#59c2ff', 22, 300, 3);
      popup(ship.x, ship.y - 30, 'SHIELD DOWN', '#59c2ff');
      return events | EVENT_HIT;
    }
    state.lives -= 1;
    state.combo = 1;
    state.comboTimer = 0;
    state.shake = 14;
    ship.invulnerable = SHIP.invulnerable;
    burst(ship.x, ship.y, '#ff5d7a', 30, 320, 3);
    burst(ship.x, ship.y, '#7df9ff', 16, 240, 3);
    if (state.lives <= 0) return events | EVENT_HIT | EVENT_OVER;
    return events | EVENT_HIT;
  }

  /**
   * One fixed step. `ctrl` is { mx, my, aimX, aimY, firing } in field coordinates.
   * With `harmless` set (the title screen's backdrop) rocks drift and the ship cruises,
   * but nothing collides and nothing scores.
   */
  function step(dt, ctrl, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);

    // Level from survival time; reaching WIN_LEVEL clears the sector.
    const level = Math.min(LEVEL.max, 1 + Math.floor(state.elapsed / LEVEL.seconds));
    if (level !== state.level) {
      state.level = level;
      events |= EVENT_LEVEL;
      if (level === WIN_LEVEL && !state.won) {
        state.won = true;
        events |= EVENT_WIN;
      }
    }
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 1;
    }
    if (ship.invulnerable > 0) ship.invulnerable -= dt;
    if (ship.rapid > 0) ship.rapid -= dt;
    if (ship.spread > 0) ship.spread -= dt;

    // --- Ship ---
    if (harmless) {
      const t = state.elapsed * 0.35;
      const cx = FIELD.width / 2 + Math.cos(t) * 260;
      const cy = FIELD.height / 2 + Math.sin(t * 1.3) * 130;
      ship.angle = angleLerp(ship.angle, Math.atan2(cy - ship.y, cx - ship.x), dt * 3);
      ship.vx += Math.cos(ship.angle) * 320 * dt;
      ship.vy += Math.sin(ship.angle) * 320 * dt;
      ship.thrusting = true;
    } else {
      const drag = Math.exp(-SHIP.drag * dt);
      ship.vx *= drag;
      ship.vy *= drag;
      ship.thrusting = ctrl.mx !== 0 || ctrl.my !== 0;
      if (ship.thrusting) {
        ship.vx += ctrl.mx * SHIP.accel * dt;
        ship.vy += ctrl.my * SHIP.accel * dt;
      }
      const speed = Math.hypot(ship.vx, ship.vy);
      if (speed > SHIP.maxSpeed) {
        ship.vx = (ship.vx / speed) * SHIP.maxSpeed;
        ship.vy = (ship.vy / speed) * SHIP.maxSpeed;
      }
      const aim = Math.atan2(ctrl.aimY - ship.y, ctrl.aimX - ship.x);
      ship.angle = angleLerp(ship.angle, aim, dt * SHIP.turn);
      ship.fireTimer -= dt;
      if (ctrl.firing && ship.fireTimer <= 0) {
        ship.fireTimer = ship.rapid > 0 ? SHIP.rapidInterval : SHIP.fireInterval;
        fireBullet(ship.angle);
        if (ship.spread > 0) {
          fireBullet(ship.angle - 0.22);
          fireBullet(ship.angle + 0.22);
        }
        events |= EVENT_SHOOT;
      }
      if (ship.thrusting && random() < 0.6) {
        const p = free(particles);
        if (p) {
          p.active = true;
          p.x = ship.x - Math.cos(ship.angle) * SHIP.radius;
          p.y = ship.y - Math.sin(ship.angle) * SHIP.radius;
          p.vx = -Math.cos(ship.angle) * 120 + (random() - 0.5) * 40;
          p.vy = -Math.sin(ship.angle) * 120 + (random() - 0.5) * 40;
          p.maxLife = 0.35; p.life = 0.35; p.size = 2.5; p.color = '#ffb347';
        }
      }
    }
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    // The ship wraps around the edges; rocks and seekers leave instead.
    if (ship.x < -SHIP.radius) ship.x += FIELD.width + SHIP.radius * 2;
    else if (ship.x > FIELD.width + SHIP.radius) ship.x -= FIELD.width + SHIP.radius * 2;
    if (ship.y < -SHIP.radius) ship.y += FIELD.height + SHIP.radius * 2;
    else if (ship.y > FIELD.height + SHIP.radius) ship.y -= FIELD.height + SHIP.radius * 2;

    // --- Spawning ---
    state.asteroidTimer -= dt;
    if (state.asteroidTimer <= 0) {
      spawnAsteroid(random() < 0.7 ? 0 : 1, false);
      const interval = Math.max(ASTEROID.minInterval, ASTEROID.interval * ASTEROID.intervalScale ** (state.level - 1));
      state.asteroidTimer += interval * (0.7 + random() * 0.6);
    }
    if (state.level >= SEEKER.firstLevel) {
      state.seekerTimer -= dt;
      if (state.seekerTimer <= 0) {
        spawnSeeker();
        state.seekerTimer += Math.max(SEEKER.minInterval, SEEKER.interval - state.level * 0.5) * (0.8 + random() * 0.4);
      }
    }

    // --- Bullets ---
    for (const b of bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      if (harmless) continue;
      for (const a of asteroids) {
        if (!a.active) continue;
        const r = ASTEROID.radius[a.size] + 5;
        if (dist2(b.x, b.y, a.x, a.y) < r * r) {
          b.active = false;
          a.hull -= 1;
          burst(b.x, b.y, '#aefcff', 5, 140, 2);
          if (a.hull <= 0) events = destroyAsteroid(a, events);
          break;
        }
      }
      if (!b.active) continue;
      for (const s of seekers) {
        if (!s.active) continue;
        const r = SEEKER.radius + 5;
        if (dist2(b.x, b.y, s.x, s.y) < r * r) {
          b.active = false;
          s.hull -= 1;
          burst(b.x, b.y, '#ff5d7a', 8, 180, 2);
          if (s.hull <= 0) {
            s.active = false;
            const points = SEEKER.score * state.combo;
            state.score += points;
            state.kills += 1;
            state.combo = Math.min(COMBO.max, state.combo + 1);
            state.comboTimer = COMBO.window;
            burst(s.x, s.y, '#ff5d7a', 22, 280, 3);
            popup(s.x, s.y, `+${points}`, '#ffd94d');
            dropLoot(s.x, s.y, 2);
            events |= EVENT_EXPLODE;
          }
          break;
        }
      }
    }

    // --- Asteroids & seekers drift ---
    for (const a of asteroids) {
      if (!a.active) continue;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += a.rotV * dt;
      const r = ASTEROID.radius[a.size];
      if (a.x < -r - 40 || a.x > FIELD.width + r + 40 || a.y < -r - 40 || a.y > FIELD.height + r + 40) a.active = false;
    }
    for (const s of seekers) {
      if (!s.active) continue;
      const speed = SEEKER.speed + SEEKER.speedPerLevel * (state.level - 1);
      const dx = ship.x - s.x;
      const dy = ship.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      s.vx += (dx / d) * speed * 2.2 * dt;
      s.vy += (dy / d) * speed * 2.2 * dt;
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > speed) { s.vx = (s.vx / sp) * speed; s.vy = (s.vy / sp) * speed; }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot = Math.atan2(s.vy, s.vx);
      if (s.x < -60 || s.x > FIELD.width + 60 || s.y < -60 || s.y > FIELD.height + 60) s.active = false;
    }

    // --- Gems & power-ups drift, magnetise, get collected ---
    for (const g of gems) {
      if (!g.active) continue;
      g.life -= dt;
      if (g.life <= 0) { g.active = false; continue; }
      const d2 = dist2(g.x, g.y, ship.x, ship.y);
      if (!harmless && d2 < GEM.magnet * GEM.magnet) {
        const d = Math.sqrt(d2) || 1;
        const pull = 900 * (1 - d / (GEM.magnet * 1.4));
        g.vx += ((ship.x - g.x) / d) * pull * dt;
        g.vy += ((ship.y - g.y) / d) * pull * dt;
      }
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (!harmless && d2 < GEM.collect * GEM.collect) {
        g.active = false;
        const points = GEM.score * state.combo;
        state.score += points;
        state.combo = Math.min(COMBO.max, state.combo + 1);
        state.comboTimer = COMBO.window;
        popup(g.x, g.y, `+${points}`, '#ffd94d');
        burst(g.x, g.y, '#ffd94d', 6, 120, 2);
        events |= EVENT_PICKUP;
      }
    }
    for (const p of powerups) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (!harmless && dist2(p.x, p.y, ship.x, ship.y) < (POWERUP.radius + SHIP.radius) ** 2) {
        p.active = false;
        if (p.kind === 'shield') {
          ship.shield = true;
          popup(ship.x, ship.y - 30, 'SHIELD UP', '#59c2ff');
        } else if (p.kind === 'rapid') {
          ship.rapid = POWERUP.duration;
          popup(ship.x, ship.y - 30, 'RAPID FIRE', '#ff9f43');
        } else {
          ship.spread = POWERUP.duration;
          popup(ship.x, ship.y - 30, 'SPREAD SHOT', '#c77dff');
        }
        events |= EVENT_POWER;
      }
    }

    // --- Particles & popups age ---
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-2 * dt);
      p.vy *= Math.exp(-2 * dt);
    }
    for (const p of popups) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
      p.y -= 34 * dt;
    }

    // --- Ship collisions ---
    if (!harmless && ship.invulnerable <= 0) {
      for (const a of asteroids) {
        if (!a.active) continue;
        const r = ASTEROID.radius[a.size] * 0.82 + SHIP.radius * 0.7;
        if (dist2(a.x, a.y, ship.x, ship.y) < r * r) {
          a.active = false;
          burst(a.x, a.y, '#c9b8d9', 14, 220, 3);
          events = hitShip(events);
          break;
        }
      }
      if (!(events & EVENT_OVER) && ship.invulnerable <= 0) {
        for (const s of seekers) {
          if (!s.active) continue;
          const r = SEEKER.radius + SHIP.radius * 0.7;
          if (dist2(s.x, s.y, ship.x, ship.y) < r * r) {
            s.active = false;
            burst(s.x, s.y, '#ff5d7a', 14, 220, 3);
            events = hitShip(events);
            break;
          }
        }
      }
    }
    return events;
  }

  reset();
  return { state, reset, step };
}
