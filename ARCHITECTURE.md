# Architecture

Pirate Battle keeps the rules of the game, the rendering, the input and the user interface in separate layers that only talk through small, typed seams.

```
src/
├── game/
│   ├── config.ts        typed balancing and per-match config snapshot
│   ├── core/            pure simulation: no Pixi, React or DOM
│   ├── render/          PixiJS views reading the simulation state
│   ├── input/           keyboard and touch mapped to player intents
│   ├── audio/           Web Audio playback driven by simulation events
│   └── session/         GameSession: wires simulation, renderer, input, ticker and HUD store
├── app/                 React screens (menu, options, captain's log, battle, result)
├── ui/                  shared React components (buttons, dialog, media query hook)
├── api/                 contracts, Axios client, TanStack Query hooks, pending match queue
├── mocks/               MSW handlers, mock store, fixtures and network scenarios
├── storage/             validated localStorage persistence
└── testing/             opt-in e2e probe (`?e2e=1`)
```

## React and PixiJS integration

React owns the screens and everything that is a form, a panel or a dialog. PixiJS owns one canvas per battle: the arena, ships, projectiles, effects and the health bars above every ship.

`GameScreen` loads the textures, then mounts a `GameSession` into a host `div` from a `useEffect`. The session creates the Pixi `Application` asynchronously, so the effect cleanup can run before the renderer exists. `GameSession.destroy()` marks the session disposed, and `mount()` destroys the freshly created renderer if it finishes after disposal. This keeps init and teardown correct under React Strict Mode's double mount (verified in dev mode) and when the player leaves while the canvas is still starting.

The continuous state of combat never lives in React. The session publishes a small `HudSnapshot` (status, pause reason, score, whole seconds left, health) to an external `HudStore`, read with `useSyncExternalStore`. The store compares snapshots field by field and only notifies listeners when something visible changed, so React renders a few times per second at most, never once per frame. A polite live region describes meaningful changes (pause, resume, enemy sunk, 60/30/10 seconds left, critical hull, end of battle) instead of mirroring every update.

## Simulation loop

`Simulation` (`src/game/core/simulation.ts`) advances in fixed steps of 1/60 s. `FixedStepAccumulator` converts variable frame times into whole steps and clamps any frame to 250 ms, so movement, cooldowns, damage and spawns do not depend on the frame rate and a long stall cannot trigger a spiral of steps. Unit tests confirm that 30 fps and 144 fps produce the same trajectory within one step.

Each step runs, in order: player movement and weapons, spawning, flow field refresh, enemy steering and fire, ship contacts, projectiles, removal of destroyed ships, salvage pickup and the end of match check. The simulation returns early as soon as the match ends, so the final step cannot move, damage or score after the `ended` event.

Randomness comes from a seeded `mulberry32` generator, so a seed reproduces spawn types, positions and every derived event. Salvage drops use a second generator derived from the same seed, so loot never shifts the spawn sequence of a seed. The renderer uses its own seeded generator for cosmetic effects so visuals never consume simulation randomness.

### Pause

Pausing (manual, `blur` or `visibilitychange`) stops feeding the accumulator, releases all held inputs, disables keyboard capture and resets leftover accumulated time. Resuming requires the player to press **Resume**; it resets the accumulator again and skips the first frame delta, so neither elapsed time nor inputs held during the pause carry over. Cooldowns are part of the simulation state, so they freeze with it.

### Rules

- The player sails forward with acceleration and rotates both ways. The front cannon fires one projectile; each broadside fires three parallel projectiles offset along the hull. Every weapon has its own cooldown.
- Projectiles move with constant velocity, expire after their range or lifetime, stop at islands and arena edges, and apply damage once to the first opposing ship they overlap.
- A chaser that touches the player deals contact damage and explodes without scoring. Only enemies destroyed by player projectiles add one point.
- The match ends exactly at the configured duration or when health reaches zero, emitting a single `ended` event.
- Enemy pressure ramps with match progress (elapsed time over duration). Spawns still happen on every configured interval, but the cap of enemies alive grows from 4 to 10 and the mix shifts from 60/40 to 40/60 chasers to shooters.
- An enemy sunk by the player can leave **repair salvage** (35% chance, 70% while the hull is at or below half health, at most three afloat). Sailing over it with a damaged hull repairs 20 health, capped at the maximum; salvage left at full health stays afloat until it expires after 12 seconds. A rammed chaser never drops salvage.

