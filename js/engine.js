/* SpaceBake — engine: the idle loop, mission resolution, combat, refining,
 * market and repairs. Pure-ish logic that mutates the shared game state `g`.
 */

const Engine = (() => {

  function logLine(g, text, cls = '') {
    g.log.unshift({ t: Date.now(), text, cls });
    if (g.log.length > 120) g.log.pop();
  }

  // ----- starting a mission -----
  function startMission(g, activityId) {
    if (g.mission) return { ok: false, msg: 'A mission is already running.' };
    if (g.pendingDistress) return { ok: false, msg: 'Resolve the distress event first.' };
    const act = ACTIVITIES[activityId];
    if (!act) return { ok: false, msg: 'Unknown activity.' };

    const lvl = skillLevel(g, act.skill);
    if (lvl < act.reqLevel) return { ok: false, msg: `Requires ${SKILLS[act.skill].name} level ${act.reqLevel}.` };
    if (g.fuel < act.fuel) return { ok: false, msg: 'Not enough fuel.' };

    // piloting reduces effective duration a little
    const pilot = skillLevel(g, 'piloting');
    const speedMod = MODES[g.mode].mult.speed || 1;
    let dur = act.duration * (1 - Math.min(0.3, pilot * 0.0025)) / speedMod;
    dur = Math.max(6, Math.round(dur));

    g.fuel -= act.fuel;
    g.mission = {
      id: activityId, type: act.type, startedAt: Date.now(),
      duration: dur, endsAt: Date.now() + dur * 1000,
      events: [], resolved: false,
    };
    logLine(g, `Undocked: ${act.name} (${dur}s).`, 'go');
    return { ok: true };
  }

  function recallMission(g) {
    if (!g.mission) return;
    // resolve immediately with whatever progress (partial)
    g.mission.recalled = true;
    g.mission.endsAt = Date.now();
  }

  // ----- the per-frame tick -----
  function tick(g) {
    const now = Date.now();

    // refining job progress
    if (g.refineJob && now >= g.refineJob.endsAt) completeRefineBatch(g);

    // mission completion
    if (g.mission && !g.pendingDistress && now >= g.mission.endsAt) {
      resolveMission(g);
    }
  }

  // build a "run result" helper object the events can mutate
  function makeRun(g, stats) {
    return {
      g, stats,
      lootMult: 1, heat: 0, bonusLoot: [],
      damageSystem(sys, amt) {
        // armor & shields soak some; engineering reduces lasting damage
        const eng = skillLevel(g, 'engineering');
        const soak = 1 - Math.min(0.35, eng * 0.003);
        const applied = Math.max(1, Math.round(amt * soak));
        g.systems[sys] = Math.max(0, (g.systems[sys] ?? 100) - applied);
      },
      evasionRoll() {
        // higher evasion + piloting => better chance to dodge bad events
        const pilot = skillLevel(g, 'piloting');
        const chance = Math.min(0.85, (stats.evasion + pilot) / 120);
        return Math.random() < chance;
      },
      stealCargo(frac) {
        if (this.protectCargo) frac *= 0.4;
        const ids = Object.keys(g.cargo);
        for (const id of ids) {
          const lost = Math.floor(g.cargo[id] * frac);
          if (lost > 0) g.cargo[id] -= lost;
          if (g.cargo[id] <= 0) delete g.cargo[id];
        }
      },
    };
  }

  // ----- mission resolution -----
  function resolveMission(g) {
    const m = g.mission;
    const act = ACTIVITIES[m.id];
    const stats = shipStats(g);
    const run = makeRun(g, stats);
    const beh = BEHAVIORS[g.behavior];
    run.protectCargo = beh.protectCargo;

    // partial-failure factor if recalled early
    let progress = 1;
    if (m.recalled) {
      progress = Math.max(0.1, 1 - (m.endsAt - Date.now() + 0) / (m.duration * 1000));
      progress = Math.min(1, Math.max(0.15, (Date.now() - m.startedAt) / (m.duration * 1000)));
    }

    const logs = [];

    if (act.type === 'distress') {
      // hand off to player decision; pause here
      const scenario = DISTRESS[Math.floor(Math.random() * DISTRESS.length)];
      g.pendingDistress = { scenario: scenario.id };
      g.mission = null;
      logLine(g, `Distress beacon resolved into: ${scenario.title}.`, 'event');
      return;
    }

    // fire 0-2 random events from the activity pool
    const pool = act.events || [];
    const nEvents = pool.length ? (Math.random() < 0.7 ? 1 : 0) + (Math.random() < 0.35 ? 1 : 0) : 0;
    if (act.heatBonus) run.heat += act.heatBonus;
    for (let i = 0; i < nEvents; i++) {
      const evId = pool[Math.floor(Math.random() * pool.length)];
      const ev = EVENTS[evId];
      if (ev) logs.push(ev.apply(run));
    }

    // combat resolution
    let combatOk = true;
    if (act.type === 'combat' && act.enemy) {
      const c = runCombat(g, stats, act.enemy, beh);
      logs.push(c.log);
      combatOk = c.win;
      if (c.win) g.stats.kills++;
    }

    // heat lingering damage
    if (run.heat > 60) {
      const d = Math.round((run.heat - 60) / 6);
      run.damageSystem('reactor', d);
      logs.push(`Sustained heat warped the reactor (-${d}).`);
    }

    // award loot (scaled by progress, skill mastery and lootMult)
    let gained = {};
    if (combatOk && (act.drops || run.bonusLoot.length)) {
      const masteryMult = 1 + skillLevel(g, act.skill) * 0.004;
      const mult = run.lootMult * beh.lootMult * progress * masteryMult * cargoBayPenalty(g);
      for (const [id, lo, hi] of (act.drops || [])) {
        let qty = lo + Math.floor(Math.random() * (hi - lo + 1));
        qty = Math.round(qty * mult);
        if (qty > 0) gained[id] = (gained[id] || 0) + qty;
      }
      for (const [id, qty] of run.bonusLoot) gained[id] = (gained[id] || 0) + qty;
      gained = addToCargo(g, gained);
    }

    // XP
    const xpGain = Math.round(act.xp * progress);
    const lvlUp = addSkillXp(g, act.skill, xpGain);
    if (act.type === 'mine') g.stats.oreMined += Object.values(gained).reduce((a, b) => a + b, 0);

    // compose summary
    const lootStr = Object.keys(gained).length
      ? Object.entries(gained).map(([id, q]) => `${q}× ${RESOURCES[id].name}`).join(', ')
      : 'nothing of value';
    let head = m.recalled ? `Recalled early from ${act.name}.` : `Returned from ${act.name}.`;
    if (act.type === 'combat' && !combatOk) head = `Fled ${act.name} — beaten back!`;
    logLine(g, `${head} Hauled: ${lootStr}. +${xpGain} ${SKILLS[act.skill].name} XP.`, combatOk ? 'good' : 'bad');
    for (const l of logs) logLine(g, l, 'event');
    if (lvlUp) logLine(g, `★ ${SKILLS[act.skill].name} reached level ${lvlUp}!`, 'level');

    g.stats.runs++;
    g.mission = null;
  }

  // breached cargo bay loses some capacity / loot
  function cargoBayPenalty(g) { return Math.max(0.4, cond(g.systems.cargobay)); }

  // add resources but respect cargo capacity; returns what actually fit
  function addToCargo(g, items) {
    const cap = shipStats(g).cargo;
    let used = cargoUsed(g);
    const fitted = {};
    for (const [id, qty] of Object.entries(items)) {
      const room = Math.max(0, cap - used);
      const take = Math.min(qty, room);
      if (take > 0) {
        g.cargo[id] = (g.cargo[id] || 0) + take;
        used += take;
        fitted[id] = take;
      }
    }
    return fitted;
  }

  // ----- combat: a compact damage race -----
  function runCombat(g, stats, enemy, beh) {
    const gun = skillLevel(g, 'gunnery');
    let myHp = stats.hull;
    let myShield = stats.shield;
    let eHp = enemy.hull;
    let eArmor = enemy.armor;

    const myDmgBase = (stats.weapon || 4) * beh.dmgDealt * (1 + gun * 0.01);
    const acc = Math.min(0.95, 0.55 + gun * 0.006 + stats.sensors * 0.002);
    const fleeHp = stats.hull * (g.fleeAt / 100);

    let rounds = 0;
    while (eHp > 0 && myHp > 0 && rounds < 60) {
      rounds++;
      // player attacks
      if (Math.random() < acc) {
        let dmg = myDmgBase * (0.8 + Math.random() * 0.4);
        const pen = stats.armorPen || 0;
        dmg = Math.max(1, dmg - Math.max(0, eArmor - pen) * 0.4);
        if (Math.random() < 0.1 + gun * 0.003) dmg *= 1.8; // crit
        eHp -= dmg;
      }
      if (eHp <= 0) break;
      // enemy attacks
      if (Math.random() < (0.5 + enemy.weapon * 0.01) - stats.evasion * 0.006) {
        let dmg = enemy.weapon * beh.dmgTaken * (0.8 + Math.random() * 0.4);
        if (myShield > 0) { const absorbed = Math.min(myShield, dmg); myShield -= absorbed; dmg -= absorbed; }
        dmg = Math.max(0, dmg - stats.armor * 0.3);
        myHp -= dmg;
        myShield += stats.shieldRegen * 0.5;
      }
      // flee check
      if (myHp <= fleeHp && eHp > enemy.hull * 0.3) {
        return { win: false, log: `Hull at flee threshold — disengaged from ${enemy.name}.` };
      }
    }

    if (eHp <= 0) {
      // distribute hull damage taken into the hull system
      const taken = stats.hull - myHp;
      g.systems.hull = Math.max(0, g.systems.hull - Math.round(taken / stats.maxHull * 60));
      const verb = beh.disable ? 'Disabled' : 'Destroyed';
      addSkillXp(g, 'gunnery', 15);
      return { win: true, log: `${verb} ${enemy.name} in ${rounds} rounds.` };
    }
    return { win: false, log: `Overwhelmed by ${enemy.name} — retreated with hull breaches.` };
  }

  // ----- distress decision resolution -----
  function resolveDistress(g, choiceIdx) {
    if (!g.pendingDistress) return;
    const scenario = DISTRESS.find(s => s.id === g.pendingDistress.scenario);
    const choice = scenario.choices[choiceIdx];
    const stats = shipStats(g);
    const logs = [];

    // optional combat gate
    if (choice.combat) {
      const c = runCombat(g, stats, choice.combat, BEHAVIORS[g.behavior]);
      logs.push(c.log);
      if (!c.win) {
        logLine(g, `${scenario.title}: ${c.log} You got nothing.`, 'bad');
        g.pendingDistress = null;
        for (const l of logs) logLine(g, l, 'event');
        return;
      }
      g.stats.kills++;
    }

    const res = choice.result;
    if (res.credits) {
      let bonus = 1;
      if (choice.skill) bonus = 1 + skillLevel(g, choice.skill) * 0.01;
      const c = Math.round((res.credits[0] + Math.random() * (res.credits[1] - res.credits[0])) * bonus);
      g.credits += c; g.stats.credEarned += c;
      logs.push(`Received ${c} credits.`);
    }
    if (res.items) {
      const fit = addToCargo(g, Object.fromEntries(res.items));
      const str = Object.entries(fit).map(([id, q]) => `${q}× ${RESOURCES[id].name}`).join(', ');
      if (str) logs.push(`Recovered ${str}.`);
    }
    if (res.rep) { g.rep += res.rep; logs.push(`Freebelt standing ${res.rep > 0 ? '+' : ''}${res.rep}.`); }
    if (res.xp) {
      const sk = choice.skill || 'piloting';
      const lu = addSkillXp(g, sk, res.xp);
      logs.push(`+${res.xp} ${SKILLS[sk] ? SKILLS[sk].name : 'Piloting'} XP.`);
      if (lu) logs.push(`★ ${SKILLS[sk].name} reached level ${lu}!`);
    }

    logLine(g, `${scenario.title}: ${res.log}`, 'good');
    for (const l of logs) logLine(g, l, 'event');
    g.pendingDistress = null;
    g.stats.runs++;
  }

  // ----- refining -----
  function startRefine(g, recipeId, qty) {
    if (g.refineJob) return { ok: false, msg: 'Refinery is busy.' };
    const r = RECIPES[recipeId];
    if (!r) return { ok: false, msg: 'Unknown recipe.' };
    if (skillLevel(g, 'refining') < r.reqLevel) return { ok: false, msg: `Requires Refining level ${r.reqLevel}.` };
    // how many batches can we afford by inputs?
    let maxBatches = qty;
    for (const [id, need] of Object.entries(r.in)) {
      maxBatches = Math.min(maxBatches, Math.floor((g.cargo[id] || 0) / need));
    }
    if (maxBatches < 1) return { ok: false, msg: 'Not enough input materials.' };
    g.refineJob = { recipe: recipeId, batchesLeft: maxBatches, perBatch: r.time, endsAt: Date.now() + r.time * 1000 };
    logLine(g, `Refinery started: ${maxBatches}× ${r.name}.`, 'go');
    return { ok: true };
  }
  function completeRefineBatch(g) {
    const job = g.refineJob;
    const r = RECIPES[job.recipe];
    // consume inputs (guard against shortfall)
    for (const [id, need] of Object.entries(r.in)) {
      if ((g.cargo[id] || 0) < need) { g.refineJob = null; logLine(g, `Refinery halted: out of ${RESOURCES[id].name}.`, 'bad'); return; }
    }
    for (const [id, need] of Object.entries(r.in)) { g.cargo[id] -= need; if (g.cargo[id] <= 0) delete g.cargo[id]; }
    const made = addToCargo(g, r.out);
    const lu = addSkillXp(g, 'refining', r.xp);
    const str = Object.entries(made).map(([id, q]) => `${q}× ${RESOURCES[id].name}`).join(', ');
    logLine(g, `Refined ${str || '(cargo full!)'}. +${r.xp} Refining XP.`, 'good');
    if (lu) logLine(g, `★ Refining reached level ${lu}!`, 'level');
    job.batchesLeft--;
    if (job.batchesLeft > 0) job.endsAt = Date.now() + job.perBatch * 1000;
    else g.refineJob = null;
  }

  // ----- market -----
  function sellPrice(g, id) {
    const res = RESOURCES[id];
    const mod = SYSTEM.station.sell[res.kind] || 1;
    const tradeBonus = 1 + skillLevel(g, 'trade') * 0.004;
    return Math.max(1, Math.round(res.value * mod * tradeBonus));
  }
  function sellResource(g, id, qty) {
    const have = g.cargo[id] || 0;
    qty = Math.min(qty, have);
    if (qty <= 0) return;
    const each = sellPrice(g, id);
    const total = each * qty;
    g.cargo[id] -= qty; if (g.cargo[id] <= 0) delete g.cargo[id];
    g.credits += total; g.stats.credEarned += total;
    addSkillXp(g, 'trade', Math.ceil(total / 25));
    logLine(g, `Sold ${qty}× ${RESOURCES[id].name} for ${total} cr.`, 'good');
  }
  function sellAllRaw(g) {
    for (const id of Object.keys({ ...g.cargo })) {
      if (['ore', 'salvage'].includes(RESOURCES[id].kind)) sellResource(g, id, g.cargo[id]);
    }
  }

  // ----- repair & refuel -----
  function repairAll(g) {
    const ship = SHIPS[g.activeShip];
    let cost = 0;
    for (const sys of SHIP_SYSTEMS) {
      const missing = 100 - g.systems[sys];
      cost += missing;
    }
    cost = Math.round(cost * SYSTEM.station.repairCostPerHp);
    // engineering discount
    cost = Math.round(cost * (1 - Math.min(0.3, skillLevel(g, 'engineering') * 0.003)));
    if (cost <= 0) return { ok: false, msg: 'Nothing to repair.' };
    if (g.credits < cost) return { ok: false, msg: `Repair costs ${cost} cr — you can't afford it.` };
    g.credits -= cost;
    g.systems = freshSystems();
    logLine(g, `Repaired all systems for ${cost} cr.`, 'good');
    return { ok: true };
  }
  function refuel(g, units) {
    const price = SYSTEM.station.fuelPrice;
    const max = Math.floor(g.credits / price);
    units = Math.min(units, max);
    if (units <= 0) return { ok: false, msg: 'Not enough credits for fuel.' };
    g.credits -= units * price;
    g.fuel += units;
    logLine(g, `Bought ${units} fuel for ${units * price} cr.`, 'good');
    return { ok: true };
  }

  // ----- shipyard / outfitting -----
  function buyModule(g, modId) {
    const m = MODULES[modId];
    if (g.credits < m.cost) return { ok: false, msg: 'Not enough credits.' };
    g.credits -= m.cost;
    g.storage[modId] = (g.storage[modId] || 0) + 1;
    logLine(g, `Bought ${m.name}.`, 'good');
    return { ok: true };
  }
  function fitModule(g, modId) {
    const m = MODULES[modId];
    const fit = g.fittings[g.activeShip];
    const ship = SHIPS[g.activeShip];
    const slotCap = ship.slots[m.slot] || 0;
    if ((fit[m.slot] || []).length >= slotCap) return { ok: false, msg: `No free ${m.slot} slot.` };
    if ((g.storage[modId] || 0) < 1) return { ok: false, msg: 'None in storage.' };
    g.storage[modId]--;
    fit[m.slot] = fit[m.slot] || [];
    fit[m.slot].push(modId);
    logLine(g, `Fitted ${m.name}.`);
    return { ok: true };
  }
  function unfitModule(g, slot, idx) {
    const fit = g.fittings[g.activeShip];
    const modId = (fit[slot] || [])[idx];
    if (!modId) return;
    fit[slot].splice(idx, 1);
    g.storage[modId] = (g.storage[modId] || 0) + 1;
    logLine(g, `Removed ${MODULES[modId].name}.`);
  }
  function buyShip(g, shipId) {
    const ship = SHIPS[shipId];
    if (g.ownedShips.includes(shipId)) return { ok: false, msg: 'Already owned.' };
    if (g.credits < ship.cost) return { ok: false, msg: 'Not enough credits.' };
    g.credits -= ship.cost;
    g.ownedShips.push(shipId);
    // default empty fitting
    g.fittings[shipId] = { reactor: ['reactor_mk1'], engine: ['engine_mk1'], shield: [], weapon: [], mining: [], utility: [], cargo: ['cargo_mk1'] };
    g.storage['reactor_mk1'] = (g.storage['reactor_mk1'] || 0); // bookkeeping
    logLine(g, `Purchased ${ship.name}!`, 'good');
    return { ok: true };
  }
  function switchShip(g, shipId) {
    if (!g.ownedShips.includes(shipId)) return;
    if (g.mission) return;
    g.activeShip = shipId;
    g.systems = freshSystems();
    logLine(g, `Now flying the ${SHIPS[shipId].name}.`);
  }

  return {
    tick, startMission, recallMission, resolveDistress,
    startRefine, sellResource, sellAllRaw, sellPrice,
    repairAll, refuel, buyModule, fitModule, unfitModule, buyShip, switchShip,
    logLine,
  };
})();
