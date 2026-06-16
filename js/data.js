/* SpaceBake — static game data
 * An idle space career sim. This file defines the "content" of the game:
 * skills, resources, modules, ships, activities and the single starter system.
 * Everything here is data-driven so the engine can stay generic.
 */

// ---------------------------------------------------------------------------
// SKILLS
// Each skill levels independently from XP earned while doing related work.
// Higher levels reduce failure chance and speed up the relevant activities.
// ---------------------------------------------------------------------------
const SKILLS = {
  mining:      { name: 'Mining',      desc: 'Extract ore, ice and rare minerals from belts.' },
  refining:    { name: 'Refining',    desc: 'Turn raw ore into metals, fuel and ship parts.' },
  gunnery:     { name: 'Gunnery',     desc: 'Weapon accuracy, crits and subsystem targeting.' },
  piloting:    { name: 'Piloting',    desc: 'Travel speed, evasion and escape chance.' },
  engineering: { name: 'Engineering', desc: 'Repair speed, reactor tuning and heat control.' },
  salvage:     { name: 'Salvage',     desc: 'Strip derelicts, wrecks and battlefield debris.' },
  trade:       { name: 'Trade',       desc: 'Better market prices and cargo contracts.' },
};

// XP curve: total XP required to *reach* a given level (Melvor-ish exponential).
const MAX_LEVEL = 99;
function xpForLevel(level) {
  // Classic RuneScape-style accumulation, scaled down a little.
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += Math.floor(l + 300 * Math.pow(2, l / 7));
  }
  return Math.floor(total / 4);
}
function levelForXp(xp) {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

// ---------------------------------------------------------------------------
// RESOURCES
// kind: ore | refined | fuel | part | salvage | loot
// value: base credits per unit at a neutral market.
// ---------------------------------------------------------------------------
const RESOURCES = {
  // raw ore
  iron_ore:      { name: 'Iron Ore',      kind: 'ore',     value: 3,   icon: '🪨' },
  nickel_ore:    { name: 'Nickel Ore',    kind: 'ore',     value: 4,   icon: '🪨' },
  ice:           { name: 'Ice',           kind: 'ore',     value: 2,   icon: '🧊' },
  titanium_ore:  { name: 'Titanium Ore',  kind: 'ore',     value: 9,   icon: '🪨' },
  copper_ore:    { name: 'Copper Ore',    kind: 'ore',     value: 7,   icon: '🪨' },
  crystal_shard: { name: 'Crystal Shard', kind: 'ore',     value: 18,  icon: '💎' },
  uranium_ore:   { name: 'Uranium Ore',   kind: 'ore',     value: 30,  icon: '☢️' },
  // refined goods
  refined_iron:  { name: 'Refined Iron',  kind: 'refined', value: 10,  icon: '🔩' },
  steel:         { name: 'Steel Plate',   kind: 'refined', value: 26,  icon: '🛡️' },
  titanium_ingot:{ name: 'Titanium Ingot',kind: 'refined', value: 32,  icon: '🧱' },
  focusing_lens: { name: 'Focusing Lens', kind: 'part',    value: 70,  icon: '🔬' },
  reactor_part:  { name: 'Reactor Part',  kind: 'part',    value: 120, icon: '⚙️' },
  // fuel
  hydrogen_fuel: { name: 'Hydrogen Fuel', kind: 'fuel',    value: 6,   icon: '⛽' },
  // salvage / loot
  scrap:         { name: 'Scrap Metal',   kind: 'salvage', value: 5,   icon: '🔧' },
  wiring:        { name: 'Wiring',        kind: 'salvage', value: 8,   icon: '🧵' },
  damaged_module:{ name: 'Damaged Module',kind: 'salvage', value: 22,  icon: '📦' },
  black_box:     { name: 'Black Box',     kind: 'loot',    value: 150, icon: '🗃️' },
  contraband:    { name: 'Contraband',    kind: 'loot',    value: 90,  icon: '🚫' },
  ammo:          { name: 'Ammo',          kind: 'part',    value: 4,   icon: '🔫' },
};

// ---------------------------------------------------------------------------
// MODULES
// Fitted into ship slots. They modify ship stats and draw reactor power / heat.
// slot: reactor | engine | shield | weapon | mining | utility | cargo
// ---------------------------------------------------------------------------
const MODULES = {
  // reactors (provide power, no draw)
  reactor_mk1:  { name: 'Reactor Mk I',   slot: 'reactor', power: 100, heat: 4, cost: 0,    stats: {} },
  reactor_mk2:  { name: 'Reactor Mk II',  slot: 'reactor', power: 160, heat: 6, cost: 4200, stats: {} },
  reactor_mk3:  { name: 'Fusion Reactor', slot: 'reactor', power: 240, heat: 9, cost: 14000,stats: {} },
  // engines
  engine_mk1:   { name: 'Ion Engine',     slot: 'engine',  draw: 20, heat: 3, cost: 0,    stats: { speed: 1.0, evasion: 5 } },
  engine_mk2:   { name: 'Plasma Drive',   slot: 'engine',  draw: 30, heat: 5, cost: 3600, stats: { speed: 1.35, evasion: 9 } },
  // shields
  shield_mk1:   { name: 'Buckler Shield', slot: 'shield',  draw: 25, heat: 4, cost: 1500, stats: { shield: 60, shieldRegen: 2 } },
  shield_mk2:   { name: 'Aegis Shield',   slot: 'shield',  draw: 38, heat: 6, cost: 6800, stats: { shield: 130, shieldRegen: 4 } },
  // weapons
  laser_mk1:    { name: 'Pulse Laser',    slot: 'weapon',  draw: 22, heat: 8,  cost: 1200, stats: { weapon: 14 } },
  railgun_mk1:  { name: 'Railgun',        slot: 'weapon',  draw: 30, heat: 12, cost: 5200, stats: { weapon: 26, armorPen: 8 } },
  // mining lasers
  mininglaser_1:{ name: 'Mining Laser I', slot: 'mining',  draw: 18, heat: 6,  cost: 0,    stats: { mining: 10 } },
  mininglaser_2:{ name: 'Mining Laser II',slot: 'mining',  draw: 26, heat: 9,  cost: 4400, stats: { mining: 22 } },
  // utility
  heatsink_1:   { name: 'Heat Sink',      slot: 'utility', draw: 4,  heat: -14, cost: 1800, stats: {} },
  scanner_1:    { name: 'Survey Scanner', slot: 'utility', draw: 10, heat: 2,  cost: 2600, stats: { sensors: 18, mining: 6 } },
  salvager_1:   { name: 'Salvage Arm',    slot: 'utility', draw: 16, heat: 5,  cost: 2400, stats: { salvage: 16 } },
  armor_1:      { name: 'Armor Plating',  slot: 'utility', draw: 0,  heat: 0,  cost: 2200, stats: { armor: 40, hull: 60 } },
  // cargo
  cargo_mk1:    { name: 'Cargo Pod I',    slot: 'cargo',   draw: 0,  heat: 0,  cost: 0,    stats: { cargo: 60 } },
  cargo_mk2:    { name: 'Cargo Pod II',   slot: 'cargo',   draw: 0,  heat: 0,  cost: 3000, stats: { cargo: 140 } },
};

// ---------------------------------------------------------------------------
// SHIPS
// Base stats + slot layout. Slots define how many modules of each type fit.
// ---------------------------------------------------------------------------
const SHIPS = {
  shuttle: {
    name: 'Rustbucket Shuttle', class: 'Shuttle', cost: 0,
    base: { hull: 120, armor: 10, evasion: 6 },
    slots: { reactor: 1, engine: 1, shield: 1, weapon: 1, mining: 1, utility: 1, cargo: 1 },
    desc: 'A wheezing starter hull. Cheap to fix, weak everywhere.',
  },
  prospector: {
    name: 'Prospector', class: 'Prospector', cost: 9000,
    base: { hull: 200, armor: 20, evasion: 4 },
    slots: { reactor: 1, engine: 1, shield: 1, weapon: 1, mining: 2, utility: 2, cargo: 2 },
    desc: 'Built to chew rock. Extra mining and cargo slots.',
  },
  gunship: {
    name: 'Vendetta Gunship', class: 'Gunship', cost: 16000,
    base: { hull: 320, armor: 45, evasion: 8 },
    slots: { reactor: 1, engine: 1, shield: 1, weapon: 3, mining: 0, utility: 2, cargo: 1 },
    desc: 'A predator. Three weapon hardpoints, thick armor.',
  },
};

// ---------------------------------------------------------------------------
// SHIP SYSTEMS that can take damage during a run. Each maps to a gameplay effect.
// ---------------------------------------------------------------------------
const SHIP_SYSTEMS = ['hull', 'reactor', 'engines', 'sensors', 'cargobay', 'weapons', 'shields', 'lifesupport'];

// ---------------------------------------------------------------------------
// POWER MODES — chosen before a run. Bias the ship toward a role.
// ---------------------------------------------------------------------------
const MODES = {
  travel:  { name: 'Travel',    desc: 'More engine power, weaker shields.',        mult: { speed: 1.3, shield: 0.6, heat: 0.9 } },
  mining:  { name: 'Mining',    desc: 'Mining lasers and survey running hot.',     mult: { mining: 1.25, shield: 0.85, heat: 1.1 } },
  combat:  { name: 'Combat',    desc: 'Weapons and shields at full.',              mult: { weapon: 1.25, shield: 1.15, heat: 1.15 } },
  stealth: { name: 'Stealth',   desc: 'Low signature, slower, weaker shields.',    mult: { speed: 0.8, sensors: 1.3, shield: 0.7, heat: 0.7 } },
  balanced:{ name: 'Balanced',  desc: 'No bias. Everything nominal.',              mult: {} },
};

// ---------------------------------------------------------------------------
// COMBAT BEHAVIOURS — player sets the rules of engagement before undocking.
// ---------------------------------------------------------------------------
const BEHAVIORS = {
  defensive:  { name: 'Defensive',    desc: 'Take less damage, fights last longer.',     dmgTaken: 0.7, dmgDealt: 0.85, lootMult: 1.0 },
  aggressive: { name: 'Aggressive',   desc: 'Deal more, take more, burn more heat.',     dmgTaken: 1.25, dmgDealt: 1.3, lootMult: 1.1, heat: 1.2 },
  disable:    { name: 'Disable Only', desc: 'Target subsystems for intact loot.',        dmgTaken: 1.0, dmgDealt: 0.9, lootMult: 1.45, disable: true },
  protect:    { name: 'Protect Cargo',desc: 'Shield the hold, eat more hull damage.',    dmgTaken: 1.15, dmgDealt: 1.0, lootMult: 0.95, protectCargo: true },
};

// ---------------------------------------------------------------------------
// ACTIVITIES — the heart of the idle loop.
// type: mine | combat | salvage | distress | refine | trade
// Each lists skill, duration, fuel, risk, reward table and an event pool.
// ---------------------------------------------------------------------------
const ACTIVITIES = {
  // ---- MINING ----
  mine_common: {
    type: 'mine', name: 'Common Asteroid Belt', skill: 'mining', reqLevel: 1,
    duration: 25, fuel: 2, risk: 'Low', xp: 16,
    desc: 'Iron, nickel and ice. Safe and slow.',
    drops: [ ['iron_ore', 3, 7], ['nickel_ore', 1, 4], ['ice', 1, 5] ],
    events: ['micrometeor', 'rich_vein'],
  },
  mine_dense: {
    type: 'mine', name: 'Dense Titanium Belt', skill: 'mining', reqLevel: 12,
    duration: 45, fuel: 5, risk: 'Medium', xp: 40,
    desc: 'Titanium and copper, with a chance at crystals.',
    drops: [ ['titanium_ore', 2, 6], ['copper_ore', 1, 4], ['crystal_shard', 0, 2] ],
    events: ['micrometeor', 'rich_vein', 'pirate_scan'],
  },
  mine_crystal: {
    type: 'mine', name: 'Crystal Field', skill: 'mining', reqLevel: 25,
    duration: 60, fuel: 7, risk: 'Medium', xp: 70,
    desc: 'Lens-grade crystal shards. Lucrative.',
    drops: [ ['crystal_shard', 2, 6], ['copper_ore', 1, 3] ],
    events: ['rich_vein', 'pirate_scan', 'sensor_ghost'],
  },
  mine_radiation: {
    type: 'mine', name: 'Radiation Pocket', skill: 'mining', reqLevel: 40,
    duration: 80, fuel: 10, risk: 'High', xp: 120,
    desc: 'Uranium ore near a radiation belt. Cooks your reactor.',
    drops: [ ['uranium_ore', 2, 5], ['titanium_ore', 1, 4] ],
    events: ['overheat', 'rich_vein', 'pirate_scan'],
    heatBonus: 18,
  },

  // ---- COMBAT ----
  patrol_weak: {
    type: 'combat', name: 'Hunt Pirate Stragglers', skill: 'gunnery', reqLevel: 1,
    duration: 30, fuel: 3, risk: 'Low', xp: 22,
    desc: 'Pick off lone, lightly-armed raiders.',
    enemy: { name: 'Pirate Skiff', hull: 60, armor: 5, weapon: 8, evasion: 6 },
    drops: [ ['scrap', 2, 5], ['ammo', 1, 6], ['hydrogen_fuel', 0, 3] ],
    events: ['ambush', 'rich_vein'],
  },
  patrol_pack: {
    type: 'combat', name: 'Break a Pirate Pack', skill: 'gunnery', reqLevel: 18,
    duration: 55, fuel: 6, risk: 'Medium', xp: 55,
    desc: 'A coordinated raider wing. Better loot, real bite.',
    enemy: { name: 'Red Maw Wing', hull: 160, armor: 20, weapon: 18, evasion: 8 },
    drops: [ ['scrap', 3, 7], ['damaged_module', 0, 2], ['contraband', 0, 1], ['ammo', 2, 6] ],
    events: ['ambush', 'reactor_strain'],
  },

  // ---- SALVAGE ----
  salvage_debris: {
    type: 'salvage', name: 'War Debris Field', skill: 'salvage', reqLevel: 1,
    duration: 35, fuel: 3, risk: 'Low', xp: 20,
    desc: 'Strip floating wreckage for scrap and parts.',
    drops: [ ['scrap', 3, 8], ['wiring', 1, 5], ['damaged_module', 0, 2] ],
    events: ['pirate_scan', 'lucky_find'],
  },
  salvage_derelict: {
    type: 'salvage', name: 'Abandoned Drill Platform', skill: 'salvage', reqLevel: 22,
    duration: 65, fuel: 6, risk: 'Medium', xp: 60,
    desc: 'A dead industrial hulk. Pirates like to lurk here.',
    drops: [ ['scrap', 4, 9], ['wiring', 2, 6], ['damaged_module', 1, 3], ['black_box', 0, 1] ],
    events: ['ambush', 'lucky_find', 'sensor_ghost'],
  },

  // ---- DISTRESS ----
  distress_signal: {
    type: 'distress', name: 'Answer Distress Signal', skill: 'piloting', reqLevel: 1,
    duration: 40, fuel: 4, risk: 'Variable', xp: 35,
    desc: 'A beacon is pinging. Could be anything.',
    // distress resolves through a dedicated branch in the engine
    events: [],
  },
};

// ---------------------------------------------------------------------------
// REFINING RECIPES — separate from activities; instant-ish batch jobs.
// in: {resource: qty}, out: {resource: qty}, time in seconds per batch.
// ---------------------------------------------------------------------------
const RECIPES = {
  refine_iron:    { name: 'Refined Iron',   skill: 'refining', reqLevel: 1,  time: 12, in: { iron_ore: 3 }, out: { refined_iron: 1 }, xp: 10 },
  make_steel:     { name: 'Steel Plate',    skill: 'refining', reqLevel: 10, time: 20, in: { refined_iron: 2, nickel_ore: 1 }, out: { steel: 1 }, xp: 22 },
  make_titanium:  { name: 'Titanium Ingot', skill: 'refining', reqLevel: 18, time: 26, in: { titanium_ore: 3 }, out: { titanium_ingot: 1 }, xp: 34 },
  make_fuel:      { name: 'Hydrogen Fuel',  skill: 'refining', reqLevel: 5,  time: 10, in: { ice: 2 }, out: { hydrogen_fuel: 2 }, xp: 8 },
  make_lens:      { name: 'Focusing Lens',  skill: 'refining', reqLevel: 30, time: 40, in: { crystal_shard: 3, copper_ore: 2 }, out: { focusing_lens: 1 }, xp: 60 },
  make_reactorpt: { name: 'Reactor Part',   skill: 'refining', reqLevel: 45, time: 60, in: { uranium_ore: 2, titanium_ingot: 2 }, out: { reactor_part: 1 }, xp: 110 },
};

// ---------------------------------------------------------------------------
// THE STARTER SYSTEM — Kharon's Belt, one station.
// Market modifiers bias buy/sell prices by resource kind.
// ---------------------------------------------------------------------------
const SYSTEM = {
  name: "Kharon's Belt",
  faction: 'Freebelt Union',
  economy: 'Mining / Frontier',
  danger: 'Medium',
  station: {
    name: 'Kharon Station',
    desc: 'A rust-streaked mining hub. Cheap repairs, fair refinery, poor shipyard.',
    // price multipliers: how this market values each resource kind when you SELL.
    sell: { ore: 0.9, refined: 1.15, part: 1.2, fuel: 1.0, salvage: 1.1, loot: 1.3 },
    repairCostPerHp: 1.2,   // credits per hull point
    fuelPrice: 7,           // credits per fuel unit
  },
};

// ---------------------------------------------------------------------------
// EVENT DEFINITIONS — fired mid-run. effect() mutates a run-result object.
// Each returns a short log line.
// ---------------------------------------------------------------------------
const EVENTS = {
  micrometeor: {
    name: 'Micro-meteor shower',
    apply: (r) => { const d = 6 + Math.floor(Math.random()*10); r.damageSystem('hull', d); return `Micro-meteors peppered the hull (-${d} hull).`; }
  },
  rich_vein: {
    name: 'Rich vein',
    apply: (r) => { r.lootMult *= 1.4; return 'Struck a rich vein — yield boosted!'; }
  },
  pirate_scan: {
    name: 'Pirate scan',
    apply: (r) => {
      if (r.evasionRoll()) return 'A pirate patrol scanned you but you slipped away.';
      const d = 10 + Math.floor(Math.random()*14);
      r.damageSystem('cargobay', d); r.stealCargo(0.15);
      return `Pirates breached the cargo bay (-${d}) and skimmed some cargo!`;
    }
  },
  overheat: {
    name: 'Reactor overheat',
    apply: (r) => {
      r.heat += 25;
      if (r.heat > 100) { const d = 12 + Math.floor(Math.random()*12); r.damageSystem('reactor', d); return `Reactor overheated and warped (-${d} reactor).`; }
      return 'Reactor temperature spiked but held.';
    }
  },
  reactor_strain: {
    name: 'Reactor strain',
    apply: (r) => { const d = 8 + Math.floor(Math.random()*10); r.damageSystem('reactor', d); return `Power surge strained the reactor (-${d}).`; }
  },
  ambush: {
    name: 'Ambush',
    apply: (r) => {
      if (r.evasionRoll()) return 'You detected an ambush early and repositioned.';
      const d = 14 + Math.floor(Math.random()*16);
      r.damageSystem('hull', d); return `Ambushed! Took ${d} hull damage before breaking contact.`;
    }
  },
  sensor_ghost: {
    name: 'Sensor ghost',
    apply: (r) => 'Sensors flagged a contact that vanished. Nothing came of it.'
  },
  lucky_find: {
    name: 'Lucky find',
    apply: (r) => { r.bonusLoot.push(['damaged_module', 1]); return 'Spotted an intact module drifting nearby — grabbed it.'; }
  },
};

// ---------------------------------------------------------------------------
// DISTRESS SCENARIOS — each is a decision tree resolved by the player.
// ---------------------------------------------------------------------------
const DISTRESS = [
  {
    id: 'freighter',
    title: 'Broken Cargo Freighter',
    text: 'A freighter drifts with a blown drive coil, crew waving through the viewport.',
    choices: [
      { label: 'Repair it for a fee', skill: 'engineering', result: { credits: [180, 360], xp: 40, log: 'You patched the coil. The grateful captain paid up.' } },
      { label: 'Strip it for parts',  result: { items: [['damaged_module', 2], ['wiring', 4], ['scrap', 5]], xp: 25, rep: -1, log: 'You took what you could. They will remember this.' } },
      { label: 'Leave them be',        result: { xp: 5, log: 'You logged the position and moved on.' } },
    ],
  },
  {
    id: 'fake_beacon',
    title: 'Suspicious Beacon',
    text: 'The distress code is malformed and the signal source keeps moving. Smells like bait.',
    choices: [
      { label: 'Investigate anyway', combat: { name: 'Pirate Ambush', hull: 110, armor: 14, weapon: 16, evasion: 7 }, result: { items: [['contraband', 1], ['scrap', 4]], xp: 50, log: 'It was a trap — but you won the fight and looted the raiders.' } },
      { label: 'Scan from range',     skill: 'electronics', result: { items: [['black_box', 1]], xp: 30, log: 'You traced the spoof to a dead drop and recovered a black box.' } },
      { label: 'Warp out',            result: { xp: 8, log: 'Better safe than salvaged. You left.' } },
    ],
  },
  {
    id: 'escape_pod',
    title: 'Escape Pod',
    text: 'A single cryo-pod tumbles through the debris, life signs faint but stable.',
    choices: [
      { label: 'Rescue the survivor', result: { credits: [120, 200], xp: 45, rep: 1, log: 'You hauled the pod aboard. The Union pays for rescues.' } },
      { label: 'Sell pod to pirates', result: { credits: [220, 340], xp: 20, rep: -2, log: 'Cold credits. The Red Maw paid well, but word travels.' } },
      { label: 'Ignore it',           result: { xp: 4, log: 'You throttled past. Not your problem.' } },
    ],
  },
  {
    id: 'research_vessel',
    title: 'Derelict Research Vessel',
    text: 'A Xenowatch science hull, dark and cold. Something flickers in the labs.',
    choices: [
      { label: 'Board and salvage', combat: { name: 'Rogue Lab Drones', hull: 90, armor: 30, weapon: 12, evasion: 4 }, result: { items: [['black_box', 1], ['damaged_module', 2], ['focusing_lens', 1]], xp: 65, log: 'The drones fought back, but the labs held real treasure.' } },
      { label: 'Tow it to station', skill: 'piloting', result: { credits: [260, 420], xp: 50, log: 'You towed the hulk in for a finder fee.' } },
      { label: 'Mark and report',   result: { xp: 12, rep: 1, log: 'You reported the wreck to the Union. Minor goodwill.' } },
    ],
  },
];
