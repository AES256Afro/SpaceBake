/* SpaceBake — game state, persistence and derived ship stats. */

const SAVE_KEY = 'spacebake.save.v1';

// A fresh game.
function newGame() {
  return {
    version: 1,
    credits: 600,
    reputation: Object.fromEntries(Object.keys(FACTIONS).map(f => [f, 0])), // standing per faction (all factions)
    fuel: 40,
    currentSystem: 'kharon',        // the system you're in
    currentBase: 'kharon_station',  // the starbase you're docked at
    marketEvents: [],               // active price swings in the current system
    marketEventsEndsAt: 0,          // when to re-roll (0 => roll on first tick)
    news: [],                       // GalNet news feed (procedural flavour headlines, newest first)
    newsEndsAt: 0,                  // when to roll the next batch (0 => roll on first tick)
    newsSeen: 0,                    // timestamp the player last opened the News tab (for the unread badge)
    rumors: [],                     // cantina gossip at the current base (refreshes with the contract board)
    galaxyEvent: null,              // active cluster-wide event {id, startedAt, endsAt} or null
    galaxyEventNextAt: 0,           // earliest time the next galaxy event may start
    crewAssignments: [],            // crew off on timed side-tasks: [{idx, taskId, startedAt, endsAt}]
    heat: 0,                        // notoriety 0..100 — rises from crime, draws bounty hunters
    heatLast: Date.now(),           // last heat-decay timestamp
    outpost: null,                  // player-owned passive base {tier, lastAccrue, pendingCr} or null
    operation: null,                // active multi-step faction operation or null
    operationOffer: null,           // the operation currently on offer at this base
    contractOffers: [],             // faction contracts available at this station
    contractOffersEndsAt: 0,        // when to re-roll offers
    activeContract: null,           // the one contract you've accepted
    contractSeq: 0,                 // monotonic id source for contracts
    activeShip: 'shuttle',
    ownedShips: ['shuttle'],
    // fittings per owned ship: { slotType: [moduleId, ...] }
    fittings: {
      shuttle: {
        reactor: ['reactor_mk1'], engine: ['engine_mk1'], shield: [],
        weapon: ['laser_mk1'], mining: ['mininglaser_1'], utility: [], cargo: ['cargo_mk1'],
      },
    },
    // subsystem condition 0..100 (% health) for the active ship
    systems: freshSystems(),
    // per-ship subsystem condition for non-active owned ships (active lives in `systems`)
    shipCond: {},
    // owned loose modules (not fitted): moduleId -> count
    storage: { shield_mk1: 0 },
    // resources held in cargo: resourceId -> qty
    cargo: {},
    // skills: id -> xp
    skills: Object.fromEntries(Object.keys(SKILLS).map(k => [k, 0])),
    // current mission (null when docked)
    mission: null,
    // refining jobs queue: [{recipe, qtyLeft, endsAt}]
    refineJob: null,
    // run preferences
    mode: 'balanced',
    behavior: 'defensive',
    fleeAt: 40,                     // % hull to flee at
    repairAt: 50,                   // pause auto-repeat when ship integrity drops below this %
    // pending distress decision (blocks until resolved)
    pendingDistress: null,
    // pending scavenging encounter decision (blocks until resolved)
    pendingEncounter: null,
    // ---- MVP 5: crew, automation, fleet ----
    crew: [],                       // hired crew ids (first CREW_SLOTS are "aboard")
    unlocks: { automation: true },  // automation is on for everyone now (idle loop is core)
    autoRepeat: true,               // idle missions auto-repeat by default (pause is the damage threshold)
    fleet: {},                      // owned fleet units: unitId -> count
    fleetPendingCr: 0,              // accrued, unclaimed passive income
    fleetLast: Date.now(),          // last time fleet income/harvest was accrued
    deployments: [],                // fleet units stationed at POIs: [{unit, poi}]
    fleetStock: {},                 // resources harvested by deployed units (resId -> qty)
    bargeProduced: {},              // net goods barges refined since the last log digest
    bargeLogAt: 0,                  // when the last barge production digest was logged
    discovered: [],                 // POI ids revealed by scanning
    visited: ['kharon'],            // system ids you've been to (for the Codex)
    produced: {},                   // lifetime resources produced (resId -> qty)
    achievements: [],               // unlocked achievement ids
    loreSeen: [],                   // unlocked Codex lore entry ids
    journal: [],                    // Captain's Logbook: milestone entries (newest first)
    journalKeys: {},                // milestone keys already logged (dedupe)
    questsDone: [],                  // completed onboarding objective ids
    questChains: {},                 // faction storyline progress: fid -> {step, killBaseline}
    renown: 0,                       // prestige currency (permanent production bonus)
    renownClaimed: 0,                // lifetime renown already converted (no double-count)
    prestige: 0,                     // number of times you've reset for Legacy
    toasts: [],                     // transient unlock notifications (not really persisted)
    // rolling event/run log
    log: [],
    stats: { runs: 0, oreMined: 0, kills: 0, credEarned: 0 },
    lastTick: Date.now(),
  };
}

