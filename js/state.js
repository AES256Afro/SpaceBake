/* SpaceBake — game state, persistence and derived ship stats. */

const SAVE_KEY = 'spacebake.save.v1';

// A fresh game.
function newGame() {
  return {
    version: 1,
    credits: 600,
    rep: 0,                         // Freebelt Union standing
    fuel: 40,
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
    // pending distress decision (blocks until resolved)
    pendingDistress: null,
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
    return g;
  } catch (e) { return null; }
}
function wipeSave() { localStorage.removeItem(SAVE_KEY); }

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
