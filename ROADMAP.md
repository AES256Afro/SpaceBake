# SpaceBake — Future Work Roadmap

Scoped plan for the next features. Each is written so a future session can implement it
directly. Pick one, follow the **conventions** below, test, then commit + deploy.

---

## How this codebase works (read first)

Vanilla JS, no build step. Files served from `public/`:

- `public/js/data.js` — all static content/config (the "what"): resources, ships, activities,
  factions, news/rumor pools, encounters, distress, lore, galaxy events, crew tasks, outpost
  tiers, operation flavor, etc. **Pure data + a few pure helpers.** Loaded first.
- `public/js/state.js` — `newGame()` (defaults), `loadGame()` (forward-migration), derived
  helpers (`shipStats`, `crewAboard`, `skillLevel`, `factionRep`, `addRep`, `producedKind` is
  in engine). Save is `localStorage`, JSON, `version: 1`.
- `public/js/engine.js` — one big IIFE (`const Engine = (() => { ... })()`). All game logic
  mutates the shared state `g`. The per-frame `tick(g)` drives timers (missions, refining,
  fleet, galaxy events, crew assignments, heat decay, outpost accrual, news). Public API is the
  `return { ... }` object at the bottom — **export anything the UI calls.**
- `public/js/ui.js` — another IIFE (`const UI`). `render()` rebuilds the DOM from `g` on
  actions; `tickRender()` runs every frame (topbar, banners, log, ticker). One `renderX()` per
  tab, dispatched in `renderBody()`. Tabs registered in the `TABS` array.
- `public/js/main.js` — boot + the rAF loop (wrapped in try/catch so a bad frame can't freeze
  the UI) + a 500ms `setInterval` tick.
- `public/css/style.css` — theme via CSS vars (`--accent`, `--panel`, `--good`, etc.).
- `public/_headers` — `Cache-Control: no-cache` so deploys reach players. Script tags in
  `index.html` also carry `?v=YYYYMMDD` — **bump it on meaningful deploys.**

### The pattern for adding a feature (do it in this order)
1. **data.js** — add the static definitions (templates, tiers, tables). Validate ids against
   real `RESOURCES`/`FACTIONS`/etc.
2. **engine.js** — add the logic functions; wire into `tick()` and/or the relevant action paths;
   **add them to the `return {}` export block** if the UI calls them.
3. **state.js** — add `newGame()` defaults AND a `loadGame()` migration guard for every new
   `g.*` field. If the field is run-specific, also reset it in `prestige()` (engine.js).
4. **ui.js** — render it; add a tab to `TABS` + `renderBody()` if it needs its own tab.
5. **css** — styles using existing vars.
6. **Test** (see below), then commit + deploy.

### Testing harnesses (use these — they catch real bugs)
All run headlessly by concatenating data+state+engine into a Node `vm` context. Examples used
throughout this project (recreate in a scratchpad):
- **Referential integrity** — cross-check every id reference in data.js (drops, events,
  encounters, quest rewards, faction wants, base activities, POI activities…). Target: **0 errors.**
- **Soak/fuzz** — drive `tick()` + ~all `Engine.*` actions randomly for 40k iterations; assert
  no throws and no invalid state (credits/fuel/cargo/systems finite & in-range). Target: **0 problems.**
- **Functional** — exercise the specific new feature end-to-end and assert outcomes.
- `node --check` each file for syntax.

### Deploy
`git add -A && git commit … && git branch -f main HEAD && git push origin main && npx wrangler deploy`.
Co-author trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
Bump `?v=` in `index.html`. Verify live with `curl -s <url>/js/<file>.js | grep -c <symbol>`.

---

## Already shipped (context)

Idle loop (auto-repeat default + paused banner), per-ship condition, crash-proof loop,
17-category GalNet news with recurring cast + market-moving shocks, cantina rumours, crew barks,
arrival flavor, 11 distress + 12 encounters + 19 mid-mission events, Codex lore, Captain's
Logbook, production-quota contracts, **galaxy-wide timed events**, **reputation-gated black
market**, **crew assignments**, **player outposts**, **heat/notoriety + bounty hunters**, and
**multi-step faction operations**.

---

## Feature 1 — Endgame goal / Legacy ranking  (size: M)

**Goal:** give the late game a destination. Today prestige (Renown) loops forever with no apex.
Add a visible long-term objective and a ranking that reflects total career achievement.

