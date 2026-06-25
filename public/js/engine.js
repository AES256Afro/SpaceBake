/* SpaceBake — engine: the idle loop, mission resolution, combat, refining,
 * market and repairs. Pure-ish logic that mutates the shared game state `g`.
 */

const Engine = (() => {

  function logLine(g, text, cls = '') {
    g.log.unshift({ t: Date.now(), text, cls });
    if (g.log.length > 120) g.log.pop();
    // surface celebratory lines (level-ups, achievements) as on-screen toasts
    if (cls === 'level') { if (!g.toasts) g.toasts = []; g.toasts.push({ text, kind: 'level' }); }
  }

  // ----- meta: perks, renown (prestige) and the combined bonus -----
  // permanent perk multiplier for a bonus key, summed across unlocked achievements
  function perkMult(g, key) {
    let s = 0;
    for (const id of (g.achievements || [])) {
      const a = ACHIEVEMENTS.find(x => x.id === id);
      if (a && a.perk && a.perk.key === key) s += a.perk.val;
    }
    return 1 + s;
  }
  // Legacy/Renown gives a broad production bonus (+2% per point)
  function prestigeMult(g, key) {
    if (!['yield', 'price', 'fleet', 'combat'].includes(key)) return 1;
    return 1 + (g.renown || 0) * 0.02;
  }
  // the one multiplier the engine reads everywhere: crew × perks × renown
  function bonus(g, key) { return crewMult(g, key) * perkMult(g, key) * prestigeMult(g, key); }

  // renown earnable from lifetime credits (sqrt curve), minus what's been claimed.
  // divisor tuned so the first prestige is a deliberate mid-game milestone (~25k
  // lifetime credits) rather than an early trap.
  function renownEarnable(g) { return Math.floor(Math.sqrt((g.stats.credEarned || 0) / 25000)); }
  function pendingRenown(g) { return Math.max(0, renownEarnable(g) - (g.renownClaimed || 0)); }
  function prestige(g) {
    const gain = pendingRenown(g);
    if (gain < 1) return { ok: false, msg: 'Not enough lifetime earnings to gain Renown yet.' };
    g.renown = (g.renown || 0) + gain;
    g.renownClaimed = renownEarnable(g);
    g.prestige = (g.prestige || 0) + 1;
    // ---- reset the run, keep the meta (achievements/perks/renown/codex/objectives) ----
    g.credits = 600; g.fuel = 40;
    g.currentSystem = 'kharon'; g.currentBase = 'kharon_station';
    g.reputation = { freebelt: 0, concord: 0, redmaw: 0, corporate: 0, socialist: 0 };
    g.skills = Object.fromEntries(Object.keys(SKILLS).map(k => [k, 0]));
    g.activeShip = 'shuttle'; g.ownedShips = ['shuttle'];
    g.fittings = { shuttle: { reactor: ['reactor_mk1'], engine: ['engine_mk1'], shield: [], weapon: ['laser_mk1'], mining: ['mininglaser_1'], utility: [], cargo: ['cargo_mk1'] } };
    g.systems = freshSystems();
    g.shipCond = { shuttle: g.systems };
    g.storage = {}; g.cargo = {};
    g.mission = null; g.refineJob = null; g.pendingDistress = null; g.pendingEncounter = null;
    g.mode = 'balanced'; g.behavior = 'defensive'; g.fleeAt = 40; g.repairAt = 50;
    g.marketEvents = []; g.marketEventsEndsAt = 0;
    g.contractOffers = []; g.contractOffersEndsAt = 0; g.activeContract = null;
    g.questChains = {};
    g.crew = []; g.unlocks = { automation: false }; g.autoRepeat = false; g.autoRepeatPaused = false;
    g.fleet = {}; g.deployments = []; g.fleetStock = {}; g.fleetPendingCr = 0; g.fleetLast = Date.now();
    g.bargeProduced = {}; g.bargeLogAt = 0;
    logLine(g, `✨ Prestiged! Gained ${gain} Renown (now ${g.renown}). Permanent +${Math.round(g.renown * 2)}% to production. The frontier begins anew.`, 'level');
    return { ok: true };
  }

  // ----- onboarding objectives -----
  function checkObjectives(g) {
    if (!g.questsDone) g.questsDone = [];
    for (const o of OBJECTIVES) {
      if (g.questsDone.includes(o.id)) continue;
      if (o.done(g)) {
        g.questsDone.push(o.id);
        g.credits += o.reward;
        g.stats.credEarned += o.reward;
        logLine(g, `✅ Objective complete: ${o.name} (+${o.reward} cr).`, 'level');
      }
    }
  }

  // lifetime production tally (per resource), surfaced in the Codex
  function addProduced(g, id, qty) {
    if (qty > 0) { if (!g.produced) g.produced = {}; g.produced[id] = (g.produced[id] || 0) + qty; }
  }
  function addProducedMap(g, items) {
    for (const [id, q] of Object.entries(items)) addProduced(g, id, q);
  }

  // ----- achievements (production milestones) -----
  function achievementValue(g, ach) {
    const prod = g.produced || {};
    switch (ach.metric) {
      case 'total': return Object.values(prod).reduce((a, b) => a + Math.floor(b), 0);
      case 'kind': return Object.entries(prod).reduce((a, [id, q]) => a + (RESOURCES[id] && RESOURCES[id].kind === ach.arg ? Math.floor(q) : 0), 0);
      case 'resource': return Math.floor(prod[ach.arg] || 0);
      case 'distinct': return Object.values(prod).filter(q => Math.floor(q) >= 1).length;
      default: return 0;
    }
  }
  function checkAchievements(g) {
    if (!g.achievements) g.achievements = [];
    for (const a of ACHIEVEMENTS) {
      if (g.achievements.includes(a.id)) continue;
      if (achievementValue(g, a) >= a.threshold) {
        g.achievements.push(a.id);
        logLine(g, `🏆 Achievement unlocked: ${a.name} — ${a.desc}`, 'level');
      }
    }
  }

  // ----- codex lore (narrative unlocks) -----
  // Evaluate a LORE entry's unlock condition against game state. Mirrors how
  // achievementValue / questValue read state: visited→g.visited,
  // discovered→g.discovered, achievements→g.achievements, produced→g.produced.
  function loreUnlocked(g, entry) {
    const u = entry.unlock || {};
    switch (u.type) {
      case 'always': return true;
      case 'visit': return (g.visited || []).includes(u.sys);
      case 'discover': return (g.discovered || []).includes(u.poi);
      case 'achievement': return (g.achievements || []).includes(u.ach);
      case 'produce': {
        const prod = g.produced || {};
        const have = u.res ? Math.floor(prod[u.res] || 0)
          : Object.entries(prod).reduce((a, [id, q]) => a + (RESOURCES[id] && RESOURCES[id].kind === u.kind ? Math.floor(q) : 0), 0);
        return have >= (u.n || 0);
      }
      default: return false;
    }
  }
  function checkLore(g) {
    if (!g.loreSeen) g.loreSeen = [];
    if (g.loreSeen.length >= LORE.length) return; // all known — keep it cheap
    for (const entry of LORE) {
      if (g.loreSeen.includes(entry.id)) continue;
      if (loreUnlocked(g, entry)) {
        g.loreSeen.push(entry.id);
        logLine(g, `📖 Lore unlocked: ${entry.title}`, 'level');
      }
    }
  }

  // ----- Captain's Logbook: a personal narrative auto-written from milestones.
  // Persists across prestige (like the Codex). journalKeys prevents duplicates. -----
  function journalAdd(g, icon, text) {
    if (!g.journal) g.journal = [];
    g.journal.unshift({ t: Date.now(), icon, text });
    if (g.journal.length > 80) g.journal.length = 80;
  }
  function journalOnce(g, key, icon, text) {
    if (!g.journalKeys) g.journalKeys = {};
    if (g.journalKeys[key]) return;
    g.journalKeys[key] = 1;
    journalAdd(g, icon, text);
  }
  function checkJournal(g) {
    const st = g.stats || {};
    for (const [thr, txt] of [[1, 'Logged my first run. The frontier doesn\'t wait for anyone.'],
      [10, 'Ten runs in — the ship\'s starting to feel like home.'],
      [100, 'A hundred runs behind me. The old hands are starting to nod.'],
      [1000, 'A thousand runs. They tell stories about pilots like me now.']])
      if ((st.runs || 0) >= thr) journalOnce(g, 'runs' + thr, '🚀', txt);
    for (const [thr, txt] of [[1, 'First kill. The void got a little quieter.'],
      [25, 'Twenty-five hostiles down. Word travels out here.'],
      [100, 'A hundred kills. The raiders know my transponder by now.']])
      if ((st.kills || 0) >= thr) journalOnce(g, 'kills' + thr, '💥', txt);
    for (const [thr, txt] of [[10000, 'Cleared ten thousand credits earned. Beans on the table.'],
      [100000, 'A hundred thousand earned. I can afford the good fuel now.'],
      [1000000, 'A million credits earned — a frontier fortune.']])
      if ((st.credEarned || 0) >= thr) journalOnce(g, 'cred' + thr, '💰', txt);
    for (const sid of (g.visited || [])) if (SYSTEMS[sid]) journalOnce(g, 'visit' + sid, '🌌', `Made port in ${SYSTEMS[sid].name} for the first time.`);
    for (const id of Object.keys(SKILLS)) { const lv = skillLevel(g, id);
      for (const m of [25, 50, 99]) if (lv >= m) journalOnce(g, 'skill' + id + m, '📘', `Reached ${SKILLS[id].name} level ${m}.`); }
    if (g.prestige) journalOnce(g, 'prestige' + g.prestige, '✨', `Prestiged (×${g.prestige}). The frontier begins anew — but I remember every run.`);
  }

  // Deployed Refinery Barges work the shared fleet stockpile: first single-input
  // recipes (raw ore → metal/fuel), then multi-input recipes (assemble finished
  // goods), each pass richest-output-first. Splitting the passes lets chains run
  // in one tick — e.g. iron ore → refined iron → steel.
  const outValue = (r) => Object.entries(r.out).reduce((a, [id, q]) => a + (RESOURCES[id].value * q), 0);
  const SINGLE_REFINE = Object.values(RECIPES)
    .filter(r => Object.keys(r.in).length === 1).sort((a, b) => outValue(b) - outValue(a));
  const MULTI_REFINE = Object.values(RECIPES)
    .filter(r => Object.keys(r.in).length > 1).sort((a, b) => outValue(b) - outValue(a));
  // batches a single deployed barge can process per hour
  const BARGE_BATCHES_PER_HOUR = 12;
  // every resource a recipe can output (used to tally net barge production)
  const PRODUCT_IDS = (() => {
    const s = new Set();
    for (const r of Object.values(RECIPES)) for (const id of Object.keys(r.out)) s.add(id);
    return [...s];
  })();

  // ----- starting a mission -----
  // opts: { skipBaseCheck, poi, location } — POI launches skip the base op list.
  function startMission(g, activityId, opts) {
    opts = opts || {};
    if (g.mission) return { ok: false, msg: 'A mission is already running.' };
    if (g.pendingDistress) return { ok: false, msg: 'Resolve the distress event first.' };
    if (g.pendingEncounter) return { ok: false, msg: 'Resolve the salvage find first.' };
    const act = ACTIVITIES[activityId];
    if (!act) return { ok: false, msg: 'Unknown activity.' };

    if (!opts.skipBaseCheck && !curBase(g).activities.includes(activityId)) return { ok: false, msg: 'That operation is not offered at this starbase.' };
    const lvl = skillLevel(g, act.skill);
    if (lvl < act.reqLevel) return { ok: false, msg: `Requires ${SKILLS[act.skill].name} level ${act.reqLevel}.` };
    const fuelCost = Math.max(1, Math.round(act.fuel / perkMult(g, 'fuel')));
    if (g.fuel < fuelCost) return { ok: false, msg: 'Not enough fuel.' };

    // piloting + a Navigator reduce effective duration
    const pilot = skillLevel(g, 'piloting');
    const speedMod = MODES[g.mode].mult.speed || 1;
    let dur = act.duration * (1 - Math.min(0.3, pilot * 0.0025)) / speedMod / bonus(g, 'speed');
    dur = Math.max(6, Math.round(dur));

    g.fuel -= fuelCost;
    g.mission = {
      id: activityId, type: act.type, startedAt: Date.now(),
      duration: dur, endsAt: Date.now() + dur * 1000,
      events: [], resolved: false,
      poi: opts.poi || null, location: opts.location || null,
    };
    g.lastRoute = { id: activityId, poi: opts.poi || null }; // remembered so a paused idle loop can resume
    logLine(g, `Undocked: ${act.name}${opts.location ? ` → ${opts.location}` : ''} (${dur}s).`, 'go');
    return { ok: true };
  }

  // ----- POI helpers & launches -----
  // which system (and body) a POI belongs to
  function poiLocation(poiId) {
    for (const [sid, s] of Object.entries(SYSTEMS)) {
      if ((s.spacePois || []).includes(poiId)) return { system: sid, body: null };
      for (const bid of (s.bodies || [])) {
        if ((BODIES[bid].pois || []).includes(poiId)) return { system: sid, body: bid };
      }
    }
    return null;
  }
  // a POI's richness tier (defaults to standard)
  function poiTier(poiId) {
    const p = POIS[poiId];
    return (p && POI_TIERS[p.tier]) || POI_TIERS.standard;
  }
  function poiTierMult(poiId) { return poiTier(poiId).mult; }
  function startPoiMission(g, poiId) {
    const p = POIS[poiId];
    if (!p) return { ok: false, msg: 'Unknown location.' };
    const loc = poiLocation(poiId);
    if (!loc || loc.system !== g.currentSystem) return { ok: false, msg: 'That location is in another system — jump there first.' };
    if (!poiRevealed(g, poiId)) return { ok: false, msg: 'Scan to reveal this location before you can work it.' };
    return startMission(g, p.activity, { skipBaseCheck: true, poi: poiId, location: p.name });
  }

  // ----- scanning: an idle survey that reveals hidden POIs -----
  // target: 'system' (deep-space POIs) or a body id (surface POIs)
  function startScan(g, target) {
    if (g.mission) return { ok: false, msg: 'A mission is already running.' };
    if (g.pendingDistress || g.pendingEncounter) return { ok: false, msg: 'Resolve the pending event first.' };
    if (target !== 'system' && (!BODIES[target] || BODIES[target].system !== g.currentSystem)) {
      return { ok: false, msg: 'Nothing to scan there.' };
    }
    if (g.fuel < SCAN_ACTIVITY.fuel) return { ok: false, msg: 'Not enough fuel to run a scan.' };
    const pilot = skillLevel(g, 'piloting');
    let dur = SCAN_ACTIVITY.duration * (1 - Math.min(0.3, pilot * 0.0025)) / bonus(g, 'speed');
    dur = Math.max(5, Math.round(dur));
    g.fuel -= SCAN_ACTIVITY.fuel;
    g.mission = {
      id: '__scan', type: 'scan', target, startedAt: Date.now(),
      duration: dur, endsAt: Date.now() + dur * 1000, events: [], resolved: false,
    };
    const what = target === 'system' ? `${curSystem(g).name} deep space` : BODIES[target].name;
    logLine(g, `Running a survey scan of ${what} (${dur}s).`, 'go');
    return { ok: true };
  }
  // candidate hidden POIs for a scan target
  function hiddenPoisFor(g, target) {
    let ids = [];
    if (target === 'system') ids = curSystem(g).spacePois || [];
    else if (BODIES[target]) ids = BODIES[target].pois || [];
    return ids.filter(id => POIS[id] && POIS[id].hidden && !(g.discovered || []).includes(id));
  }

  function recallMission(g) {
    if (!g.mission) return;
    // aborting a jump: drift back to origin (fuel already spent is lost)
    if (g.mission.type === 'travel') {
      logLine(g, `Aborted the jump to ${SYSTEMS[g.mission.dest].name}; limped back to ${curSystem(g).name}.`, 'bad');
      g.mission = null;
      return;
    }
    // aborting a scan: just stop (fuel already spent is lost)
    if (g.mission.type === 'scan') {
      logLine(g, 'Survey scan aborted.', 'bad');
      g.mission = null;
      return;
    }
    // resolve immediately with whatever progress (partial)
    g.mission.recalled = true;
    g.mission.endsAt = Date.now();
  }

  // ----- travel between systems -----
  // jump cost scales with distance; piloting trims the travel time.
  function travelCost(g, fromId, toId) {
    const a = SYSTEMS[fromId].pos, b = SYSTEMS[toId].pos;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const pilot = skillLevel(g, 'piloting');
    const time = Math.max(10, Math.round(dist * 8 * (1 - Math.min(0.3, pilot * 0.0025)) / bonus(g, 'speed')));
    const fuel = Math.max(2, Math.round(dist * 2 / perkMult(g, 'fuel')));
    return { fuel, time, dist };
  }
  function startTravel(g, destId) {
    if (g.mission) return { ok: false, msg: 'You are already underway.' };
    if (g.pendingDistress) return { ok: false, msg: 'Resolve the distress event first.' };
    if (g.pendingEncounter) return { ok: false, msg: 'Resolve the salvage find first.' };
    if (g.refineJob) return { ok: false, msg: 'Cannot jump while the refinery is running.' };
    const dest = SYSTEMS[destId];
    if (!dest) return { ok: false, msg: 'Unknown system.' };
    if (destId === g.currentSystem) return { ok: false, msg: 'You are already docked here.' };
    const { fuel, time } = travelCost(g, g.currentSystem, destId);
    if (g.fuel < fuel) return { ok: false, msg: `Need ${fuel} fuel to jump there.` };
    g.fuel -= fuel;
    g.mission = {
      id: '__travel', type: 'travel', dest: destId, startedAt: Date.now(),
      duration: time, endsAt: Date.now() + time * 1000, events: [], resolved: false,
    };
    logLine(g, `Jumping to ${dest.name} — ${time}s, ${fuel} fuel.`, 'go');
    return { ok: true };
  }

  // ----- dock at another starbase within the current system (instant) -----
  function dockAt(g, baseId) {
    if (g.mission) return { ok: false, msg: 'You are underway — finish your run first.' };
    if (g.pendingDistress || g.pendingEncounter) return { ok: false, msg: 'Resolve the pending event first.' };
    const base = BASES[baseId];
    if (!base) return { ok: false, msg: 'Unknown starbase.' };
    if (base.system !== g.currentSystem) return { ok: false, msg: 'That base is in another system — jump there first.' };
    if (baseId === g.currentBase) return { ok: false, msg: 'Already docked here.' };
    g.currentBase = baseId;
    generateContracts(g);    // fresh board for this base's faction
    logLine(g, `Docked at ${base.name} (${FACTIONS[base.factionId].name}).`, 'go');
    arrivalFlavor(g);        // a line of local colour
    arrivalCustoms(g);       // a different base means a different customs desk
    arrivalHostility(g);
    return { ok: true };
  }

  // ----- the per-frame tick -----
  function tick(g) {
    const now = Date.now();

    // market events refresh on expiry (and on first run when endsAt is 0)
    if (!g.marketEventsEndsAt || now >= g.marketEventsEndsAt) rollMarketEvents(g);

    // GalNet news feed rolls forward on expiry (and on first run when endsAt is 0)
    if (!g.newsEndsAt || now >= g.newsEndsAt) rollNews(g);

    // contract board refresh on expiry (and on first run)
    if (!g.contractOffersEndsAt || now >= g.contractOffersEndsAt) generateContracts(g);

    // fleet passive income accrues continuously (and catches up offline)
    accrueFleet(g);

    // report what the barges refined — at most once a minute (and promptly after
    // an offline catch-up, since bargeLogAt starts at 0).
    if (now - (g.bargeLogAt || 0) >= 60000) {
      flushBargeLog(g);
      g.bargeLogAt = now;
    }

    // refining job progress
    if (g.refineJob && now >= g.refineJob.endsAt) completeRefineBatch(g);

    // mission completion. Guard it: if resolution ever throws, clear the mission
    // instead of re-throwing every tick (which would freeze the loop and leave
    // the activity buttons greyed out with no progress bar, permanently).
    if (g.mission && !g.pendingDistress && now >= g.mission.endsAt) {
      try {
        resolveMission(g);
      } catch (err) {
        if (typeof console !== 'undefined') console.error('resolveMission failed:', err);
        g.mission = null;
        g.autoRepeat = false; // don't let a broken route relaunch into the same error
        logLine(g, '⚠️ A mission failed to resolve and was aborted. You can launch again.', 'bad');
      }
    }

    // production milestones + onboarding objectives + codex lore
    checkAchievements(g);
    checkObjectives(g);
    checkLore(g);
    checkJournal(g);
  }

  // ----- market events: roll 1-2 temporary price swings for the current system
  function rollMarketEvents(g) {
    const n = 1 + (Math.random() < 0.5 ? 1 : 0);
    const pool = MARKET_EVENT_POOL.slice();
    const picked = [];
    const usedKinds = new Set();
    for (let i = 0; i < n && pool.length; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const ev = pool.splice(idx, 1)[0];
      if (usedKinds.has(ev.kind)) continue; // one swing per kind at a time
      usedKinds.add(ev.kind);
      picked.push({ kind: ev.kind, mult: ev.mult, up: ev.up, label: ev.label });
    }
    g.marketEvents = picked;
    const dur = 180 + Math.floor(Math.random() * 180); // 3-6 minutes
    g.marketEventsEndsAt = Date.now() + dur * 1000;
  }

  // ----- GALNET: a procedural galactic news feed (pure flavour/worldbuilding) -----
  // Headlines are stored in g.news; they have no mechanical effect. Each draws a
  // category from NEWS_WEIGHTS, then fills its template tokens from newsContext().
  // The big template pool × random people/ships/orgs makes repeats rare.
  const NEWS_CAP = 60;
  const newsPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function pushNews(g, item) {
    if (!g.news) g.news = [];
    g.news.unshift(item);
    if (g.news.length > NEWS_CAP) g.news.length = NEWS_CAP;
  }
  function fillTokens(tpl, ctx) {
    return tpl.replace(/\{(\w+)\}/g, (m, k) => (ctx[k] != null ? ctx[k] : m));
  }
  const newsName = () => `${newsPick(NEWS_FIRST_NAMES)} ${newsPick(NEWS_LAST_NAMES)}`;
  function newsPrice() {
    const mag = newsPick([100, 1000, 10000, 100000]);
    return ((2 + Math.floor(Math.random() * 98)) * mag).toLocaleString();
  }
  // a fresh context of real game entities + random people/ships/orgs per headline
  function newsContext(g) {
    const fid = newsPick(Object.keys(FACTIONS));
    const f = FACTIONS[fid];
    const rivalId = (f.opposed && FACTIONS[f.opposed]) ? f.opposed
      : newsPick(Object.keys(FACTIONS).filter(x => x !== fid));
    const sysIds = Object.keys(SYSTEMS);
    const sid = newsPick(sysIds);
    const sid2 = newsPick(sysIds.filter(x => x !== sid)) || sid;
    const resId = newsPick(Object.keys(RESOURCES));
    const bodyIds = Object.keys(BODIES);
    // ~40% of the time the subject is a recurring public figure rather than a
    // one-off name, so the same cast keeps surfacing across news + rumours.
    let person = newsName(), title = newsPick(NEWS_TITLES);
    if (typeof NAMED_CHARACTERS !== 'undefined' && NAMED_CHARACTERS.length && Math.random() < 0.4) {
      const ch = newsPick(NAMED_CHARACTERS); person = ch.name; title = ch.title;
    }
    return {
      faction: f.name, rival: FACTIONS[rivalId].name,
      system: SYSTEMS[sid].name, system2: SYSTEMS[sid2].name,
      economy: SYSTEMS[sid].economy, danger: SYSTEMS[sid].danger,
      resource: RESOURCES[resId].name, corp: FACTIONS.corporate.name,
      body: bodyIds.length ? BODIES[newsPick(bodyIds)].name : SYSTEMS[sid].name,
      org: newsPick(NEWS_ORGS), ship: newsPick(NEWS_SHIP_NAMES), title,
      person, person2: newsName(), price: newsPrice(),
      n: 2 + Math.floor(Math.random() * 48), pct: 3 + Math.floor(Math.random() * 30),
      age: 58 + Math.floor(Math.random() * 42), // 58–99, for obituaries
    };
  }
  function weightedCat() {
    const total = NEWS_WEIGHTS.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [k, w] of NEWS_WEIGHTS) { r -= w; if (r <= 0) return k; }
    return NEWS_WEIGHTS[0][0];
  }
  function makeHeadline(cat, ctx) {
    const t = NEWS_TEMPLATES[cat];
    return { t: Date.now(), cat, icon: t.icon, outlet: newsPick(NEWS_OUTLETS), text: fillTokens(newsPick(t.lines), ctx) };
  }

  // roll the feed forward: file 1–2 general headlines, and now and then echo a
  // real active market swing. Mirrors the market-event cadence.
  function rollNews(g) {
    const now = Date.now();
    const n = 1 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) pushNews(g, makeHeadline(weightedCat(), newsContext(g)));
    if (g.marketEvents && g.marketEvents.length && Math.random() < 0.35) {
      const ev = newsPick(g.marketEvents);
      pushNews(g, { t: now, cat: 'market', icon: NEWS_TEMPLATES.market.icon,
        outlet: 'Meridian Exchange Report', text: `${curSystem(g).name}: ${ev.label}.` });
    }
    maybeMarketShock(g); // some news actually MOVES the local market
    g.newsEndsAt = now + (90 + Math.floor(Math.random() * 150)) * 1000; // 1.5–4 min
  }

  // GalNet that bites: occasionally a headline spawns a real price swing on a
  // resource KIND in your current system (lives until the market set re-rolls).
  function maybeMarketShock(g) {
    if (typeof MARKET_EVENT_POOL === 'undefined') return;
    if (!Array.isArray(g.marketEvents)) g.marketEvents = [];
    if (Math.random() > 0.15) return;
    const active = new Set(g.marketEvents.map(e => e.kind));
    const candidates = MARKET_EVENT_POOL.filter(e => !active.has(e.kind));
    if (!candidates.length) return;
    const ev = newsPick(candidates);
    g.marketEvents.push({ kind: ev.kind, mult: ev.mult, up: ev.up, label: ev.label, fromNews: true });
    pushNews(g, { t: Date.now(), cat: 'market', icon: '📈',
      outlet: newsPick(NEWS_OUTLETS), text: `${curSystem(g).name}: ${ev.label} — local prices are moving.` });
  }

  // ----- cantina rumours: local bar gossip, regenerated when the board rolls -----
  function rollRumors(g) {
    if (typeof RUMORS === 'undefined') return;
    const n = 3 + Math.floor(Math.random() * 2); // 3–4 rumours per board
    const pool = RUMORS.slice();
    const out = [];
    for (let i = 0; i < n && pool.length; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      out.push(fillTokens(pool.splice(idx, 1)[0], newsContext(g)));
    }
    g.rumors = out;
  }

  // ----- crew barks: a little character in the log after a completed run -----
  function maybeCrewBark(g) {
    if (Math.random() > 0.28) return;                 // ~quarter of runs
    const aboard = (typeof crewAboard === 'function' ? crewAboard(g) : []).filter(c => c && c.bark && c.bark.length);
    if (!aboard.length) return;
    const c = newsPick(aboard);
    logLine(g, `${c.icon} ${c.name}: ${newsPick(c.bark)}`, 'event');
  }

  // ----- arrival flavour: a colour line when you dock somewhere -----
  function arrivalFlavor(g) {
    if (typeof ARRIVAL_LINES === 'undefined') return;
    const base = curBase(g), fac = FACTIONS[base.factionId];
    const ctx = { base: base.name, faction: fac ? fac.name : 'station', system: curSystem(g).name };
    logLine(g, newsPick(ARRIVAL_LINES).replace(/\{(\w+)\}/g, (m, k) => ctx[k] != null ? ctx[k] : m), 'event');
  }

  // ----- customs & faction welcome on arrival -----
  // lawful stations scan arriving ships for illegal cargo.
  function arrivalCustoms(g) {
    const base = curBase(g);
    const fac = FACTIONS[base.factionId];
    if (!fac || !fac.lawful) return;
    const illegalIds = Object.keys(g.cargo).filter(id => RESOURCES[id].illegal && g.cargo[id] > 0);
    if (!illegalIds.length) return;
    const total = illegalIds.reduce((a, id) => a + g.cargo[id], 0);
    let chance = 0.45 + Math.min(0.3, total * 0.01);
    if (g.mode === 'stealth') chance -= 0.25;                          // run dark to smuggle
    chance -= Math.min(0.2, Math.max(0, factionRep(g, base.factionId)) * 0.01); // trusted = less scrutiny
    chance -= skillLevel(g, 'piloting') * 0.002;
    chance = Math.max(0.05, Math.min(0.9, chance));
    if (Math.random() < chance) {
      let fine = 0;
      for (const id of illegalIds) { fine += g.cargo[id] * RESOURCES[id].value; delete g.cargo[id]; }
      fine = Math.min(g.credits, Math.round(fine * 1.5));
      g.credits -= fine;
      addRep(g, base.factionId, -3);
      logLine(g, `⚠️ ${base.name} customs seized your contraband and fined you ${fine} cr. ${fac.name} standing -3.`, 'bad');
    } else {
      logLine(g, `You ran your contraband past ${base.name} customs undetected.`, 'event');
    }
  }
  // arriving/docking where you're hostile gets you roughed up by patrols.
  function arrivalHostility(g) {
    if (!hostileHere(g)) return;
    const base = curBase(g);
    const stats = shipStats(g);
    const pilot = skillLevel(g, 'piloting');
    if (Math.random() < Math.min(0.8, (stats.evasion + pilot) / 120)) {
      logLine(g, `${FACTIONS[base.factionId].name} patrols shadowed you, but you kept your distance.`, 'event');
      return;
    }
    const d = 10 + Math.floor(Math.random() * 16);
    g.systems.hull = Math.max(0, g.systems.hull - d);
    logLine(g, `${FACTIONS[base.factionId].name} patrols harassed you at ${base.name} (-${d} hull). You're not welcome here.`, 'bad');
  }

  // ----- faction contracts (the jobs board) -----
  function generateContracts(g) {
    const fid = curBase(g).factionId;
    g.contractOffersEndsAt = Date.now() + 300 * 1000; // refresh every 5 min
    rollRumors(g);                                     // fresh cantina gossip with each board
    // hostiles won't hire you
    if (hostileHere(g)) { g.contractOffers = []; return; }
    const fac = FACTIONS[fid];
    const power = Math.max(...Object.keys(SKILLS).map(k => skillLevel(g, k)));
    const offers = [];
    const count = 3;
    for (let i = 0; i < count; i++) {
      const seq = ++g.contractSeq;
      const roll = Math.random();
      if (roll < 0.45) {
        // delivery: bring goods this faction wants
        const resId = fac.wants[Math.floor(Math.random() * fac.wants.length)];
        const res = RESOURCES[resId];
        const qty = 4 + Math.floor(Math.random() * 8) + Math.floor(power / 4);
        const credits = Math.round(qty * res.value * 1.6 + 80);
        const rep = 1 + Math.floor(qty / 10);
        offers.push({
          id: `${fid}-d-${seq}`, faction: fid, type: 'deliver', resource: resId, qty,
          reward: { credits, rep, xp: Math.round(credits / 12) },
          title: `Deliver ${qty}× ${res.name}`,
          desc: `${fac.name} needs ${qty}× ${res.icon} ${res.name}. Bring it to any ${fac.name} station.`,
        });
      } else if (roll < 0.75) {
        // bounty: clear hostiles
        const kills = 2 + Math.floor(Math.random() * 3) + Math.floor(power / 10);
        const credits = kills * 140 + 100;
        const rep = 1 + Math.floor(kills / 3);
        offers.push({
          id: `${fid}-b-${seq}`, faction: fid, type: 'bounty', kills,
          reward: { credits, rep, xp: Math.round(credits / 14) },
          title: `Bounty: clear ${kills} hostiles`,
          desc: `${fac.name} pays per kill. Destroy ${kills} hostiles in combat, then report back to any ${fac.name} station.`,
        });
      } else {
        // production quota (side-gig): mine/refine a quantity of a resource KIND.
        // Tracks lifetime output once accepted — no need to haul it back, just produce it.
        const wantKinds = [...new Set(fac.wants.map(w => RESOURCES[w].kind))]
          .filter(k => ['ore', 'refined', 'salvage', 'fuel', 'part'].includes(k));
        const kind = wantKinds.length ? wantKinds[Math.floor(Math.random() * wantKinds.length)] : 'ore';
        const need = 20 + Math.floor(Math.random() * 30) + power * 2;
        const credits = Math.round(need * 7 + 120);
        const rep = 1 + Math.floor(need / 40);
        offers.push({
          id: `${fid}-p-${seq}`, faction: fid, type: 'produce', kind, qty: need,
          reward: { credits, rep, xp: Math.round(credits / 12) },
          title: `Quota: produce ${need}× ${kind}`,
          desc: `${fac.name} wants ${need} units of ${kind} mined or refined. Output counts from the moment you accept — then report to any ${fac.name} station.`,
        });
      }
    }
    g.contractOffers = offers;
  }
  // lifetime units produced of a given resource KIND (used by production quotas)
  function producedKind(g, kind) {
    const prod = g.produced || {};
    return Object.entries(prod).reduce((a, [id, q]) => a + (RESOURCES[id] && RESOURCES[id].kind === kind ? Math.floor(q) : 0), 0);
  }
  function acceptContract(g, id) {
    if (g.activeContract) return { ok: false, msg: 'Finish or abandon your current contract first.' };
    const off = (g.contractOffers || []).find(o => o.id === id);
    if (!off) return { ok: false, msg: 'That contract is no longer available.' };
    g.activeContract = Object.assign({}, off, {
      acceptedAt: Date.now(), killBaseline: g.stats.kills,
      produceBaseline: off.type === 'produce' ? producedKind(g, off.kind) : 0,
    });
    g.contractOffers = g.contractOffers.filter(o => o.id !== id);
    logLine(g, `Accepted contract: ${off.title} (${FACTIONS[off.faction].name}).`, 'go');
    return { ok: true };
  }
  function contractProgress(g) {
    const c = g.activeContract;
    if (!c) return null;
    if (c.type === 'deliver') return { have: g.cargo[c.resource] || 0, need: c.qty };
    if (c.type === 'bounty') return { have: Math.max(0, g.stats.kills - c.killBaseline), need: c.kills };
    if (c.type === 'produce') return { have: Math.max(0, producedKind(g, c.kind) - (c.produceBaseline || 0)), need: c.qty };
    return null;
  }
  function completeContract(g) {
    const c = g.activeContract;
    if (!c) return { ok: false, msg: 'No active contract.' };
    const fac = FACTIONS[c.faction];
    if (curBase(g).factionId !== c.faction) return { ok: false, msg: `Turn this in at a ${fac.name} station.` };
    if (c.type === 'deliver') {
      if ((g.cargo[c.resource] || 0) < c.qty) return { ok: false, msg: `You need ${c.qty}× ${RESOURCES[c.resource].name} aboard.` };
      g.cargo[c.resource] -= c.qty; if (g.cargo[c.resource] <= 0) delete g.cargo[c.resource];
    } else if (c.type === 'bounty') {
      const got = g.stats.kills - c.killBaseline;
      if (got < c.kills) return { ok: false, msg: `Bounty incomplete: ${got}/${c.kills} hostiles cleared.` };
    } else if (c.type === 'produce') {
      const made = producedKind(g, c.kind) - (c.produceBaseline || 0);
      if (made < c.qty) return { ok: false, msg: `Quota incomplete: ${Math.floor(made)}/${c.qty} ${c.kind} produced.` };
    }
    g.credits += c.reward.credits; g.stats.credEarned += c.reward.credits;
    addRep(g, c.faction, c.reward.rep);
    const sk = c.type === 'bounty' ? 'gunnery'
      : c.type === 'produce' ? (c.kind === 'refined' || c.kind === 'part' ? 'refining' : 'mining')
      : 'trade';
    const lu = addSkillXp(g, sk, c.reward.xp);
    logLine(g, `Contract complete: ${c.title}. +${c.reward.credits} cr, ${fac.name} standing +${c.reward.rep}.`, 'good');
    if (lu) logLine(g, `★ ${SKILLS[sk].name} reached level ${lu}!`, 'level');
    g.activeContract = null;
    return { ok: true };
  }
  function abandonContract(g) {
    if (!g.activeContract) return;
    logLine(g, `Abandoned contract: ${g.activeContract.title}.`, 'bad');
    g.activeContract = null;
  }

  // ----- faction storylines -----
  function getChain(g, fid) {
    if (!g.questChains) g.questChains = {};
    if (!g.questChains[fid]) g.questChains[fid] = { step: 0, killBaseline: g.stats.kills };
    return g.questChains[fid];
  }
  // the effective current step, resolving branch variants into the step body
  function currentQuest(g, fid) {
    const ql = QUESTLINES[fid]; if (!ql) return null;
    const c = getChain(g, fid);
    const raw = c.step < ql.steps.length ? ql.steps[c.step] : null;
    if (!raw) return null;
    if (raw.variants) {
      const v = (c.branch && raw.variants[c.branch]) || raw.variants[Object.keys(raw.variants)[0]];
      return Object.assign({}, raw, v);
    }
    return raw;
  }
  function questTarget(o) { return o.type === 'visit' ? 1 : o.n; }
  function questValue(g, fid) {
    const q = currentQuest(g, fid); if (!q || !q.objective) return 0;
    const o = q.objective, c = getChain(g, fid);
    switch (o.type) {
      case 'rep': return factionRep(g, fid);
      case 'deliver': return g.cargo[o.res] || 0;
      case 'kills': return Math.max(0, g.stats.kills - (c.killBaseline || 0));
      case 'produce': return o.res ? Math.floor(g.produced[o.res] || 0)
        : Object.entries(g.produced || {}).reduce((a, [id, v]) => a + (RESOURCES[id] && RESOURCES[id].kind === o.kind ? Math.floor(v) : 0), 0);
      case 'visit': return (g.visited || []).includes(o.sys) ? 1 : 0;
      case 'credEarned': return g.stats.credEarned || 0;
      default: return 0;
    }
  }
  function questMet(g, fid) { const q = currentQuest(g, fid); return !!q && !!q.objective && questValue(g, fid) >= questTarget(q.objective); }
  function questStatus(g, fid) {
    const ql = QUESTLINES[fid]; if (!ql) return null;
    const c = getChain(g, fid);
    const quest = currentQuest(g, fid);
    const isChoice = !!(quest && quest.choice);
    return { ql, step: c.step, total: ql.steps.length, quest, isChoice,
      choices: (quest && quest.choices) || [],
      value: quest && quest.objective ? questValue(g, fid) : 0,
      target: quest && quest.objective ? questTarget(quest.objective) : 0,
      met: quest && quest.objective ? questMet(g, fid) : false, complete: !quest };
  }
  // make a branching decision at a choice chapter
  function chooseQuest(g, fid, idx) {
    const q = currentQuest(g, fid);
    if (!q || !q.choice) return { ok: false, msg: 'No decision to make here.' };
    if (curBase(g).factionId !== fid) return { ok: false, msg: `Decide at a ${FACTIONS[fid].name} starbase.` };
    if (hostileHere(g)) return { ok: false, msg: `${FACTIONS[fid].name} won't deal with a hostile.` };
    const ch = q.choices[idx]; if (!ch) return { ok: false, msg: 'Unknown choice.' };
    const e = ch.effect || {};
    if (e.credits && e.credits < 0 && g.credits < -e.credits) return { ok: false, msg: 'You can\'t afford that option.' };
    if (e.credits) { g.credits += e.credits; if (e.credits > 0) g.stats.credEarned += e.credits; }
    if (e.rep) for (const [f, amt] of Object.entries(e.rep)) g.reputation[f] = (g.reputation[f] || 0) + amt;
    if (e.xp) addSkillXp(g, e.xpSkill || 'piloting', e.xp);
    if (e.item) g.storage[e.item] = (g.storage[e.item] || 0) + 1;
    if (e.fleet) g.fleet[e.fleet] = (g.fleet[e.fleet] || 0) + 1;
    const c = getChain(g, fid);
    if (ch.branch) c.branch = ch.branch;
    c.step++;
    const next = currentQuest(g, fid);
    if (next && next.objective && next.objective.type === 'kills') c.killBaseline = g.stats.kills;
    logLine(g, `📖 ${QUESTLINES[fid].title} — you chose: ${ch.label}.${e.log ? ' ' + e.log : ''}`, 'level');
    return { ok: true };
  }
  function reportQuest(g, fid) {
    const ql = QUESTLINES[fid]; if (!ql) return { ok: false, msg: 'No storyline here.' };
    const q = currentQuest(g, fid); if (!q) return { ok: false, msg: 'Storyline already complete.' };
    if (q.choice) return { ok: false, msg: 'Make your decision first.' };
    if (curBase(g).factionId !== fid) return { ok: false, msg: `Report to a ${FACTIONS[fid].name} starbase.` };
    if (hostileHere(g)) return { ok: false, msg: `${FACTIONS[fid].name} won't deal with a hostile.` };
    if (!questMet(g, fid)) return { ok: false, msg: 'Objective not complete yet.' };
    const o = q.objective;
    if (o.type === 'deliver') {
      if ((g.cargo[o.res] || 0) < o.n) return { ok: false, msg: `You need ${o.n}× ${RESOURCES[o.res].name} aboard.` };
      g.cargo[o.res] -= o.n; if (g.cargo[o.res] <= 0) delete g.cargo[o.res];
    }
    const r = q.reward;
    if (r.credits) { g.credits += r.credits; g.stats.credEarned += r.credits; }
    if (r.rep) addRep(g, fid, r.rep);
    if (r.xp) { const sk = r.xpSkill || 'piloting'; const lu = addSkillXp(g, sk, r.xp); if (lu) logLine(g, `★ ${SKILLS[sk].name} reached level ${lu}!`, 'level'); }
    if (r.item) g.storage[r.item] = (g.storage[r.item] || 0) + 1;
    if (r.fleet) g.fleet[r.fleet] = (g.fleet[r.fleet] || 0) + 1;
    const c = getChain(g, fid); c.step++;
    const next = currentQuest(g, fid);
    if (next && next.objective && next.objective.type === 'kills') c.killBaseline = g.stats.kills;
    const parts = [r.credits ? `${r.credits} cr` : null, r.rep ? `+${r.rep} standing` : null,
      r.item ? `a ${MODULES[r.item].name}` : null, r.fleet ? `a ${FLEET_UNITS[r.fleet].name}` : null].filter(Boolean);
    logLine(g, `📖 ${ql.title} — “${q.title}” complete! Reward: ${parts.join(', ')}.`, 'level');
    if (!next) logLine(g, `📖 Storyline complete: you've seen out ${FACTIONS[fid].name}'s ${ql.title}.`, 'level');
    return { ok: true };
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

    // ----- travel arrival -----
    if (m.type === 'travel') {
      g.currentSystem = m.dest;
      g.currentBase = primaryBaseId(m.dest); // arrive at the system's primary starbase
      if (!g.visited) g.visited = [];
      if (!g.visited.includes(m.dest)) g.visited.push(m.dest);
      rollMarketEvents(g);     // fresh market on arrival
      generateContracts(g);    // fresh contract board for the new base's faction
      const sys = SYSTEMS[m.dest];
      logLine(g, `Arrived at ${sys.name}, docking at ${curBase(g).name}.`, 'good');
      if (sys.danger === 'High') logLine(g, `⚠️ ${sys.name} is high-danger space. Watch your hull.`, 'event');
      arrivalFlavor(g);        // a line of local colour
      arrivalCustoms(g);       // lawful space scans for contraband
      arrivalHostility(g);     // hostile factions don't roll out the welcome mat
      g.mission = null;
      return;
    }

    // ----- survey scan: reveal hidden POIs at the target -----
    if (m.type === 'scan') {
      const found = hiddenPoisFor(g, m.target);
      for (const id of found) g.discovered.push(id);
      const where = m.target === 'system' ? `${curSystem(g).name} deep space` : (BODIES[m.target] ? BODIES[m.target].name : 'the area');
      // every scan logs survey data; discovering new sites yields a bonus haul
      const dataQty = 1 + Math.floor(Math.random() * 2) + found.length * 2;
      const gotData = addToCargo(g, { survey_data: dataQty });
      const dataStr = gotData.survey_data ? ` Logged ${gotData.survey_data}× Survey Data.` : '';
      if (found.length) {
        logLine(g, `Scan of ${where} complete — discovered ${found.length} new location${found.length > 1 ? 's' : ''}: ${found.map(id => POIS[id].name).join(', ')}.${dataStr}`, 'good');
      } else {
        logLine(g, `Scan of ${where} complete — nothing new on the scopes.${dataStr}`, 'event');
      }
      addSkillXp(g, 'piloting', SCAN_ACTIVITY.xp);
      g.mission = null;
      return;
    }

    const act = ACTIVITIES[m.id];
    if (!act) {
      // stale/unknown mission id (e.g. from an older save) — recover gracefully
      logLine(g, 'Returned from an unknown operation. Mission cleared.', 'bad');
      g.mission = null;
      return;
    }
    const stats = shipStats(g);
    const run = makeRun(g, stats);
    const beh = BEHAVIORS[g.behavior] || BEHAVIORS.defensive; // fall back if behavior is bad
    run.protectCargo = beh.protectCargo;

    // partial-failure factor if recalled early
    let progress = 1;
    if (m.recalled) {
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
    } else if (act.type === 'wave') {
      // escort/defense: fight waves; loot scales with how many you cleared
      const res = runWaves(g, stats, buildWaves(act), beh);
      for (const l of res.logs) logs.push(l);
      combatOk = res.cleared > 0;
      run.lootMult *= res.total ? res.cleared / res.total : 0;
      if (res.win) {
        for (const [id, lo, hi] of (act.bossDrops || [])) {
          const q = lo + Math.floor(Math.random() * (hi - lo + 1));
          if (q > 0) run.bonusLoot.push([id, q]);
        }
        logs.push(`Held the line — all ${res.total} waves cleared!`);
      } else {
        logs.push(`Cleared ${res.cleared}/${res.total} waves before withdrawing.`);
      }
    }

    // heat lingering damage (a Chief Engineer dampens it)
    if (run.heat > 60) {
      const d = Math.max(1, Math.round((run.heat - 60) / 6 * (1 - Math.min(0.6, (crewMult(g, 'heatCut') - 1)))));
      run.damageSystem('reactor', d);
      logs.push(`Sustained heat warped the reactor (-${d}).`);
    }

    // award loot (scaled by progress, skill mastery, lootMult, crew yield, POI tier)
    let gained = {};
    if (combatOk && (act.drops || run.bonusLoot.length)) {
      const masteryMult = 1 + skillLevel(g, act.skill) * 0.004;
      const tier = m.poi ? poiTier(m.poi) : POI_TIERS.standard;
      const mult = run.lootMult * beh.lootMult * progress * masteryMult * cargoBayPenalty(g) * bonus(g, 'yield') * tier.mult;
      for (const [id, lo, hi] of (act.drops || [])) {
        let qty = lo + Math.floor(Math.random() * (hi - lo + 1));
        qty = Math.round(qty * mult);
        if (qty > 0) gained[id] = (gained[id] || 0) + qty;
      }
      for (const [id, qty] of run.bonusLoot) gained[id] = (gained[id] || 0) + qty;
      // pristine sites occasionally turn up exotic materials
      if (tier.rare && Math.random() < 0.5) {
        const rid = PRISTINE_RARE_DROPS[Math.floor(Math.random() * PRISTINE_RARE_DROPS.length)];
        gained[rid] = (gained[rid] || 0) + 1;
        logs.push(`A pristine find — recovered a ${RESOURCES[rid].name}!`);
      }
      addProducedMap(g, gained); // count everything extracted, even if the hold is full
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
    if ((act.type === 'combat' || act.type === 'wave') && !combatOk) head = `Fled ${act.name} — beaten back!`;
    logLine(g, `${head} Hauled: ${lootStr}. +${xpGain} ${SKILLS[act.skill].name} XP.`, combatOk ? 'good' : 'bad');
    for (const l of logs) logLine(g, l, 'event');
    if (lvlUp) logLine(g, `★ ${SKILLS[act.skill].name} reached level ${lvlUp}!`, 'level');

    g.stats.runs++;
    g.mission = null;

    // crew wages drawn from the run's takings
    payCrewWages(g);
    maybeCrewBark(g);        // a little character from whoever's aboard

    // a salvage-type run may turn up a broken ship or sealed find to investigate
    maybeTriggerEncounter(g, act);

    // automation: relaunch the same route if enabled and nothing is blocking —
    // but pause first if the ship has taken too much damage, so the idle loop
    // doesn't fly a battered hull back into harm. Repairing re-arms auto-repeat.
    if (g.autoRepeat && !g.mission && !g.pendingEncounter && !g.pendingDistress) {
      const integrity = shipIntegrity(g);
      const threshold = g.repairAt ?? 50;
      if (integrity < threshold) {
        g.autoRepeat = false;
        g.autoRepeatPaused = true; // distinguish "stopped to repair" from a hard stop
        logLine(g, `Auto-route paused: ship integrity ${integrity}% fell below the ${threshold}% threshold. Repair to resume.`, 'bad');
      } else {
        const res = m.poi ? startPoiMission(g, m.poi) : startMission(g, m.id);
        if (!res.ok) {
          g.autoRepeat = false;
          g.autoRepeatPaused = false;
          logLine(g, `Auto-route stopped: ${res.msg}`, 'bad');
        }
      }
    }
  }

  // crew draw a wage from every completed mission; if you can't pay, they grumble.
  function payCrewWages(g) {
    const wage = crewWage(g);
    if (wage <= 0) return;
    if (g.credits >= wage) {
      g.credits -= wage;
      logLine(g, `Paid crew wages: ${wage} cr.`, 'event');
    } else {
      g.credits = 0;
      logLine(g, `⚠️ Couldn't cover crew wages (${wage} cr) — morale is slipping.`, 'bad');
    }
  }

  // breached cargo bay loses some capacity / loot
  function cargoBayPenalty(g) { return Math.max(0.4, cond(g.systems.cargobay)); }

  // overall ship integrity = the worst-off subsystem's condition (0-100).
  // Used to halt auto-repeat before the ship grinds itself to scrap.
  function shipIntegrity(g) {
    return Math.min(...SHIP_SYSTEMS.map(s => g.systems[s] ?? 100));
  }

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

  // ----- combat -----
  // a single engagement; `state` carries hp/shield across multi-wave fights.
  // enemy.abilities: shielded | regen | alpha | evasive | disabler | enrage
  function fight(g, stats, enemy, beh, state) {
    const gun = skillLevel(g, 'gunnery');
    let myHp = state ? state.hp : stats.hull;
    let myShield = state ? state.shield : stats.shield;
    const maxEhp = enemy.hull;
    let eHp = enemy.hull;
    const eArmor = enemy.armor || 0;
    let eShield = (enemy.shield || 0);
    const ab = enemy.abilities || [];
    const has = a => ab.includes(a);

    const myDmgBase = (stats.weapon || 4) * beh.dmgDealt * (1 + gun * 0.01) * bonus(g, 'combat');
    let acc = Math.min(0.95, 0.55 + gun * 0.006 + stats.sensors * 0.002) - (enemy.evasion || 0) * 0.005;
    if (has('evasive')) acc -= 0.15;
    acc = Math.max(0.2, acc);
    const fleeHp = stats.hull * (g.fleeAt / 100);

    let rounds = 0, firstHit = true;
    const subsysHit = new Set();
    while (eHp > 0 && myHp > 0 && rounds < 60) {
      rounds++;
      // player attacks (shield soaks first, then armour)
      if (Math.random() < acc) {
        let dmg = myDmgBase * (0.8 + Math.random() * 0.4);
        const pen = stats.armorPen || 0;
        dmg = Math.max(1, dmg - Math.max(0, eArmor - pen) * 0.4);
        if (Math.random() < 0.1 + gun * 0.003) dmg *= 1.8; // crit
        if (eShield > 0) { const a = Math.min(eShield, dmg); eShield -= a; dmg -= a; }
        eHp -= dmg;
      }
      if (eHp <= 0) break;
      // self-repairing enemies claw hull back
      if (has('regen')) eHp = Math.min(maxEhp, eHp + maxEhp * 0.04);
      // enemy attacks
      if (Math.random() < (0.5 + enemy.weapon * 0.01) - stats.evasion * 0.006) {
        let dmg = enemy.weapon * beh.dmgTaken * (0.8 + Math.random() * 0.4);
        if (firstHit && has('alpha')) dmg *= 2.5;           // devastating opening salvo
        if (has('enrage')) dmg *= 1 + (1 - eHp / maxEhp) * 0.6; // hits harder as it's wounded
        firstHit = false;
        if (myShield > 0) { const a = Math.min(myShield, dmg); myShield -= a; dmg -= a; }
        dmg = Math.max(0, dmg - stats.armor * 0.3);
        // disabler drones knock out subsystems directly
        if (has('disabler') && Math.random() < 0.4) {
          const opts = SHIP_SYSTEMS.filter(s => s !== 'hull');
          const sys = opts[Math.floor(Math.random() * opts.length)];
          g.systems[sys] = Math.max(0, g.systems[sys] - (6 + Math.floor(Math.random() * 10)));
          subsysHit.add(sys);
        }
        myHp -= dmg;
        myShield += stats.shieldRegen * 0.5;
      }
      if (myHp <= fleeHp && eHp > maxEhp * 0.3) {
        return { win: false, fled: true, hp: myHp, shield: myShield, log: `Hull at flee threshold — disengaged from ${enemy.name}.` };
      }
    }
    if (eHp <= 0) {
      const verb = beh.disable ? 'Disabled' : 'Destroyed';
      let log = `${verb} ${enemy.name} in ${rounds} rounds.`;
      if (subsysHit.size) log += ` Subsystems hit: ${subsysHit.size}.`;
      return { win: true, hp: myHp, shield: myShield, log };
    }
    return { win: false, hp: myHp, shield: myShield, log: `Overwhelmed by ${enemy.name} — retreated with hull breaches.` };
  }

  // single-engagement wrapper (preserves the original API + hull damage + XP)
  function runCombat(g, stats, enemy, beh) {
    const r = fight(g, stats, enemy, beh, null);
    // Apply hull damage whether you won, fled, or were overwhelmed — matching
    // runWaves(). Previously this sat inside `if (r.win)`, so losing or fleeing a
    // fight cost no hull at all, making reckless engagements consequence-free.
    const taken = stats.hull - r.hp;
    if (taken > 0) {
      // Losing/fleeing a single fight still costs hull, but at a reduced rate so
      // it stings without being punishing (wins remain at the original cost).
      const lossFactor = r.win ? 1 : 0.5;
      g.systems.hull = Math.max(0, g.systems.hull - Math.round(taken / stats.maxHull * 60 * lossFactor));
    }
    if (r.win) addSkillXp(g, 'gunnery', 15);
    return { win: r.win, log: r.log };
  }

  // multi-wave engagement (escort/defense): hp carries between waves with a small
  // breather; returns how many waves were cleared.
  function runWaves(g, stats, waves, beh) {
    const state = { hp: stats.hull, shield: stats.shield };
    let cleared = 0; const logs = [];
    for (let i = 0; i < waves.length; i++) {
      const r = fight(g, stats, waves[i], beh, state);
      logs.push(`Wave ${i + 1}/${waves.length}: ${r.log}`);
      state.hp = r.hp; state.shield = r.shield;
      if (!r.win) break;
      cleared++; g.stats.kills++;
      state.shield = Math.min(stats.shield, state.shield + stats.shieldRegen * 2); // brief recovery
    }
    const taken = stats.hull - state.hp;
    if (taken > 0) g.systems.hull = Math.max(0, g.systems.hull - Math.round(taken / stats.maxHull * 60));
    if (cleared > 0) addSkillXp(g, 'gunnery', 10 * cleared);
    return { cleared, total: waves.length, win: cleared === waves.length, logs };
  }

  // build a wave list from an activity: scaled trash waves, then the boss
  function buildWaves(act) {
    const arr = [];
    const n = act.waveCount || 3;
    for (let i = 0; i < n; i++) {
      const e = Object.assign({}, act.enemy);
      e.name = `${act.enemy.name} ${i + 1}`;
      e.hull = Math.round(act.enemy.hull * (1 + 0.12 * i));
      arr.push(e);
    }
    if (act.boss) arr.push(Object.assign({}, act.boss));
    return arr;
  }

  // human-readable subsystem names for log lines
  const SYS_LABELS = { hull: 'Hull', reactor: 'Reactor', engines: 'Engines', sensors: 'Sensors', cargobay: 'Cargo bay', weapons: 'Weapons', shields: 'Shields', lifesupport: 'Life support' };

  // apply a result/outcome payload (used by encounters).
  // supports credits[lo,hi], items[[id,qty]], fuel, damage([sys,amt] or list), rep, xp.
  function applyResult(g, res, choice, defaultSkill) {
    const logs = [];
    if (res.credits) {
      let bonus = 1;
      if (choice && choice.skill) bonus = 1 + skillLevel(g, choice.skill) * 0.01;
      const c = Math.round((res.credits[0] + Math.random() * (res.credits[1] - res.credits[0])) * bonus);
      g.credits += c; g.stats.credEarned += c;
      logs.push(`Received ${c} credits.`);
    }
    if (res.items) {
      const fit = addToCargo(g, Object.fromEntries(res.items));
      const str = Object.entries(fit).map(([id, q]) => `${q}× ${RESOURCES[id].name}`).join(', ');
      if (str) logs.push(`Recovered ${str}.`);
      else logs.push('Cargo hold was too full to take anything.');
    }
    if (res.fuel) {
      g.fuel = Math.max(0, g.fuel + res.fuel);
      logs.push(`${res.fuel > 0 ? 'Salvaged' : 'Lost'} ${Math.abs(res.fuel)} fuel.`);
    }
    if (res.damage) {
      const list = Array.isArray(res.damage[0]) ? res.damage : [res.damage];
      for (const [sys, amt] of list) {
        g.systems[sys] = Math.max(0, (g.systems[sys] ?? 100) - amt);
        logs.push(`${SYS_LABELS[sys] || sys} damaged (-${amt}).`);
      }
    }
    if (res.rep) {
      // scavenging goodwill is Freebelt-flavoured, mirroring distress
      addRep(g, 'freebelt', res.rep);
      logs.push(`Freebelt Union standing ${res.rep > 0 ? '+' : ''}${res.rep}.`);
    }
    if (res.xp) {
      const sk = (choice && choice.skill) || defaultSkill || 'salvage';
      const lu = addSkillXp(g, sk, res.xp);
      logs.push(`+${res.xp} ${SKILLS[sk] ? SKILLS[sk].name : sk} XP.`);
      if (lu) logs.push(`★ ${SKILLS[sk].name} reached level ${lu}!`);
    }
    return logs;
  }

  // pick a weighted outcome; skill bonus tilts toward `good` and away from `bad`.
  function rollOutcome(outcomes, skillBonus) {
    const sb = skillBonus || 0;
    const weighted = outcomes.map(o => {
      let w = o.p || 1;
      if (o.good) w *= (1 + sb * 6);
      if (o.bad) w /= (1 + sb * 6);
      return { o, w };
    });
    const total = weighted.reduce((a, x) => a + x.w, 0);
    let r = Math.random() * total;
    for (const x of weighted) { r -= x.w; if (r <= 0) return x.o; }
    return weighted[weighted.length - 1].o;
  }

  // maybe surface an interactive scavenging encounter after a salvage-type run
  function maybeTriggerEncounter(g, act) {
    if (!act || !act.encounters || !act.encounters.length) return;
    if (g.pendingDistress || g.pendingEncounter || g.mission) return;
    if (Math.random() > (act.encChance ?? 0.35)) return;
    const id = act.encounters[Math.floor(Math.random() * act.encounters.length)];
    if (!ENCOUNTERS.find(e => e.id === id)) return;
    g.pendingEncounter = { scenario: id };
    logLine(g, 'Mid-salvage, you came across something worth a closer look…', 'event');
  }

  // ----- encounter decision resolution -----
  function resolveEncounter(g, choiceIdx) {
    if (!g.pendingEncounter) return;
    const sc = ENCOUNTERS.find(s => s.id === g.pendingEncounter.scenario);
    if (!sc) { g.pendingEncounter = null; return; }
    const choice = sc.choices[choiceIdx];
    if (!choice) return;
    const stats = shipStats(g);
    const logs = [];

    // optional combat gate
    if (choice.combat) {
      const c = runCombat(g, stats, choice.combat, BEHAVIORS[g.behavior]);
      logs.push(c.log);
      if (!c.win) {
        logLine(g, `${sc.title}: ${c.log} You came away empty-handed.`, 'bad');
        for (const l of logs) logLine(g, l, 'event');
        g.pendingEncounter = null;
        return;
      }
      g.stats.kills++;
    }

    // resolve the payload (weighted outcome if present)
    let res = choice.result;
    if (choice.outcomes) {
      const sb = choice.skill ? skillLevel(g, choice.skill) * 0.01 : 0;
      res = rollOutcome(choice.outcomes, sb);
    }
    const applied = applyResult(g, res, choice, 'salvage');
    logLine(g, `${sc.title}: ${res.log || choice.label}`, res.bad ? 'bad' : 'good');
    for (const l of logs) logLine(g, l, 'event');
    for (const l of applied) logLine(g, l, 'event');
    g.pendingEncounter = null;
  }

  // ----- distress decision resolution -----
  function resolveDistress(g, choiceIdx) {
    if (!g.pendingDistress) return;
    const scenario = DISTRESS.find(s => s.id === g.pendingDistress.scenario);
    if (!scenario) { g.pendingDistress = null; return; }   // stale/unknown id — self-heal instead of throwing
    const choice = scenario.choices[choiceIdx];
    if (!choice) return;                                   // out-of-range pick — ignore, keep the card up
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
    if (res.rep) {
      // distress rep is Freebelt-flavoured; addRep ripples the opposed faction
      addRep(g, 'freebelt', res.rep);
      logs.push(`Freebelt Union standing ${res.rep > 0 ? '+' : ''}${res.rep}.`);
    }
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
    const batchTime = Math.max(2, Math.round(r.time / bonus(g, 'refine'))); // Chief Engineer speeds this up
    g.refineJob = { recipe: recipeId, batchesLeft: maxBatches, perBatch: batchTime, endsAt: Date.now() + batchTime * 1000 };
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
    addProducedMap(g, r.out);
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
  // sell price at an arbitrary base (current-system market events only apply to
  // bases in the system you're actually in — you can't see remote events).
  function sellPriceAtBase(g, base, id) {
    const res = RESOURCES[id];
    let mod = base.station.sell[res.kind] || 1;
    // research & corporate buyers pay a premium for survey data
    if (res.kind === 'data' && (base.factionId === 'concord' || base.factionId === 'corporate')) mod *= 1.4;
    let evMult = 1;
    if (base.system === g.currentSystem) {
      for (const ev of (g.marketEvents || [])) if (ev.kind === res.kind) evMult *= ev.mult;
    }
    const tradeBonus = 1 + skillLevel(g, 'trade') * 0.004;
    const repBonus = 1 + Math.max(-0.2, Math.min(0.25, factionRep(g, base.factionId) * 0.01));
    return Math.max(1, Math.round(res.value * mod * evMult * tradeBonus * repBonus * bonus(g, 'price')));
  }
  function sellPrice(g, id) { return sellPriceAtBase(g, curBase(g), id); }
  function buyPriceAtBase(g, base, id) { return Math.max(1, Math.ceil(sellPriceAtBase(g, base, id) * BUY_SPREAD)); }

  // best arbitrage lane per commodity across the bases you've charted (visited
  // systems). Ranked by per-unit profit, since cargo is counted by quantity.
  function bestRoutes(g, limit) {
    limit = limit || 8;
    const bases = [];
    for (const sid of (g.visited || [])) if (SYSTEMS[sid]) for (const bid of SYSTEMS[sid].bases) bases.push(BASES[bid]);
    const best = {};
    for (const id of Object.keys(RESOURCES)) {
      if (!isBuyable(id)) continue;
      for (const from of bases) {
        const buy = buyPriceAtBase(g, from, id);
        for (const to of bases) {
          if (to === from) continue;
          const profit = sellPriceAtBase(g, to, id) - buy;
          if (profit <= 0) continue;
          if (!best[id] || profit > best[id].profit) {
            best[id] = { id, from: from.id, to: to.id, fromSys: from.system, toSys: to.system, buy, sell: buy + profit, profit, margin: profit / buy };
          }
        }
      }
    }
    return Object.values(best).sort((a, b) => b.profit - a.profit).slice(0, limit);
  }
  // a commodity you can buy at the local exchange
  function isBuyable(id) {
    const r = RESOURCES[id];
    return !!r && !r.illegal && BUYABLE_KINDS.includes(r.kind);
  }
  // buy price = local sell price × spread, so a same-base round-trip never profits
  function buyPrice(g, id) {
    return Math.max(1, Math.ceil(sellPrice(g, id) * BUY_SPREAD));
  }
  function buyResource(g, id, qty) {
    if (!isBuyable(id)) return { ok: false, msg: 'That isn\'t stocked at this exchange.' };
    const price = buyPrice(g, id);
    const room = Math.max(0, shipStats(g).cargo - cargoUsed(g));
    const affordable = Math.floor(g.credits / price);
    qty = Math.min(qty, room, affordable);
    if (qty <= 0) return { ok: false, msg: room <= 0 ? 'Cargo hold is full.' : 'Not enough credits.' };
    const total = price * qty;
    g.credits -= total;
    g.cargo[id] = (g.cargo[id] || 0) + qty;
    addSkillXp(g, 'trade', Math.ceil(total / 40));
    logLine(g, `Bought ${qty}× ${RESOURCES[id].name} for ${total} cr.`, 'go');
    return { ok: true };
  }

  function sellResource(g, id, qty) {
    const res = RESOURCES[id];
    const fac = FACTIONS[curBase(g).factionId];
    if (res.illegal && fac && fac.lawful) {
      return { ok: false, msg: `${res.name} is illegal in ${fac.name} space — find a lawless port to fence it.` };
    }
    const have = g.cargo[id] || 0;
    qty = Math.min(qty, have);
    if (qty <= 0) return { ok: false, msg: 'Nothing to sell.' };
    const each = sellPrice(g, id);
    const total = each * qty;
    g.cargo[id] -= qty; if (g.cargo[id] <= 0) delete g.cargo[id];
    g.credits += total; g.stats.credEarned += total;
    addSkillXp(g, 'trade', Math.ceil(total / 25));
    logLine(g, `Sold ${qty}× ${res.name} for ${total} cr.`, 'good');
    return { ok: true };
  }
  function sellAllRaw(g) {
    for (const id of Object.keys({ ...g.cargo })) {
      if (['ore', 'salvage'].includes(RESOURCES[id].kind)) sellResource(g, id, g.cargo[id]);
    }
  }

  // ----- repair & refuel -----
  // friendly stations cut you a deal; hostile ones refuse or gouge you.
  function repAdj(g) { return Math.max(-0.3, Math.min(0.25, factionRep(g, curBase(g).factionId) * 0.01)); }
  function hostileHere(g) {
    const base = curBase(g);
    const fac = FACTIONS[base.factionId];
    return fac && fac.lawful && factionRep(g, base.factionId) <= -6;
  }

  function repairAll(g) {
    if (hostileHere(g)) return { ok: false, msg: `${FACTIONS[curBase(g).factionId].name} won't service a hostile ship here.` };
    let cost = 0;
    for (const sys of SHIP_SYSTEMS) {
      const missing = 100 - g.systems[sys];
      cost += missing;
    }
    cost = Math.round(cost * curBase(g).station.repairCostPerHp);
    // engineering discount
    cost = Math.round(cost * (1 - Math.min(0.3, skillLevel(g, 'engineering') * 0.003)));
    // faction standing discount / surcharge
    cost = Math.round(cost * (1 - repAdj(g)));
    if (cost <= 0) return { ok: false, msg: 'Nothing to repair.' };
    if (g.credits < cost) return { ok: false, msg: `Repair costs ${cost} cr — you can't afford it.` };
    g.credits -= cost;
    g.systems = freshSystems();
    if (g.shipCond) g.shipCond[g.activeShip] = g.systems; // keep this ship's stored condition in sync
    logLine(g, `Repaired all systems for ${cost} cr.`, 'good');
    // a fully-patched hull re-arms an auto-route that paused for damage
    if (g.autoRepeatPaused) {
      g.autoRepeat = true;
      g.autoRepeatPaused = false;
      logLine(g, 'Auto-route re-armed — it resumes when you next launch a route.', 'go');
    }
    return { ok: true };
  }
  function refuel(g, units) {
    if (hostileHere(g)) return { ok: false, msg: `${FACTIONS[curBase(g).factionId].name} won't sell fuel to a hostile ship.` };
    const price = Math.max(1, Math.round(curBase(g).station.fuelPrice * (1 - repAdj(g))));
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
    if (!m) return { ok: false, msg: 'Unknown module.' };
    if (g.credits < m.cost) return { ok: false, msg: 'Not enough credits.' };
    g.credits -= m.cost;
    g.storage[modId] = (g.storage[modId] || 0) + 1;
    logLine(g, `Bought ${m.name}.`, 'good');
    return { ok: true };
  }
  function fitModule(g, modId) {
    const m = MODULES[modId];
    if (!m) return { ok: false, msg: 'Unknown module.' };
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
  // total cargo capacity a ship would have with its current fittings
  function cargoCapOf(g, shipId) {
    const fit = g.fittings[shipId]; if (!fit) return 0;
    let c = 0;
    for (const slot of Object.keys(fit)) for (const m of fit[slot]) {
      const md = MODULES[m]; if (md && md.stats && md.stats.cargo) c += md.stats.cargo;
    }
    return c;
  }
  function unfitModule(g, slot, idx) {
    const fit = g.fittings[g.activeShip];
    const modId = (fit[slot] || [])[idx];
    if (!modId) return { ok: false };
    const md = MODULES[modId];
    // don't let a refit strand cargo above the new capacity
    if (md && md.stats && md.stats.cargo) {
      const newCap = cargoCapOf(g, g.activeShip) - md.stats.cargo;
      if (cargoUsed(g) > newCap) return { ok: false, msg: 'Offload cargo before removing this hold.' };
    }
    fit[slot].splice(idx, 1);
    g.storage[modId] = (g.storage[modId] || 0) + 1;
    logLine(g, `Removed ${md ? md.name : modId}.`); // tolerate a stale/unknown module id
    return { ok: true };
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
    if (!g.shipCond || typeof g.shipCond !== 'object') g.shipCond = {};
    g.shipCond[shipId] = freshSystems();                  // a freshly-bought ship arrives pristine
    logLine(g, `Purchased ${ship.name}!`, 'good');
    return { ok: true };
  }
  function switchShip(g, shipId) {
    if (!g.ownedShips.includes(shipId)) return { ok: false };
    if (g.mission) return { ok: false, msg: 'Cannot switch ships mid-mission.' };
    const cap = cargoCapOf(g, shipId);
    if (cargoUsed(g) > cap) return { ok: false, msg: `The ${SHIPS[shipId].name}'s hold (${cap}) can't fit your ${cargoUsed(g)} cargo — sell or offload first.` };
    // Per-ship condition: stash the ship we're leaving and restore the one we're
    // boarding, so swapping ships no longer free-repairs (the old exploit).
    if (!g.shipCond || typeof g.shipCond !== 'object') g.shipCond = {};
    g.shipCond[g.activeShip] = g.systems;                 // persist current damage
    g.activeShip = shipId;
    g.systems = g.shipCond[shipId] || freshSystems();     // restore prior damage (or pristine if never flown)
    g.shipCond[shipId] = g.systems;                       // keep active condition === stored condition
    logLine(g, `Now flying the ${SHIPS[shipId].name}.`);
    return { ok: true };
  }

  // ----- MVP 5: crew -----
  function hireCrew(g, crewId) {
    const c = CREW[crewId];
    if (!c) return { ok: false, msg: 'Unknown crew member.' };
    if (!(curBase(g).crew || []).includes(crewId)) return { ok: false, msg: `No ${c.name} is looking for work at ${curBase(g).name}.` };
    if ((g.crew || []).filter(id => id === crewId).length >= 2) return { ok: false, msg: `You already employ enough ${c.name}s.` };
    if (g.credits < c.cost) return { ok: false, msg: 'Not enough credits to sign them on.' };
    g.credits -= c.cost;
    g.crew.push(crewId);
    const aboard = g.crew.length <= crewSlots(g);
    logLine(g, `Hired ${c.name}${aboard ? '' : ' (benched — no free berth)'}.`, 'good');
    return { ok: true };
  }
  function dismissCrew(g, index) {
    if (index < 0 || index >= (g.crew || []).length) return { ok: false };
    const [id] = g.crew.splice(index, 1);
    logLine(g, `Dismissed ${CREW[id] ? CREW[id].name : 'crew'}.`);
    return { ok: true };
  }

  // ----- MVP 5: fleet & passive income -----
  // how many of a unit type are currently deployed to POIs
  function deployedCount(g, unitId) { return (g.deployments || []).filter(d => d.unit === unitId).length; }
  // idle (undeployed) units of a type still earn flat credits at a base
  function idleCount(g, unitId) { return Math.max(0, (g.fleet[unitId] || 0) - deployedCount(g, unitId)); }

  // flat credit income from IDLE units only
  function fleetRate(g) {
    let base = 0;
    for (const id of Object.keys(FLEET_UNITS)) base += FLEET_UNITS[id].rate * idleCount(g, id);
    return Math.round(base * bonus(g, 'fleet'));
  }
  function accrueFleet(g) {
    const now = Date.now();
    if (typeof g.fleetLast !== 'number') g.fleetLast = now;
    let hours = (now - g.fleetLast) / 3600000;
    if (hours > FLEET_OFFLINE_CAP_HOURS) hours = FLEET_OFFLINE_CAP_HOURS; // cap offline accrual
    if (hours > 0) {
      // idle units → credits
      const rate = fleetRate(g);
      if (rate > 0) g.fleetPendingCr += rate * hours;
      // deployed units → harvest the POI's drop table into the fleet stockpile
      const fleetMult = bonus(g, 'fleet');
      for (const d of (g.deployments || [])) {
        const u = FLEET_UNITS[d.unit];
        const poi = POIS[d.poi];
        const act = poi && ACTIVITIES[poi.activity];
        if (!u || !act || !act.drops || !act.drops.length) continue;
        const total = u.harvest * hours * fleetMult * poiTierMult(d.poi);
        const sumAvg = act.drops.reduce((a, [, lo, hi]) => a + (lo + hi) / 2, 0) || 1;
        for (const [rid, lo, hi] of act.drops) {
          const amount = total * ((lo + hi) / 2) / sumAvg;
          g.fleetStock[rid] = (g.fleetStock[rid] || 0) + amount;
          addProduced(g, rid, amount);
        }
      }
      // deployed barges refine the shared stockpile (raw → metal/fuel → finished goods)
      bargeRefine(g, hours, fleetMult);
    }
    g.fleetLast = now;
  }

  // a barge throughput-limited refining pass over the fleet stockpile
  function runRecipePass(stock, recipes, capacity) {
    for (const r of recipes) {
      if (capacity <= 0.0001) break;
      let maxByInput = Infinity;
      for (const [inId, need] of Object.entries(r.in)) maxByInput = Math.min(maxByInput, (stock[inId] || 0) / need);
      const batches = Math.min(capacity, maxByInput);
      if (batches <= 0.0001) continue;
      for (const [inId, need] of Object.entries(r.in)) { stock[inId] -= need * batches; if (stock[inId] < 0.0001) delete stock[inId]; }
      for (const [outId, qty] of Object.entries(r.out)) stock[outId] = (stock[outId] || 0) + qty * batches;
      capacity -= batches;
    }
    return capacity;
  }
  function bargeRefine(g, hours, fleetMult) {
    const barges = deployedCount(g, 'refinery_barge');
    if (barges <= 0) return;
    // snapshot product levels so we can tally net production for the log
    const before = {};
    for (const id of PRODUCT_IDS) before[id] = g.fleetStock[id] || 0;
    let capacity = barges * BARGE_BATCHES_PER_HOUR * hours * fleetMult; // batches this interval
    capacity = runRecipePass(g.fleetStock, SINGLE_REFINE, capacity); // raw → metals/fuel
    runRecipePass(g.fleetStock, MULTI_REFINE, capacity);             // → finished goods
    // accumulate net additions (intermediates consumed downstream net to ~0)
    if (!g.bargeProduced) g.bargeProduced = {};
    for (const id of PRODUCT_IDS) {
      const delta = (g.fleetStock[id] || 0) - before[id];
      if (delta > 0.0001) { g.bargeProduced[id] = (g.bargeProduced[id] || 0) + delta; addProduced(g, id, delta); }
    }
  }
  // flush a digest of what the barges have refined since the last report
  function flushBargeLog(g) {
    const prod = g.bargeProduced || {};
    const parts = [];
    for (const [id, q] of Object.entries(prod)) {
      const n = Math.floor(q);
      if (n >= 1) { parts.push(`${n}× ${RESOURCES[id].name}`); prod[id] -= n; if (prod[id] < 0.0001) delete prod[id]; }
    }
    if (parts.length) logLine(g, `🏭 Refinery barges produced: ${parts.join(', ')}.`, 'event');
  }
  function buyFleetUnit(g, unitId) {
    const u = FLEET_UNITS[unitId];
    if (!u) return { ok: false, msg: 'Unknown fleet unit.' };
    if (g.credits < u.cost) return { ok: false, msg: 'Not enough credits.' };
    g.credits -= u.cost;
    g.fleet[unitId] = (g.fleet[unitId] || 0) + 1;
    logLine(g, `Commissioned a ${u.name} into your fleet.`, 'good');
    return { ok: true };
  }
  function claimFleet(g) {
    accrueFleet(g);
    const amt = Math.floor(g.fleetPendingCr);
    if (amt <= 0) return { ok: false, msg: 'No fleet income to collect yet.' };
    g.fleetPendingCr -= amt;
    g.credits += amt;
    g.stats.credEarned += amt;
    logLine(g, `Collected ${amt} cr in fleet income.`, 'good');
    return { ok: true };
  }

  // ----- deploy a fleet unit to a POI to harvest it passively -----
  function deployFleet(g, unitId, poiId) {
    const u = FLEET_UNITS[unitId];
    if (!u) return { ok: false, msg: 'Unknown fleet unit.' };
    if (idleCount(g, unitId) < 1) return { ok: false, msg: `No idle ${u.name} available — commission one or recall another.` };
    const p = POIS[poiId];
    if (!p) return { ok: false, msg: 'Unknown location.' };
    if (!poiRevealed(g, poiId)) return { ok: false, msg: 'Scan to reveal this location first.' };
    const loc = poiLocation(poiId);
    if (!loc || loc.system !== g.currentSystem) return { ok: false, msg: 'You must be in-system to deploy a unit there.' };
    accrueFleet(g); // settle accrual before the roster changes
    g.deployments.push({ unit: unitId, poi: poiId });
    logLine(g, `Deployed a ${u.name} to harvest ${p.name}.`, 'good');
    return { ok: true };
  }
  function recallDeployment(g, index) {
    if (index < 0 || index >= (g.deployments || []).length) return { ok: false };
    accrueFleet(g);
    const d = g.deployments.splice(index, 1)[0];
    const p = POIS[d.poi];
    logLine(g, `Recalled a ${FLEET_UNITS[d.unit] ? FLEET_UNITS[d.unit].name : 'unit'} from ${p ? p.name : 'a site'}.`);
    return { ok: true };
  }
  // total whole units sitting in the harvested stockpile
  function fleetStockTotal(g) { return Object.values(g.fleetStock || {}).reduce((a, b) => a + Math.floor(b), 0); }
  // collect harvested goods into the ship's cargo (respects capacity)
  function collectFleetStock(g) {
    accrueFleet(g);
    const items = {};
    for (const [id, q] of Object.entries(g.fleetStock || {})) { const n = Math.floor(q); if (n > 0) items[id] = n; }
    if (!Object.keys(items).length) return { ok: false, msg: 'Nothing harvested yet.' };
    const fitted = addToCargo(g, items);
    for (const [id, n] of Object.entries(fitted)) { g.fleetStock[id] -= n; if (g.fleetStock[id] < 0.001) delete g.fleetStock[id]; }
    const str = Object.entries(fitted).map(([id, n]) => `${n}× ${RESOURCES[id].name}`).join(', ');
    if (!str) return { ok: false, msg: 'Cargo hold is full.' };
    logLine(g, `Collected harvested goods: ${str}.`, 'good');
    return { ok: true };
  }
  // sell the harvested stockpile directly for credits at current base prices
  function sellFleetStock(g) {
    accrueFleet(g);
    let total = 0; const sold = [];
    for (const [id, q] of Object.entries({ ...g.fleetStock })) {
      const n = Math.floor(q);
      if (n <= 0) continue;
      const res = RESOURCES[id];
      const fac = FACTIONS[curBase(g).factionId];
      if (res.illegal && fac && fac.lawful) continue; // can't fence illegal here
      total += sellPrice(g, id) * n;
      sold.push(`${n}× ${res.name}`);
      g.fleetStock[id] -= n; if (g.fleetStock[id] < 0.001) delete g.fleetStock[id];
    }
    if (total <= 0) return { ok: false, msg: 'Nothing sellable in the stockpile here.' };
    g.credits += total; g.stats.credEarned += total;
    addSkillXp(g, 'trade', Math.ceil(total / 25));
    logLine(g, `Sold harvested stockpile for ${total} cr.`, 'good');
    return { ok: true };
  }

  // ----- MVP 5: unlocks (automation) -----
  function buyUnlock(g, key) {
    if (key === 'automation') {
      if (g.unlocks.automation) return { ok: false, msg: 'Already installed.' };
      if (g.credits < AUTOMATION_COST) return { ok: false, msg: 'Not enough credits.' };
      g.credits -= AUTOMATION_COST;
      g.unlocks.automation = true;
      logLine(g, 'Installed a Flight Computer — activity routes can now auto-repeat.', 'good');
      return { ok: true };
    }
    return { ok: false, msg: 'Unknown unlock.' };
  }

  return {
    tick, startMission, recallMission, resolveDistress, resolveEncounter,
    startTravel, travelCost, dockAt, rollMarketEvents, rollNews,
    startScan, startPoiMission, poiLocation, poiTier,
    achievementValue, loreUnlocked, perkMult, pendingRenown, prestige,
    acceptContract, completeContract, abandonContract, contractProgress, generateContracts,
    questStatus, reportQuest, chooseQuest,
    startRefine, sellResource, sellAllRaw, sellPrice, buyResource, buyPrice, isBuyable, bestRoutes,
    repairAll, refuel, buyModule, fitModule, unfitModule, buyShip, switchShip,
    hireCrew, dismissCrew, fleetRate, accrueFleet, buyFleetUnit, claimFleet, buyUnlock,
    deployFleet, recallDeployment, collectFleetStock, sellFleetStock,
    idleCount, deployedCount, fleetStockTotal,
    shipIntegrity,
    logLine,
  };
})();