function freshSystems() {
  const s = {};
  for (const sys of SHIP_SYSTEMS) s[sys] = 100;
  return s;
}

// ---- persistence ----
function saveGame(g) {
  g.lastTick = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(g)); } catch (e) { /* ignore quota */ }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw);
    if (!g || g.version !== 1) return null;
    // ---- forward-migrate older saves (pre-MVP3) ----
    if (!g.currentSystem || !SYSTEMS[g.currentSystem]) g.currentSystem = 'kharon';
    // ---- forward-migrate to starbases (expansion) ----
    if (!g.currentBase || !BASES[g.currentBase] || BASES[g.currentBase].system !== g.currentSystem) {
      g.currentBase = SYSTEMS[g.currentSystem].bases[0];
    }
    if (!Array.isArray(g.marketEvents)) g.marketEvents = [];
    if (typeof g.marketEventsEndsAt !== 'number') g.marketEventsEndsAt = 0;
    if (!Array.isArray(g.news)) g.news = [];
    if (typeof g.newsEndsAt !== 'number') g.newsEndsAt = 0;
    if (typeof g.newsSeen !== 'number') g.newsSeen = 0;
    if (!Array.isArray(g.rumors)) g.rumors = [];
    if (g.galaxyEvent !== null && typeof g.galaxyEvent !== 'object') g.galaxyEvent = null;
    if (typeof g.galaxyEventNextAt !== 'number') g.galaxyEventNextAt = 0;
    if (!Array.isArray(g.crewAssignments)) g.crewAssignments = [];
    if (typeof g.heat !== 'number' || isNaN(g.heat)) g.heat = 0;
    if (typeof g.heatLast !== 'number') g.heatLast = Date.now();
    if (g.outpost !== null && (typeof g.outpost !== 'object' || typeof g.outpost.tier !== 'number')) g.outpost = null;
    if (g.operation !== null && typeof g.operation !== 'object') g.operation = null;
    if (g.operationOffer !== null && typeof g.operationOffer !== 'object') g.operationOffer = null;
    delete g.wars; // wars were never shipped as a mechanic; drop any stragglers from earlier saves
    if (g.pendingEncounter === undefined) g.pendingEncounter = null;
    // ---- forward-migrate older saves (pre-MVP4) ----
    if (!g.reputation || typeof g.reputation !== 'object') {
      g.reputation = { freebelt: g.rep || 0, concord: 0, redmaw: 0 };
    }
    for (const fid of Object.keys(FACTIONS)) if (typeof g.reputation[fid] !== 'number') g.reputation[fid] = 0;
    delete g.rep;
    if (!Array.isArray(g.contractOffers)) g.contractOffers = [];
    if (typeof g.contractOffersEndsAt !== 'number') g.contractOffersEndsAt = 0;
    if (g.activeContract === undefined) g.activeContract = null;
    if (typeof g.contractSeq !== 'number') g.contractSeq = 0;
    // ---- forward-migrate older saves (pre-MVP5) ----
    if (!Array.isArray(g.crew)) g.crew = [];
    if (!g.unlocks || typeof g.unlocks !== 'object') g.unlocks = { automation: false };
    g.unlocks.automation = true; // idle auto-repeat is now standard, not a paid unlock
    if (typeof g.autoRepeat !== 'boolean') g.autoRepeat = false;
    // one-time: turn the idle loop ON for existing saves (the whole point of the feature)
    if (!g.idleDefaultApplied) { g.autoRepeat = true; g.idleDefaultApplied = true; }
    if (typeof g.autoRepeatPaused !== 'boolean') g.autoRepeatPaused = false;
    if (typeof g.repairAt !== 'number') g.repairAt = 50;
    if (!g.fleet || typeof g.fleet !== 'object') g.fleet = {};
    if (typeof g.fleetPendingCr !== 'number') g.fleetPendingCr = 0;
    if (typeof g.fleetLast !== 'number') g.fleetLast = Date.now();
    if (!Array.isArray(g.deployments)) g.deployments = [];
    if (!g.fleetStock || typeof g.fleetStock !== 'object') g.fleetStock = {};
    if (!g.bargeProduced || typeof g.bargeProduced !== 'object') g.bargeProduced = {};
    if (typeof g.bargeLogAt !== 'number') g.bargeLogAt = 0;
    if (!Array.isArray(g.discovered)) g.discovered = [];
    if (!Array.isArray(g.visited)) g.visited = [g.currentSystem];
    if (!g.visited.includes(g.currentSystem)) g.visited.push(g.currentSystem);
    if (!g.produced || typeof g.produced !== 'object') g.produced = {};
    if (!Array.isArray(g.achievements)) g.achievements = [];
    if (!Array.isArray(g.loreSeen)) g.loreSeen = [];
    if (!Array.isArray(g.journal)) g.journal = [];
    if (!g.journalKeys || typeof g.journalKeys !== 'object') g.journalKeys = {};
    if (!Array.isArray(g.questsDone)) g.questsDone = [];
    if (!g.questChains || typeof g.questChains !== 'object') g.questChains = {};
    if (typeof g.renown !== 'number') g.renown = 0;
    if (typeof g.renownClaimed !== 'number') g.renownClaimed = 0;
    if (typeof g.prestige !== 'number') g.prestige = 0;
    // ---- validate fields shipStats()/combat read every frame: a bad value here
    // throws on every render/tick, which renders a blank, frozen UI. ----
    if (!MODES[g.mode]) g.mode = 'balanced';
    if (!BEHAVIORS[g.behavior]) g.behavior = 'defensive';
    if (typeof g.fleeAt !== 'number') g.fleeAt = 40;
    if (!SHIPS[g.activeShip]) g.activeShip = 'shuttle';
    if (!Array.isArray(g.ownedShips) || !g.ownedShips.length) g.ownedShips = ['shuttle'];
    if (!g.ownedShips.includes(g.activeShip)) g.ownedShips.push(g.activeShip);
    if (!g.fittings || typeof g.fittings !== 'object') g.fittings = {};
    if (!g.fittings[g.activeShip]) {
      g.fittings[g.activeShip] = { reactor: [], engine: [], shield: [], weapon: [], mining: [], utility: [], cargo: [] };
    }
    if (!g.systems || typeof g.systems !== 'object') g.systems = freshSystems();
    else for (const sk of SHIP_SYSTEMS) if (typeof g.systems[sk] !== 'number') g.systems[sk] = 100;
    // ---- per-ship condition (so swapping ships no longer free-repairs) ----
    // g.systems stays authoritative for the active ship; g.shipCond holds the rest.
    if (!g.shipCond || typeof g.shipCond !== 'object') g.shipCond = {};
    g.shipCond[g.activeShip] = g.systems;
    for (const sid of g.ownedShips) {
      if (!g.shipCond[sid] || typeof g.shipCond[sid] !== 'object') g.shipCond[sid] = freshSystems();
      else for (const sk of SHIP_SYSTEMS) if (typeof g.shipCond[sid][sk] !== 'number') g.shipCond[sid][sk] = 100;
    }
    g.toasts = []; // transient; never replay saved toasts
    return g;
  } catch (e) { return null; }
}
function wipeSave() { localStorage.removeItem(SAVE_KEY); }