## Collisions and navigation

- **Ships** are circles. **Islands** are tile-aligned rectangles. `Arena.resolveCircle` pushes a ship out of any overlapping island along the shortest axis (or along the contact normal) and clamps it to the visible arena. Hitting an obstacle caps the ship's speed so it slides along coasts instead of grinding.
- **Projectiles** are small circles tested against islands, the arena bounds and the ships of the opposing faction.
- **Ships** separate from each other by splitting the overlap, then are resolved against islands again.
- **Line of sight** is sampled along the segment at a quarter tile.
- **Enemies** use a shared **flow field**. It runs Dijkstra on a half-tile grid, with islands inflated by the largest enemy radius, and is rebuilt toward the player four times per second. An enemy with line of sight steers straight at the player; otherwise it follows the gradient around islands. The cost stays constant per enemy, however many enemies there are.
- **Shooters** close in until their preferred range, then hold position and turn to aim. They fire only with line of sight, inside the attack range and within an aim tolerance.
- **Spawn points** are drawn with the seeded random generator. A spawn must be off islands, clear of other ships and beyond `minDistanceFromPlayer`, which is greater than the shooter attack range. If no random candidate fits, a grid scan picks the farthest valid cell, and the spawn is skipped if none qualifies. The first two spawns are always one chaser and one shooter, so both types appear in every match.

## Rendering and resource management

- **Textures.** They load once through Pixi `Assets` as three atlases:
  - ships and effects, converted from the provided Starling XML by `scripts/build-atlases.mjs`;
  - tiles at 1× or 2×, chosen by device pixel ratio;
  - the provided UI atlas.

  Loading reports progress, retries twice per asset and surfaces a retryable error before combat starts. Pixi drops failed promises from its cache, so a retry really refetches. Atlases stay cached between battles.

- **Arena.** It is built once from tiles, with shallow water rings, grass or sand islands and deterministic decorations, then cached as a texture.
- **Ship views.** Each one switches between four hull damage stages, shows flickering fires as health drops, flashes on hit and owns a health bar above the hull. Bar fills are cropped textures cached per 2.5% step and shared by every ship.
- **Projectiles and effects.** Both use pooled sprites: muzzle smoke, hits, splashes, explosions, debris and sinking wrecks.
- **Feedback layers.** Salvage, floating score and repair numbers (pooled `Text` objects) and a red edge vignette on player damage are separate layers. The vignette texture is drawn once on a 2D canvas and stretched to the screen; under reduced motion it is fainter and numbers do not rise.
- **Screen shake.** It is disabled when the user prefers reduced motion.
- **Canvas scaling.** The canvas follows its host with `resizeTo`, uses `autoDensity` and a resolution capped at 2, and letterboxes the fixed 1920×1088 world while preserving its proportions. Input is action-based (keys and DOM buttons), so it is unaffected by scaling.
- **Teardown.** `GameSession.destroy` removes the visibility and blur listeners and the ticker callback, detaches the keyboard, releases inputs, destroys ship views, cached fill textures and generated textures, and destroys the Pixi application with its children while keeping the shared atlases. The profiling report checks that canvases, DOM nodes and heap return to their menu baseline after five battles.

## Input

`InputController` keeps, for each action, the set of sources holding it (`key:KeyW`, `pointer:3`, …). Keyboard and multi-touch can therefore hold movement and fire at the same time, and releasing one source never cancels another. `KeyboardInput` only captures game keys while gameplay is enabled, ignores form fields and modifier shortcuts, and releases everything on blur. Touch buttons use pointer capture and release on `pointerup`, `pointercancel` and lost capture.

