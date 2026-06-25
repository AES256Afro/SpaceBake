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
  contraband:    { name: 'Contraband',    kind: 'loot',    value: 90,  icon: '🚫', illegal: true },
  ammo:          { name: 'Ammo',          kind: 'part',    value: 4,   icon: '🔫' },
  // survey data — produced by scanning, prized by research/corporate buyers
  survey_data:   { name: 'Survey Data',   kind: 'data',    value: 30,  icon: '📊' },
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
  reactor_mk4:  { name: 'Antimatter Core',slot: 'reactor', power: 360, heat: 13,cost: 38000,stats: {} },
  // engines
  engine_mk1:   { name: 'Ion Engine',     slot: 'engine',  draw: 20, heat: 3, cost: 0,    stats: { speed: 1.0, evasion: 5 } },
  engine_mk2:   { name: 'Plasma Drive',   slot: 'engine',  draw: 30, heat: 5, cost: 3600, stats: { speed: 1.35, evasion: 9 } },
  // shields
  shield_mk1:   { name: 'Buckler Shield', slot: 'shield',  draw: 25, heat: 4, cost: 1500, stats: { shield: 60, shieldRegen: 2 } },
  shield_mk2:   { name: 'Aegis Shield',   slot: 'shield',  draw: 38, heat: 6, cost: 6800, stats: { shield: 130, shieldRegen: 4 } },
  shield_mk3:   { name: 'Bastion Shield', slot: 'shield',  draw: 55, heat: 8, cost: 13000,stats: { shield: 240, shieldRegen: 7 } },
  // weapons
  laser_mk1:    { name: 'Pulse Laser',    slot: 'weapon',  draw: 22, heat: 8,  cost: 1200, stats: { weapon: 14 } },
  railgun_mk1:  { name: 'Railgun',        slot: 'weapon',  draw: 30, heat: 12, cost: 5200, stats: { weapon: 26, armorPen: 8 } },
  plasma_mk1:   { name: 'Plasma Cannon',  slot: 'weapon',  draw: 44, heat: 18, cost: 11000,stats: { weapon: 46, armorPen: 16 } },
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
  freighter: {
    name: 'Mule Freighter', class: 'Freighter', cost: 22000,
    base: { hull: 280, armor: 30, evasion: 2 },
    slots: { reactor: 1, engine: 1, shield: 1, weapon: 1, mining: 0, utility: 1, cargo: 4 },
    desc: 'A slow hauler with a cavernous hold — the trader’s workhorse for big arbitrage runs.',
  },
  battlecruiser: {
    name: 'Aegis Battlecruiser', class: 'Capital', cost: 52000,
    base: { hull: 560, armor: 75, evasion: 4 },
    slots: { reactor: 1, engine: 1, shield: 2, weapon: 4, mining: 0, utility: 3, cargo: 1 },
    desc: 'A capital warship: four hardpoints, twin shields and heavy armour. Hungry for reactor power.',
  },
};

// ---------------------------------------------------------------------------
// SHIP SYSTEMS that can take damage during a run. Each maps to a gameplay effect.
// ---------------------------------------------------------------------------
const SHIP_SYSTEMS = ['hull', 'reactor', 'engines', 'sensors', 'cargobay', 'weapons', 'shields', 'lifesupport'];

// ---------------------------------------------------------------------------
// CREW (MVP 5) — hired specialists who passively buff your ship. Only the crew
// that fit your active ship's berths (CREW_SLOTS) are "aboard" and active; the
// rest stay benched. Each draws a small wage from every completed mission.
// bonus keys: yield (loot), combat (weapon dmg), refine (refinery speed),
// speed (mission & jump time), price (sell prices), fleet (passive income),
// heatCut (less heat damage).
// ---------------------------------------------------------------------------
const CREW_SLOTS = { shuttle: 1, prospector: 2, gunship: 2, freighter: 2, battlecruiser: 3 };
const CREW = {
  foreman:   { name: 'Mining Foreman',    icon: '⛏️', cost: 3500, wage: 8,  bonus: { yield: 0.15 },               desc: '+15% haul from mining & salvage runs.' },
  gunner:    { name: 'Master Gunner',     icon: '🎯', cost: 4200, wage: 10, bonus: { combat: 0.15 },              desc: '+15% weapon damage in combat.' },
  engineer:  { name: 'Chief Engineer',    icon: '🔧', cost: 4000, wage: 9,  bonus: { refine: 0.20, heatCut: 0.4 },desc: '+20% refinery speed; far less heat damage.' },
  navigator: { name: 'Navigator',         icon: '🧭', cost: 3800, wage: 8,  bonus: { speed: 0.15 },               desc: '-15% mission & jump time.' },
  quarter:   { name: 'Quartermaster',     icon: '💼', cost: 4500, wage: 11, bonus: { price: 0.12 },               desc: '+12% sell prices at every market.' },
  logistics: { name: 'Logistics Officer', icon: '📦', cost: 6000, wage: 14, bonus: { fleet: 0.25 },               desc: '+25% fleet passive income.' },
};

// ---------------------------------------------------------------------------
// FLEET UNITS (MVP 5) — automated vessels that earn credits while you play or
// while you're away. `rate` is credits per hour, per unit (offline-capped).
// ---------------------------------------------------------------------------
// `rate` = idle credits/hour when stationed at a base; `harvest` = resource
// units/hour when deployed to a POI (split across that site's drop table).
const FLEET_UNITS = {
  mining_drone:   { name: 'Mining Drone',   icon: '🛰️', cost: 5000,  rate: 40,  harvest: 8,  desc: 'Strips nearby belts on autopilot. Best value harvester.' },
  hauler:         { name: 'Cargo Hauler',   icon: '🚛', cost: 12000, rate: 105, harvest: 12, desc: 'Runs short, safe trade hops. Hauls bulk from worked sites.' },
  refinery_barge: { name: 'Refinery Barge', icon: '🏭', cost: 26000, rate: 240, harvest: 18, desc: 'Best idle earner. Deployed, it auto-refines its harvest and assembles multi-part goods (steel, lenses, reactor parts) from the fleet stockpile.' },
};