// ---- export / import a save as a portable string ----
function exportSave(g) {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(g)))); }
  catch (e) { try { return JSON.stringify(g); } catch (e2) { return ''; } }
}
function importSave(str) {
  if (!str) return false;
  let raw = String(str).trim();
  // accept either base64-encoded or plain JSON
  let obj = null;
  try { obj = JSON.parse(decodeURIComponent(escape(atob(raw)))); } catch (e) { obj = null; }
  if (!obj) { try { obj = JSON.parse(raw); } catch (e) { obj = null; } }
  if (!obj || obj.version !== 1) { alert('That doesn\'t look like a valid SpaceBake save.'); return false; }
  if (!confirm('Load this save? Your current game will be overwritten.')) return false;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(obj)); } catch (e) { alert('Could not store the save.'); return false; }
  location.reload();
  return true;
}

// the star system the player is currently in
function curSystem(g) { return SYSTEMS[g.currentSystem] || SYSTEMS.kharon; }
// the starbase the player is currently docked at (carries station/faction/etc.)
function curBase(g) { return BASES[g.currentBase] || BASES[SYSTEMS[g.currentSystem].bases[0]]; }

// a POI is workable if it isn't hidden, or you've scanned and revealed it
function poiRevealed(g, poiId) {
  const p = POIS[poiId];
  if (!p) return false;
  return !p.hidden || (g.discovered || []).includes(poiId);
}

