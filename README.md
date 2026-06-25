# 🚀 SpaceBake

> A relaxing idle space career sim — *Melvor Idle* meets *Freelancer / Elite / Starsector*.

Start as a broke miner in a weak shuttle on the frontier. Dock, pick a job, fit
your ship for it, send it out, and let the idle timer run. Your ship comes back
with ore, loot, XP, damage — or a story. Refine, sell, repair, upgrade, repeat.

This repo implements the **full MVP 1 → MVP 5 roadmap** plus a **starbase
expansion**: the core idle loop, a real ship-systems layer, a multi-system galaxy
with jump travel and a living market, a faction layer (reputation, contracts,
legal vs illegal cargo), the empire layer (crew, an automated fleet with passive
income, auto-repeating routes), and now **6 star systems hosting 12 rival
starbases**, **5 factions**, and explorable **ship & starbase interiors**. No
build step, no dependencies — it's a single static page in vanilla JS.

## ▶️ Play

Open `public/index.html` in any modern browser. That's it.

For a local server (recommended, avoids any file-URL quirks):

```bash
cd public && python3 -m http.server 8000
# then visit http://localhost:8000
```

## ☁️ Deploy (Cloudflare)

The game ships as static files in `public/`, served by Cloudflare Workers Static
Assets — config is in `wrangler.jsonc`. No build step.

```bash
npm install              # one-time: installs wrangler locally
npx wrangler login       # opens a browser to authorize your Cloudflare account
npx wrangler deploy      # publishes; prints a *.workers.dev URL
```

To serve it from **mydexnow.com**: add that domain to your Cloudflare account as a
zone (point its nameservers to Cloudflare and wait for it to go *active*), then
uncomment the `routes` block in `wrangler.jsonc` and run `npx wrangler deploy`
again — Wrangler attaches the custom domain and its DNS automatically.

Progress autosaves to `localStorage` every few seconds. Use **💾 Save** to force
a save and **⟲ Reset** to wipe and start fresh.

## 🎮 The loop

1. **Activities tab** — choose a power **Mode**, a combat **Behavior**, and a
   *flee-at-hull%* rule, then **Launch** a mining / combat / salvage / distress run.
   Only the operations offered at your **current starbase** are shown.
2. An idle timer runs and random **events** fire mid-run (rich veins, pirate
   scans, overheats, ambushes…).
3. The ship returns with loot, XP, and possibly **subsystem damage**.
4. **Galaxy tab** — **jump** between six star systems. Fuel and travel time scale
   with distance (Piloting trims the time); each system hosts several starbases.
5. **System tab** — explore the system you're in: **planets, moons and deep-space
   POIs**. **Scan** a body or deep space to reveal hidden sites, then launch
   **location-specific idle ops** (surface digs, crystal caves, gas skims, ruins,
   derelicts) that aren't tied to any starbase.
6. **Contracts tab** — take **faction jobs** (deliveries & bounties) for credits
   and **reputation**. Standing changes prices, unlocks goodwill, or gets you
   turned away. Watch the rival faction you anger by helping its enemy.
7. **Refinery tab** — turn raw ore into metals, fuel and parts.
8. **Market tab** — **buy and sell** at the commodity exchange. Prices differ by
   starbase, shift with live **market events**, and bend with your faction standing,
   so you can **arbitrage**: buy cheap where a good is abundant, haul it, and sell
   high where it's prized (a built-in spread blocks same-base round-trips). **Illegal
   cargo** can't be sold in lawful space and risks a **customs scan** — fence it at
   a lawless port instead.