**Design**
- A **Legacy Score** computed from durable progress: `renown`, lifetime `credEarned`, distinct
  resources produced, achievements unlocked, lore unlocked, systems charted, top skill levels,
  prestige count. One formula, surfaced as a single number + a **rank title** (e.g. Drifter →
  Hauler → Trader → Magnate → Baron → Frontier Legend) via threshold bands (mirror
  `HEAT_TIERS`/`standingName` pattern).
- A handful of **capstone goals** (a "win"-ish milestone set): e.g. "Reach Renown 25", "Produce
  1M total units", "Unlock all lore", "Own a Frontier Hub outpost", "Complete an operation for
  all 5 factions". Completing all of them flags `g.legacyComplete` and shows a celebratory
  end-state (you can keep playing — idle games don't hard-stop).

**Data (data.js)**
- `LEGACY_RANKS = [{ min, title, icon }, …]` (descending, like HEAT_TIERS).
- `LEGACY_GOALS = [{ id, name, desc, done(g) }]` (predicate style like `OBJECTIVES`).

**Engine (engine.js)**
- `legacyScore(g)` — pure compute from the durable fields above.
- `legacyRank(g)` — find band for the score.
- `checkLegacy(g)` — in `tick()` (next to `checkAchievements`/`checkObjectives`/`checkLore`):
  track completed goal ids in `g.legacyGoalsDone`; log each on first completion; when all done
  and `!g.legacyComplete`, set it + a `'level'` log line + toast.
- Export `legacyScore`, `legacyRank`.

**State**
- `g.legacyGoalsDone = []`, `g.legacyComplete = false`. Migration guards. These are **meta**
  (survive prestige) — do NOT reset in `prestige()`.

**UI (ui.js)** — new section at the top of the **Codex** tab: rank title + score, a progress
list of `LEGACY_GOALS` (✓/○ like objectives), and a banner when `legacyComplete`.

**Test** — functional: construct a maxed `g`, assert rank title and that all goals flip done.

---

## Feature 2 — System control / faction tug-of-war  (size: L)

**Goal:** make the galaxy feel dynamic and player-influenceable. Systems' controlling faction
shifts over time based on a hidden "influence" value the player can nudge.

**Design**
- Each system gets per-faction **influence** (0..100). The faction with the most influence
  "controls" it (affects which contracts/operations/services appear, market modifiers, danger).
  Today `SYSTEMS[sid].factionId` is static — keep it as the *default/lore* owner but compute the
  *current* controller from influence.
- **Drift:** every few minutes, influence drifts slightly toward the lore owner (stability) with
  small random noise, and contested systems (two factions close) raise danger + spawn
  Pirate-Surge-like effects.
- **Player influence:** completing contracts/operations for a faction at/near a system raises
  that faction's influence there; smuggling / Red Maw work raises Red Maw influence (and your
  heat). Big swings flip control → a GalNet headline ("The X now hold Y").
- Keep it **bounded and legible**: a small per-system bar set, announced via news, no
  micromanagement required.

**Data (data.js)**
- `INFLUENCE_DRIFT` constants (drift rate, contest threshold, flip hysteresis).
- Optionally `SYSTEM_CONTROL_EFFECTS` (what control grants: market tilt, contract bias).

**State**
- `g.influence = { [sid]: { [factionId]: number } }`. Initialize in `newGame()` from each
  system's lore owner (owner starts ~60, others spread the rest). Migration: rebuild if missing
  or shape-invalid.
- `g.controlSeenAt` / a `controlEndsAt`-style timer for the drift cadence (mirror
  `marketEventsEndsAt`).

**Engine (engine.js)**
- `systemController(g, sid)` — argmax of influence (fallback to lore `factionId`).
- `addInfluence(g, sid, fid, n)` — clamp 0..100, renormalize-ish.
- `driftInfluence(g, now)` — in `tick()` on a timer; nudge toward owner + noise; on a control
  flip, `pushNews()` a headline and bump that system's danger handling.
- Hook `completeContract` / `chooseOperationPayoff` / Red Maw paths to `addInfluence` for the
  current system.