// ---- faction reputation ----
function factionRep(g, fid) { return (g.reputation && g.reputation[fid]) || 0; }
// adjust standing; helping a faction quietly erodes standing with its rival.
function addRep(g, fid, amt) {
  if (!g.reputation) g.reputation = {};
  g.reputation[fid] = (g.reputation[fid] || 0) + amt;
  const opp = FACTIONS[fid] && FACTIONS[fid].opposed;
  if (opp && amt !== 0) g.reputation[opp] = (g.reputation[opp] || 0) - Math.round(amt * 0.5);
  return g.reputation[fid];
}
// ---- crew (MVP 5) ----
// crew that fit the active ship's berths are "aboard" and apply their bonuses.
function crewSlots(g) { return CREW_SLOTS[g.activeShip] ?? 1; }
function crewAboard(g) {
  // crew away on an assignment vacate their berth; a benched crew slides in.
  const busy = new Set((g.crewAssignments || []).map(a => a.idx));
  const avail = (g.crew || []).filter((id, i) => !busy.has(i));
  return avail.slice(0, crewSlots(g)).map(id => CREW[id]).filter(Boolean);
}
// combined multiplier for a bonus key across aboard crew (1 = no effect)
function crewMult(g, key) {
  let s = 1;
  for (const c of crewAboard(g)) if (c.bonus && c.bonus[key]) s += c.bonus[key];
  return s;
}
// total wage drawn by aboard crew per completed mission
function crewWage(g) {
  return crewAboard(g).reduce((a, c) => a + (c.wage || 0), 0);
}

// standing tier label for a rep value
function standingName(r) {
  if (r <= -6) return 'Hostile';
  if (r < 0) return 'Suspicious';
  if (r === 0) return 'Neutral';
  if (r < 5) return 'Friendly';
  if (r < 12) return 'Trusted';
  return 'Allied';
}

// ---------------------------------------------------------------------------
// Derived stats: aggregate the active ship's hull + fitted modules + mode.
// Returns an object the engine reads from. Damaged systems scale stats down.
// ---------------------------------------------------------------------------
function shipStats(g) {
  const ship = SHIPS[g.activeShip];
  const fit = g.fittings[g.activeShip];
  const sys = g.systems;

  const s = {
    hull: ship.base.hull, maxHull: ship.base.hull,
    armor: ship.base.armor, evasion: ship.base.evasion,
    shield: 0, shieldRegen: 0,
    weapon: 0, armorPen: 0, mining: 0, salvage: 0, sensors: 10,
    cargo: 0, power: 0, draw: 0, heatGen: 0,
  };

  // sum all fitted modules
  for (const slot of Object.keys(fit)) {
    for (const modId of fit[slot]) {
      const m = MODULES[modId];
      if (!m) continue;
      if (m.power) s.power += m.power;
      if (m.draw) s.draw += m.draw;
      if (m.heat) s.heatGen += m.heat;
      for (const [k, v] of Object.entries(m.stats || {})) {
        s[k] = (s[k] || 0) + v;
      }
    }
  }

  // apply power mode multipliers
  const mult = MODES[g.mode].mult || {};
  if (mult.speed)   s.evasion *= mult.speed;       // cheap proxy: speed ~ evasion influence
  if (mult.shield)  { s.shield *= mult.shield; s.shieldRegen *= mult.shield; }
  if (mult.weapon)  s.weapon *= mult.weapon;
  if (mult.mining)  s.mining *= mult.mining;
  if (mult.sensors) s.sensors *= mult.sensors;
  const heatMult = mult.heat || 1;
  s.heatGen *= heatMult;

  // subsystem damage degrades effectiveness (linear with condition %)
  s.weapon      *= cond(sys.weapons);
  s.shield      *= cond(sys.shields);
  s.shieldRegen *= cond(sys.shields);
  s.mining      *= cond(sys.sensors) * 0.5 + cond(sys.weapons) * 0.0 + 0.5; // mining tied to sensors a bit
  s.evasion     *= cond(sys.engines);
  s.sensors     *= cond(sys.sensors);
  s.power       *= cond(sys.reactor);
  // effective hull is the hull system condition
  s.hull = Math.round(ship.base.hull * cond(sys.hull));

  // power deficit penalty: if draw exceeds power, everything sags
  s.powerOk = s.draw <= s.power;
  if (!s.powerOk && s.power > 0) {
    const ratio = s.power / s.draw;
    s.weapon *= ratio; s.shield *= ratio; s.mining *= ratio; s.evasion *= ratio;
  }

  // round display-ish numbers
  for (const k of ['weapon','shield','shieldRegen','mining','salvage','evasion','sensors','armor','cargo','power','draw','heatGen']) {
    s[k] = Math.round((s[k] || 0) * 10) / 10;
  }
  return s;
}

// condition multiplier: a system at low % is far less effective.
function cond(pct) { return Math.max(0.15, pct / 100); }

// how much cargo is currently used
function cargoUsed(g) {
  return Object.values(g.cargo).reduce((a, b) => a + b, 0);
}

// skill helpers
function skillLevel(g, id) { return levelForXp(g.skills[id] || 0); }
function addSkillXp(g, id, amt) {
  if (!(id in g.skills)) g.skills[id] = 0;
  const before = levelForXp(g.skills[id]);
  g.skills[id] += amt;
  const after = levelForXp(g.skills[id]);
  return after > before ? after : 0; // returns new level if leveled up, else 0
}