// Automation: a one-time purchase that unlocks auto-repeating activity routes.
const AUTOMATION_COST = 5000;
// Offline fleet income is capped to this many hours of accrual.
const FLEET_OFFLINE_CAP_HOURS = 12;

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
    enemy: { name: 'Red Maw Wing', hull: 160, armor: 20, weapon: 18, evasion: 8, abilities: ['evasive'] },
    drops: [ ['scrap', 3, 7], ['damaged_module', 0, 2], ['contraband', 0, 1], ['ammo', 2, 6] ],
    events: ['ambush', 'reactor_strain'],
  },
  hunt_elite: {
    type: 'combat', name: 'Hunt an Elite Raider', skill: 'gunnery', reqLevel: 30,
    duration: 70, fuel: 8, risk: 'High', xp: 130,
    desc: 'A named ace flying a shielded, self-repairing warship. Brutal — and richly bountied.',
    enemy: { name: 'Crimson Ace', hull: 360, armor: 40, weapon: 30, evasion: 12, shield: 160, abilities: ['shielded', 'regen', 'alpha'] },
    drops: [ ['contraband', 1, 3], ['damaged_module', 1, 3], ['black_box', 0, 1], ['reactor_part', 0, 1] ],
    events: ['ambush'],
  },

  // ---- WAVE: ESCORT / DEFENSE ----
  defense_station: {
    type: 'wave', name: 'Station Defense', skill: 'gunnery', reqLevel: 12,
    duration: 65, fuel: 6, risk: 'High', xp: 90,
    desc: 'Hold a depot against waves of raiders, then their warlord. Loot scales with waves cleared.',
    waveCount: 4,
    enemy: { name: 'Raider', hull: 70, armor: 10, weapon: 14, evasion: 6 },
    boss: { name: 'Raider Warlord', hull: 280, armor: 30, weapon: 26, evasion: 7, shield: 120, abilities: ['regen', 'enrage'] },
    drops: [ ['scrap', 3, 7], ['ammo', 2, 7], ['damaged_module', 0, 2] ],
    bossDrops: [ ['contraband', 1, 2], ['black_box', 0, 1] ],
    events: ['reactor_strain'],
  },
  escort_convoy: {
    type: 'wave', name: 'Escort a Convoy', skill: 'gunnery', reqLevel: 8,
    duration: 60, fuel: 5, risk: 'Medium', xp: 70,
    desc: 'Shepherd a freighter convoy through ambushes. Disabler drones target your subsystems.',
    waveCount: 3,
    enemy: { name: 'Ambush Drone', hull: 60, armor: 6, weapon: 12, evasion: 9, abilities: ['disabler'] },
    boss: { name: 'Pirate Interceptor', hull: 200, armor: 22, weapon: 22, evasion: 11, abilities: ['alpha', 'evasive'] },
    drops: [ ['scrap', 2, 6], ['wiring', 1, 5], ['hydrogen_fuel', 1, 4] ],
    bossDrops: [ ['damaged_module', 1, 2], ['contraband', 0, 1] ],
    events: ['ambush'],
  },

  // ---- SALVAGE ----
  salvage_debris: {
    type: 'salvage', name: 'War Debris Field', skill: 'salvage', reqLevel: 1,
    duration: 35, fuel: 3, risk: 'Low', xp: 20,
    desc: 'Strip floating wreckage for scrap and parts.',
    drops: [ ['scrap', 3, 8], ['wiring', 1, 5], ['damaged_module', 0, 2] ],
    events: ['pirate_scan', 'lucky_find', 'floating_cache', 'derelict_marker'],
    encounters: ['drifting_hulk', 'mystery_container', 'unstable_wreck'],
    encChance: 0.4,
  },
  salvage_derelict: {
    type: 'salvage', name: 'Abandoned Drill Platform', skill: 'salvage', reqLevel: 22,
    duration: 65, fuel: 6, risk: 'Medium', xp: 60,
    desc: 'A dead industrial hulk. Pirates like to lurk here.',
    drops: [ ['scrap', 4, 9], ['wiring', 2, 6], ['damaged_module', 1, 3], ['black_box', 0, 1] ],
    events: ['ambush', 'lucky_find', 'sensor_ghost', 'corpse_starship'],
    encounters: ['drifting_hulk', 'cracked_reactor', 'ghost_ship', 'pirate_stash'],
    encChance: 0.55,
  },
  // A dedicated scavenging run -- light guaranteed loot, but almost always turns
  // up a *broken ship* or sealed find you have to make a decision about.
  scavenge_field: {
    type: 'salvage', name: 'Scavenge a Wreck Field', skill: 'salvage', reqLevel: 1,
    duration: 30, fuel: 3, risk: 'Variable', xp: 18,
    desc: "Drift a graveyard of broken ships and sealed crates. You never know what you'll find -- that's the point.",
    drops: [ ['scrap', 1, 4], ['wiring', 0, 3] ],
    events: ['derelict_marker', 'floating_cache', 'salvage_windfall', 'corpse_starship', 'intact_canister'],
    encounters: ['drifting_hulk', 'cracked_reactor', 'ghost_ship', 'pirate_stash', 'unstable_wreck', 'mystery_container'],
    encChance: 0.92,
  },

  // ---- DISTRESS ----
  distress_signal: {
    type: 'distress', name: 'Answer Distress Signal', skill: 'piloting', reqLevel: 1,
    duration: 40, fuel: 4, risk: 'Variable', xp: 35,
    desc: 'A beacon is pinging. Could be anything.',
    // distress resolves through a dedicated branch in the engine
    events: [],
  },

  // ---- POI / SURFACE OPERATIONS (expansion) ----
  // launched from the System Map at specific planets, moons and deep-space POIs.
  harvest_gas: {
    type: 'mine', name: 'Skim Gas Clouds', skill: 'mining', reqLevel: 1,
    duration: 30, fuel: 2, risk: 'Low', xp: 18,
    desc: 'Dip into a gas giant’s upper atmosphere and scoop hydrogen and ice.',
    drops: [ ['hydrogen_fuel', 2, 6], ['ice', 1, 3] ],
    events: ['overheat', 'sensor_ghost'],
  },
  explore_caves: {
    type: 'mine', name: 'Spelunk Crystal Caves', skill: 'mining', reqLevel: 8,
    duration: 45, fuel: 3, risk: 'Medium', xp: 42,
    desc: 'Rappel into cave systems threaded with crystal and copper veins.',
    drops: [ ['crystal_shard', 1, 4], ['copper_ore', 2, 5] ],
    events: ['micrometeor', 'rich_vein'],
  },
  explore_ruins: {
    type: 'salvage', name: 'Explore Ancient Ruins', skill: 'salvage', reqLevel: 5,
    duration: 50, fuel: 3, risk: 'Medium', xp: 48,
    desc: 'Pick through silent ruins on a dead world. Old tech, old dangers.',
    drops: [ ['black_box', 0, 1], ['damaged_module', 1, 3], ['wiring', 2, 5] ],
    events: ['lucky_find', 'sensor_ghost'],
    encounters: ['drifting_hulk', 'mystery_container'], encChance: 0.4,
  },
  surface_dig: {
    type: 'mine', name: 'Surface Mining Dig', skill: 'mining', reqLevel: 1,
    duration: 35, fuel: 2, risk: 'Low', xp: 24,
    desc: 'Set down rovers and strip an exposed ore seam.',
    drops: [ ['iron_ore', 4, 9], ['nickel_ore', 1, 4], ['copper_ore', 0, 3] ],
    events: ['micrometeor', 'rich_vein'],
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
// ACHIEVEMENTS — unlock at lifetime production milestones (tracked in g.produced).
// metric: total (all units) | kind (a resource kind) | resource (a specific id) |
// distinct (how many different resources you've produced).
// ---------------------------------------------------------------------------
// each achievement grants a small permanent perk (key: yield | price | fleet |
// combat | refine | fuel). PERK_LABEL describes the bonus in the UI.
const PERK_LABEL = { yield: 'haul yield', price: 'sell prices', fleet: 'fleet income', combat: 'weapon damage', refine: 'refinery speed', fuel: 'fuel efficiency' };
const ACHIEVEMENTS = [
  { id: 'first_haul',     icon: '📦', name: 'First Haul',      desc: 'Produce 100 total units.',          metric: 'total',                       threshold: 100,    perk: { key: 'yield',  val: 0.02 } },
  { id: 'industrialist',  icon: '🏭', name: 'Industrialist',   desc: 'Produce 5,000 total units.',        metric: 'total',                       threshold: 5000,   perk: { key: 'yield',  val: 0.05 } },
  { id: 'tycoon',         icon: '🏙️', name: 'Tycoon',          desc: 'Produce 50,000 total units.',       metric: 'total',                       threshold: 50000,  perk: { key: 'price',  val: 0.08 } },
  { id: 'magnate',        icon: '👑', name: 'Magnate',         desc: 'Produce 250,000 total units.',      metric: 'total',                       threshold: 250000, perk: { key: 'fleet',  val: 0.10 } },
  { id: 'rock_hound',     icon: '🪨', name: 'Rock Hound',      desc: 'Mine 1,000 ore.',                   metric: 'kind',     arg: 'ore',        threshold: 1000,   perk: { key: 'yield',  val: 0.03 } },
  { id: 'belt_baron',     icon: '⛏️', name: 'Belt Baron',      desc: 'Mine 25,000 ore.',                  metric: 'kind',     arg: 'ore',        threshold: 25000,  perk: { key: 'yield',  val: 0.06 } },
  { id: 'smelter',        icon: '🔩', name: 'Smelter',         desc: 'Refine 500 refined goods.',         metric: 'kind',     arg: 'refined',    threshold: 500,    perk: { key: 'refine', val: 0.05 } },
  { id: 'foundry_boss',   icon: '🛡️', name: 'Foundry Boss',    desc: 'Refine 10,000 refined goods.',      metric: 'kind',     arg: 'refined',    threshold: 10000,  perk: { key: 'refine', val: 0.10 } },
  { id: 'steel_magnate',  icon: '🛡️', name: 'Steel Magnate',   desc: 'Produce 2,000 Steel Plate.',        metric: 'resource', arg: 'steel',      threshold: 2000,   perk: { key: 'price',  val: 0.05 } },
  { id: 'machinist',      icon: '⚙️', name: 'Machinist',       desc: 'Produce 100 parts.',                metric: 'kind',     arg: 'part',       threshold: 100,    perk: { key: 'combat', val: 0.04 } },
  { id: 'reactor_line',   icon: '⚛️', name: 'Reactor Line',    desc: 'Produce 25 Reactor Parts.',         metric: 'resource', arg: 'reactor_part', threshold: 25,   perk: { key: 'fleet',  val: 0.06 } },
  { id: 'crystal_cutter', icon: '🔬', name: 'Crystal Cutter',  desc: 'Produce 50 Focusing Lenses.',       metric: 'resource', arg: 'focusing_lens', threshold: 50,  perk: { key: 'price',  val: 0.05 } },
  { id: 'fuel_baron',     icon: '⛽', name: 'Fuel Baron',      desc: 'Produce 5,000 Hydrogen Fuel.',      metric: 'resource', arg: 'hydrogen_fuel', threshold: 5000,perk: { key: 'fuel',   val: 0.08 } },
  { id: 'data_broker',    icon: '📊', name: 'Data Broker',     desc: 'Log 500 Survey Data.',              metric: 'resource', arg: 'survey_data', threshold: 500,   perk: { key: 'price',  val: 0.05 } },
  { id: 'diversified',    icon: '🧺', name: 'Diversified',     desc: 'Produce 12 distinct resources.',    metric: 'distinct',                    threshold: 12,     perk: { key: 'yield',  val: 0.03 } },
  { id: 'full_catalogue', icon: '📚', name: 'Full Catalogue',  desc: 'Produce 18 distinct resources.',    metric: 'distinct',                    threshold: 18,     perk: { key: 'fleet',  val: 0.05 } },
];

// ---------------------------------------------------------------------------
// OBJECTIVES — a light onboarding track. Each completes from observable state
// and pays a one-time credit reward, nudging new pilots through the core loops.
// ---------------------------------------------------------------------------
const OBJECTIVES = [
  { id: 'first_run',   name: 'Undock & work a run',     desc: 'Launch any activity from the Activities tab.',         reward: 150,  done: g => (g.stats.runs || 0) >= 1 },
  { id: 'refine',      name: 'Refine some ore',         desc: 'Process raw ore in the Refinery tab.',                 reward: 200,  done: g => (g.skills.refining || 0) > 0 },
  { id: 'sell',        name: 'Make a sale',             desc: 'Sell cargo at the Market.',                            reward: 200,  done: g => (g.skills.trade || 0) > 0 },
  { id: 'mining5',     name: 'Reach Mining level 5',    desc: 'Level up Mining by working belts.',                    reward: 300,  done: g => levelForXp(g.skills.mining || 0) >= 5 },
  { id: 'scan',        name: 'Survey a site',           desc: 'Scan deep space or a body in the System tab.',         reward: 300,  done: g => (g.discovered || []).length >= 1 },
  { id: 'jump',        name: 'Jump to a new system',    desc: 'Travel to another star system from the Galaxy tab.',   reward: 400,  done: g => (g.visited || []).length >= 2 },
  { id: 'crew',        name: 'Hire a crew member',      desc: 'Recruit a specialist from a starbase cantina.',        reward: 500,  done: g => (g.crew || []).length >= 1 },
  { id: 'fleet',       name: 'Commission a fleet unit', desc: 'Buy a fleet vessel in the Operations tab.',            reward: 700,  done: g => Object.values(g.fleet || {}).reduce((a, b) => a + b, 0) >= 1 },
  { id: 'deploy',      name: 'Deploy to a POI',         desc: 'Station a fleet unit at a site to harvest it.',         reward: 900,  done: g => (g.deployments || []).length >= 1 },
  { id: 'achieve',     name: 'Earn an achievement',     desc: 'Hit any production milestone.',                         reward: 1000, done: g => (g.achievements || []).length >= 1 },
];

// ---------------------------------------------------------------------------
// FACTION STORYLINES — a narrative quest chain per faction, reported chapter by
// chapter at that faction's starbases. objective.type: rep | deliver | kills |
// produce (res or kind) | visit | credEarned. reward: credits, rep, xp(+xpSkill),
// item (free module to storage), fleet (free fleet unit). Locked while hostile.
// ---------------------------------------------------------------------------
const QUESTLINES = {
  freebelt: { faction: 'freebelt', title: 'Securing the Belt', steps: [
    { title: 'A Reliable Hand', text: 'Kharon Station is short of dependable pilots. Earn the Union\'s trust and they\'ll bring you in.', objective: { type: 'rep', n: 3 }, reward: { credits: 500, rep: 2, xp: 60, xpSkill: 'piloting' } },
    { title: 'Fortify the Depots', text: 'Raiders are testing the frontier depots. Bring steel plate to shore up the bulkheads.', objective: { type: 'deliver', res: 'steel', n: 15 }, reward: { credits: 1600, rep: 2, xp: 90, xpSkill: 'trade' } },
    { choice: true, title: 'The Captured Captain', text: 'You\'ve handed the Union a captured raider captain. Command asks how to proceed.', choices: [
      { label: 'Execute him — make an example', text: 'A hard line that rattles the Red Maw.', effect: { rep: { freebelt: 1, redmaw: -2 }, log: 'The Union approves of your resolve.' }, branch: 'iron' },
      { label: 'Turn him — run him as an informant', text: 'Quieter, and it buys you intel.', effect: { rep: { freebelt: 1 }, credits: 500, log: 'He talks. The Union pays for the names.' }, branch: 'guile' },
    ]},
    { title: 'Finish the Job', text: 'How you handled the captain shapes what comes next.',
      variants: {
        iron: { title: 'Crush the Leaderless Wing', text: 'Leaderless and furious, the raiders lash out. Break them for good.', objective: { type: 'kills', n: 8 }, reward: { credits: 4000, rep: 4, xp: 150, xpSkill: 'gunnery', item: 'armor_1' } },
        guile: { title: 'Spring the Trap', text: 'Your informant set the bait. Keep a sting patrol fuelled and waiting.', objective: { type: 'produce', res: 'hydrogen_fuel', n: 800 }, reward: { credits: 4000, rep: 4, xp: 150, xpSkill: 'engineering', item: 'scanner_1' } },
      } },
  ]},
  concord: { faction: 'concord', title: 'The Deep Survey', steps: [
    { title: 'Credentials', text: 'The Concord only shares its work with trusted surveyors. Build a rapport.', objective: { type: 'rep', n: 3 }, reward: { credits: 600, rep: 2, xp: 70, xpSkill: 'piloting' } },
    { title: 'Catalogue the Veil', text: 'Map the nebula. Bring survey data for the archive.', objective: { type: 'deliver', res: 'survey_data', n: 20 }, reward: { credits: 1800, rep: 2, xp: 100, xpSkill: 'trade' } },
    { choice: true, title: 'The Anomaly Signal', text: 'Your survey caught a signal the Concord can\'t explain. Helix has quietly offered to buy your data.', choices: [
      { label: 'Publish openly — for science', text: 'Knowledge belongs to everyone. Helix won\'t be pleased.', effect: { rep: { concord: 2, corporate: -1 }, log: 'The Concord lauds your integrity.' }, branch: 'open' },
      { label: 'Sell the findings to Helix', text: 'A discreet, lucrative arrangement.', effect: { rep: { concord: -2, corporate: 1 }, credits: 3500, log: 'Helix wires the credits. The Concord notices the silence.' }, branch: 'sold' },
    ]},
    { title: 'Chase It Down', text: 'Your choice set the course of the investigation.',
      variants: {
        open: { title: 'Recover the Evidence', text: 'With the Concord behind you, dredge the deep wrecks for black boxes.', objective: { type: 'deliver', res: 'black_box', n: 2 }, reward: { credits: 4200, rep: 4, xp: 160, xpSkill: 'salvage', item: 'scanner_1' } },
        sold: { title: 'Cover Your Tracks', text: 'Helix wants the trail buried under busywork. Tool up their lenses and look away.', objective: { type: 'produce', res: 'focusing_lens', n: 25 }, reward: { credits: 5000, rep: 2, xp: 160, xpSkill: 'refining', item: 'railgun_mk1' } },
      } },
  ]},
  corporate: { faction: 'corporate', title: 'Market Dominance', steps: [
    { title: 'A Sound Investment', text: 'The Helix Combine measures everyone by their books. Prove you\'re worth a contract.', objective: { type: 'rep', n: 3 }, reward: { credits: 700, rep: 2, xp: 70, xpSkill: 'trade' } },
    { title: 'Supply the Lines', text: 'The foundries are hungry. Deliver steel and keep the quarterly numbers green.', objective: { type: 'deliver', res: 'steel', n: 20 }, reward: { credits: 2000, rep: 2, xp: 110, xpSkill: 'trade' } },
    { choice: true, title: 'The Rival Co-op', text: 'A workers\' cooperative is undercutting Helix margins. The board wants it gone.', choices: [
      { label: 'Buy them out (−4,000 cr)', text: 'Absorb them cleanly. Expensive, but tidy.', cost: 4000, effect: { rep: { corporate: 2 }, credits: -4000, log: 'Acquired and rebranded. The board is pleased.' }, branch: 'buy' },
      { label: 'Break them (sabotage)', text: 'Cheaper. The Commonwealth will hear about it.', effect: { rep: { corporate: 2, socialist: -2 }, log: 'Their contracts evaporate overnight.' }, branch: 'break' },
    ]},
    { title: 'Consolidate', text: 'Helix expects you to close the deal.',
      variants: {
        buy: { title: 'Demonstrate Returns', text: 'Make the acquisition pay. Show the board real profit.', objective: { type: 'credEarned', n: 150000 }, reward: { credits: 6000, rep: 4, xp: 180, xpSkill: 'trade', item: 'plasma_mk1' } },
        break: { title: 'Strong-Arm the Holdouts', text: 'A few diehards still resist. Convince them.', objective: { type: 'kills', n: 8 }, reward: { credits: 5000, rep: 4, xp: 180, xpSkill: 'gunnery', item: 'railgun_mk1' } },
      } },
  ]},
  socialist: { faction: 'socialist', title: 'Power to the Workers', steps: [
    { title: 'Solidarity', text: 'The Collective shares with those who share back. Stand with the communes.', objective: { type: 'rep', n: 3 }, reward: { credits: 500, rep: 2, xp: 70, xpSkill: 'piloting' } },
    { title: 'Heat the Habitats', text: 'Winter on Solace is long. Deliver hydrogen fuel to the cooperative depots.', objective: { type: 'deliver', res: 'hydrogen_fuel', n: 30 }, reward: { credits: 1500, rep: 3, xp: 100, xpSkill: 'engineering' } },
    { choice: true, title: 'The Stray Convoy', text: 'A Helix supply convoy has drifted into commune space, lightly guarded. The workers look to you.', choices: [
      { label: 'Share the surplus', text: 'Trade fairly. Even Helix can be a neighbour.', effect: { rep: { socialist: 2, corporate: 1 }, log: 'Goodwill all round — a rare thing.' }, branch: 'share' },
      { label: 'Seize it for the people', text: 'Redistribute by force. Helix will seethe.', effect: { rep: { socialist: 2, corporate: -2 }, log: 'The holds are emptied into the communes.' }, branch: 'seize' },
    ]},
    { title: 'For the Common Good', text: 'The communes rally behind your decision.',
      variants: {
        share: { title: 'Feed the Cooperatives', text: 'With Helix placated, the shared yards just need raw ore. Mine for everyone.', objective: { type: 'produce', kind: 'ore', n: 5000 }, reward: { credits: 3000, rep: 4, xp: 160, xpSkill: 'mining', fleet: 'mining_drone' } },
        seize: { title: 'Defend the Commune', text: 'Helix-paid raiders come for payback. Hold the line.', objective: { type: 'kills', n: 6 }, reward: { credits: 3200, rep: 4, xp: 160, xpSkill: 'gunnery', item: 'railgun_mk1' } },
      } },
  ]},
  redmaw: { faction: 'redmaw', title: 'Blood and Plunder', steps: [
    { title: 'Earn Your Scars', text: 'The Red Maw respects nerve, not paperwork. Show them you belong.', objective: { type: 'rep', n: 3 }, reward: { credits: 600, rep: 2, xp: 70, xpSkill: 'gunnery' } },
    { title: 'Move the Goods', text: 'Run contraband past the customs desks and bring it to the Hideout.', objective: { type: 'deliver', res: 'contraband', n: 10 }, reward: { credits: 2000, rep: 3, xp: 110, xpSkill: 'piloting' } },
    { choice: true, title: 'The Next Mark', text: 'The crew\'s split on the next score. The captain leaves the call to you.', choices: [
      { label: 'Hit the fat freighter', text: 'Pure profit, less heat.', effect: { rep: { redmaw: 1 }, credits: 1000, log: 'The crew grins. Easy money.' }, branch: 'freighter' },
      { label: 'Ambush the Union patrol', text: 'Bloody work that the Union won\'t forgive.', effect: { rep: { redmaw: 2, freebelt: -2 }, log: 'The Maw howls your name. The Union opens a file.' }, branch: 'patrol' },
    ]},
    { title: 'Take Your Cut', text: 'Your call decides the haul.',
      variants: {
        freighter: { title: 'Crack the Vault', text: 'The freighter\'s strongbox holds black boxes worth a fortune. Bring them in.', objective: { type: 'deliver', res: 'black_box', n: 2 }, reward: { credits: 5000, rep: 4, xp: 180, xpSkill: 'salvage', item: 'railgun_mk1' } },
        patrol: { title: 'Finish the Slaughter', text: 'The patrol fights back hard. Leave none to report it.', objective: { type: 'kills', n: 10 }, reward: { credits: 5500, rep: 4, xp: 190, xpSkill: 'gunnery', item: 'plasma_mk1' } },
      } },
  ]},
};

// ---------------------------------------------------------------------------
// FACTIONS (MVP 4) — the powers whose standing you build or burn.
// `lawful` stations refuse illegal cargo and run customs scans; `opposed`
// means helping one faction quietly costs you standing with its rival.
// `wants` lists the goods that faction posts delivery contracts for.
// ---------------------------------------------------------------------------
const FACTIONS = {
  freebelt: {
    name: 'Freebelt Union', icon: '🟦', lawful: true, opposed: 'redmaw',
    desc: 'Frontier miners and traders. Keep the belts working, keep the raiders out.',
    wants: ['refined_iron', 'steel', 'hydrogen_fuel', 'titanium_ingot'],
  },
  concord: {
    name: 'Xenowatch Concord', icon: '🟩', lawful: true, opposed: 'redmaw',
    desc: 'A scientific authority cataloguing the deep nebulae. Pays for crystal, lenses and data.',
    wants: ['crystal_shard', 'focusing_lens', 'survey_data', 'black_box'],
  },
  redmaw: {
    name: 'Red Maw', icon: '🟥', lawful: false, opposed: 'freebelt',
    desc: 'The dominant pirate clan of the Reach. Pays well for scrap, ammo and contraband — forgives nothing.',
    wants: ['contraband', 'scrap', 'ammo', 'damaged_module'],
  },
  corporate: {
    name: 'Helix Combine', icon: '🟪', lawful: true, opposed: 'socialist',
    desc: 'A vertically-integrated megacorp. Premium prices for refined goods and parts — and a price for everything else.',
    wants: ['steel', 'focusing_lens', 'reactor_part', 'survey_data'],
  },
  socialist: {
    name: 'Commonwealth Collective', icon: '🟧', lawful: true, opposed: 'corporate',
    desc: 'A federation of worker communes. Cheap fuel and repairs, fair prices, and no time for profiteers.',
    wants: ['refined_iron', 'hydrogen_fuel', 'steel', 'scrap'],
  },
};

// ---------------------------------------------------------------------------
// THE GALAXY — star systems you jump between (MVP 3), each hosting one or more
// STARBASES (expansion). A system has position (jump distance), danger and a
// controlling `factionId` for flavour; the *bases* carry the station services,
// faction, available activities and hireable crew. Bases in the same system can
// belong to rival factions, so where you dock matters as much as where you fly.
// ---------------------------------------------------------------------------
const SYSTEMS = {
  kharon: {
    id: 'kharon', factionId: 'freebelt',
    name: "Kharon's Belt", economy: 'Mining / Frontier', danger: 'Medium',
    pos: { x: 0, y: 0 },
    desc: 'The rust-streaked frontier you call home. Endless belts, lurking raiders.',
    star: 'Kharon (orange dwarf)',
    bases: ['kharon_station', 'redmaw_hideout'],
    bodies: ['kharon_iv', 'kharon_iv_a'],
    spacePois: ['kh_belt', 'kh_derelict', 'kh_anomaly'],
  },
  veil: {
    id: 'veil', factionId: 'concord',
    name: 'Veil Nebula', economy: 'Research / Crystal', danger: 'Low',
    pos: { x: 3, y: 2 },
    desc: 'A glittering nebula of crystal fields and quiet research stations. Parts and lenses fetch a fortune.',
    star: 'Veil (binary, veiled in dust)',
    bases: ['concord_spire', 'helix_annex'],
    bodies: ['veil_prime', 'veil_shard'],
    spacePois: ['vl_crystalfield', 'vl_nebula', 'vl_relic'],
  },
  tartarus: {
    id: 'tartarus', factionId: 'redmaw',
    name: 'Tartarus Reach', economy: 'War Zone', danger: 'High',
    pos: { x: 6, y: -1 },
    desc: 'A burnt-out battlefield bristling with pirate wings and irradiated wrecks. Dangerous — and rich.',
    star: 'Tartarus (dying red giant)',
    bases: ['gallows_anchorage', 'salvage_commune'],
    bodies: ['tartarus_hulk', 'tartarus_moon'],
    spacePois: ['tt_graveyard', 'tt_radbelt', 'tt_flagship'],
  },
  meridian: {
    id: 'meridian', factionId: 'freebelt',
    name: 'Meridian Hub', economy: 'Trade / Core', danger: 'Low',
    pos: { x: 2, y: 5 },
    desc: 'A bustling core trade station. The best prices in the cluster and the cheapest fuel — but little to mine.',
    star: 'Meridian (stable yellow star)',
    bases: ['meridian_exchange', 'helix_tower'],
    bodies: ['meridian_b', 'meridian_b_a'],
    spacePois: ['md_ring', 'md_outpost'],
  },
  halcyon: {
    id: 'halcyon', factionId: 'corporate',
    name: 'Halcyon Drift', economy: 'Industrial / Corporate', danger: 'Medium',
    pos: { x: 5, y: 4 },
    desc: 'A company system of foundries and logistics yards, lit by the glow of the Helix Combine.',
    star: 'Halcyon (managed white star)',
    bases: ['helix_foundry', 'combine_port'],
    bodies: ['halcyon_forge', 'halcyon_slag'],
    spacePois: ['hl_scrapyard', 'hl_blacksite'],
  },
  solace: {
    id: 'solace', factionId: 'socialist',
    name: 'Solace Commons', economy: 'Collective / Cooperative', danger: 'Low',
    pos: { x: -2, y: 3 },
    desc: 'A federation of worker communes running shared yards and open belts. No bosses, no gouging.',
    star: 'Solace (gentle amber star)',
    bases: ['commonwealth_hall', 'peoples_yard'],
    bodies: ['solace_garden', 'solace_rock'],
    spacePois: ['sl_belt', 'sl_co_op'],
  },
};

// ---------------------------------------------------------------------------
// STARBASES — where you actually dock. Each carries its faction, market
// modifiers (sell), repair/fuel pricing, the activities launchable here, the
// crew that can be hired here, whether it has a shipyard, and an interior map
// of facilities for the Starbase view.
// ---------------------------------------------------------------------------
const BASES = {
  // --- Kharon's Belt ---
  kharon_station: {
    id: 'kharon_station', system: 'kharon', factionId: 'freebelt', type: 'Mining Hub',
    name: 'Kharon Station', desc: 'A rust-streaked mining hub. Cheap repairs, fair refinery, modest shipyard.',
    station: { sell: { ore: 0.9, refined: 1.15, part: 1.2, fuel: 1.0, salvage: 1.1, loot: 1.3 }, repairCostPerHp: 1.2, fuelPrice: 7 },
    activities: ['mine_common', 'mine_dense', 'salvage_debris', 'scavenge_field', 'escort_convoy', 'defense_station', 'distress_signal'],
    crew: ['foreman', 'engineer'], shipyard: true,
    facilities: ['dock', 'market', 'refinery', 'cantina', 'contracts', 'shipyard'],
  },
  redmaw_hideout: {
    id: 'redmaw_hideout', system: 'kharon', factionId: 'redmaw', type: 'Pirate Outpost',
    name: 'Red Maw Hideout', desc: 'A hollowed asteroid full of smugglers. No customs, no questions — and no mercy.',
    station: { sell: { ore: 1.0, refined: 1.1, part: 1.15, fuel: 1.4, salvage: 1.4, loot: 1.7 }, repairCostPerHp: 2.2, fuelPrice: 13 },
    activities: ['patrol_weak', 'hunt_elite', 'salvage_debris', 'scavenge_field', 'distress_signal'],
    crew: ['gunner', 'navigator'], shipyard: false,
    facilities: ['dock', 'market', 'cantina', 'contracts'],
  },
  // --- Veil Nebula ---
  concord_spire: {
    id: 'concord_spire', system: 'veil', factionId: 'concord', type: 'Research Station',
    name: 'Concord Spire', desc: 'A pristine science platform. Top credit for parts and refined goods; pricey repairs.',
    station: { sell: { ore: 1.0, refined: 1.2, part: 1.5, fuel: 1.1, salvage: 1.0, loot: 1.2 }, repairCostPerHp: 1.5, fuelPrice: 8 },
    activities: ['mine_dense', 'mine_crystal', 'scavenge_field', 'distress_signal'],
    crew: ['engineer', 'navigator'], shipyard: false,
    facilities: ['dock', 'market', 'refinery', 'cantina', 'contracts'],
  },
  helix_annex: {
    id: 'helix_annex', system: 'veil', factionId: 'corporate', type: 'Corporate Annex',
    name: 'Helix Research Annex', desc: 'A Combine forward office buying up crystal research. Pays premium for parts; lowballs ore.',
    station: { sell: { ore: 0.85, refined: 1.3, part: 1.55, fuel: 1.0, salvage: 0.95, loot: 1.1 }, repairCostPerHp: 1.6, fuelPrice: 8 },
    activities: ['mine_dense', 'salvage_derelict', 'distress_signal'],
    crew: ['quarter', 'logistics'], shipyard: false,
    facilities: ['dock', 'market', 'refinery', 'cantina', 'contracts', 'faction_office'],
  },
  // --- Tartarus Reach ---
  gallows_anchorage: {
    id: 'gallows_anchorage', system: 'tartarus', factionId: 'redmaw', type: 'Free Port',
    name: 'Gallows Anchorage', desc: 'A lawless free port. Fences loot and salvage for a killing; fuel and repairs cost a killing too.',
    station: { sell: { ore: 1.05, refined: 1.25, part: 1.3, fuel: 1.3, salvage: 1.3, loot: 1.6 }, repairCostPerHp: 2.0, fuelPrice: 12 },
    activities: ['mine_radiation', 'patrol_pack', 'hunt_elite', 'salvage_derelict', 'scavenge_field', 'distress_signal'],
    crew: ['gunner', 'quarter'], shipyard: true,
    facilities: ['dock', 'market', 'cantina', 'contracts', 'shipyard'],
  },
  salvage_commune: {
    id: 'salvage_commune', system: 'tartarus', factionId: 'socialist', type: 'Salvage Commune',
    name: 'Salvage Commune', desc: 'A worker co-op stripping the battlefield. Cheap repairs and fuel; pays fairly for salvage.',
    station: { sell: { ore: 1.1, refined: 1.1, part: 1.15, fuel: 0.85, salvage: 1.35, loot: 1.2 }, repairCostPerHp: 0.9, fuelPrice: 5 },
    activities: ['salvage_derelict', 'salvage_debris', 'scavenge_field', 'mine_radiation'],
    crew: ['foreman', 'engineer'], shipyard: false,
    facilities: ['dock', 'market', 'refinery', 'cantina', 'contracts', 'faction_office'],
  },
  // --- Meridian Hub ---
  meridian_exchange: {
    id: 'meridian_exchange', system: 'meridian', factionId: 'freebelt', type: 'Trade Hub',
    name: 'Meridian Exchange', desc: 'A gleaming commercial hub. Best all-round prices, cheap fuel and fast repairs.',
    station: { sell: { ore: 1.15, refined: 1.35, part: 1.4, fuel: 0.9, salvage: 1.2, loot: 1.4 }, repairCostPerHp: 1.0, fuelPrice: 5 },
    activities: ['patrol_weak', 'salvage_debris', 'scavenge_field', 'escort_convoy', 'defense_station', 'distress_signal'],
    crew: ['quarter', 'logistics'], shipyard: true,
    facilities: ['dock', 'market', 'refinery', 'cantina', 'contracts', 'shipyard'],
  },
  helix_tower: {
    id: 'helix_tower', system: 'meridian', factionId: 'corporate', type: 'Corporate HQ',
    name: 'Helix Tower', desc: 'The Combine regional headquarters. Premium for refined goods and parts; a full corporate shipyard.',
    station: { sell: { ore: 0.85, refined: 1.4, part: 1.6, fuel: 0.95, salvage: 0.9, loot: 1.15 }, repairCostPerHp: 1.4, fuelPrice: 7 },
    activities: ['patrol_weak', 'hunt_elite', 'salvage_debris', 'defense_station', 'distress_signal'],
    crew: ['quarter', 'logistics', 'navigator'], shipyard: true,
    facilities: ['dock', 'market', 'refinery', 'cantina', 'contracts', 'shipyard', 'faction_office'],
  },
  // --- Halcyon Drift (corporate) ---
  helix_foundry: {
    id: 'helix_foundry', system: 'halcyon', factionId: 'corporate', type: 'Foundry',
    name: 'Helix Foundry', desc: 'A roaring company foundry. Buys raw ore at a premium to feed the furnaces.',
    station: { sell: { ore: 1.3, refined: 1.1, part: 1.25, fuel: 1.0, salvage: 1.1, loot: 1.0 }, repairCostPerHp: 1.3, fuelPrice: 7 },
    activities: ['mine_dense', 'mine_radiation', 'salvage_derelict'],
    crew: ['engineer', 'logistics'], shipyard: false,
    facilities: ['dock', 'market', 'refinery', 'cantina', 'contracts', 'faction_office'],
  },
  combine_port: {
    id: 'combine_port', system: 'halcyon', factionId: 'corporate', type: 'Logistics Port',
    name: 'Combine Logistics Port', desc: 'A sprawling freight depot. Steady prices and a deep contract board.',
    station: { sell: { ore: 1.1, refined: 1.25, part: 1.35, fuel: 1.05, salvage: 1.15, loot: 1.1 }, repairCostPerHp: 1.2, fuelPrice: 8 },
    activities: ['salvage_debris', 'patrol_weak', 'escort_convoy', 'distress_signal'],
    crew: ['logistics', 'quarter'], shipyard: false,
    facilities: ['dock', 'market', 'refinery', 'cantina', 'contracts'],
  },
  // --- Solace Commons (socialist) ---
  commonwealth_hall: {
    id: 'commonwealth_hall', system: 'solace', factionId: 'socialist', type: "People's Hall",
    name: 'Commonwealth Hall', desc: 'The heart of the Collective. The cheapest fuel and repairs anywhere; fair prices for all.',
    station: { sell: { ore: 1.1, refined: 1.15, part: 1.2, fuel: 0.8, salvage: 1.2, loot: 1.15 }, repairCostPerHp: 0.85, fuelPrice: 4 },
    activities: ['mine_common', 'salvage_debris', 'scavenge_field', 'escort_convoy', 'defense_station', 'distress_signal'],
    crew: ['foreman', 'engineer', 'navigator'], shipyard: false,
    facilities: ['dock', 'market', 'refinery', 'cantina', 'contracts', 'faction_office'],
  },
  peoples_yard: {
    id: 'peoples_yard', system: 'solace', factionId: 'socialist', type: 'Cooperative Yard',
    name: "People's Yard", desc: 'A shared shipyard run by the dockworkers themselves. Cheap hulls, cheaper repairs.',
    station: { sell: { ore: 1.05, refined: 1.2, part: 1.25, fuel: 0.85, salvage: 1.3, loot: 1.1 }, repairCostPerHp: 0.8, fuelPrice: 5 },
    activities: ['salvage_derelict', 'mine_dense', 'scavenge_field'],
    crew: ['engineer', 'gunner'], shipyard: true,
    facilities: ['dock', 'market', 'refinery', 'cantina', 'contracts', 'shipyard'],
  },
};

// the primary (controlling) base of a system — where inter-system jumps arrive.
function primaryBaseId(systemId) { return SYSTEMS[systemId].bases[0]; }

// labels + icons for starbase interior facilities
const FACILITY_INFO = {
  dock:          { icon: '🛬', name: 'Docking Bay',   desc: 'Berths, fuel lines and the long walk to the concourse.' },
  market:        { icon: '💱', name: 'Commodities Market', desc: 'Traders haggling over ore, parts and stranger cargo.' },
  refinery:      { icon: '⚗️', name: 'Refinery Bay',  desc: 'Furnaces and presses turning raw rock into goods.' },
  cantina:       { icon: '🍻', name: 'Cantina',       desc: 'Where crews drink, brag, and look for a berth.' },
  contracts:     { icon: '📋', name: 'Contracts Office', desc: 'A board of faction jobs for those who need the work.' },
  shipyard:      { icon: '🏗️', name: 'Shipyard',      desc: 'Cranes and drydocks selling hulls and modules.' },
  faction_office:{ icon: '🏛️', name: 'Faction Office', desc: 'The local authority, watching who comes and goes.' },
};

// ---------------------------------------------------------------------------
// CELESTIAL BODIES — planets, moons and gas giants within systems. Each holds
// surface/orbital POIs you can scan for and work. `parent` links a moon to its
// planet for display.
// ---------------------------------------------------------------------------
const BODIES = {
  // Kharon's Belt
  kharon_iv:   { id: 'kharon_iv', system: 'kharon', type: 'planet', name: 'Kharon IV', desc: 'A cracked rocky world, mined since the first prospectors arrived.', pois: ['kh_mine_seam', 'kh_ruins'] },
  kharon_iv_a: { id: 'kharon_iv_a', system: 'kharon', type: 'moon', parent: 'kharon_iv', name: 'Kharon IV-a', desc: 'A small ice moon in tidal lock.', pois: ['kh_ice'] },
  // Veil Nebula
  veil_prime:  { id: 'veil_prime', system: 'veil', type: 'gas_giant', name: 'Veil Prime', desc: 'A banded gas giant wreathed in the nebula’s glow.', pois: ['vl_gas'] },
  veil_shard:  { id: 'veil_shard', system: 'veil', type: 'moon', parent: 'veil_prime', name: 'The Shard', desc: 'A crystalline moon, caves glittering with shards.', pois: ['vl_caves', 'vl_ice'] },
  // Tartarus Reach
  tartarus_hulk: { id: 'tartarus_hulk', system: 'tartarus', type: 'planet', name: 'The Hulk', desc: 'A dead world cratered by the war that gutted this system.', pois: ['tt_ruins', 'tt_caches'] },
  tartarus_moon: { id: 'tartarus_moon', system: 'tartarus', type: 'moon', parent: 'tartarus_hulk', name: 'Ossuary', desc: 'A cratered moon strip-mined for irradiated ore.', pois: ['tt_cratermine'] },
  // Meridian Hub
  meridian_b:   { id: 'meridian_b', system: 'meridian', type: 'planet', name: 'Meridian B', desc: 'A half-terraformed world dotted with company digs.', pois: ['md_dig'] },
  meridian_b_a: { id: 'meridian_b_a', system: 'meridian', type: 'moon', parent: 'meridian_b', name: 'Meridian B-a', desc: 'A frozen moon with deep polar ice.', pois: ['md_ice'] },
  // Halcyon Drift
  halcyon_forge: { id: 'halcyon_forge', system: 'halcyon', type: 'planet', name: 'Forge World', desc: 'A scorched industrial planet, its crust opened for ore.', pois: ['hl_dig', 'hl_caves'] },
  halcyon_slag:  { id: 'halcyon_slag', system: 'halcyon', type: 'moon', parent: 'halcyon_forge', name: 'Slag', desc: 'A moon buried under centuries of company tailings.', pois: ['hl_slagmine'] },
  // Solace Commons
  solace_garden: { id: 'solace_garden', system: 'solace', type: 'planet', name: 'Garden', desc: 'A green, cooperatively-farmed world over old settlements.', pois: ['sl_caves', 'sl_ruins'] },
  solace_rock:   { id: 'solace_rock', system: 'solace', type: 'moon', parent: 'solace_garden', name: 'The Rock', desc: 'A communal mining moon worked in shifts.', pois: ['sl_dig'] },
};

// ---------------------------------------------------------------------------
// POI RICHNESS TIERS — how lucrative a site is. `mult` scales both manual-run
// loot and deployed-fleet harvest; `rare` sites sometimes yield exotic materials.
// Hidden, scanned-out sites skew richer, so surveying pays off.
// ---------------------------------------------------------------------------
const POI_TIERS = {
  depleted: { mult: 0.6, label: 'Depleted', cls: 'tier-poor' },
  standard: { mult: 1.0, label: 'Standard', cls: 'tier-std' },
  rich:     { mult: 1.6, label: 'Rich',     cls: 'tier-rich' },
  pristine: { mult: 2.4, label: 'Pristine', cls: 'tier-pristine', rare: true },
};
// exotic materials a pristine site can turn up as a bonus
const PRISTINE_RARE_DROPS = ['crystal_shard', 'focusing_lens', 'reactor_part', 'black_box', 'uranium_ore'];

// ---------------------------------------------------------------------------
// POINTS OF INTEREST — discrete locations (deep space or on a body) that each
// offer an idle activity. `hidden` POIs must be revealed by scanning the system
// (deep space) or the body (surface) before they can be worked. `tier` defaults
// to 'standard' when omitted.
// ---------------------------------------------------------------------------
const POIS = {
  // --- Kharon's Belt ---
  kh_belt:      { id: 'kh_belt', name: 'Common Asteroid Belt', type: 'belt', icon: '🪨', desc: 'A dense field of iron, nickel and ice.', activity: 'mine_common' },
  kh_derelict:  { id: 'kh_derelict', name: 'Derelict Freighter', type: 'wreck', icon: '🛰️', desc: 'A long-dead hauler drifting off the belt lanes.', activity: 'salvage_derelict' },
  kh_anomaly:   { id: 'kh_anomaly', name: 'Sensor Anomaly', type: 'anomaly', icon: '❓', desc: 'A flickering contact the charts don’t explain.', activity: 'scavenge_field', hidden: true, tier: 'rich' },
  kh_mine_seam: { id: 'kh_mine_seam', name: 'Exposed Ore Seam', type: 'dig', icon: '⛏️', desc: 'A rich seam laid bare on Kharon IV.', activity: 'surface_dig' },
  kh_ruins:     { id: 'kh_ruins', name: 'Frontier Ruins', type: 'ruins', icon: '🏛️', desc: 'Collapsed prospector domes, older than the Union.', activity: 'explore_ruins', hidden: true, tier: 'rich' },
  kh_ice:       { id: 'kh_ice', name: 'Ice Fields', type: 'ice', icon: '🧊', desc: 'Harvestable ice across the moon’s dark side.', activity: 'harvest_gas' },
  // --- Veil Nebula ---
  vl_crystalfield: { id: 'vl_crystalfield', name: 'Crystal Field', type: 'belt', icon: '💎', desc: 'Lens-grade shards adrift in the dust.', activity: 'mine_crystal', tier: 'rich' },
  vl_nebula:    { id: 'vl_nebula', name: 'Dense Nebula Pocket', type: 'gas', icon: '🌫️', desc: 'A thick pocket of harvestable gases.', activity: 'harvest_gas' },
  vl_relic:     { id: 'vl_relic', name: 'Drifting Relic', type: 'ruins', icon: '🏛️', desc: 'An ancient hull the Concord pretends not to study.', activity: 'explore_ruins', hidden: true, tier: 'pristine' },
  vl_gas:       { id: 'vl_gas', name: 'Upper Atmosphere', type: 'gas', icon: '🌪️', desc: 'Skim the gas giant for hydrogen and ice.', activity: 'harvest_gas' },
  vl_caves:     { id: 'vl_caves', name: 'Crystal Caves', type: 'caves', icon: '🕳️', desc: 'Shard-lined caverns beneath the moon.', activity: 'explore_caves' },
  vl_ice:       { id: 'vl_ice', name: 'Frozen Caverns', type: 'caves', icon: '🧊', desc: 'Sealed ice caves rumoured to hide deeper veins.', activity: 'explore_caves', hidden: true },
  // --- Tartarus Reach ---
  tt_graveyard: { id: 'tt_graveyard', name: 'Ship Graveyard', type: 'wreck', icon: '🛸', desc: 'A drifting field of broken warships.', activity: 'scavenge_field' },
  tt_radbelt:   { id: 'tt_radbelt', name: 'Radiation Belt', type: 'belt', icon: '☢️', desc: 'Uranium-rich rock near a hot radiation belt.', activity: 'mine_radiation', tier: 'rich' },
  tt_flagship:  { id: 'tt_flagship', name: 'Wrecked Flagship', type: 'wreck', icon: '🛰️', desc: 'The gutted hulk of a command ship — picked at, never emptied.', activity: 'salvage_derelict', hidden: true, tier: 'pristine' },
  tt_ruins:     { id: 'tt_ruins', name: 'War Ruins', type: 'ruins', icon: '🏛️', desc: 'Bombed-out installations on the dead world.', activity: 'explore_ruins' },
  tt_caches:    { id: 'tt_caches', name: 'Buried Caches', type: 'ruins', icon: '🗃️', desc: 'Munitions caches someone meant to come back for.', activity: 'explore_ruins', hidden: true },
  tt_cratermine:{ id: 'tt_cratermine', name: 'Crater Mine', type: 'dig', icon: '☢️', desc: 'An open-pit dig into irradiated regolith.', activity: 'mine_radiation' },
  // --- Meridian Hub ---
  md_ring:      { id: 'md_ring', name: 'Planetary Ring', type: 'belt', icon: '💫', desc: 'A bright ring rich in titanium and copper.', activity: 'mine_dense', tier: 'rich' },
  md_outpost:   { id: 'md_outpost', name: 'Abandoned Outpost', type: 'wreck', icon: '🏚️', desc: 'A stripped customs outpost worth a second look.', activity: 'salvage_debris', tier: 'depleted' },
  md_dig:       { id: 'md_dig', name: 'Strip Mine', type: 'dig', icon: '⛏️', desc: 'A sanctioned company strip mine.', activity: 'surface_dig' },
  md_ice:       { id: 'md_ice', name: 'Polar Ice', type: 'ice', icon: '🧊', desc: 'Deep polar ice, easy to harvest.', activity: 'harvest_gas' },
  // --- Halcyon Drift ---
  hl_scrapyard: { id: 'hl_scrapyard', name: 'Company Scrapyard', type: 'wreck', icon: '🏚️', desc: 'A sea of decommissioned company hulls.', activity: 'salvage_debris' },
  hl_blacksite: { id: 'hl_blacksite', name: 'Combine Black Site', type: 'ruins', icon: '🏛️', desc: 'An off-books facility the Combine scrubbed from the charts.', activity: 'explore_ruins', hidden: true, tier: 'pristine' },
  hl_dig:       { id: 'hl_dig', name: 'Company Dig', type: 'dig', icon: '⛏️', desc: 'A round-the-clock corporate ore dig.', activity: 'surface_dig' },
  hl_caves:     { id: 'hl_caves', name: 'Deep Caves', type: 'caves', icon: '🕳️', desc: 'Machine-cut caverns chasing crystal seams.', activity: 'explore_caves' },
  hl_slagmine:  { id: 'hl_slagmine', name: 'Slag Reclamation', type: 'dig', icon: '⛏️', desc: 'Reclaim ore from centuries of tailings.', activity: 'surface_dig', tier: 'depleted' },
  // --- Solace Commons ---
  sl_belt:      { id: 'sl_belt', name: 'Open Belt', type: 'belt', icon: '🪨', desc: 'A communally-worked asteroid belt.', activity: 'mine_common' },
  sl_co_op:     { id: 'sl_co_op', name: 'Co-op Salvage Run', type: 'wreck', icon: '🛰️', desc: 'A shared salvage route through old debris.', activity: 'salvage_debris' },
  sl_caves:     { id: 'sl_caves', name: 'Community Caves', type: 'caves', icon: '🕳️', desc: 'Caves worked in shifts by the commune.', activity: 'explore_caves' },
  sl_ruins:     { id: 'sl_ruins', name: 'Old Settlement', type: 'ruins', icon: '🏛️', desc: 'The buried first settlement, half-remembered.', activity: 'explore_ruins', hidden: true, tier: 'rich' },
  sl_dig:       { id: 'sl_dig', name: 'Co-op Dig', type: 'dig', icon: '⛏️', desc: 'A cooperative surface mine, profits shared.', activity: 'surface_dig' },
};

// the "scan" survey activity used to reveal hidden POIs
const SCAN_ACTIVITY = { name: 'Survey Scan', duration: 18, fuel: 1, xp: 14 };

// ---------------------------------------------------------------------------
// TRADING — commodity kinds you can BUY at any base's exchange. Salvage, loot
// and data aren't stocked (you only acquire those out in the black). The buy
// price is the local sell price times a spread, so a same-base round-trip always
// loses money — profit comes from arbitrage between bases and market events.
// ---------------------------------------------------------------------------
const BUYABLE_KINDS = ['ore', 'refined', 'part', 'fuel'];
const BUY_SPREAD = 1.15;

// Back-compat alias: some older code referenced a single SYSTEM. Points at home.
const SYSTEM = SYSTEMS.kharon;

// ---------------------------------------------------------------------------
// MARKET EVENTS — temporary per-system price swings on a resource KIND.
// Rolled fresh whenever you arrive in a system and when the current set expires.
// ---------------------------------------------------------------------------
const MARKET_EVENT_POOL = [
  { kind: 'ore',     mult: 1.4,  up: true,  label: 'Ore shortage — refiners paying a premium' },
  { kind: 'ore',     mult: 0.7,  up: false, label: 'Ore glut — belt haulers crashed the price' },
  { kind: 'refined', mult: 1.5,  up: true,  label: 'Refit boom — refined metal in high demand' },
  { kind: 'refined', mult: 0.75, up: false, label: 'Surplus stock — refined prices slumped' },
  { kind: 'fuel',    mult: 1.6,  up: true,  label: 'Fuel crisis — hydrogen is scarce' },
  { kind: 'part',    mult: 1.5,  up: true,  label: 'Shipwrights buying every part they can get' },
  { kind: 'loot',    mult: 1.6,  up: true,  label: 'A collector is in port — exotics prized' },
  { kind: 'salvage', mult: 1.4,  up: true,  label: 'Scrap drive — salvage yards bidding up' },
  { kind: 'salvage', mult: 0.7,  up: false, label: 'Yards full — salvage barely sells' },
];

// ---------------------------------------------------------------------------
// GALNET — a procedural galactic news feed (à la Elite's GalNet). Pure flavour
// and worldbuilding: no mechanical effect. The engine builds a context of real
// entities + random people/ships/orgs and fills the {tokens} below, then files
// the headline to g.news.
// Tokens: {faction} {rival} {system} {system2} {economy} {danger} {resource}
//         {corp} {body} {org} {person} {person2} {title} {ship} {n} {pct} {price}
// Unknown tokens are left intact (harmless). With this many lines × token
// variety, the same headline twice is rare. Category = left-border colour.
// ---------------------------------------------------------------------------
const NEWS_OUTLETS = [
  'GalNet Frontier', 'The Belt Courier', 'Helix Financial Wire', 'Concord Science Desk',
  'Tartarus Free Broadcast', 'Commonwealth Voice', 'Meridian Exchange Report', 'Deep Survey Bulletin',
  'The Drifter Gazette', 'Rimward Review', 'Station Daily', 'The Long Haul', 'Spinward Signal',
  'The Prospector', 'Cluster Wire Service', 'Halcyon Business Daily',
  'The Orbital Times', 'Belt & Beyond', 'Frontier Free Press', 'The Vacuum Herald',
  'Trade Winds Weekly', 'The Relay', 'Nebula Nightly', 'The Solace Bulletin',
];
// token pools — these multiply the variety enormously across the templates
const NEWS_FIRST_NAMES = [
  'Mara', 'Idris', 'Sol', 'Vance', 'Kira', 'Renn', 'Tariq', 'Lena', 'Cabot', 'Yuna', 'Dex', 'Orin',
  'Sable', 'Cole', 'Nadia', 'Bram', 'Esme', 'Joren', 'Petra', 'Kaz', 'Ravi', 'Mira', 'Oksana', 'Theo',
  'Suri', 'Garr', 'Lio', 'Anya', 'Dane', 'Wren', 'Hollis', 'Zara', 'Niko', 'Imani', 'Pell', 'Drev',
  'Mateo', 'Saanvi', 'Bex', 'Ivo', 'Tamsin', 'Ozias', 'Lux', 'Faye', 'Roque', 'Halle', 'Sten', 'Marisol',
  'Cato', 'Indra', 'Boone', 'Selka', 'Aurel', 'Nyx', 'Caleb', 'Odile', 'Fitz', 'Maral', 'Soren', 'Calla',
  'Jian', 'Rune', 'Ondine', 'Basil', 'Halcyon', 'Vesna', 'Tycho', 'Lira', 'Osric', 'Junia',
];
const NEWS_LAST_NAMES = [
  'Okonkwo', 'Vance', 'Reyes', 'Holt', 'Calder', 'Nasser', 'Bright', 'Vega', 'Stroud', 'Ibarra',
  'Kessler', 'Mwangi', 'Sato', 'Drake', 'Voss', 'Aldarisi', 'Petrov', 'Quill', 'Marsh', 'Okafor',
  'Lindqvist', 'Tan', 'Bauer', 'Cruz', 'Novak', 'Hale', 'Banner', 'Silva', 'Dolan', 'Frost', 'Mercer', 'Ash',
  'Achebe', 'Romero', 'Khan', 'Larsen', 'Osei', 'Yamato', 'Beckett', 'Solano', 'Greaves', 'Underwood',
  'Cho', 'Variel', 'Brandt', 'Esposito', 'Delacroix', 'Park', 'Whitlock', 'Rourke', 'Adeyemi', 'Castellanos',
  'Ferreira', 'Knox', 'Soto', 'Renard', 'Vasquez', 'Oduya', 'Halloran', 'Belov', 'Nakamura', 'Sterling',
];
const NEWS_TITLES = [
  'Captain', 'Commander', 'Director', 'Administrator', 'Professor', 'Senator', 'Foreman',
  'Quartermaster', 'Chief Engineer', 'Magnate', 'Councillor', 'Doctor', 'Overseer', 'Marshal',
  'Provost', 'Envoy', 'Prospector', 'Bosun', 'Archivist', 'Steward', 'Prelate', 'Warden',
];
const NEWS_SHIP_NAMES = [
  'the Wandering Star', 'the Iron Verdict', 'the Slow Dawn', 'the Halcyon Maybe', 'the Belt Reaper',
  'the Last Dividend', 'the Quiet Profit', 'the Vagrant Sun', 'the Cold Comfort', 'the Red Ledger',
  'the Pale Horizon', 'the Gravedigger', 'the Salt & Rust', 'the Long Odds', "the Fool's Errand", 'the Tin Halo',
  'the Errant Comet', 'the Bonfire', 'the Sunken Crown', 'the Margin Call', 'the Threadbare', 'the Drunken Compass',
  'the Final Notice', "the Hauler's Lament", 'the Black Marigold', 'the Stray Photon', 'the Unpaid Debt',
  'the Wayward Ox', 'the Glint', 'the Hollow Crown', 'the Patient Wolf', 'the Second Wind', 'the Ember Tide',
];
// no leading "the" — templates supply the article so it isn't doubled
const NEWS_ORGS = [
  "Pilots' Federation", "Belt Miners' Guild", 'Deep Range Survey', 'Frontier Medical Corps',
  'Cluster Trade Authority', "Independent Haulers' Union", "Stellar Cartographers' Circle",
  "Salvagers' Cooperative", 'Outer Reach Relief Fund', "Shipwrights' Consortium",
  'Concord Science Board', "Free Traders' League", "Navigators' Assembly", "Dockworkers' Collective",
  'Asteroid Wardens', 'Frontier Press Guild', 'Cluster Relief Society', 'Orbital Safety Board',
  'Long Range Couriers', 'Belt Reclamation Authority', 'Free Clinics Network', 'Stellar Heritage Trust',
  'Outer Colonies Assembly', "Hydro Workers' Union", 'Order of the Drifting Lantern', 'Deep Range Chaplaincy',
];
const NEWS_TEMPLATES = {
  world: { icon: '🌌', lines: [
    'Long-range relays report a spike in traffic through {system}; haulers cite strong demand for {resource}.',
    'Frontier population passes a new milestone as colonists pour into {system}.',
    'Cluster-wide fuel reserves dip {pct}% as winter shipping peaks.',
    'The {org} reroutes convoys around {system2} after a navigation buoy fails.',
    'A census finds {n} new settlements established along the {system}–{system2} corridor this year.',
    'Bandwidth on the deep-space relay net is upgraded, cutting message lag by {pct}%.',
    'Travellers report record crowds at {system} as the trade season opens.',
    '{title} {person} of {system} calls for closer ties between the frontier worlds.',
    'Standardised docking protocols roll out across {n} stations to ease congestion.',
    'An old generation ship is rediscovered drifting beyond {system}, its crew long gone.',
    'Migration along the {system}–{system2} lane hits a record high this season.',
  ] },
  system: { icon: '🪐', lines: [
    '{economy} output across {system} climbs {pct}% on the quarter, officials say.',
    "A reactor fault dims half of {system}'s stations; engineers scramble to restore power.",
    '{system} opens a new starbase berth, easing dock congestion.',
    'Belt collisions force a temporary mining halt across {system}.',
    'Authorities on {body} break ground on a domed settlement for {n} families.',
    '{system} introduces a docking levy of {price} credits, angering independent pilots.',
    'A dust season blankets {body}, grounding surface operations for days.',
    'Power rationing begins on {body} as demand outstrips the local grid.',
    '{system} celebrates {n} years since its first permanent station was commissioned.',
    'Water reclamation upgrades on {body} promise to end decades of shortages.',
    'A jurisdiction dispute leaves {n} outposts near {body} in legal limbo.',
  ] },
  faction: { icon: '🏛️', lines: [
    '{faction} leadership survives a no-confidence vote amid frontier unrest.',
    '{title} {person} is elected to lead the {faction} after a tight ballot.',
    'The {faction} and the {rival} trade barbs over disputed salvage rights near {system}.',
    'A {faction} trade delegation tours {system} seeking new supply deals.',
    '{faction} recruiters report a surge in pilots signing on this cycle.',
    'The {faction} unveils a {price}-credit relief fund for storm-hit {system}.',
    '{faction} envoys and {rival} negotiators open talks on a shared shipping lane.',
    'A scandal engulfs the {faction} as {title} {person} resigns over misused funds.',
    'The {faction} pledges {n} new patrol craft to keep the {system} lanes clear.',
    '{faction} archivists release records from the founding of {system}.',
    'The {faction} and {rival} agree an uneasy truce over {body} mining rights.',
  ] },
  corporate: { icon: '💼', lines: [
    '{corp} shares jump {pct}% after a bumper {resource} contract.',
    '{corp} announces automation of {n} refineries, drawing union protest.',
    'Analysts downgrade {corp} on thin margins in the {resource} market.',
    '{corp} unveils a logistics hub at {system}, promising {n} jobs.',
    'A leaked memo shows {corp} lobbying to deregulate the {resource} trade.',
    '{corp} names {person} as its new {title}, effective next cycle.',
    'The {org} and {corp} announce a {price}-credit joint venture on {body}.',
    '{corp} recalls {n} faulty drive units after a string of breakdowns.',
    'Whistleblower {person} alleges {corp} dumped tailings near {system}.',
    '{corp} posts a {pct}% dividend as frontier demand outpaces supply.',
    '{corp} buys out a rival yard at {system} in a {price}-credit deal.',
  ] },
  market: { icon: '📈', lines: [
    'Commodity desks flag a {pct}% swing in {resource} prices across the cluster.',
    'Speculators pile into {resource} futures as supply tightens.',
    '{resource} stockpiles at {system} run low; buyers pay over the odds.',
    'A glut of {resource} drags spot prices down {pct}% this cycle.',
    'The {org} sets a new benchmark price of {price} credits for {resource}.',
    'Insurers raise hull premiums {pct}% on the {system}–{system2} run.',
    'Black-market {resource} floods {system} after a customs crackdown elsewhere.',
    'Refiners warn of {resource} shortages if belt yields keep falling.',
    'A short squeeze on {resource} burns speculators at {system}.',
  ] },
  science: { icon: '🔬', lines: [
    'Researchers at {system} publish a breakthrough in {resource} refining efficiency.',
    '{title} {person} wins the Concord Prize for work on nebula formation.',
    'A long-baseline survey detects an unexplained signal beyond {system}.',
    'Xenobiologists confirm microbial life in the deep ice of {body}.',
    'A new sensor array at {system} maps {n} previously uncharted asteroids.',
    'Lab tests suggest crystal shards from {body} are older than the system itself.',
    'The {org} opens a research station to study the anomalies near {system}.',
    'Astronomers revise the age of the {system} star upward by {n} million years.',
    'A team led by {title} {person} demonstrates a faster ice-to-fuel process.',
    'Survey drones return from {system2} with data that puzzles the archives.',
  ] },
  tech: { icon: '⚙️', lines: [
    'Shipwrights at {system} debut a reactor that runs {pct}% cooler under load.',
    'The {org} licenses a new mining laser said to cut extraction time by {pct}%.',
    'A firmware flaw grounds {n} drones across {system} until patches arrive.',
    'Engineers on {body} field-test self-repairing hull plating.',
    '{corp} patents a cargo pod that squeezes {pct}% more into the same hold.',
    'A startup at {system} promises cheaper shields — sceptics remain unconvinced.',
    'The {org} standardises docking clamps across {n} station classes.',
    'New navigation software shaves minutes off the {system}–{system2} jump.',
    'A {system} lab unveils a sensor suite that sees through nebula dust.',
  ] },
  exploration: { icon: '🛰️', lines: [
    'Independent pilot {person} claims the first survey of a deep-space relic near {system}.',
    'A prospecting rush hits {body} after rich {resource} readings leak.',
    'The {org} charts a new safe lane through the {system} belts.',
    'Explorers report a derelict the size of a station drifting past {system2}.',
    'A scout returns from the edge of {system} with the first images of its outer moons.',
    'Cartographers add {n} new waypoints to the {system} approach charts.',
    '{title} {person} leads an expedition into the unmapped reaches beyond {system2}.',
    'Salvage crews stake claims across a fresh debris field near {body}.',
    'A drifting beacon near {system} is traced to a survey lost {n} years ago.',
  ] },
  people: { icon: '🎖️', lines: [
    '{title} {person} is promoted to fleet command after {n} years of service.',
    'Veteran miner {person} retires after a record {n} seasons in the {system} belts.',
    '{person} is decorated for rescuing {n} crew from a foundering freighter.',
    'The {org} names {person} {title} of the Year for frontier service.',
    '{title} {person} celebrates {n} years at the helm of the same trusty hauler.',
    'Apprentice {person} tops the {system} piloting exams, a station record.',
    '{person} and {person2} wed aboard a station in orbit of {body}.',
    'Beloved dockmaster {person} of {system} steps down to a fond farewell.',
    '{title} {person} donates {price} credits to the {system} relief fund.',
    '{title} {person} hands command of {ship} to first officer {person2}.',
  ] },
  event: { icon: '🎉', lines: [
    "The {system} Founders' Festival draws record crowds this cycle.",
    'The annual {system} belt-racing league opens with {n} crews entered.',
    'Pilot {person} wins the {system2} Rally, edging out {n} rivals.',
    "{body} hosts the cluster's largest harvest fair in a decade.",
    'Crowds gather on {body} to watch a rare triple eclipse.',
    'The {org} stages a memorial flypast over {system} for lost prospectors.',
    "A trade expo at {system} unveils next season's ship designs.",
    'The {system} lantern festival lights up the station rings for {n} nights.',
    'Crowds cheer as {ship} takes line honours in the long-haul race to {system2}.',
  ] },
  crime: { icon: '🚨', lines: [
    'Customs at {system} seize {n} crates of contraband in a dawn raid.',
    'A daring heist relieves a {system} vault of {price} credits in goods.',
    'A smuggling ring is broken up near {body}; {n} arrests reported.',
    'Pirates raid a convoy on the {system}–{system2} lane, making off with {resource}.',
    '{title} {person} is charged with running counterfeit {resource} through {system}.',
    'Station security on {body} foils a docking-bay robbery.',
    'A raider known only as "{ship}" is sighted again near {system}.',
    'An insurance-fraud probe widens to {n} haulers operating out of {system}.',
    'Stolen {resource} worth {price} credits surfaces on the {system} black market.',
  ] },
  disaster: { icon: '⚠️', lines: [
    'A docking accident at {system} damages {n} berths; no fatalities reported.',
    'Rescue crews pull {n} survivors from a wreck drifting near {body}.',
    'A coolant leak forces the evacuation of a {system} refinery.',
    'A storm surge knocks out comms across {body} for {n} hours.',
    'A runaway barge is brought under control before reaching {system} station.',
    'Fire guts a cargo hold aboard a freighter docked at {system}.',
    'A distress call from {ship} near {system2} sends nearby vessels racing to assist.',
    'A reactor scram strands {n} ships at {system} awaiting tugs.',
    'A micrometeor swarm peppers {body}, halting surface work for a shift.',
  ] },
  culture: { icon: '🎭', lines: [
    'A holo-drama filmed aboard a {system} station tops the cluster charts.',
    'Belt shanties from {system} enjoy a surprise revival among young pilots.',
    'Artist {person} unveils a sculpture welded from {system} salvage.',
    "A {body} chef's ration-pack recipes become an unlikely sensation.",
    'Historians restore the oldest mural on {system} station to its former colour.',
    'The memoirs of {title} {person} become required reading at flight academies.',
    'A station choir on {body} broadcasts across {n} systems for the festival.',
    'Collectors bid {price} credits for a relic recovered near {system}.',
    'A documentary on the {system} belts wins acclaim across the cluster.',
  ] },
  religion: { icon: '🛐', lines: [
    'A new sect preaching the "Long Silence" gains followers across {system}.',
    'Pilgrims flock to {body}, where some claim the nebula light carries a message.',
    'The Order of the Drifting Lantern consecrates a shrine aboard a {system} station.',
    '{title} {person} denounces the cult of the Hollow Star as a danger to crews.',
    'Belt monks of {system} mark the solstice with a {n}-hour silent vigil.',
    'A breakaway congregation declares {body} a holy world, alarming authorities.',
    'The faithful gather at {system} for the Festival of First Light.',
    'A charismatic preacher rallies {n} converts in the {system} docks.',
    'Scholars debate whether the {system} relics are sacred or simply ancient.',
    'The Cult of the Open Vacuum is barred from {system} stations after a scare.',
    'Shrine-keepers on {body} report a record {n} pilgrims this season.',
  ] },
  sport: { icon: '🏁', lines: [
    "The {system} belt-racing league crowns {person} this season's champion.",
    'Pilot {person} shatters the {system}–{system2} course record by {n} seconds.',
    'A betting scandal rocks the {system} zero-g arena circuit.',
    'In a surprise, {ship} qualifies on pole for the Tartarus Gauntlet.',
    'The cluster freight-rally returns to {system} with {n} teams entered.',
    'Veteran racer {person} announces retirement after {n} championship runs.',
    'A photo finish hands {person} the {system2} Cup over local favourite {person2}.',
    'The {org} sponsors a new low-grav sprint league out of {system}.',
    'An underdog crew aboard {ship} stuns the field at the {system} regatta.',
    'Officials review the {system} derby after a contested {n}-lap finish.',
  ] },
  obituary: { icon: '🕯️', lines: [
    '{title} {person}, pioneering surveyor of {system}, dies aged {age}.',
    'Tributes pour in for {person}, who charted the first lanes through {system}.',
    'Legendary captain {person} of {ship} is laid to rest at {system}.',
    '{title} {person}, founder of the {org}, remembered as a frontier hero.',
    'The {system} community mourns dockmaster {person}, dead at {age}.',
    'Mining foreman {person}, who worked the {system} belts for {n} years, passes away.',
    'Obituary: {person}, whose salvage finds funded a {system} hospital.',
    '{person}, the voice of {system} traffic control for a generation, has died.',
    "A memorial flotilla escorts {person}'s ashes into the {system} sun.",
    'Scientist {person}, who decoded the {system} relic glyphs, dies at {age}.',
  ] },
  weather: { icon: '☄️', lines: [
    'Forecasters warn of a coronal mass ejection sweeping toward {system}.',
    'An unexplained gravity ripple is logged near {body}, baffling navigators.',
    'The {system} nebula flares a brilliant violet, drawing sightseers.',
    'A rogue asteroid swarm forces lane closures around {body}.',
    'Strange auroras dance over {body} after a spike in stellar wind.',
    'A sudden radiation surge near {system} sends ships scrambling for cover.',
    'Astronomers track a comet on a {n}-year orbit past {system}.',
    'Sensor crews report an expanding dust front along the {system}–{system2} lane.',
    'A micro-singularity scare near {system2} proves a false alarm, says the {org}.',
    'Tidal stresses crack the ice sheets of {body}, opening new fissures.',
    'A solar flare paints the skies of {body} and knocks out comms for {n} hours.',
  ] },
};
// relative weights for an unprompted headline (higher = more common)
const NEWS_WEIGHTS = [
  ['world', 3], ['system', 3], ['faction', 3], ['corporate', 3], ['market', 3],
  ['science', 2], ['tech', 2], ['exploration', 2], ['people', 2], ['event', 2],
  ['crime', 2], ['disaster', 2], ['culture', 2],
  ['religion', 2], ['sport', 2], ['obituary', 1], ['weather', 2],
];

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
  derelict_marker: {
    name: 'Derelict marker',
    apply: (r) => 'A broken-backed freighter drifts past, too far gone to board. You log its position.'
  },
  floating_cache: {
    name: 'Floating cache',
    apply: (r) => { r.bonusLoot.push(['scrap', 2 + Math.floor(Math.random() * 3)]); return 'Snagged a drifting cargo net full of loose scrap.'; }
  },
  salvage_windfall: {
    name: 'Salvage windfall',
    apply: (r) => { r.lootMult *= 1.5; return 'A fresh, untouched wreck — the pickings are unusually good!'; }
  },
  corpse_starship: {
    name: 'Ghost in the hull',
    apply: (r) => 'You drift through a silent, frostbitten hull. The crew never made it out. Unsettling.'
  },
  intact_canister: {
    name: 'Intact canister',
    apply: (r) => { const fuel = Math.random() < 0.5; r.bonusLoot.push(fuel ? ['hydrogen_fuel', 2] : ['ammo', 3]); return fuel ? 'Recovered a sealed fuel canister.' : 'Recovered a crate of usable ammo.'; }
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
      { label: 'Scan from range',     skill: 'piloting', result: { items: [['black_box', 1]], xp: 30, log: 'You traced the spoof to a dead drop and recovered a black box.' } },
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

// ---------------------------------------------------------------------------
// ENCOUNTERS — interactive scavenging decisions that fire *after* a salvage-type
// run (see activity.encounters / encChance). Like DISTRESS, but a choice may
// have weighted `outcomes` (good / neutral / bad) instead of a fixed `result`.
// A `skill` on a choice both shifts the odds toward good outcomes and boosts the
// payout. Results support: credits[lo,hi], items[[id,qty]], xp, rep, fuel,
// and damage ([sys,amt] or a list of them).
// ---------------------------------------------------------------------------
const ENCOUNTERS = [
  {
    id: 'drifting_hulk',
    title: 'Drifting Hulk',
    text: 'A gutted freighter tumbles end over end, its hull split open but parts of the interior still pressurised.',
    choices: [
      { label: 'Board and search the interior', skill: 'salvage', outcomes: [
        { good: true, p: 3, items: [['damaged_module', 2], ['black_box', 1], ['wiring', 4]], xp: 45, log: 'The bridge safe was intact — and so was the flight recorder. A real haul.' },
        { p: 4, items: [['scrap', 5], ['wiring', 3]], xp: 25, log: 'You picked the bones clean. Nothing rare, but a solid load of scrap.' },
        { bad: true, p: 2, damage: [['hull', 18], ['cargobay', 10]], xp: 12, log: 'A collapsing bulkhead nearly crushed your ship on the way out.' },
      ] },
      { label: 'Strip the hull plating (safe)', result: { items: [['scrap', 6], ['wiring', 2]], xp: 18, log: 'You peeled the outer plating without risking the interior.' } },
      { label: 'Plant a beacon and move on', result: { rep: 1, xp: 6, log: 'You tagged the wreck for a Union recovery team. They appreciate the tip.' } },
    ],
  },
  {
    id: 'cracked_reactor',
    title: 'Cracked Reactor Core',
    text: "A destroyer's aft section floats nearby, its fusion core still humming faintly behind a cracked housing.",
    choices: [
      { label: 'Extract the core', skill: 'engineering', outcomes: [
        { good: true, p: 3, items: [['reactor_part', 1], ['wiring', 3]], xp: 60, log: 'Steady hands. You pulled an intact reactor part worth a small fortune.' },
        { p: 3, items: [['scrap', 4]], xp: 20, log: 'The core crumbled as you cut it loose — only scrap survived.' },
        { bad: true, p: 3, damage: [['reactor', 22], ['hull', 12]], xp: 15, log: 'The housing ruptured. The flare-back warped your own reactor.' },
      ] },
      { label: 'Vent it, then strip the hull', result: { items: [['scrap', 4], ['wiring', 2], ['damaged_module', 1]], xp: 22, log: 'You bled the core safely and stripped what was left.' } },
      { label: "Too dangerous — leave it", result: { xp: 5, log: "You backed off. Some salvage isn't worth the obituary." } },
    ],
  },
  {
    id: 'ghost_ship',
    title: 'The Quiet Ship',
    text: 'An intact liner sits dark and unpowered. No distress call, no bodies, no answer to your hails. Just... quiet.',
    choices: [
      { label: 'Explore the decks', skill: 'salvage', outcomes: [
        { good: true, p: 3, items: [['contraband', 1], ['black_box', 1]], xp: 50, log: "The hold held smuggled goods and the captain's black box. Whatever happened here, it paid out." },
        { p: 4, xp: 18, log: 'Deck after deck of nothing. Coffee cups still on the tables. You leave faster than you came.' },
        { bad: true, p: 2, damage: [['lifesupport', 16]], xp: 14, log: 'Something had nested in the vents. It got into your life support before you sealed it out.' },
      ] },
      { label: 'Strip the exterior only', result: { items: [['scrap', 5], ['wiring', 2]], xp: 16, log: 'You kept to the hull and took the easy salvage.' } },
      { label: 'Warp away', result: { xp: 8, log: 'Every instinct said leave. You listened.' } },
    ],
  },
  {
    id: 'pirate_stash',
    title: 'Hidden Pirate Cache',
    text: 'Sensors flag a strongbox welded inside a raider wreck — the kind pirates use to stash their cut.',
    choices: [
      { label: 'Crack the lock', skill: 'engineering', outcomes: [
        { good: true, p: 3, credits: [200, 420], items: [['contraband', 1]], xp: 40, log: 'The lock gave with a satisfying clunk. Credits and contraband both.' },
        { bad: true, p: 2, damage: [['hull', 16]], xp: 12, log: 'It was rigged. The charge went off in your face.' },
      ] },
      { label: 'Tow the whole wreck to port', skill: 'piloting', result: { credits: [120, 240], xp: 30, log: "You hauled it in and let the dockworkers fight the lock. Finder's fee paid." } },
      { label: 'Leave it — smells like a trap', result: { xp: 6, log: "You've seen too many friends die to a baited box." } },
    ],
  },
  {
    id: 'unstable_wreck',
    title: 'Venting Wreck',
    text: "A freshly-killed gunship spews plasma from a dozen ruptures. Good loot — if you're fast, or careful.",
    choices: [
      { label: 'Smash-and-grab', skill: 'piloting', outcomes: [
        { good: true, p: 4, items: [['damaged_module', 2], ['scrap', 4]], xp: 35, log: 'In and out before the next rupture blew. Clean grab.' },
        { bad: true, p: 3, damage: [['hull', 20]], xp: 12, log: 'A plasma jet caught you mid-grab. You got the loot — and a scorched hull.' },
      ] },
      { label: 'Careful approach (safe, less loot)', result: { items: [['scrap', 3], ['wiring', 1]], xp: 18, log: 'You waited out the worst of the venting and took what you could reach.' } },
      { label: 'Not worth it', result: { xp: 5, log: 'You let it burn and moved on.' } },
    ],
  },
  {
    id: 'mystery_container',
    title: 'Sealed Container',
    text: 'An unmarked container drifts alone, hull intact, contents unknown. No transponder. No clue.',
    choices: [
      { label: 'Force it open', outcomes: [
        { good: true, p: 3, items: [['focusing_lens', 1], ['wiring', 2]], xp: 30, log: 'Jackpot — precision optics packed in protective foam.' },
        { p: 4, items: [['scrap', 2]], xp: 10, log: 'Just packing material and a dead drone. Oh well.' },
        { bad: true, p: 2, damage: [['cargobay', 18]], xp: 8, log: 'Proximity mine. It blew a hole in your cargo bay.' },
      ] },
      { label: 'Scan it carefully first', skill: 'piloting', result: { items: [['damaged_module', 1]], xp: 22, log: 'A careful scan let you defuse the trap and pop it open safely for a tidy find.' } },
      { label: 'Toss it back', result: { xp: 4, log: "Whatever it was, it's someone else's problem now." } },
    ],
  },
];
