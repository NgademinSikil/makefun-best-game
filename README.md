# NOVA DRIFT — make.fun best-game-01 entry (local-only, not submitted)

A complete, original neon space arcade game that plays offline in a desktop browser
from its own static files. No libraries, no network requests, no build step.

## How to play

Serve it locally and open http://localhost:8080 (or open `game/index.html` directly):

```
node serve.ts
```

- **Fly:** WASD or arrow keys (drift physics — thrust, momentum, edge wrap)
- **Aim:** mouse · **Fire:** hold click or Space
- **Pause:** P or Esc · **Mute:** M · **Restart:** R (or Space/click on the end screens)

## The game

Blast asteroids — big ones split into two smaller ones. Red seeker ships hunt you from
level 3. Destroyed rocks drop **star shards**: catch them to chain a combo multiplier up
to **x8**. Rare drops grant **Shield** (absorbs one hit), **Rapid Fire**, or **Spread Shot**.
You have 3 hull. Reach **level 6 to clear the sector (win)** — then keep flying endlessly
for a higher score. Game over at 0 hull. Best score is saved in `localStorage`.

Synthesised WebAudio sound effects (laser, explosions, pickups, jingles) — no audio files.
Title screen runs a live autopilot backdrop; a `?shot=start|play|action|end&seed=N` mode
stages deterministic screenshot scenes (see `game/src/shots.js`).

## Layout

- `main.ts` — Node 22 entry: copies `game/` + `screenshots/` to `/output` and writes
  `dossier.json` via `vendor/makefun-game.ts` (copied unchanged from the kit)
- `game/index.html` + `game/src/` — the game: `config`, `random` (seeded), `input`,
  `audio` (WebAudio synth), `world` (rules), `render` (canvas), `shots` (screenshot
  scenes), `main` (loop)
- `screenshots/` — 4 real renders of the game's own code (1280×720)
- `shots.json` — the `?shot=` scenes each screenshot was taken from
- `serve.ts` — tiny static server for local play-testing

## Status

Built locally only. **Not submitted** to make.fun — submission still needs a public
GitHub repo (or source bundle), the AI agent transcripts, and a Solana wallet for the
USDC payout. Bounty closes Thu 19 Nov 2026 02:00 WITA.
