// Drawing only: the world's state and the current screen in, pixels out. A pre-rendered
// nebula backdrop, parallax starfield, glowing neon ship, craggy asteroids, particles and
// floating score popups; the 1280x720 playfield scales to fit the window and centres. The
// HUD shows score, level progress, combo, hull and active power-ups; panels cover the title,
// pause, sector-clear and game-over screens.
import { ASTEROID, COMBO, FIELD, FONT, GEM, LEVEL, LIVES, PALETTE, POWERUP, SEEKER, SHIP, WIN_LEVEL } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const TAU = Math.PI * 2;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  let time = 0;

  // --- Pre-rendered backdrop: nebula blobs + static stars, larger than the field so it
  // can drift a little with the ship (parallax) without showing an edge.
  const bg = document.createElement('canvas');
  bg.width = 1440;
  bg.height = 820;
  {
    const b = bg.getContext('2d');
    const grad = b.createLinearGradient(0, 0, 0, 820);
    grad.addColorStop(0, '#070818');
    grad.addColorStop(0.55, '#0a0d26');
    grad.addColorStop(1, '#05060f');
    b.fillStyle = grad;
    b.fillRect(0, 0, 1440, 820);
    const blobs = [
      [300, 180, 420, PALETTE.nebulaA, 0.55], [1150, 120, 380, PALETTE.nebulaB, 0.5],
      [1050, 620, 460, PALETTE.nebulaC, 0.5], [220, 640, 360, PALETTE.nebulaB, 0.42],
      [720, 400, 520, '#120b33', 0.5],
    ];
    for (const [x, y, r, color, alpha] of blobs) {
      const g = b.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(5,6,15,0)');
      b.globalAlpha = alpha;
      b.fillStyle = g;
      b.fillRect(x - r, y - r, r * 2, r * 2);
    }
    b.globalAlpha = 1;
    const rnd = createRandom(1337);
    for (let i = 0; i < 260; i += 1) {
      const x = rnd() * 1440;
      const y = rnd() * 820;
      const r = rnd() * 1.4 + 0.3;
      b.globalAlpha = 0.25 + rnd() * 0.65;
      b.fillStyle = rnd() < 0.12 ? '#ffd94d' : PALETTE.star;
      b.beginPath();
      b.arc(x, y, r, 0, TAU);
      b.fill();
    }
    b.globalAlpha = 1;
  }
  // Twinkling stars, drawn live over the backdrop.
  const twinkles = [];
  {
    const rnd = createRandom(4242);
    for (let i = 0; i < 48; i += 1) {
      twinkles.push({ x: rnd() * FIELD.width, y: rnd() * FIELD.height, r: 0.8 + rnd() * 1.6, phase: rnd() * TAU, speed: 0.6 + rnd() * 1.8 });
    }
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Screen (CSS) pixels to field coordinates, for aiming with the mouse. */
  function toField(sx, sy) {
    const ratio = window.devicePixelRatio || 1;
    return { x: (sx * ratio - view.x) / view.scale, y: (sy * ratio - view.y) / view.scale };
  }

  function text(value, x, y, size, color, align, weight) {
    context.font = `${weight ?? 600} ${size}px ${FONT}`;
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function glowCircle(x, y, r, color, alpha) {
    context.save();
    context.globalAlpha = alpha;
    context.shadowColor = color;
    context.shadowBlur = 18;
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, r, 0, TAU);
    context.fill();
    context.restore();
  }

  function drawBackground(state) {
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const px = (state.ship.x / FIELD.width - 0.5) * -36;
    const py = (state.ship.y / FIELD.height - 0.5) * -28;
    context.drawImage(bg, -80 + px, -50 + py);
    for (const s of twinkles) {
      context.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(time * s.speed + s.phase));
      context.fillStyle = PALETTE.star;
      context.beginPath();
      context.arc(s.x, s.y, s.r, 0, TAU);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawShip(ship) {
    const blink = ship.invulnerable > 0 && Math.floor(ship.invulnerable * 10) % 2 === 0;
    context.save();
    context.translate(ship.x, ship.y);
    context.rotate(ship.angle);
    if (!blink) {
      if (ship.thrusting) {
        const flick = 14 + Math.random() * 12;
        const fg = context.createLinearGradient(-SHIP.radius, 0, -SHIP.radius - flick - 10, 0);
        fg.addColorStop(0, '#ffe9a8');
        fg.addColorStop(0.5, PALETTE.flame);
        fg.addColorStop(1, 'rgba(255,80,40,0)');
        context.fillStyle = fg;
        context.beginPath();
        context.moveTo(-SHIP.radius + 2, 5);
        context.lineTo(-SHIP.radius - flick, 0);
        context.lineTo(-SHIP.radius + 2, -5);
        context.closePath();
        context.fill();
      }
      context.shadowColor = PALETTE.ship;
      context.shadowBlur = 16;
      const body = context.createLinearGradient(-SHIP.radius, 0, SHIP.radius + 6, 0);
      body.addColorStop(0, '#1fb6cf');
      body.addColorStop(1, PALETTE.ship);
      context.fillStyle = body;
      context.beginPath();
      context.moveTo(SHIP.radius + 6, 0);
      context.lineTo(-SHIP.radius * 0.7, SHIP.radius * 0.75);
      context.lineTo(-SHIP.radius * 0.35, 0);
      context.lineTo(-SHIP.radius * 0.7, -SHIP.radius * 0.75);
      context.closePath();
      context.fill();
      context.shadowBlur = 0;
      context.fillStyle = PALETTE.shipCore;
      context.beginPath();
      context.arc(2, 0, 4.5, 0, TAU);
      context.fill();
    }
    context.restore();
    if (ship.shield) {
      context.save();
      context.strokeStyle = PALETTE.shield;
      context.globalAlpha = 0.75 + 0.2 * Math.sin(time * 5);
      context.lineWidth = 2.5;
      context.shadowColor = PALETTE.shield;
      context.shadowBlur = 14;
      context.beginPath();
      context.arc(ship.x, ship.y, SHIP.radius + 10, 0, TAU);
      context.stroke();
      context.restore();
    }
  }

  function drawAsteroid(a) {
    const r = ASTEROID.radius[a.size];
    context.save();
    context.translate(a.x, a.y);
    context.rotate(a.rot);
    context.beginPath();
    for (let i = 0; i < a.verts.length; i += 1) {
      const ang = (i / a.verts.length) * TAU;
      const rr = r * a.verts[i];
      if (i === 0) context.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      else context.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
    }
    context.closePath();
    context.fillStyle = PALETTE.asteroid;
    context.fill();
    context.strokeStyle = PALETTE.asteroidEdge;
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.arc(-r * 0.25, -r * 0.15, r * 0.22, 0, TAU);
    context.arc(r * 0.3, r * 0.3, r * 0.16, 0, TAU);
    context.fill();
    // Hull cracks: a rock on its last hit glows hot at the cracks.
    if (a.hull === 1 && a.size !== 2) {
      context.strokeStyle = 'rgba(255,120,80,0.85)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(-r * 0.5, -r * 0.2);
      context.lineTo(0, r * 0.1);
      context.lineTo(r * 0.45, -r * 0.35);
      context.stroke();
    }
    context.restore();
  }

  function drawSeeker(s) {
    context.save();
    context.translate(s.x, s.y);
    context.rotate(s.rot);
    context.shadowColor = PALETTE.seeker;
    context.shadowBlur = 14;
    context.fillStyle = PALETTE.seeker;
    context.beginPath();
    context.moveTo(SEEKER.radius + 4, 0);
    context.lineTo(-SEEKER.radius, SEEKER.radius * 0.8);
    context.lineTo(-SEEKER.radius * 0.4, 0);
    context.lineTo(-SEEKER.radius, -SEEKER.radius * 0.8);
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = PALETTE.seekerCore;
    context.beginPath();
    context.arc(0, 0, 4, 0, TAU);
    context.fill();
    context.restore();
  }

  function drawWorld(state) {
    for (const g of state.gems) {
      if (!g.active) continue;
      const pulse = 1 + 0.18 * Math.sin(time * 6 + g.x);
      context.save();
      context.translate(g.x, g.y);
      context.rotate(time * 2 + g.x);
      context.scale(pulse, pulse);
      glowCircle(0, 0, GEM.radius * 0.9, PALETTE.gem, 0.9);
      context.fillStyle = '#fff3c4';
      context.beginPath();
      context.moveTo(0, -GEM.radius);
      context.lineTo(GEM.radius * 0.7, 0);
      context.lineTo(0, GEM.radius);
      context.lineTo(-GEM.radius * 0.7, 0);
      context.closePath();
      context.fill();
      context.restore();
    }
    for (const p of state.powerups) {
      if (!p.active) continue;
      const color = p.kind === 'shield' ? PALETTE.shield : p.kind === 'rapid' ? PALETTE.rapid : PALETTE.spread;
      const label = p.kind === 'shield' ? 'S' : p.kind === 'rapid' ? 'R' : 'W';
      const bob = Math.sin(time * 3 + p.x) * 3;
      glowCircle(p.x, p.y + bob, POWERUP.radius, color, 0.85);
      context.save();
      context.fillStyle = 'rgba(5,6,15,0.85)';
      context.beginPath();
      context.arc(p.x, p.y + bob, POWERUP.radius - 4, 0, TAU);
      context.fill();
      context.restore();
      text(label, p.x, p.y + bob + 7, 17, color, 'center', 800);
    }
    for (const b of state.bullets) {
      if (!b.active) continue;
      context.save();
      context.strokeStyle = PALETTE.bullet;
      context.shadowColor = PALETTE.bullet;
      context.shadowBlur = 10;
      context.lineWidth = 3.5;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
      context.lineTo(b.x, b.y);
      context.stroke();
      context.restore();
    }
    for (const a of state.asteroids) if (a.active) drawAsteroid(a);
    for (const s of state.seekers) if (s.active) drawSeeker(s);
    drawShip(state.ship);
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size * (0.5 + p.life / p.maxLife), 0, TAU);
      context.fill();
    }
    context.globalAlpha = 1;
    for (const p of state.popups) {
      if (!p.active) continue;
      context.globalAlpha = Math.min(1, p.life * 1.6);
      text(p.text, p.x, p.y, 19, p.color, 'center', 800);
    }
    context.globalAlpha = 1;
  }

  function drawHud(state, best) {
    // A soft scrim behind the top bar, so rocks drifting behind the text never hurt readability.
    const scrim = context.createLinearGradient(0, 0, 0, 116);
    scrim.addColorStop(0, 'rgba(5,6,15,0.6)');
    scrim.addColorStop(1, 'rgba(5,6,15,0)');
    context.fillStyle = scrim;
    context.fillRect(0, 0, FIELD.width, 116);
    context.textBaseline = 'alphabetic';
    text(`SCORE  ${state.score.toLocaleString('en-US')}`, 28, 44, 26, PALETTE.text, 'left', 800);
    text(`BEST  ${Math.max(best, state.score).toLocaleString('en-US')}`, 28, 74, 16, PALETTE.muted, 'left', 600);
    text(`LEVEL ${state.level}`, FIELD.width / 2, 44, 26, PALETTE.text, 'center', 800);
    // Progress to the next level.
    const frac = state.level >= LEVEL.max ? 1 : (state.elapsed % LEVEL.seconds) / LEVEL.seconds;
    context.fillStyle = 'rgba(157,184,214,0.25)';
    context.fillRect(FIELD.width / 2 - 90, 56, 180, 6);
    context.fillStyle = PALETTE.ship;
    context.fillRect(FIELD.width / 2 - 90, 56, 180 * frac, 6);
    // Hull: little ships, spent ones dimmed.
    text('HULL', FIELD.width - 28 - LIVES * 34, 44, 16, PALETTE.muted, 'right', 600);
    for (let i = 0; i < LIVES; i += 1) {
      const x = FIELD.width - 28 - (LIVES - 1 - i) * 34;
      context.save();
      context.translate(x, 38);
      context.fillStyle = i < state.lives ? PALETTE.ship : 'rgba(157,184,214,0.25)';
      context.beginPath();
      context.moveTo(10, 0);
      context.lineTo(-8, 8);
      context.lineTo(-4, 0);
      context.lineTo(-8, -8);
      context.closePath();
      context.fill();
      context.restore();
    }
    // Combo meter.
    if (state.combo > 1) {
      const cx = FIELD.width / 2;
      text(`COMBO x${state.combo}`, cx, 108, 22, PALETTE.gold, 'center', 800);
      context.fillStyle = 'rgba(255,217,77,0.3)';
      context.fillRect(cx - 60, 116, 120, 5);
      context.fillStyle = PALETTE.gold;
      context.fillRect(cx - 60, 116, 120 * (state.comboTimer / COMBO.window), 5);
    }
    // Active power-ups, with seconds left.
    let row = 0;
    const ship = state.ship;
    const timers = [
      ship.shield ? ['SHIELD', PALETTE.shield, null] : null,
      ship.rapid > 0 ? ['RAPID', PALETTE.rapid, Math.ceil(ship.rapid)] : null,
      ship.spread > 0 ? ['SPREAD', PALETTE.spread, Math.ceil(ship.spread)] : null,
    ];
    for (const t of timers) {
      if (!t) continue;
      text(t[2] === null ? t[0] : `${t[0]} ${t[2]}s`, 28, 112 + row * 26, 17, t[1], 'left', 700);
      row += 1;
    }
    text('P pause · M mute', FIELD.width - 28, FIELD.height - 20, 14, 'rgba(157,184,214,0.6)', 'right', 600);
  }

  function drawPanel(title, titleColor, lines, prompt, promptColor) {
    const width = 640;
    const height = 150 + lines.length * 34 + 66;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.save();
    context.fillStyle = 'rgba(3,4,12,0.45)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1.5;
    context.shadowColor = 'rgba(125,249,255,0.35)';
    context.shadowBlur = 24;
    context.beginPath();
    context.roundRect(x, y, width, height, 18);
    context.fill();
    context.stroke();
    context.restore();
    text(title, FIELD.width / 2, y + 78, 52, titleColor, 'center', 800);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 132 + i * 34, 20, PALETTE.muted, 'center', 600);
    }
    text(prompt, FIELD.width / 2, y + height - 34, 22, promptColor ?? PALETTE.gold, 'center', 700);
  }

  /** Paint one frame: backdrop, world, then the HUD or a panel for the screen. */
  function draw(state, screen, best, dt) {
    time += dt;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (state.shake > 0.3) {
      const s = state.shake;
      context.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    drawBackground(state);
    drawWorld(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('NOVA DRIFT', PALETTE.ship, [
        'Blast the asteroids. Catch the star shards. Chain the combo.',
        'Fly with WASD or arrows · Aim with the mouse · Hold click or Space to fire',
        'Red seekers hunt you from level 3 · Reach level 6 to clear the sector',
        `Best score  ${Math.max(best, 0).toLocaleString('en-US')}`,
      ], 'Press Space or click to launch');
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', PALETTE.text, ['The rocks will wait for you.'], 'Press P or click to resume');
    } else if (screen === SCREEN_WIN) {
      drawPanel('SECTOR CLEARED', PALETTE.gold, [
        `Score  ${state.score.toLocaleString('en-US')}   ·   Best  ${Math.max(best, state.score).toLocaleString('en-US')}`,
        `You reached level ${WIN_LEVEL} — the sector is yours, pilot.`,
        'Keep flying for a higher score, or restart for a fresh run.',
      ], 'Press Space to keep flying · R to restart', PALETTE.ship);
    } else if (screen === SCREEN_OVER) {
      drawPanel('GAME OVER', PALETTE.danger, [
        `Score  ${state.score.toLocaleString('en-US')}   ·   Best  ${Math.max(best, state.score).toLocaleString('en-US')}`,
        `You survived to level ${state.level} and destroyed ${state.kills} rocks.`,
        state.score >= best && state.score > 0 ? 'A new best score — nicely flown.' : 'The drift claims another pilot.',
      ], 'Press Space or click to fly again');
    }
    // Soft vignette, so the edges fall away and the action reads.
    const vg = context.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.42,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.85,
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    context.fillStyle = vg;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
