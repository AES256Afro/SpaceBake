# 🚀 SpaceBake

> A relaxing idle space career sim — *Melvor Idle* meets *Freelancer / Elite / Starsector*.

Start as a broke miner in a weak shuttle on the frontier. Dock, pick a job, fit
your ship for it, send it out, and let the idle timer run. Your ship comes back
with ore, loot, XP, damage — or a story. Refine, sell, repair, upgrade, repeat.

This repo currently implements **MVP 1 + MVP 2** from the design doc: the full
core idle loop *plus* a real ship-systems layer. No build step, no dependencies —
it's a single static page in vanilla JS.

## ▶️ Play

Open `index.html` in any modern browser. That's it.

For a local server (recommended, avoids any file-URL quirks):

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Progress autosaves to `localStorage` every few seconds. Use **💾 Save** to force
a save and **⟲ Reset** to wipe and start fresh.

## 🎮 The loop

1. **Activities tab** — choose a power **Mode**, a combat **Behavior**, and a
   *flee-at-hull%* rule, then **Launch** a mining / combat / salvage / distress run.
2. An idle timer runs and random **events** fire mid-run (rich veins, pirate
   scans, overheats, ambushes…).
3. The ship returns with loot, XP, and possibly **subsystem damage**.
4. **Refinery tab** — turn raw ore into metals, fuel and parts.
5. **Market tab** — sell cargo (frontier prices favour refined goods).
6. **Station tab** — repair, refuel, buy ships & modules.
7. **Ship tab** — fit modules into slots and watch your **reactor power budget**
   and **subsystem health**.

## 🛠️ Systems implemented

- **7 skills** with a Melvor-style XP curve (Mining, Refining, Gunnery, Piloting,
  Engineering, Salvage, Trade). Levels cut failure/damage and boost yields.
- **Ship systems as a machine**: hull, reactor, engines, sensors, cargo bay,
  weapons, shields, life support — each can be damaged independently and degrades
  the stats it powers.
- **Reactor power budget** — modules draw power; over-budget fittings sag every
  system. **Heat** builds up and warps the reactor if you run too hot.
- **Power modes** (Travel / Mining / Combat / Stealth / Balanced) and **combat
  behaviors** (Defensive / Aggressive / Disable / Protect Cargo).
- **Idle combat** with armor, shields, evasion, crits, and a flee threshold.
- **Distress signals** as branching decisions with combat/skill gates.
- **Mining → refining → parts** crafting chains and a frontier market economy.
- **Outfitting**: 3 ships, ~18 modules, slot-based fitting, repairs & refuel.

## 🗂️ Code layout

| File | Responsibility |
| --- | --- |
| `js/data.js` | All static content: skills, resources, modules, ships, activities, recipes, events, the starter system. |
| `js/state.js` | Game state, save/load, and derived ship stats (`shipStats`). |
| `js/engine.js` | The idle loop: missions, combat, events, refining, market, repairs, outfitting. |
| `js/ui.js` | DOM rendering for every tab + the live mission/log views. |
| `js/main.js` | Bootstrap and the `requestAnimationFrame` game loop. |
| `css/style.css` | The dark "deep space" theme. |

## 🧭 Roadmap (from the design doc)

- **MVP 3** — multiple systems, station types, system-based pricing, market events.
- **MVP 4** — factions, reputation effects, faction missions, legal vs illegal cargo.
- **MVP 5** — automation routes, crew, fleets, passive station income.

Design rule kept in mind throughout: *every activity should touch at least three
systems* (e.g. mining touches cargo, heat, fuel, pirate risk, refining and market).