- Read `systemController` where `SYSTEMS[sid].factionId` is currently used for *dynamic*
  decisions (contract/operation faction at a base is still the base's faction — keep base
  factions fixed; control affects flavor, danger, market tilt, and which faction's news fires).
- Export `systemController`, influence read helpers.

**UI (ui.js)** — Galaxy tab: a small influence bar per system + current controller badge
(distinct from lore owner if flipped). A line in renderSystemMap. News already carries the flips.

**Test** — functional: pump influence for a non-owner faction past the flip threshold; assert
`systemController` changes and a news headline is filed. Fuzz must stay clean (drift in tick).

**Risk notes:** keep base factions and services stable to avoid breaking docking/contract logic;
control is a *layer on top*, not a rewrite. Renormalization math is the easy place to introduce
NaN — clamp and guard.

---

## Feature 3 — Ship-to-ship boarding  (size: L)

**Goal:** a deeper combat layer. After winning (or disabling) an enemy, optionally **board** it
for richer rewards at real risk — a mini sub-encounter rather than just loot drops.

**Design**
- Gate behind the existing **Disable Only** behavior (`BEHAVIORS.disable`) or a high enough
  Gunnery/Salvage level: when a single-enemy combat is *won by disabling*, surface a **boarding
  prompt** (a new `g.pendingEncounter`-style decision, OR a synchronous choice in the mission
  banner). Reuse the encounter machinery — boarding is essentially a bespoke `ENCOUNTERS` entry
  with weighted `outcomes` and a `combat` re-gate (the crew fights back).
- Boarding outcomes scale with the enemy: capture cargo/contraband/black boxes, rare **module
  salvage** (a free `MODULES` id to storage), intel, or a **prize** payout — vs. the risk of
  casualties (subsystem damage, a crew member "shaken" → unavailable, or a counter-boarding
  fight you can lose).
- Optionally: at high Salvage skill, a chance to **claim the hull** as scrap value or even
  (rare, capstone) a free ship.

**Cleanest implementation path (low risk):** model boarding as **encounter content**, not a new
system. Add `ENCOUNTERS` entries (`board_freighter`, `board_warship`, …) with `combat` gates and
`outcomes` that can grant `items`, `credits`, and a new `module` field; extend `applyResult`
(engine.js) to handle `module` (add to `g.storage`). Then in `runCombat`'s win path (or
`resolveMission` after a disable-win), roll a chance to set `g.pendingEncounter` to a boarding
scenario. This reuses `resolveEncounter`, the banner UI, and existing weighting — minimal new
surface.

**Data (data.js)** — new `ENCOUNTERS` entries flagged as boarding (or a separate `BOARDING`
array if you want them gated separately). Use valid resource/module ids (run refcheck).

**Engine (engine.js)**
- Extend `applyResult` to support `res.module` (→ `g.storage[id]++`, with a log line).
- In the combat-win path (single enemy, `beh.disable` or skill check), small chance →
  `g.pendingEncounter = { scenario: <boarding id> }` (guard: not already pending, not mid-thing).
- Everything else flows through existing `resolveEncounter` / `renderEncounter`.

**State** — none new if you reuse `pendingEncounter`. (If boarding can injure crew, reuse the
`crewAssignments`/availability idea or add a simple `g.crewShaken` set with a cooldown.)

**UI** — reuses the existing encounter banner (`renderEncounter`). Add an ⚔️/🚪 icon flourish
for boarding scenarios if you want them visually distinct.

**Test** — refcheck the new encounter/module references; functional: force a boarding scenario,
resolve each choice, assert rewards (including a `module` landing in storage) and no throws; fuzz
clean.

---

## Smaller backlog (nice-to-haves)
- Tie **system control** + **galaxy events** together (a war event that accelerates influence drift).
- **Outpost perks** per tier (fuel discount nearby, free minor repairs) beyond flat credits.
- **Heat decay item/service** (bribe a fixer to cool your notoriety) for a credit sink.
- **Operation variety**: visit/scan step types; rare item/fleet payoffs.
- A **settings toggle** to mute galaxy-event/boarding prompts for pure-idle players.

## Conventions checklist before any commit
- [ ] New `g.*` field → default in `newGame()` AND guard in `loadGame()` migration.
- [ ] Run-specific field → also reset in `prestige()`. Meta field → leave it.
- [ ] UI-called engine fn → added to the `Engine` export block.
- [ ] `node --check` clean on all touched files.
- [ ] Referential-integrity harness: 0 errors.
- [ ] 40k-action fuzz: 0 problems.
- [ ] Feature functional test passes.
- [ ] Bump `?v=` in `index.html`; commit; push; `wrangler deploy`; verify live with curl.