## Audio

`AudioManager` creates the `AudioContext` on the Play click, decodes the WAV files once in the background and plays short one-shot sources with a per-sound rate limit. `battleSounds` maps simulation events to sounds, and the HUD snapshot drives pause, resume, the ten second warning and low health. Audio failures are swallowed, so they can never block a battle.

## Local persistence

| Key                              | Content                                  | Validation                                 |
| -------------------------------- | ---------------------------------------- | ------------------------------------------ |
| `pirate-battle:options`          | Session time and spawn interval          | Re-validated on read, defaults on failure  |
| `pirate-battle:profile`          | Local player id and captain name         | Regenerated if invalid                     |
| `pirate-battle:sound`            | Sound on or off                          | Boolean                                    |
| `pirate-battle:last-result`      | Last completed match outcome             | Shape checked on read                      |
| `pirate-battle:pending-matches`  | Submissions not yet confirmed by the API | Shared submission parser                   |
| `pirate-battle:mock-db`          | Matches confirmed by the mock server     | Shape checked on read                      |
| `pirate-battle:mock-settings`    | Network scenario, latency and seed       | Scenario whitelist                         |
| `pirate-battle:screen` (session) | Whether the result screen was open       | Used to restore the result after a refresh |

Every read goes through `readJson` with a parser, and storage exceptions (private mode, quota) are caught, so corrupted or missing data falls back to defaults. A battle only produces a result when it ends; leaving or reloading during combat destroys the session without saving or submitting anything.

## Ranking and match history

### Contracts

Defined once in `src/api/contracts.ts` and shared by the client and the mock server:

| Endpoint                                                                   | Purpose                                             |
| -------------------------------------------------------------------------- | --------------------------------------------------- |
| `GET /api/ranking?page&pageSize&matchDurationSeconds&spawnIntervalSeconds` | Paginated ranking for one configuration             |
| `GET /api/players/:playerId/matches?page&pageSize`                         | Paginated history of the local player, newest first |
| `PUT /api/matches/:matchId`                                                | Idempotent registration of a completed match        |

A match record carries the match id, player id and captain name, play date, score, effective duration, end reason and the configuration used. The ranking only compares matches with the same configuration and is deterministic. It orders by score descending, then shorter duration, then earlier play date, then match id.

### Idempotent registration

The match id is a UUID generated when the battle ends. `PUT` creates the record (201), returns the stored one for an identical resubmission (200), or answers 409 for a different payload under the same id. Each completed match therefore produces exactly one history entry and one ranking entry, however many times it is sent.

### Pending queue and recovery

When a battle ends, the outcome is saved as the last result and the submission is written to `pirate-battle:pending-matches` before the request is sent. It leaves the queue only after the server confirms it. Failures record the attempt and the error message.

The queue survives refreshes. Pending submissions are retried on startup and from the **Retry now** buttons on the result screen and in the history tab. A module-level in-flight set ignores repeated clicks for the same match while a request is running, and server-side idempotency covers resubmissions after a timeout. The player can start new battles while submissions are pending, and API failures never block the menu, the options or combat.

### TanStack Query and Axios

- **Error normalization.** Axios has a 4 s timeout and normalizes errors into `timeout`, `network` and `http` failures.
- **Retries.** Only transient failures (timeouts, connection errors, 5xx and 429) are retried, at most twice, with capped exponential backoff. Client errors are not retried.
- **Query keys.** Ranking and history are keyed by configuration or player and page. `keepPreviousData` shows the previous page dimmed while the next one loads, and an "Updating…" status covers background refetches. Loading, empty and error states each have their own message, and the error state offers a retry.
- **Freshness.** Queries refetch whenever a tab is shown again (`refetchOnMount: 'always'`) and on window focus.
- **Invalidation.** After every registration attempt, both `ranking` and `history` are invalidated.
- **Late answers.** Requests receive TanStack Query's abort signal, so superseded requests are cancelled and, because each page has its own key, a late answer for another page or an older refetch cannot overwrite the data on screen. The `out-of-order` scenario and its end-to-end test exercise this.

