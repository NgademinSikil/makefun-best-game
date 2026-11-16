// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is there.
// The game moves between five screens: title, play, paused, sector-clear (win) and game over.
// Reaching level 6 clears the sector; the pilot may keep flying for score, or restart.
//
// ?seed=N fixes the run. ?shot=start|play|action|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, STEP, WIN_LEVEL } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_EXPLODE, EVENT_HIT, EVENT_LEVEL, EVENT_OVER, EVENT_PICKUP, EVENT_POWER, EVENT_SHOOT, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world, seed);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, 1 / 60);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${LIVES} lives. Reach level ${WIN_LEVEL} to clear the sector.`);
  }

  function endGame(won) {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      screen = SCREEN_WIN;
      audio.win();
      announce(`Sector cleared. Score ${world.state.score}. Best ${best}.`);
    } else {
      screen = SCREEN_OVER;
      audio.gameover();
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function handleEvents(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_EXPLODE) audio.explosion(false);
    if (events & EVENT_PICKUP) audio.pickup(world.state.combo);
    if (events & EVENT_POWER) audio.powerup();
    if (events & EVENT_LEVEL) {
      audio.levelup();
      announce(`Level ${world.state.level}.`);
    }
    if (events & EVENT_HIT) {
      audio.hit();
      announce(world.state.lives === 1 ? 'Hit. 1 hull left.' : `Hit. ${world.state.lives} hull left.`);
    }
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      if (actions & (ACTION_CONFIRM | ACTION_RESTART)) startGame();
    } else if (screen === SCREEN_WIN) {
      if (actions & ACTION_RESTART) startGame();
      else if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Flying on for score.');
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function controls() {
    const move = input.move();
    const mouse = input.mouse();
    const aim = mouse.seen ? renderer.toField(mouse.x, mouse.y) : { x: world.state.ship.x + Math.cos(world.state.ship.angle) * 200, y: world.state.ship.y + Math.sin(world.state.ship.angle) * 200 };
    return { mx: move.x, my: move.y, aimX: aim.x, aimY: aim.y, firing: input.firing() };
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { mx: 0, my: 0, aimX: 0, aimY: 0, firing: false }, true);
      return;
    }
    handleEvents(world.step(STEP, controls(), false));
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_WIN) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_WIN)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, 1 / 60);
  }

  // Leaving the tab pauses a running game rather than letting rocks fall unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Nova Drift. Press Space or click to launch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