9. **Starbase tab** — walk the **station interior**, **dock at rival bases** in the
   system, repair, refuel, and (where there's a shipyard) buy ships & modules.
   Prices and services vary by base, faction and standing; hostile bases turn you away.
10. **Ship tab** — read the **deck plan** (compartments + stationed crew), fit
    modules into slots, and watch your **reactor power budget** and **subsystem health**.
11. **Operations tab** — hire **crew** for passive bonuses, commission a **fleet**
    (idle units earn **passive income**; units **deployed to POIs** harvest resources),
    collect/sell the harvested **stockpile**, and install a Flight Computer to
    **auto-repeat** a route hands-free.

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
- **Idle combat** with armor, shields, evasion, crits, and a flee threshold, plus
  **enemy special abilities** (shielded, self-repair, alpha strike, evasive,
  subsystem-disabling, enrage) and **elite/boss** foes.
- **Escort & defense missions** — multi-wave fights where your hull carries between
  waves and loot scales with how many waves you clear, capped by a boss.
- **Distress signals** as branching decisions with combat/skill gates.
- **Mining → refining → parts** crafting chains and a frontier market economy.
- **Outfitting**: 5 ships — from the starter shuttle to a cargo **Freighter** and a
  capital **Battlecruiser** — and ~22 modules including high-tier plasma cannons,
  Bastion shields and an Antimatter reactor; slot-based fitting, repairs & refuel.
- **Commodity trading & arbitrage** — buy and sell ore, refined goods, parts and
  fuel at every base's exchange. Each base prices by its economy, live market events
  and your standing, so hauling goods between starbases for profit is a real
  playstyle; a buy/sell spread keeps same-base round-trips unprofitable. A built-in
  **best-routes scanner** surfaces the most profitable buy→sell lanes across the
  bases you've charted, ranked by per-unit profit.
- **A 4-system galaxy** (mining frontier, research nebula, war zone, trade core)
  with **jump travel** that burns fuel and time by distance, per-system station
  prices/repairs/fuel, location-gated activities, and rotating **market events**
  that spike or crash prices on a resource kind.
- **Three factions** (Freebelt Union, Xenowatch Concord, Red Maw) with **per-faction
  reputation**: standing sways sell prices and service costs, friendly stations
  cut deals, hostile ones refuse you and harass you on arrival, and helping one
  faction quietly erodes standing with its rival.
- **Faction contracts**: a rotating jobs board of **deliveries** and **bounties**
  that pay credits, XP and reputation, turned in at any station of that faction.
- **Faction storylines with branching choices**: each of the five factions has a
  multi-chapter narrative quest chain (reach standing, deliver goods, win battles,
  supply production) reported at their starbases. A mid-chain **decision** forks the
  story — shifting your standing with rival factions and **branching the finale** into
  a different objective and a different unique capstone reward (a free high-tier
  **module** or **fleet unit**).
- **Legal vs illegal cargo**: contraband can't be sold in lawful space and risks
  **customs seizure + fines** when you jump in (run Stealth mode to smuggle) —
  but fences for top credit at lawless ports.
- **Crew** — six hireable specialists (Foreman, Gunner, Engineer, Navigator,
  Quartermaster, Logistics Officer) whose bonuses apply when they fit the active
  ship's **berths**; each draws a wage from every run.
- **Fleet & passive income** — commission drones, haulers and refinery barges. Left
  **idle** at a base they earn **credits per hour**; **deployed to a discovered POI**
  they **harvest that site's resources** into a stockpile you collect to cargo or sell.
  **Refinery Barges refine the shared stockpile** — single-input first (ore→metal,
  ice→fuel) then multi-input assembly (**steel, lenses, reactor parts**), throughput-
  limited per barge and richest-output-first, so raw gathered by *any* unit becomes
  finished goods (even cross-deployment chains like uranium + titanium → reactor parts).
  Everything accrues for up to 12h **offline**; a Logistics Officer boosts it all, and a
  **ship's-log digest** (~once a minute, and on return from offline) reports what the
  barges refined. This ties the scan-and-explore loop straight into the idle economy.
- **Automation routes** — a one-time Flight Computer unlocks **auto-repeat**, which
  relaunches the chosen activity the instant your ship returns until fuel runs out.
- **Interactive scavenging encounters** — salvage runs can surface branching "broken
  ship" finds with skill/combat-gated, risk-weighted outcomes.
- **Starbases** — each system hosts **multiple rival starbases** you dock between
  instantly (re-running customs/contracts for that base's faction). Where you dock
  decides your prices, the ops on offer, the crew you can hire, and whether there's
  a shipyard. A pirate hideout can sit one hop from a lawful mining station.
- **5 factions** — the original three plus the **Helix Combine** (🟪 corporate:
  premium prices for refined goods/parts, but lowball ore) and the **Commonwealth
  Collective** (🟧 socialist: cheap fuel/repairs and fair prices). Corporate and
  socialist are **rivals**, so courting one costs standing with the other.
- **6 star systems**, including the corporate **Halcyon Drift** and the socialist
  **Solace Commons**, with the two new factions also seeded as bases in the
  original systems.
- **Ship interior** — a deck-plan map of compartments showing each subsystem's
  health and which crew is stationed where.
- **Starbase interior** — a facility map (docking bay, market, refinery, cantina,
  contracts office, shipyard, faction office) you can click to jump to its service.
- **In-system geography** — every system holds **planets, moons and deep-space
  POIs** (32 sites across the galaxy: belts, derelicts, ruins, crystal caves, gas
  giants, ice fields, anomalies…). **Scan** deep space or a body to reveal **hidden**
  sites, then run **location-specific idle ops** on them — independent of starbases.
- **POI richness tiers** — sites range from **Depleted** (×0.6) through **Standard**
  and **Rich** (×1.6) to **Pristine** (×2.4, with occasional exotic finds), scaling
  both manual-run loot and fleet harvest. Hidden, scanned-out sites skew richer, so
  surveying for that Pristine wreck genuinely pays.
- **Survey Data** — scanning produces a tradeable data resource that **Xenowatch
  Concord** and the **Helix Combine** pay a premium for and post contracts to buy.
- **Captain's Codex** — a discovery log tracking systems visited, sites charted
  (with per-system completion bars), bodies logged, lifetime career stats, and a
  **per-resource Lifetime Production** breakdown (everything you've mined, refined,
  harvested and assembled), grouped by resource kind.
- **Achievements & perks** — 16 production milestones (total output, per-kind,
  per-resource and variety) that unlock live with a ship's-log fanfare, show progress
  bars in the Codex, and each grant a **permanent perk** (more yield, better prices,
  faster refining, fleet income, weapon damage or fuel efficiency).
- **Prestige (Legacy)** — convert lifetime earnings into **Renown** and reset the run
  (ships, credits, skills, fleet, standing) for a permanent **+2%-per-Renown** boost to
  mining yield, sell prices, fleet income and weapon damage. Achievements, perks, the
  Codex and objectives carry over.
- **Sound & visual juice** — fully **procedural audio** (synthesized SFX for launches,
  unlocks, sales, errors and mission returns, plus a generative **ambient music** pad)
  built on the Web Audio API with no asset files; toggle 🔊/🎵 in the header. Visuals
  add a drifting **starfield**, button press feedback, credit-change flashes, a gold
  **pulse** on unlocks, and shimmering progress bars.
- **Settings panel** (⚙️) — master & music volume sliders, big-number abbreviation
  (1.2M), toggles for toast popups / screen effects / reduced motion, and autosave
  cadence — persisted independently of your save.
- **Combat & economy feedback** — floating **+/− credit** numbers, floating
  **hull-damage** numbers, and a red **damage flash** when you take a hit (toggleable).
- **Quality of life** — a first-launch **tutorial** (reopen any time with ❓ Help); a
  "while you were away" **offline summary** (income, harvest, missions, achievements)
  on return; **toast** pop-ups for unlocks and level-ups; a ten-step **onboarding
  objectives** track with credit rewards; and **save export/import** (the ⤓ Data
  button) to back up or move your game.

## 🗂️ Code layout

| File | Responsibility |
| --- | --- |
| `public/js/data.js` | All static content: skills, resources, modules, ships, activities, recipes, events, the galaxy of systems and market-event pool. |
| `public/js/state.js` | Game state, save/load, and derived ship stats (`shipStats`). |
| `public/js/engine.js` | The idle loop: missions, combat, events, refining, market, repairs, outfitting. |
| `public/js/ui.js` | DOM rendering for every tab + the live mission/log views. |
| `public/js/settings.js` | Player settings (volume, formatting, autosave) persisted to localStorage. |
| `public/js/sound.js` | Procedural Web Audio: synthesized SFX and generative ambient music. |
| `public/js/main.js` | Bootstrap and the `requestAnimationFrame` game loop. |
| `public/css/style.css` | The dark "deep space" theme. |

## 🧭 Roadmap (from the design doc)

- ~~**MVP 3** — multiple systems, station types, system-based pricing, market events.~~ ✅ **done**
- ~~**MVP 4** — factions, reputation effects, faction missions, legal vs illegal cargo.~~ ✅ **done**
- ~~**MVP 5** — automation routes, crew, fleets, passive station income.~~ ✅ **done**

🎉 The full design-doc roadmap (MVP 1–5) is now implemented.

Design rule kept in mind throughout: *every activity should touch at least three
systems* (e.g. mining touches cargo, heat, fuel, pirate risk, refining and market).