## Mock server

MSW handlers (`src/mocks/handlers.ts`) run in the browser in development, in the Playwright runs and in the deployed build, using the same contracts, fixtures and store logic as the unit tests.

- **Fixtures.** They are generated from a fixed seed and date, so the ranking is reproducible.
- **Persistence.** Confirmed matches persist in `localStorage`.
- **Scenarios.** They control latency (fixed, seeded variable or alternating slow and fast for out-of-order answers) and failures (timeouts, connection errors, 4xx/5xx, ranking-only or history-only failures, a timeout after storing a match, unavailability during registration).
- **Reset.** The Network scenarios dialog switches scenarios and restores the initial state.

## Testing strategy

- **Vitest.** It covers the pure core: fixed step, seeded random, arena collisions, flow field, movement, weapons, damage and scoring, enemy behaviors, spawning, match rules, option validation, the mock store and the client error policy.
- **Playwright.** It drives the production build on desktop and mobile Chromium. Battles use `?e2e=1&clock=manual&seed=n`: the probe advances the simulation in fixed steps and reads state, while every action goes through the real keyboard or touch controls, the real collision code and the real renderer. Under the manual clock the render loop is capped at 20 fps to keep parallel software WebGL runs stable.
- **Visual baselines.** They use a fixed locale, the UTC timezone and reduced motion. Font rasterization differs between operating systems, so baselines are stored per platform (`__screenshots__/{win32,linux}`). Linux baselines are produced inside the official Playwright Docker image, the same image CI runs, so they match on any host; `npm run test:e2e:docker` runs the suite there from Windows, macOS or Linux.
- **CI.** GitHub Actions runs lint, type checks, formatting, unit tests and the build, then the Playwright suite in the Playwright container, uploading the HTML report and failure traces as artifacts.

## Balancing decisions

| Decision                                                         | Reason                                                                                                                                 |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Front cannon: 25 damage, 0.45 s cooldown, 560 px range           | Precise and quick, rewards aiming.                                                                                                     |
| Broadsides: three 20 damage balls, 1.2 s cooldown, 380 px range  | Strong at close range but slow, so they reward positioning alongside enemies.                                                          |
| Chaser: 40 health                                                | Sunk by two front shots or one broadside.                                                                                              |
| Shooter: 60 health                                               | Needs three front shots, more attention than a chaser.                                                                                 |
| Shooter cannon: 8 damage, 1.8 s cooldown                         | Lowered from 10 damage and 1.6 s after profiling showed a single shooter sank a stationary ship in about 18 s.                         |
| Spawn distance 520 px                                            | Greater than the 420 px shooter attack range, so no enemy can deal damage on arrival.                                                  |
| First two spawns: one chaser, one shooter                        | Guarantees both enemy types in every match. After that, spawns follow a weighted distribution.                                         |
| Enemies alive capped from 4 to 10 over the match                 | Early battles are learnable; late battles are busy without becoming a wall of ships. A spawn tick is skipped while the cap is reached. |
| Enemy mix from 60/40 to 40/60 chasers to shooters                | Late battles reward positioning and broadsides rather than only kiting chasers.                                                        |
| Repair salvage: 20 health, 35% drop (70% at half health or less) | A way to recover by playing aggressively, which counters the rising pressure without making the player immune.                         |

## Limitations

- **Visuals.** Rendering is not interpolated between simulation steps; at refresh rates above 60 Hz motion is stepped at 60 Hz.
- **Collision shapes.** Ships are circles and islands are rectangles; the rounded sand edges of the tiles are slightly inside the collision box.
- **Pathing.** The flow field ignores other ships, so enemies can briefly bunch up before separation pushes them apart.
- **Identity.** It is local to the browser (a generated player id). Clearing site data starts a new player history.
- **Visual baselines.** They exist for Windows and Linux. On macOS the visual tests skip; run the Docker script to check them.
- **Profiling run.** It uses an invulnerable flag, because the scripted bot cannot survive three minutes on its own.
