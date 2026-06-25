/* SpaceBake — UI rendering. Builds the DOM from game state each frame.
 * Vanilla JS, no framework. Event handlers call Engine.* then re-render.
 */

const UI = (() => {
  let g = null;
  let tab = 'activities';
  // juice tracking
  let lastSoundT = 0, lastRuns = 0, lastCredits = null, lastHull = null, lastNewsBodyLen = -1;
  function snd(name) { if (typeof Sound !== 'undefined') Sound.play(name); }
  // settings accessor with safe defaults (so headless tests run without Settings)
  const SETTING_DEFAULTS = { numAbbrev: false, toasts: true, effects: true, reduceMotion: false, autosaveSec: 5, masterVol: 0.32, musicVol: 0.5 };
  function setting(k) { return (typeof Settings !== 'undefined') ? Settings.get(k) : SETTING_DEFAULTS[k]; }
  function effectsOn() { return setting('effects'); }

  function goldPulse() {
    if (!effectsOn() || typeof document === 'undefined') return;
    const ov = el('div', 'gold-pulse'); document.body.appendChild(ov);
    setTimeout(() => ov.remove(), 900);
  }
  function damageFlash() {
    if (!effectsOn() || typeof document === 'undefined') return;
    const ov = el('div', 'dmg-flash'); document.body.appendChild(ov);
    setTimeout(() => ov.remove(), 500);
  }
  // a number that floats up and fades, anchored near a topbar chip when possible
  function floatNum(text, cls, anchorSel) {
    if (!effectsOn() || typeof document === 'undefined' || !document.body) return;
    const fx = el('div', 'float-num ' + (cls || ''), text);
    let x = window.innerWidth / 2, y = 70;
    const a = anchorSel && $(anchorSel);
    if (a && a.getBoundingClientRect) { const r = a.getBoundingClientRect(); x = r.left + r.width / 2; y = r.bottom + 4; }
    fx.style.left = x + 'px'; fx.style.top = y + 'px';
    document.body.appendChild(fx);
    setTimeout(() => fx.remove(), 1100);
  }

  const $ = sel => document.querySelector(sel);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  function init(game) { g = game; render(); }
  function setState(game) { g = game; }

  function abbrev(n) {
    const neg = n < 0; n = Math.abs(n);
    let s;
    if (n >= 1e9) s = (n / 1e9).toFixed(2) + 'B';
    else if (n >= 1e6) s = (n / 1e6).toFixed(2) + 'M';
    else if (n >= 1e4) s = (n / 1e3).toFixed(1) + 'K';
    else s = String(n);
    return (neg ? '-' : '') + s;
  }
  function fmt(n) { n = Math.round(n); return setting('numAbbrev') ? abbrev(n) : n.toLocaleString(); }
  function timeLeft(endsAt) { return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)); }

  // ---------- top bar ----------
  function renderTopbar() {
    const stats = shipStats(g);
    const bar = $('#topbar');
    bar.innerHTML = '';
    const items = [
      ['💰', `${fmt(g.credits)} cr`, 'Credits'],
      ['⛽', `${fmt(g.fuel)}`, 'Fuel'],
      ['📦', `${fmt(cargoUsed(g))}/${fmt(stats.cargo)}`, 'Cargo'],
      ['🚀', (SHIPS[g.activeShip] || SHIPS.shuttle).name, 'Active ship'],
      ['🌌', curSystem(g).name, 'Current system'],
      ['🛰️', curBase(g).name, 'Docked starbase'],
    ];
    const fid = curBase(g).factionId;
    const fac = FACTIONS[fid];
    items.push([fac.icon, `${standingName(factionRep(g, fid))} (${factionRep(g, fid)})`, `${fac.name} standing`]);
    if ((g.renown || 0) > 0) items.push(['✨', `${fmt(g.renown)} (+${Math.round(g.renown * 2)}%)`, 'Renown — permanent production bonus']);
    // flash the credits chip + float the delta when the balance changes
    let creditFlash = '';
    if (lastCredits !== null && g.credits !== lastCredits) {
      const up = g.credits > lastCredits;
      creditFlash = up ? ' flash-up' : ' flash-down';
      floatNum(`${up ? '+' : '-'}${fmt(Math.abs(g.credits - lastCredits))} cr`, up ? 'good' : 'bad', '#topbar');
    }
    lastCredits = g.credits;
    items.forEach(([icon, val, title], i) => {
      const d = el('div', 'stat' + (i === 0 ? creditFlash : ''), `<span class="ico">${icon}</span><span>${val}</span>`);
      d.title = title;
      bar.appendChild(d);
    });
  }


  // ---------- mission banner ----------
  function renderMissionBanner() {
    const host = $('#mission-banner');
    host.innerHTML = '';
    if (g.pendingDistress) {
      host.classList.remove('hidden');
      host.appendChild(renderDistress());
      return;
    }
    if (g.pendingEncounter) {
      host.classList.remove('hidden');
      host.appendChild(renderEncounter());
      return;
    }
    if (!g.mission) {
      // idle loop paused for damage — don't just vanish; tell the player why and
      // give them a one-tap way to resume so the banner area never goes silent.
      if (g.autoRepeatPaused) { host.classList.remove('hidden'); host.appendChild(renderIdlePaused()); return; }
      host.classList.add('hidden');
      return;
    }
    host.classList.remove('hidden');
    const m = g.mission;
    const isTravel = m.type === 'travel';
    const isScan = m.type === 'scan';
    let title;
    if (isTravel) title = `🚀 Jumping to ${SYSTEMS[m.dest] ? SYSTEMS[m.dest].name : 'destination'}`;
    else if (isScan) title = `📡 Surveying ${m.target === 'system' ? curSystem(g).name : (BODIES[m.target] ? BODIES[m.target].name : 'area')}`;
    else title = `⏳ ${ACTIVITIES[m.id] ? ACTIVITIES[m.id].name : 'Mission'}${m.location ? ` — ${m.location}` : ''}`;
    const left = timeLeft(m.endsAt);
    const total = m.duration;
    const pct = Math.min(100, Math.round((1 - left / total) * 100));
    const card = el('div', 'banner-card');
    card.innerHTML = `
      <div class="banner-head">
        <strong>${title}</strong>
        <span>${left}s remaining</span>
      </div>
      <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>`;
    const btn = el('button', 'btn small', isTravel ? 'Abort Jump' : isScan ? 'Abort Scan' : 'Recall Ship');
    btn.onclick = () => { Engine.recallMission(g); refresh(); };
    card.appendChild(btn);
    host.appendChild(card);
  }

  // shown in place of the progress bar when the idle loop pauses for ship damage,
  // so the banner area never just goes blank when a run finishes.
  function resumeIdle() {
    g.autoRepeat = true; g.autoRepeatPaused = false;
    if (g.lastRoute) {
      const r = g.lastRoute.poi ? Engine.startPoiMission(g, g.lastRoute.poi) : Engine.startMission(g, g.lastRoute.id);
      if (r && r.ok === false) Engine.logLine(g, `Couldn't resume: ${r.msg}`, 'bad');
    }
  }
  function renderIdlePaused() {
    const card = el('div', 'banner-card distress');
    const integ = Engine.shipIntegrity ? Engine.shipIntegrity(g) : 0;
    card.innerHTML = `<div class="banner-head"><strong>⏸️ Idle loop paused</strong><span class="muted">integrity ${integ}% · below ${g.repairAt}%</span></div>
      <p class="distress-text">Your ship took too much damage to keep running on its own. Repair to resume, or carry on regardless.</p>`;
    const row = el('div', 'distress-choices');
    const fix = el('button', 'btn', '🔧 Repair & resume');
    fix.onclick = () => { const r = Engine.repairAll(g); if (r.ok) resumeIdle(); notify(r); };
    row.appendChild(fix);
    const resume = el('button', 'btn', '▶ Resume anyway');
    resume.onclick = () => { resumeIdle(); refresh(); };
    row.appendChild(resume);
    card.appendChild(row);
    return card;
  }

  function renderDistress() {
    const sc = DISTRESS.find(s => s.id === g.pendingDistress.scenario);
    if (!sc) { g.pendingDistress = null; return el('div'); } // unknown scenario: self-heal, don't lock
    const card = el('div', 'banner-card distress');
    card.innerHTML = `<div class="banner-head"><strong>📡 ${sc.title}</strong></div><p class="distress-text">${sc.text}</p>`;
    const choices = el('div', 'distress-choices');
    sc.choices.forEach((c, i) => {
      const b = el('button', 'btn', c.label + (c.combat ? ' ⚔️' : ''));
      b.onclick = () => { Engine.resolveDistress(g, i); refresh(); };
      choices.appendChild(b);
    });
    card.appendChild(choices);
    return card;
  }

  // a scavenging encounter: a broken ship or sealed find with branching choices,
  // some of which gamble on a good / neutral / bad outcome (a ⚠️ flags risk).
  function renderEncounter() {
    const sc = ENCOUNTERS.find(s => s.id === g.pendingEncounter.scenario);
    if (!sc) { g.pendingEncounter = null; return el('div'); } // unknown scenario: self-heal, don't lock
    const card = el('div', 'banner-card encounter');
    card.innerHTML = `<div class="banner-head"><strong>🛸 ${sc.title}</strong><span class="muted">Salvage find</span></div><p class="distress-text">${sc.text}</p>`;
    const choices = el('div', 'distress-choices');
    sc.choices.forEach((c, i) => {
      let label = c.label;
      if (c.skill && SKILLS[c.skill]) label += ` <small class="muted">(${SKILLS[c.skill].name})</small>`;
      if (c.combat) label += ' ⚔️';
      if (c.outcomes && c.outcomes.some(o => o.bad)) label += ' ⚠️';
      const b = el('button', 'btn', label);
      b.onclick = () => { Engine.resolveEncounter(g, i); refresh(); };
      choices.appendChild(b);
    });
    card.appendChild(choices);
    return card;
  }

  // ---------- tabs ----------
  const TABS = [
    ['activities', '🛰️ Activities'],
    ['galaxy', '🌌 Galaxy'],
    ['system', '🪐 System'],
    ['contracts', '📋 Contracts'],
    ['refinery', '⚗️ Refinery'],
    ['ship', '🚀 Ship'],
    ['market', '💱 Market'],
    ['operations', '🛠️ Operations'],
    ['skills', '📊 Skills'],
    ['codex', '📖 Codex'],
    ['news', '📡 News'],
    ['station', '🛰️ Starbase'],
  ];
  function renderTabs() {
    const host = $('#tabs');
    host.innerHTML = '';
    for (const [id, base] of TABS) {
      let label = base;
      if (id === 'news') {
        if (tab === 'news') g.newsSeen = Date.now();
        const unread = (g.news || []).filter(x => x.t > (g.newsSeen || 0)).length;
        if (unread) label += ` <span class="news-badge">${unread > 9 ? '9+' : unread}</span>`;
      }
      const b = el('button', 'tab' + (tab === id ? ' active' : ''), label);
      b.onclick = () => {
        tab = id; render();
        // bring the new tab's content into view (it may have rendered below the fold)
        if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);
      };
      host.appendChild(b);
    }
  }

  // ---------- body ----------
  function renderBody() {
    const host = $('#body');
    host.innerHTML = '';
    if (tab === 'activities') host.appendChild(renderActivities());
    else if (tab === 'galaxy') host.appendChild(renderGalaxy());
    else if (tab === 'system') host.appendChild(renderSystemMap());
    else if (tab === 'contracts') host.appendChild(renderContracts());
    else if (tab === 'refinery') host.appendChild(renderRefinery());
    else if (tab === 'ship') host.appendChild(renderShip());
    else if (tab === 'market') host.appendChild(renderMarket());
    else if (tab === 'operations') host.appendChild(renderOperations());
    else if (tab === 'skills') host.appendChild(renderSkills());
    else if (tab === 'codex') host.appendChild(renderCodex());
    else if (tab === 'news') host.appendChild(renderNews());
    else if (tab === 'station') host.appendChild(renderStation());
  }

  function notify(res) {
    if (res && res.ok === false) { Engine.logLine(g, res.msg, 'bad'); snd('error'); }
    refresh();
  }

  // onboarding objectives panel (hides once all are complete)
  function renderObjectives() {
    const done = g.questsDone || [];
    if (done.length >= OBJECTIVES.length) return null;
    const wrap = el('div', 'objectives');
    wrap.appendChild(el('div', 'slot-label', `🎯 OBJECTIVES — ${done.length}/${OBJECTIVES.length} · earn credits learning the ropes`));
    const incomplete = OBJECTIVES.filter(o => !done.includes(o.id)).slice(0, 3);
    for (const o of incomplete) {
      wrap.appendChild(el('div', 'objective-row', `<span>○ <b>${o.name}</b> <span class="muted">— ${o.desc}</span></span><span class="obj-reward">+${o.reward} cr</span>`));
    }
    return wrap;
  }

  // enemy ability badges shown on combat/wave cards
  const ABILITY_LABEL = { shielded: '🔵 shielded', regen: '♻️ self-repair', alpha: '💥 alpha strike', evasive: '💨 evasive', disabler: '🎯 disabler', enrage: '😡 enrage' };
  function abilityTags(enemy) {
    if (!enemy || !enemy.abilities || !enemy.abilities.length) return '';
    return enemy.abilities.map(a => `<span class="foe-ability">${ABILITY_LABEL[a] || a}</span>`).join(' ');
  }
  function enemyLine(enemy) {
    return `<div class="foe-line">⚔️ ${enemy.name} <span class="muted">(🛡️${enemy.hull}${enemy.shield ? ' 🔵' + enemy.shield : ''})</span> ${abilityTags(enemy)}</div>`;
  }

  // ---- Activities tab ----
  // a banner for the active cluster-wide galaxy event (shown on Activities/Market)
  function galaxyEventBanner() {
    const ge = Engine.activeGalaxyEvent && Engine.activeGalaxyEvent(g);
    if (!ge) return null;
    const left = timeLeft(ge.endsAt);
    const mins = Math.floor(left / 60), secs = left % 60;
    const card = el('div', 'galaxy-banner');
    card.innerHTML = `<span class="gx-icon">${ge.def.icon}</span><span><b>${ge.def.name}</b> — ${ge.def.desc} <span class="muted">· ${mins}m ${secs}s left</span></span>`;
    return card;
  }

  function renderActivities() {
    const wrap = el('div', 'panel');
    const sys = curSystem(g);
    const base = curBase(g);
    const bfac = FACTIONS[base.factionId];
    const obj = renderObjectives();
    if (obj) wrap.appendChild(obj);
    wrap.appendChild(el('div', 'sysline muted',
      `🛰️ <b>${base.name}</b> (${bfac.icon} ${bfac.name}) · ${sys.name} · Danger: ${sys.danger} — operations offered here. Dock elsewhere from the 🛰️ Starbase tab.`));
    const gx = galaxyEventBanner();
    if (gx) wrap.appendChild(gx);
    // run config row
    const cfg = el('div', 'config-row');
    cfg.appendChild(selector('Mode', MODES, g.mode, v => { g.mode = v; refresh(); }));
    cfg.appendChild(selector('Behavior', BEHAVIORS, g.behavior, v => { g.behavior = v; refresh(); }));
    // flee slider
    const flee = el('label', 'cfg-field');
    flee.innerHTML = `<span>Flee at hull <b>${g.fleeAt}%</b></span>`;
    const range = el('input'); range.type = 'range'; range.min = 0; range.max = 80; range.step = 5; range.value = g.fleeAt;
    range.oninput = () => { g.fleeAt = +range.value; flee.querySelector('b').textContent = g.fleeAt + '%'; };
    flee.appendChild(range);
    cfg.appendChild(flee);

    // automation: auto-repeat the launched route (on by default — the idle loop)
    const auto = el('label', 'cfg-field');
    auto.innerHTML = `<span>🔁 Auto-repeat (idle loop)</span>`;
    const cb = el('input'); cb.type = 'checkbox'; cb.checked = !!g.autoRepeat;
    cb.onchange = () => { g.autoRepeat = cb.checked; if (cb.checked) g.autoRepeatPaused = false; refresh(); };
    auto.appendChild(cb);
    const autoMsg = g.autoRepeat ? 'On — missions repeat automatically.'
      : (g.autoRepeatPaused ? 'Paused — repair to resume.' : 'Off — runs once, then stops.');
    auto.appendChild(el('small', 'muted', autoMsg));
    // pause auto-repeat once the ship is this damaged, so the idle loop doesn't
    // keep flying a battered hull back out.
    const rep = el('label', 'cfg-field');
    rep.innerHTML = `<span>Pause idle loop below <b>${g.repairAt}%</b> integrity</span>`;
    const rr = el('input'); rr.type = 'range'; rr.min = 0; rr.max = 90; rr.step = 5; rr.value = g.repairAt;
    rr.oninput = () => { g.repairAt = +rr.value; rep.querySelector('b').textContent = g.repairAt + '%'; };
    rep.appendChild(rr);
    auto.appendChild(rep);
    cfg.appendChild(auto);
    wrap.appendChild(cfg);

    const busy = busyNow();
    const grid = el('div', 'card-grid');
    for (const id of base.activities) {
      const act = ACTIVITIES[id];
      if (!act) continue;
      const lvl = skillLevel(g, act.skill);
      const locked = lvl < act.reqLevel;
      const card = el('div', 'card' + (locked ? ' locked' : ''));
      const dropStr = act.drops ? act.drops.map(d => RESOURCES[d[0]].icon).join(' ') : (act.type === 'combat' ? '⚔️' : '📡');
      // combat/wave intel: target + special abilities
      let foe = '';
      if (act.type === 'combat' && act.enemy) foe = enemyLine(act.enemy);
      else if (act.type === 'wave') foe = `<div class="foe-line">🌊 ${act.waveCount}+ waves → ${act.boss ? act.boss.name : 'boss'} ${abilityTags(act.boss)}</div>`;
      card.innerHTML = `
        <div class="card-head">
          <strong>${act.name}</strong>
          <span class="tag tag-${act.risk.toLowerCase()}">${act.risk}</span>
        </div>
        <p class="muted">${act.desc}</p>
        ${foe}
        <div class="card-meta">
          <span>⏱️ ${act.duration}s</span><span>⛽ ${act.fuel}</span>
          <span>📘 ${SKILLS[act.skill].name} ${act.reqLevel}</span><span>${dropStr}</span>
        </div>`;
      const b = el('button', 'btn full', locked ? `🔒 Needs ${SKILLS[act.skill].name} ${act.reqLevel}` : 'Launch');
      b.disabled = locked || busy;
      b.onclick = () => notify(Engine.startMission(g, id));
      card.appendChild(b);
      grid.appendChild(card);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  function selector(label, map, current, onChange) {
    const field = el('label', 'cfg-field');
    field.innerHTML = `<span>${label}</span>`;
    const sel = el('select');
    for (const [k, v] of Object.entries(map)) {
      const o = el('option', null, v.name); o.value = k; if (k === current) o.selected = true;
      o.title = v.desc || '';
      sel.appendChild(o);
    }
    sel.onchange = () => onChange(sel.value);
    field.appendChild(sel);
    const desc = el('small', 'muted', map[current].desc || '');
    field.appendChild(desc);
    return field;
  }

  // ---- Galaxy tab ----
  function renderGalaxy() {
    const wrap = el('div', 'panel');
    const here = curSystem(g);
    const busy = busyNow();

    wrap.appendChild(el('div', 'sysinfo',
      `<h3>🌌 Galaxy Map — docked at ${here.name}</h3>
       <p class="muted">${here.desc}</p>
       <p class="muted">Jumps cost fuel and time that scale with distance; Piloting trims the time. You cannot jump mid-mission or mid-refine.</p>`));

    const grid = el('div', 'card-grid');
    for (const [id, sys] of Object.entries(SYSTEMS)) {
      const isHere = id === g.currentSystem;
      const card = el('div', 'card' + (isHere ? ' active-system' : ''));
      const dangerCls = sys.danger.toLowerCase();
      let costLine;
      if (isHere) {
        costLine = '<span class="tag tag-low">You are here</span>';
      } else {
        const { fuel, time } = Engine.travelCost(g, g.currentSystem, id);
        const afford = g.fuel >= fuel;
        costLine = `<span>🚀 ${time}s</span><span class="${afford ? '' : 'warn-text'}">⛽ ${fuel}</span>`;
      }
      const cfac = FACTIONS[sys.factionId];
      // list the system's bases with their faction + your standing
      const baseList = sys.bases.map(bid => {
        const b = BASES[bid];
        const r = factionRep(g, b.factionId);
        const rc = r <= -6 ? 'warn-text' : r > 0 ? '' : 'muted';
        return `<div class="base-line"><span>${FACTIONS[b.factionId].icon} <b>${b.name}</b> <small class="muted">${b.type}</small></span><span class="${rc}">${standingName(r)}</span></div>`;
      }).join('');
      card.innerHTML = `
        <div class="card-head">
          <strong>${sys.name}</strong>
          <span class="tag tag-${dangerCls}">${sys.danger}</span>
        </div>
        <p class="muted">${sys.desc}</p>
        <div class="card-meta"><span>🏷️ ${sys.economy}</span><span>${cfac.icon} ${cfac.name} space</span></div>
        <div class="base-list">${baseList}</div>
        <div class="card-meta">${costLine}</div>`;
      if (!isHere) {
        const { fuel } = Engine.travelCost(g, g.currentSystem, id);
        const b = el('button', 'btn full', g.fuel >= fuel ? `Jump — ⛽ ${fuel}` : `Need ${fuel} fuel`);
        b.disabled = busy || g.fuel < fuel || !!g.refineJob;
        b.onclick = () => notify(Engine.startTravel(g, id));
        card.appendChild(b);
      }
      grid.appendChild(card);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  // ---- System Map tab (planets, moons, POIs, scanning) ----
  function busyNow() { return !!g.mission || !!g.pendingDistress || !!g.pendingEncounter; }

  function poiCard(poiId) {
    const p = POIS[poiId];
    const act = ACTIVITIES[p.activity];
    const lvl = act ? skillLevel(g, act.skill) : 99;
    const locked = act && lvl < act.reqLevel;
    const card = el('div', 'card poi-card');
    const drops = act && act.drops ? act.drops.map(d => RESOURCES[d[0]].icon).join(' ') : '✨';
    const tier = Engine.poiTier(poiId);
    card.innerHTML = `<div class="card-head"><strong>${p.icon} ${p.name}</strong><span class="tag ${tier.cls}">${tier.label}</span></div>
      <p class="muted">${p.desc}</p>
      <div class="card-meta"><span>⛏️ Yield ×${tier.mult}${tier.rare ? ' · exotic finds' : ''}</span></div>
      <div class="card-meta"><span>▶️ ${act ? act.name : p.activity}</span></div>
      <div class="card-meta"><span>⏱️ ${act ? act.duration : '?'}s</span><span>⛽ ${act ? act.fuel : '?'}</span><span>📘 ${act ? SKILLS[act.skill].name + ' ' + act.reqLevel : ''}</span><span>${drops}</span></div>`;
    const b = el('button', 'btn full', locked ? `🔒 Needs ${SKILLS[act.skill].name} ${act.reqLevel}` : 'Launch');
    b.disabled = busyNow() || locked;
    b.onclick = () => notify(Engine.startPoiMission(g, poiId));
    card.appendChild(b);

    // fleet deployment: station idle units here to harvest passively
    const here = (g.deployments || []).filter(d => d.poi === poiId);
    if (here.length) {
      const icons = here.map(d => FLEET_UNITS[d.unit].icon).join(' ');
      card.appendChild(el('div', 'poi-harvest', `🛰️ ${here.length} harvesting here ${icons}`));
    }
    const idle = Object.keys(FLEET_UNITS).filter(u => Engine.idleCount(g, u) > 0);
    const deployRow = el('div', 'deploy-row');
    if (!idle.length) {
      deployRow.appendChild(el('small', 'muted', 'No idle fleet units to deploy.'));
    } else {
      const sel = el('select', 'deploy-sel');
      for (const u of idle) { const o = el('option', null, `${FLEET_UNITS[u].icon} ${FLEET_UNITS[u].name} (${Engine.idleCount(g, u)} idle)`); o.value = u; sel.appendChild(o); }
      const db = el('button', 'btn tiny', 'Deploy');
      db.onclick = () => notify(Engine.deployFleet(g, sel.value, poiId));
      deployRow.appendChild(sel); deployRow.appendChild(db);
    }
    card.appendChild(deployRow);
    return card;
  }

  function scanButton(target, hiddenCount) {
    if (hiddenCount > 0) {
      const b = el('button', 'btn small', `📡 Survey (${hiddenCount} unknown)`);
      b.disabled = busyNow();
      b.onclick = () => notify(Engine.startScan(g, target));
      return b;
    }
    return el('span', 'muted scan-done', '✓ surveyed');
  }

  function renderSystemMap() {
    const wrap = el('div', 'panel');
    const sys = curSystem(g);

    wrap.appendChild(el('div', 'sysinfo', `<h3>🪐 ${sys.name}</h3>
      <p class="muted">${sys.desc}</p>
      <p class="muted">☀️ ${sys.star || 'Unknown star'} · ${sys.economy} · Danger: ${sys.danger}</p>
      <p class="muted">Scan planets, moons and deep space to reveal hidden sites, then launch idle operations on location. Surface ops aren't tied to any starbase.</p>`));

    // ----- deep space -----
    const spaceIds = (sys.spacePois || []);
    const spaceHidden = spaceIds.filter(id => POIS[id].hidden && !(g.discovered || []).includes(id));
    const spaceHead = el('div', 'body-head');
    spaceHead.innerHTML = `<h3>🌌 Deep Space</h3>`;
    spaceHead.appendChild(scanButton('system', spaceHidden.length));
    wrap.appendChild(spaceHead);
    const spaceGrid = el('div', 'card-grid');
    const spaceVisible = spaceIds.filter(id => poiRevealed(g, id));
    if (!spaceVisible.length) spaceGrid.appendChild(el('p', 'muted', 'No charted sites out here yet — run a survey.'));
    for (const id of spaceVisible) spaceGrid.appendChild(poiCard(id));
    wrap.appendChild(spaceGrid);

    // ----- bodies (planets & moons) -----
    for (const bid of (sys.bodies || [])) {
      const body = BODIES[bid];
      if (!body) continue;
      const bicon = { planet: '🪐', moon: '🌙', gas_giant: '🪐', star: '☀️' }[body.type] || '🪐';
      const pois = (body.pois || []);
      const hidden = pois.filter(id => POIS[id].hidden && !(g.discovered || []).includes(id));
      const head = el('div', 'body-head');
      const parent = body.parent ? ` <small class="muted">(moon of ${BODIES[body.parent] ? BODIES[body.parent].name : '—'})</small>` : '';
      head.innerHTML = `<h3>${bicon} ${body.name} <small class="muted">· ${body.type.replace('_', ' ')}</small>${parent}</h3>`;
      head.appendChild(scanButton(bid, hidden.length));
      wrap.appendChild(head);
      wrap.appendChild(el('p', 'muted body-desc', body.desc));
      const grid = el('div', 'card-grid');
      const visible = pois.filter(id => poiRevealed(g, id));
      if (!visible.length) grid.appendChild(el('p', 'muted', 'Surface uncharted — scan to reveal sites.'));
      for (const id of visible) grid.appendChild(poiCard(id));
      wrap.appendChild(grid);
    }
    return wrap;
  }

  // ---- Contracts tab ----
  function objectiveLabel(o) {
    switch (o.type) {
      case 'rep': return `Reach ${standingName(o.n)} standing (${o.n}+)`;
      case 'deliver': return `Deliver ${o.n}× ${RESOURCES[o.res].icon} ${RESOURCES[o.res].name}`;
      case 'kills': return `Defeat ${o.n} hostiles`;
      case 'produce': return `Produce ${fmt(o.n)} ${o.res ? RESOURCES[o.res].name : o.kind}`;
      case 'visit': return `Visit ${SYSTEMS[o.sys] ? SYSTEMS[o.sys].name : o.sys}`;
      case 'credEarned': return `Earn ${fmt(o.n)} lifetime credits`;
      default: return '';
    }
  }
  function choiceEffectLabel(e) {
    if (!e) return '';
    const p = [];
    if (e.credits) p.push(`${e.credits > 0 ? '+' : ''}${fmt(e.credits)} cr`);
    if (e.rep) for (const [f, amt] of Object.entries(e.rep)) p.push(`${FACTIONS[f].icon}${amt > 0 ? '+' : ''}${amt}`);
    if (e.item) p.push(`🎁 ${MODULES[e.item].name}`);
    if (e.fleet) p.push(`🎁 ${FLEET_UNITS[e.fleet].name}`);
    return p.length ? `→ ${p.join(', ')}` : '';
  }
  function rewardLabel(r) {
    const p = [];
    if (r.credits) p.push(`${fmt(r.credits)} cr`);
    if (r.rep) p.push(`+${r.rep} standing`);
    if (r.xp) p.push(`+${r.xp} ${SKILLS[r.xpSkill || 'piloting'].name} XP`);
    if (r.item) p.push(`🎁 ${MODULES[r.item].name}`);
    if (r.fleet) p.push(`🎁 ${FLEET_UNITS[r.fleet].name}`);
    return p.join(', ');
  }
  function renderStoryline(fid) {
    const fac = FACTIONS[fid];
    const st = Engine.questStatus(g, fid);
    const wrap = el('div', 'storyline');
    if (!st) return wrap;
    if (st.complete) {
      wrap.innerHTML = `<div class="story-head">📖 ${fac.icon} ${fac.name} — ${st.ql.title}</div>
        <p class="muted">✓ Storyline complete. ${fac.name} won't forget what you did out here.</p>`;
      return wrap;
    }
    const q = st.quest;
    const hostile = hostileHereUI(g);

    // ---- branching decision chapter ----
    if (st.isChoice) {
      wrap.innerHTML = `<div class="story-head">📖 ${fac.icon} ${fac.name} — ${st.ql.title} <span class="muted">· Chapter ${st.step + 1}/${st.total}</span></div>
        <div class="story-title">⚖️ ${q.title}</div>
        <p class="story-text muted">${q.text}</p>`;
      if (hostile) wrap.appendChild(el('p', 'warn', `${fac.name} is hostile — rebuild your standing to continue.`));
      const choices = el('div', 'distress-choices');
      st.choices.forEach((ch, i) => {
        const b = el('button', 'btn story-choice');
        b.innerHTML = `${ch.label}<small class="muted">${ch.text || ''} ${choiceEffectLabel(ch.effect)}</small>`;
        b.disabled = hostile;
        b.onclick = () => notify(Engine.chooseQuest(g, fid, i));
        choices.appendChild(b);
      });
      wrap.appendChild(choices);
      return wrap;
    }

    // ---- objective chapter ----
    const pct = Math.min(100, Math.round(st.value / st.target * 100));
    wrap.innerHTML = `<div class="story-head">📖 ${fac.icon} ${fac.name} — ${st.ql.title} <span class="muted">· Chapter ${st.step + 1}/${st.total}</span></div>
      <div class="story-title">${q.title}</div>
      <p class="story-text muted">${q.text}</p>
      <p class="muted">Objective: <b>${objectiveLabel(q.objective)}</b></p>
      <div class="progress small"><div class="progress-fill ${st.met ? 'ok' : ''}" style="width:${pct}%"></div></div>
      <small class="muted">${fmt(Math.min(st.value, st.target))} / ${fmt(st.target)} &nbsp;·&nbsp; Reward: ${rewardLabel(q.reward)}</small>`;
    if (hostile) {
      wrap.appendChild(el('p', 'warn', `${fac.name} is hostile — rebuild your standing to continue the storyline.`));
    }
    const btn = el('button', 'btn', st.met ? '📖 Report Chapter' : 'Objective in progress…');
    btn.disabled = !st.met || hostile;
    btn.onclick = () => notify(Engine.reportQuest(g, fid));
    wrap.appendChild(btn);
    return wrap;
  }

  function renderContracts() {
    const wrap = el('div', 'panel');
    const base = curBase(g);
    const fid = base.factionId;
    const fac = FACTIONS[fid];

    // faction standings overview
    const standWrap = el('div', 'faction-standings');
    standWrap.appendChild(el('div', 'slot-label', 'FACTION STANDING'));
    for (const [id, f] of Object.entries(FACTIONS)) {
      const r = factionRep(g, id);
      const cls = r <= -6 ? 'bad' : r > 0 ? 'good' : '';
      const row = el('div', 'standing-row');
      row.innerHTML = `<span>${f.icon} ${f.name}</span><span class="muted">${f.lawful ? 'Lawful' : 'Lawless'}</span><span class="standing-val ${cls}">${standingName(r)} (${r})</span>`;
      standWrap.appendChild(row);
    }
    wrap.appendChild(standWrap);

    // ---- faction storyline (current base's faction) ----
    wrap.appendChild(renderStoryline(fid));

    wrap.appendChild(el('div', 'sysline muted',
      `📋 Contracts posted by <b>${fac.icon} ${fac.name}</b> at ${base.name}. Complete them at any ${fac.name} starbase.`));

    // active contract
    if (g.activeContract) {
      const c = g.activeContract;
      const p = Engine.contractProgress(g);
      const here = base.factionId === c.faction;
      const done = p && p.have >= p.need;
      const card = el('div', 'banner-card');
      card.innerHTML = `<div class="banner-head"><strong>📋 ${c.title}</strong><span>${FACTIONS[c.faction].icon} ${FACTIONS[c.faction].name}</span></div>
        <p class="muted">${c.desc}</p>
        <p>Progress: <b>${p ? p.have : 0}/${p ? p.need : '?'}</b> · Reward: <b>${fmt(c.reward.credits)} cr</b>, +${c.reward.rep} standing</p>`;
      const actions = el('div', 'distress-choices');
      const comp = el('button', 'btn', done && here ? 'Turn In ✓' : here ? 'Not ready' : `Turn in at ${FACTIONS[c.faction].name}`);
      comp.disabled = !(done && here);
      comp.onclick = () => notify(Engine.completeContract(g));
      const ab = el('button', 'btn tiny', 'Abandon');
      ab.onclick = () => { Engine.abandonContract(g); refresh(); };
      actions.appendChild(comp); actions.appendChild(ab);
      card.appendChild(actions);
      wrap.appendChild(card);
    }

    // available offers
    wrap.appendChild(el('h3', null, '🗂️ Available Contracts'));
    if (hostileHereUI(g)) {
      wrap.appendChild(el('p', 'muted', `${fac.name} is hostile toward you and won't offer work here. Rebuild your standing or try elsewhere.`));
      return wrap;
    }
    const offers = g.contractOffers || [];
    if (!offers.length) { wrap.appendChild(el('p', 'muted', 'No contracts posted right now. Check back shortly.')); return wrap; }
    const grid = el('div', 'card-grid');
    for (const o of offers) {
      const card = el('div', 'card');
      const typeTag = o.type === 'bounty' ? '<span class="tag tag-high">Bounty</span>'
        : o.type === 'produce' ? '<span class="tag tag-medium">Quota</span>'
        : '<span class="tag tag-low">Delivery</span>';
      card.innerHTML = `<div class="card-head"><strong>${o.title}</strong>${typeTag}</div>
        <p class="muted">${o.desc}</p>
        <div class="card-meta"><span>💰 ${fmt(o.reward.credits)} cr</span><span>🤝 +${o.reward.rep}</span><span>📘 +${o.reward.xp} XP</span></div>`;
      const b = el('button', 'btn full', g.activeContract ? 'One contract at a time' : 'Accept');
      b.disabled = !!g.activeContract;
      b.onclick = () => notify(Engine.acceptContract(g, o.id));
      card.appendChild(b);
      grid.appendChild(card);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  // mirror of engine's hostileHere for UI gating
  function hostileHereUI(g) {
    const base = curBase(g);
    const fac = FACTIONS[base.factionId];
    return fac && fac.lawful && factionRep(g, base.factionId) <= -6;
  }

  // ---- Refinery tab ----
  function renderRefinery() {
    const wrap = el('div', 'panel');
    if (g.refineJob) {
      const r = RECIPES[g.refineJob.recipe];
      const left = timeLeft(g.refineJob.endsAt);
      const pct = Math.round((1 - left / r.time) * 100);
      const card = el('div', 'banner-card');
      card.innerHTML = `<div class="banner-head"><strong>⚗️ Refining ${r.name}</strong><span>${g.refineJob.batchesLeft} batches left · ${left}s</span></div>
        <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>`;
      wrap.appendChild(card);
    }
    const grid = el('div', 'card-grid');
    for (const [id, r] of Object.entries(RECIPES)) {
      const lvl = skillLevel(g, 'refining');
      const locked = lvl < r.reqLevel;
      const inStr = Object.entries(r.in).map(([i, q]) => `${q}× ${RESOURCES[i].icon}${RESOURCES[i].name}`).join(' + ');
      const outStr = Object.entries(r.out).map(([i, q]) => `${q}× ${RESOURCES[i].icon}${RESOURCES[i].name}`).join(', ');
      const canMake = Object.entries(r.in).every(([i, q]) => (g.cargo[i] || 0) >= q);
      const card = el('div', 'card' + (locked ? ' locked' : ''));
      card.innerHTML = `<div class="card-head"><strong>${r.name}</strong><span class="muted">Lvl ${r.reqLevel}</span></div>
        <p class="muted">${inStr} → ${outStr}</p>
        <div class="card-meta"><span>⏱️ ${r.time}s</span><span>📘 +${r.xp} XP</span></div>`;
      const b = el('button', 'btn full', locked ? `🔒 Refining ${r.reqLevel}` : (canMake ? 'Refine All' : 'No materials'));
      b.disabled = locked || !!g.refineJob || !canMake;
      b.onclick = () => notify(Engine.startRefine(g, id, 999));
      card.appendChild(b);
      grid.appendChild(card);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  // ---- Ship tab ----
  // which compartment (subsystem) each crew role works in
  const CREW_STATION = { navigator: 'sensors', engineer: 'reactor', gunner: 'weapons', foreman: 'cargobay', quarter: 'cargobay', logistics: 'cargobay' };
  const COMPARTMENT = {
    sensors:     { icon: '📡', name: 'Bridge' },
    reactor:     { icon: '⚛️', name: 'Reactor' },
    engines:     { icon: '🚀', name: 'Engine Room' },
    weapons:     { icon: '🔫', name: 'Weapons Bay' },
    shields:     { icon: '🔵', name: 'Shield Generator' },
    cargobay:    { icon: '📦', name: 'Cargo Hold' },
    lifesupport: { icon: '💨', name: 'Life Support' },
    hull:        { icon: '🛡️', name: 'Hull / Structure' },
  };
  // deck order roughly bow → stern
  const DECK_ORDER = ['sensors', 'lifesupport', 'shields', 'weapons', 'cargobay', 'reactor', 'engines', 'hull'];

  function renderDeckMap(g) {
    const aboardIds = (g.crew || []).slice(0, crewSlots(g)); // crew ids stationed aboard
    const wrap = el('div', 'deck-map');
    for (const sys of DECK_ORDER) {
      const info = COMPARTMENT[sys] || { icon: '▫️', name: sys };
      const v = g.systems[sys];
      const c = v > 66 ? 'ok' : v > 33 ? 'mid' : 'bad';
      const chips = aboardIds
        .filter(id => CREW_STATION[id] === sys && CREW[id])
        .map(id => `<span class="crew-chip" title="${CREW[id].name}">${CREW[id].icon}</span>`).join('');
      const cell = el('div', 'compartment');
      cell.innerHTML = `<div class="comp-head"><span>${info.icon} ${info.name}</span><span class="muted">${Math.round(v)}%</span></div>
        <div class="progress small"><div class="progress-fill ${c}" style="width:${v}%"></div></div>
        <div class="comp-crew">${chips || '<span class="muted comp-empty">—</span>'}</div>`;
      wrap.appendChild(cell);
    }
    return wrap;
  }

  function renderShip() {
    const wrap = el('div', 'panel');
    const stats = shipStats(g);
    const ship = SHIPS[g.activeShip] || SHIPS.shuttle;

    // ship interior deck map (compartments + stationed crew)
    wrap.appendChild(el('h3', null, `🛸 ${ship.name} — Deck Plan`));
    wrap.appendChild(el('p', 'muted', 'Each compartment maps to a subsystem; aboard crew are shown at their stations.'));
    wrap.appendChild(renderDeckMap(g));

    const grid2 = el('div', 'ship-panel');
    // systems health
    const left = el('div', 'ship-col');
    left.appendChild(el('h3', null, `${ship.name} — ${ship.class}`));
    const power = el('div', 'powerbar');
    const powColor = stats.powerOk ? 'ok' : 'bad';
    power.innerHTML = `<span>Reactor Power</span><div class="progress"><div class="progress-fill ${powColor}" style="width:${Math.min(100, stats.power ? stats.draw / stats.power * 100 : 0)}%"></div></div><span>${stats.draw}/${stats.power}</span>`;
    left.appendChild(power);
    if (!stats.powerOk) left.appendChild(el('div', 'warn', '⚠️ Power deficit — systems underperforming!'));

    const sysWrap = el('div', 'systems');
    for (const sys of SHIP_SYSTEMS) {
      const v = g.systems[sys];
      const c = v > 66 ? 'ok' : v > 33 ? 'mid' : 'bad';
      const row = el('div', 'sysrow');
      row.innerHTML = `<span>${sysLabel(sys)}</span><div class="progress small"><div class="progress-fill ${c}" style="width:${v}%"></div></div><span class="muted">${Math.round(v)}%</span>`;
      sysWrap.appendChild(row);
    }
    left.appendChild(sysWrap);

    // stat summary
    const sm = el('div', 'statgrid');
    const pairs = [['🛡️ Hull', stats.hull], ['🪨 Armor', stats.armor], ['🔵 Shield', stats.shield], ['🔫 Weapon', stats.weapon],
      ['⛏️ Mining', stats.mining], ['🧲 Salvage', stats.salvage], ['💨 Evasion', stats.evasion], ['📡 Sensors', stats.sensors]];
    for (const [k, v] of pairs) sm.appendChild(el('div', 'statcell', `<span class="muted">${k}</span><b>${v}</b>`));
    left.appendChild(sm);
    grid2.appendChild(left);

    // fittings
    const right = el('div', 'ship-col');
    right.appendChild(el('h3', null, 'Fittings'));
    const fit = g.fittings[g.activeShip];
    for (const slot of Object.keys(ship.slots)) {
      const cap = ship.slots[slot];
      if (cap === 0) continue;
      const fitted = fit[slot] || [];
      const block = el('div', 'slot-block');
      block.appendChild(el('div', 'slot-label', `${slotIcon(slot)} ${slot.toUpperCase()} (${fitted.length}/${cap})`));
      fitted.forEach((modId, idx) => {
        const m = MODULES[modId];
        if (!m) return; // tolerate a stale/unknown module id in a save
        const row = el('div', 'fit-row');
        row.innerHTML = `<span>${m.name}</span><span class="muted">${m.power ? '+' + m.power + 'pw' : (m.draw ? m.draw + 'pw' : '')} ${m.heat ? (m.heat > 0 ? '+' : '') + m.heat + '🔥' : ''}</span>`;
        const x = el('button', 'btn tiny', '✕');
        x.onclick = () => notify(Engine.unfitModule(g, slot, idx));
        if (g.mission) x.disabled = true;
        row.appendChild(x);
        block.appendChild(row);
      });
      right.appendChild(block);
    }

    // storage (loose modules)
    const store = Object.entries(g.storage).filter(([, c]) => c > 0);
    right.appendChild(el('h3', null, 'Module Storage'));
    if (!store.length) right.appendChild(el('p', 'muted', 'No spare modules. Buy some at the Station tab.'));
    for (const [modId, count] of store) {
      const m = MODULES[modId];
      if (!m) continue; // tolerate a stale/unknown module id in a save
      const row = el('div', 'fit-row');
      row.innerHTML = `<span>${m.name} ×${count}</span><span class="muted">${m.slot}</span>`;
      const b = el('button', 'btn tiny', 'Fit');
      b.disabled = !!g.mission;
      b.onclick = () => notify(Engine.fitModule(g, modId));
      row.appendChild(b);
      right.appendChild(row);
    }
    grid2.appendChild(right);
    wrap.appendChild(grid2);
    return wrap;
  }

  function sysLabel(s) { return ({ hull: 'Hull', reactor: 'Reactor', engines: 'Engines', sensors: 'Sensors', cargobay: 'Cargo Bay', weapons: 'Weapons', shields: 'Shields', lifesupport: 'Life Support' })[s] || s; }
  function slotIcon(s) { return ({ reactor: '⚛️', engine: '🚀', shield: '🔵', weapon: '🔫', mining: '⛏️', utility: '🔧', cargo: '📦' })[s] || '▫️'; }

  // ---- Market tab ----
  function renderMarket() {
    const wrap = el('div', 'panel');
    const sys = curSystem(g);
    const base = curBase(g);
    const bfac = FACTIONS[base.factionId];
    wrap.appendChild(el('div', 'sysline muted',
      `💱 <b>${base.name}</b> (${bfac.icon} ${bfac.name}) — prices vary by starbase and your standing; haul to the right buyer.`));
    const gxm = galaxyEventBanner();
    if (gxm) wrap.appendChild(gxm);

    // active market events
    if (g.marketEvents && g.marketEvents.length) {
      const evWrap = el('div', 'market-events');
      const left = Math.max(0, Math.ceil((g.marketEventsEndsAt - Date.now()) / 1000));
      for (const ev of g.marketEvents) {
        const pct = Math.round((ev.mult - 1) * 100);
        const cls = ev.up ? 'ev-up' : 'ev-down';
        evWrap.appendChild(el('div', 'market-event ' + cls,
          `${ev.up ? '📈' : '📉'} ${ev.label} <b>(${pct > 0 ? '+' : ''}${pct}%)</b> <span class="muted">· ${left}s</span>`));
      }
      wrap.appendChild(evWrap);
    }

    const lawful = bfac && bfac.lawful;
    const hasIllegal = Object.keys(g.cargo).some(id => RESOURCES[id].illegal && g.cargo[id] > 0);
    if (lawful && hasIllegal) {
      wrap.appendChild(el('div', 'market-event ev-down',
        `🚫 You are carrying illegal cargo at a lawful ${bfac.name} starbase — no buyer here, and customs scanned you on arrival. Fence it at a lawless port.`));
    }

    // ---- BEST TRADE ROUTES (arbitrage scanner) ----
    const routes = Engine.bestRoutes(g, 8);
    if (routes.length) {
      wrap.appendChild(el('h3', null, '📈 Best Trade Routes'));
      wrap.appendChild(el('p', 'muted', 'Most profitable buy→sell lanes across the bases you\'ve charted (per cargo unit). Remote live market events aren\'t included.'));
      const rt = el('div', 'market-table route-table');
      rt.appendChild(el('div', 'rt-head', '<span>Commodity</span><span>Buy at</span><span>Sell at</span><span>Profit/unit</span>'));
      for (const r of routes) {
        const res = RESOURCES[r.id];
        const here = r.from === g.currentBase;
        const sellHere = r.to === g.currentBase;
        const sameSys = r.fromSys === r.toSys;
        const row = el('div', 'rt-row');
        const fromTag = here ? ' <small class="rt-here">buy now</small>' : '';
        const toTag = sellHere ? ' <small class="rt-here">sell now</small>' : '';
        row.innerHTML = `<span>${res.icon} ${res.name}</span>
          <span class="muted">${BASES[r.from].name} <small>· ${SYSTEMS[r.fromSys].name}</small> ${r.buy}cr${fromTag}</span>
          <span class="muted">${BASES[r.to].name} <small>· ${SYSTEMS[r.toSys].name}</small> ${r.sell}cr${toTag}</span>
          <span class="rt-profit">+${r.profit} <small class="muted">(${Math.round(r.margin * 100)}%${sameSys ? '' : ' · jump'})</small></span>`;
        rt.appendChild(row);
      }
      wrap.appendChild(rt);
    }

    // ---- SELL: your cargo ----
    wrap.appendChild(el('h3', null, '📤 Sell Cargo'));
    const ctrls = el('div', 'config-row');
    const sellRaw = el('button', 'btn', 'Sell all ore & salvage');
    sellRaw.onclick = () => { Engine.sellAllRaw(g); refresh(); };
    ctrls.appendChild(sellRaw);
    wrap.appendChild(ctrls);

    const items = Object.entries(g.cargo).filter(([, q]) => q > 0);
    if (!items.length) {
      wrap.appendChild(el('p', 'muted', 'Cargo hold is empty — buy commodities below to trade, or go earn something.'));
    } else {
      const table = el('div', 'market-table');
      table.appendChild(el('div', 'mt-head', '<span>Item</span><span>Qty</span><span>Unit</span><span>Actions</span>'));
      for (const [id, qty] of items) {
        const res = RESOURCES[id];
        const blocked = res.illegal && lawful;
        const price = Engine.sellPrice(g, id);
        const row = el('div', 'mt-row');
        const tag = res.illegal ? ' <small class="warn-text">⚠ illegal</small>' : '';
        row.innerHTML = `<span>${res.icon} ${res.name} <small class="muted">(${res.kind})</small>${tag}</span><span>${qty}</span><span>${blocked ? '—' : price + ' cr'}</span>`;
        const actions = el('span', 'mt-actions');
        for (const [lbl, n] of [['+1', 1], ['+10', 10], ['All', qty]]) {
          const b = el('button', 'btn tiny', lbl);
          b.disabled = blocked;
          b.onclick = () => notify(Engine.sellResource(g, id, n));
          actions.appendChild(b);
        }
        row.appendChild(actions);
        table.appendChild(row);
      }
      wrap.appendChild(table);
    }

    // ---- BUY: the commodity exchange (enables arbitrage) ----
    wrap.appendChild(el('h3', null, '🛒 Buy Commodities'));
    wrap.appendChild(el('p', 'muted', 'Buy low here, sell high elsewhere. Buy prices include a spread, so profit comes from hauling between starbases and riding market events.'));
    const room = Math.max(0, shipStats(g).cargo - cargoUsed(g));
    const btable = el('div', 'market-table buy-table');
    btable.appendChild(el('div', 'mt-head', '<span>Commodity</span><span>Buy</span><span>Sell here</span><span>Actions</span>'));
    const buyable = Object.keys(RESOURCES).filter(id => Engine.isBuyable(id));
    // group by kind for readability
    const KIND_ORDER = ['ore', 'refined', 'part', 'fuel'];
    buyable.sort((a, b) => {
      const ka = KIND_ORDER.indexOf(RESOURCES[a].kind), kb = KIND_ORDER.indexOf(RESOURCES[b].kind);
      return ka !== kb ? ka - kb : RESOURCES[a].value - RESOURCES[b].value;
    });
    for (const id of buyable) {
      const res = RESOURCES[id];
      const bp = Engine.buyPrice(g, id), sp = Engine.sellPrice(g, id);
      const row = el('div', 'mt-row');
      row.innerHTML = `<span>${res.icon} ${res.name} <small class="muted">(${res.kind})</small></span><span class="buy-price">${bp} cr</span><span class="muted">${sp} cr</span>`;
      const actions = el('span', 'mt-actions');
      const canAfford1 = g.credits >= bp && room > 0;
      for (const [lbl, n] of [['+1', 1], ['+10', 10], ['Max', Math.max(1, Math.min(room, Math.floor(g.credits / bp)))]]) {
        const b = el('button', 'btn tiny', lbl);
        b.disabled = !canAfford1;
        b.onclick = () => notify(Engine.buyResource(g, id, n));
        actions.appendChild(b);
      }
      row.appendChild(actions);
      btable.appendChild(row);
    }
    wrap.appendChild(btable);

    // ---- BLACK MARKET (reputation-gated illegal goods to smuggle) ----
    if (Engine.blackMarketOpen && Engine.blackMarketOpen(g)) {
      const goods = Engine.blackMarketGoods(g);
      if (goods.length) {
        wrap.appendChild(el('h3', null, '🕳️ Black Market'));
        wrap.appendChild(el('p', 'muted', 'A fence deals here — illegal and stolen goods the open exchange won\'t touch. Buy low, smuggle to a lawless port, sell high. Lawful customs will seize this cargo if they catch you. Prices improve with your Red Maw standing.'));
        const room = Math.max(0, shipStats(g).cargo - cargoUsed(g));
        const bm = el('div', 'market-table buy-table');
        bm.appendChild(el('div', 'mt-head', '<span>Goods</span><span>Buy</span><span>Sells for</span><span>Actions</span>'));
        for (const goodItem of goods) {
          const res = RESOURCES[goodItem.id];
          const sp = Engine.sellPrice(g, goodItem.id);
          const row = el('div', 'mt-row');
          row.innerHTML = `<span>${res.icon} ${res.name} <small class="warn-text">⚠ illegal</small></span><span class="buy-price">${goodItem.price} cr</span><span class="muted">${sp} cr (lawless)</span>`;
          const actions = el('span', 'mt-actions');
          const can = g.credits >= goodItem.price && room > 0;
          for (const [lbl, qn] of [['+1', 1], ['+10', 10], ['Max', Math.max(1, Math.min(room, Math.floor(g.credits / goodItem.price)))]]) {
            const b = el('button', 'btn tiny', lbl);
            b.disabled = !can;
            b.onclick = () => notify(Engine.buyBlackMarket(g, goodItem.id, qn));
            actions.appendChild(b);
          }
          row.appendChild(actions);
          bm.appendChild(row);
        }
        wrap.appendChild(bm);
      }
    }
    return wrap;
  }

  // ---- Operations tab (crew, fleet, automation) ----
  function renderOperations() {
    const wrap = el('div', 'panel');
    const slots = crewSlots(g);

    // automation (now standard — the idle loop runs by default)
    wrap.appendChild(el('h3', null, '🔁 Automation'));
    wrap.appendChild(el('p', 'muted', '✅ Idle auto-repeat is built in. Toggle "🔁 Auto-repeat (idle loop)" in the Activities tab — it relaunches your route the moment the ship returns, and pauses itself if the hull drops below your set integrity threshold.'));

    // crew
    wrap.appendChild(el('h3', null, `🧑‍🚀 Crew — ${crewAboard(g).length}/${slots} berths aboard the ${(SHIPS[g.activeShip] || SHIPS.shuttle).name}`));
    wrap.appendChild(el('p', 'muted', `Wages per mission: ${fmt(crewWage(g))} cr. Only the first ${slots} crew fit this ship's berths and apply their bonuses; the rest stay benched.`));
    if (!g.crew.length) {
      wrap.appendChild(el('p', 'muted', 'No crew signed on yet. Hire specialists below.'));
    } else {
      wrap.appendChild(el('p', 'muted', 'Send crew off-ship on timed assignments for credits, goods or intel — they vacate their berth while away, and a benched crewmate slides in. Each task has good and bad outcomes.'));
      const busyIdx = new Set((g.crewAssignments || []).map(a => a.idx));
      const availIdx = g.crew.map((_, i) => i).filter(i => !busyIdx.has(i));
      const aboardIdx = new Set(availIdx.slice(0, slots));
      const tasks = (typeof CREW_TASKS !== 'undefined') ? Object.values(CREW_TASKS) : [];
      const roster = el('div', 'crew-roster');
      g.crew.forEach((id, idx) => {
        const c = CREW[id];
        const asn = (g.crewAssignments || []).find(a => a.idx === idx);
        const aboard = aboardIdx.has(idx);
        const status = asn ? 'on assignment' : (aboard ? 'aboard' : 'benched');
        const midCol = asn ? `🛰️ ${(CREW_TASKS[asn.taskId] || {}).name || 'away'}` : c.desc;
        const rightCol = asn ? `${timeLeft(asn.endsAt)}s left` : `${c.wage} cr/run`;
        const row = el('div', 'crew-row' + (aboard ? ' aboard' : '') + (asn ? ' assigned' : ''));
        row.innerHTML = `<span>${c.icon} <b>${c.name}</b> <small class="muted">${status}</small></span>
          <span class="muted">${midCol}</span><span class="muted">${rightCol}</span>`;
        const actions = el('span', 'crew-actions');
        if (asn) {
          const rc = el('button', 'btn tiny', 'Recall');
          rc.onclick = () => { Engine.recallCrewAssignment(g, idx); refresh(); };
          actions.appendChild(rc);
        } else {
          for (const t of tasks) {
            const b = el('button', 'btn tiny', t.icon);
            b.title = `${t.name} — ${t.desc} (${t.dur}s)`;
            b.disabled = !!g.mission;
            b.onclick = () => notify(Engine.assignCrew(g, idx, t.id));
            actions.appendChild(b);
          }
          const x = el('button', 'btn tiny', '✕');
          x.title = 'Dismiss crew';
          x.onclick = () => { Engine.dismissCrew(g, idx); refresh(); };
          actions.appendChild(x);
        }
        row.appendChild(actions);
        roster.appendChild(row);
      });
      wrap.appendChild(roster);
    }

    // crew hiring hall — only specialists looking for work at this base's cantina
    const base = curBase(g);
    // cantina rumours — overheard gossip at the bar (flavour)
    if (base.facilities.includes('cantina') && (g.rumors || []).length) {
      wrap.appendChild(el('h3', null, '🍺 Cantina Talk'));
      const rl = el('div', 'rumor-list');
      for (const r of g.rumors) rl.appendChild(el('div', 'rumor', `“${r}”`));
      wrap.appendChild(rl);
    }
    const hirePool = (base.facilities.includes('cantina') ? (base.crew || []) : []);
    wrap.appendChild(el('h3', null, `🧾 Cantina — hiring at ${base.name}`));
    if (!hirePool.length) {
      wrap.appendChild(el('p', 'muted', 'No one is looking for a berth here. Different starbases attract different specialists — try docking elsewhere.'));
    } else {
      wrap.appendChild(el('p', 'muted', 'Each starbase draws its own crowd. Dock around the galaxy to recruit every specialty.'));
      const crewGrid = el('div', 'card-grid');
      for (const id of hirePool) {
        const c = CREW[id];
        if (!c) continue;
        const owned = g.crew.filter(x => x === id).length;
        const card = el('div', 'card');
        card.innerHTML = `<div class="card-head"><strong>${c.icon} ${c.name}</strong>${owned ? `<span class="muted">×${owned}</span>` : ''}</div>
          <p class="muted">${c.desc}</p>
          <div class="card-meta"><span>💰 ${fmt(c.cost)} cr</span><span>👛 ${c.wage} cr/run</span></div>`;
        const b = el('button', 'btn full', `Hire — ${fmt(c.cost)} cr`);
        b.onclick = () => notify(Engine.hireCrew(g, id));
        card.appendChild(b);
        crewGrid.appendChild(card);
      }
      wrap.appendChild(crewGrid);
    }

    // fleet & passive income
    const rate = Engine.fleetRate(g);
    const pending = Math.floor(g.fleetPendingCr || 0);
    wrap.appendChild(el('h3', null, '🛰️ Fleet & Passive Income'));
    const incomeCard = el('div', 'sysinfo');
    incomeCard.innerHTML = `<p>Idle income rate: <b>${fmt(rate)} cr/hr</b> · Uncollected: <b>${fmt(pending)} cr</b>
      <br><small class="muted">Idle units docked at a base earn credits; units <b>deployed to a POI</b> harvest its resources instead. <b>Refinery Barges</b> also refine ore and assemble multi-part goods from the shared stockpile. All accrue for up to ${FLEET_OFFLINE_CAP_HOURS}h offline; a Logistics Officer boosts everything.</small></p>`;
    const claim = el('button', 'btn', `Collect ${fmt(pending)} cr`);
    claim.disabled = pending <= 0;
    claim.onclick = () => notify(Engine.claimFleet(g));
    incomeCard.appendChild(claim);
    wrap.appendChild(incomeCard);

    // active deployments (harvesting POIs)
    const deps = g.deployments || [];
    if (deps.length) {
      wrap.appendChild(el('h3', null, `📍 Deployments (${deps.length})`));
      const droster = el('div', 'crew-roster');
      deps.forEach((d, idx) => {
        const u = FLEET_UNITS[d.unit]; const p = POIS[d.poi];
        const loc = Engine.poiLocation(d.poi);
        const sysName = loc ? SYSTEMS[loc.system].name : '—';
        const row = el('div', 'crew-row aboard');
        const rateLabel = d.unit === 'refinery_barge' ? `${u.harvest}/hr ⚗️ auto-refines` : `${u.harvest}/hr`;
        row.innerHTML = `<span>${u.icon} <b>${u.name}</b></span><span class="muted">${p ? p.icon + ' ' + p.name : '—'} · ${sysName}</span><span class="muted">${rateLabel}</span>`;
        const x = el('button', 'btn tiny', 'Recall');
        x.onclick = () => { Engine.recallDeployment(g, idx); refresh(); };
        row.appendChild(x);
        droster.appendChild(row);
      });
      wrap.appendChild(droster);

      // harvested stockpile
      const stockEntries = Object.entries(g.fleetStock || {}).map(([id, q]) => [id, Math.floor(q)]).filter(([, n]) => n > 0);
      const stockCard = el('div', 'sysinfo');
      if (stockEntries.length) {
        const str = stockEntries.map(([id, n]) => `${n}× ${RESOURCES[id].icon} ${RESOURCES[id].name}`).join(', ');
        stockCard.innerHTML = `<p><b>Harvested stockpile:</b> ${str}</p>`;
        const cbtn = el('button', 'btn', 'Collect to cargo');
        cbtn.onclick = () => notify(Engine.collectFleetStock(g));
        const sbtn = el('button', 'btn', 'Sell stockpile here');
        sbtn.onclick = () => notify(Engine.sellFleetStock(g));
        stockCard.appendChild(cbtn); stockCard.appendChild(sbtn);
      } else {
        stockCard.innerHTML = `<p class="muted">No harvested goods yet — deployed units are working.</p>`;
      }
      wrap.appendChild(stockCard);
    } else {
      wrap.appendChild(el('p', 'muted', 'Tip: scan a POI in the 🪐 System tab, then deploy an idle fleet unit there to harvest it passively.'));
    }

    // commission yard — shows idle vs deployed
    const fleetGrid = el('div', 'card-grid');
    for (const [id, u] of Object.entries(FLEET_UNITS)) {
      const owned = (g.fleet && g.fleet[id]) || 0;
      const dep = Engine.deployedCount(g, id);
      const card = el('div', 'card');
      const ownedStr = owned ? `<span class="muted">×${owned}${dep ? ` · ${dep} deployed` : ''}</span>` : '';
      card.innerHTML = `<div class="card-head"><strong>${u.icon} ${u.name}</strong>${ownedStr}</div>
        <p class="muted">${u.desc}</p>
        <div class="card-meta"><span>💰 ${fmt(u.cost)} cr</span><span>📈 ${u.rate} cr/hr idle</span><span>⛏️ ${u.harvest}/hr deployed</span></div>`;
      const b = el('button', 'btn full', `Commission — ${fmt(u.cost)} cr`);
      b.onclick = () => notify(Engine.buyFleetUnit(g, id));
      card.appendChild(b);
      fleetGrid.appendChild(card);
    }
    wrap.appendChild(fleetGrid);
    return wrap;
  }

  // ---- Skills tab ----
  function renderSkills() {
    const wrap = el('div', 'panel');
    const grid = el('div', 'card-grid');
    for (const [id, sk] of Object.entries(SKILLS)) {
      const xp = g.skills[id] || 0;
      const lvl = levelForXp(xp);
      const cur = xpForLevel(lvl), next = xpForLevel(lvl + 1);
      const pct = lvl >= MAX_LEVEL ? 100 : Math.round((xp - cur) / (next - cur) * 100);
      const card = el('div', 'card');
      card.innerHTML = `<div class="card-head"><strong>${sk.name}</strong><span class="lvl">Lv ${lvl}</span></div>
        <p class="muted">${sk.desc}</p>
        <div class="progress small"><div class="progress-fill ok" style="width:${pct}%"></div></div>
        <small class="muted">${fmt(xp)} XP ${lvl < MAX_LEVEL ? `· ${fmt(next - xp)} to next` : '· MAX'}</small>`;
      grid.appendChild(card);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  // ---- Codex tab (discovery log + career stats) ----
  function systemPoiIds(sysId) {
    const s = SYSTEMS[sysId];
    let ids = [...(s.spacePois || [])];
    for (const bid of (s.bodies || [])) ids = ids.concat(BODIES[bid].pois || []);
    return ids;
  }
  function renderCodex() {
    const wrap = el('div', 'panel');
    const visited = g.visited || [];
    const sysIds = Object.keys(SYSTEMS);

    // galaxy-wide totals across visited systems
    let totalPoi = 0, chartedPoi = 0, totalBodies = 0;
    for (const sid of visited) {
      totalBodies += (SYSTEMS[sid].bodies || []).length;
      for (const pid of systemPoiIds(sid)) { totalPoi++; if (poiRevealed(g, pid)) chartedPoi++; }
    }
    const galaxyPct = Math.round(visited.length / sysIds.length * 100);

    wrap.appendChild(el('div', 'sysinfo', `<h3>📖 Captain's Codex</h3>
      <p class="muted">Your record of the cluster. Visit systems, scan their bodies and deep space to chart every site.</p>
      <p class="muted">Galaxy charted: <b>${visited.length}/${sysIds.length}</b> systems (${galaxyPct}%) · <b>${chartedPoi}/${totalPoi}</b> sites mapped in visited systems · <b>${totalBodies}</b> bodies logged</p>`));

    // ----- Legacy / prestige -----
    const renown = g.renown || 0;
    const pending = Engine.pendingRenown(g);
    wrap.appendChild(el('h3', null, '✨ Legacy'));
    const legacy = el('div', 'sysinfo');
    legacy.innerHTML = `<p><b>Renown:</b> ${fmt(renown)} &nbsp;·&nbsp; <b>Prestiges:</b> ${g.prestige || 0} &nbsp;·&nbsp; permanent <b>+${Math.round(renown * 2)}%</b> to mining yield, sell prices, fleet income & weapon damage.</p>
      <p class="muted">Prestige to wipe your current run (ships, credits, skills, fleet, standing) and convert lifetime earnings into permanent Renown. Achievements, perks, the Codex and objectives are kept.</p>
      <p class="${pending > 0 ? '' : 'muted'}">Prestige now for <b>+${fmt(pending)}</b> Renown.</p>`;
    const pbtn = el('button', 'btn danger', pending > 0 ? `✨ Prestige for +${fmt(pending)} Renown` : 'Not enough lifetime earnings yet');
    pbtn.disabled = pending < 1;
    pbtn.onclick = () => {
      if (!confirm(`Prestige now?\n\nThis WIPES your current run (ships, credits, skills, fleet, cargo, reputation) and grants +${pending} Renown for a permanent +${(renown + pending) * 2}% production bonus.\n\nAchievements, perks and the Codex are kept. This cannot be undone.`)) return;
      notify(Engine.prestige(g));
    };
    legacy.appendChild(pbtn);
    wrap.appendChild(legacy);

    // career stats
    wrap.appendChild(el('h3', null, '🏅 Career'));
    const st = g.stats || {};
    const sg = el('div', 'statgrid');
    const stats = [
      ['🚀 Runs', st.runs || 0], ['💥 Kills', st.kills || 0],
      ['⛏️ Ore mined', st.oreMined || 0], ['💰 Credits earned', st.credEarned || 0],
      ['🤝 Crew', (g.crew || []).length], ['🛰️ Fleet', Object.values(g.fleet || {}).reduce((a, b) => a + b, 0)],
    ];
    for (const [k, v] of stats) sg.appendChild(el('div', 'statcell', `<span class="muted">${k}</span><b>${fmt(v)}</b>`));
    wrap.appendChild(sg);

    // lifetime production — everything mined, refined, harvested and assembled
    const KIND_ORDER = ['ore', 'refined', 'part', 'fuel', 'salvage', 'loot', 'data'];
    const prod = Object.entries(g.produced || {})
      .map(([id, q]) => [id, Math.floor(q)])
      .filter(([id, n]) => n > 0 && RESOURCES[id]);
    if (prod.length) {
      const totalUnits = prod.reduce((a, [, n]) => a + n, 0);
      wrap.appendChild(el('h3', null, `🏭 Lifetime Production — ${fmt(totalUnits)} units`));
      prod.sort((a, b) => {
        const ka = KIND_ORDER.indexOf(RESOURCES[a[0]].kind), kb = KIND_ORDER.indexOf(RESOURCES[b[0]].kind);
        return ka !== kb ? ka - kb : b[1] - a[1];
      });
      const grid = el('div', 'prod-grid');
      for (const [id, n] of prod) {
        const r = RESOURCES[id];
        grid.appendChild(el('div', 'prod-cell', `<span>${r.icon} ${r.name} <small class="muted">(${r.kind})</small></span><b>${fmt(n)}</b>`));
      }
      wrap.appendChild(grid);
    }

    // achievements (production milestones)
    const unlocked = g.achievements || [];
    wrap.appendChild(el('h3', null, `🏆 Achievements — ${unlocked.length}/${ACHIEVEMENTS.length}`));
    const aGrid = el('div', 'card-grid');
    for (const a of ACHIEVEMENTS) {
      const done = unlocked.includes(a.id);
      const val = Engine.achievementValue(g, a);
      const pct = Math.min(100, Math.round(val / a.threshold * 100));
      const card = el('div', 'card ach-card' + (done ? ' ach-done' : ''));
      const perkTxt = a.perk ? `🎁 +${Math.round(a.perk.val * 100)}% ${PERK_LABEL[a.perk.key]}` : '';
      card.innerHTML = `<div class="card-head"><strong>${a.icon} ${a.name}</strong>${done ? '<span class="tag tier-pristine">Unlocked</span>' : ''}</div>
        <p class="muted">${a.desc}</p>
        <div class="progress small"><div class="progress-fill ${done ? 'ok' : ''}" style="width:${pct}%"></div></div>
        <small class="muted">${done ? '✓ complete' : `${fmt(val)} / ${fmt(a.threshold)}`}</small>
        <small class="perk-line ${done ? 'perk-on' : ''}">${perkTxt}</small>`;
      aGrid.appendChild(card);
    }
    wrap.appendChild(aGrid);

    // lore — unlockable narrative archive
    const seen = g.loreSeen || [];
    wrap.appendChild(el('h3', null, `📖 Lore — ${seen.length}/${LORE.length}`));
    const LORE_HINTS = {
      visit: u => `Visit ${SYSTEMS[u.sys] ? SYSTEMS[u.sys].name : u.sys}.`,
      discover: u => `Chart ${POIS[u.poi] ? POIS[u.poi].name : 'a hidden site'}.`,
      achievement: u => { const a = ACHIEVEMENTS.find(x => x.id === u.ach); return `Earn the ${a ? a.name : ''} achievement.`; },
      produce: u => `Produce ${fmt(u.n)} ${u.res && RESOURCES[u.res] ? RESOURCES[u.res].name : (u.kind || 'units')}.`,
      always: () => 'Available from the start.',
    };
    const lGrid = el('div', 'card-grid');
    for (const entry of LORE) {
      const known = seen.includes(entry.id);
      const card = el('div', 'card' + (known ? ' ach-done' : ''));
      if (known) {
        card.innerHTML = `<div class="card-head"><strong>📖 ${entry.title}</strong><span class="tag tier-pristine">Unlocked</span></div>
          <p class="muted">${entry.body}</p>`;
      } else {
        const hint = (LORE_HINTS[entry.unlock && entry.unlock.type] || (() => 'Keep exploring.'))(entry.unlock || {});
        card.innerHTML = `<div class="card-head"><strong>🔒 ???</strong><span class="tag tag-medium">Locked</span></div>
          <p class="muted">🔒 Locked — ${hint}</p>`;
      }
      lGrid.appendChild(card);
    }
    wrap.appendChild(lGrid);

    // Captain's Logbook — a personal journal auto-written from career milestones
    const journal = g.journal || [];
    if (journal.length) {
      wrap.appendChild(el('h3', null, '📔 Captain\'s Logbook'));
      const jl = el('div', 'journal-list');
      for (const e of journal) jl.appendChild(el('div', 'journal-entry', `<span class="j-icon">${e.icon || '•'}</span><span>${e.text}</span>`));
      wrap.appendChild(jl);
    }

    // per-system discovery log
    wrap.appendChild(el('h3', null, '🌌 Systems'));
    const grid = el('div', 'card-grid');
    for (const sid of sysIds) {
      const sys = SYSTEMS[sid];
      const seen = visited.includes(sid);
      const fac = FACTIONS[sys.factionId];
      const card = el('div', 'card' + (sid === g.currentSystem ? ' active-system' : ''));
      if (!seen) {
        card.innerHTML = `<div class="card-head"><strong>${sys.name}</strong><span class="tag tag-medium">Uncharted</span></div>
          <p class="muted">❓ Undiscovered system. Jump here from the 🌌 Galaxy tab to begin charting it.</p>`;
        grid.appendChild(card);
        continue;
      }
      const ids = systemPoiIds(sid);
      const charted = ids.filter(id => poiRevealed(g, id)).length;
      const pct = ids.length ? Math.round(charted / ids.length * 100) : 100;
      const c = pct >= 100 ? 'ok' : pct > 50 ? 'mid' : 'bad';
      card.innerHTML = `<div class="card-head"><strong>${sys.name}</strong><span class="tag tag-${sys.danger.toLowerCase()}">${sys.danger}</span></div>
        <p class="muted">${fac.icon} ${fac.name} space · ${sys.economy}</p>
        <p class="muted">☀️ ${sys.star || '—'}</p>
        <div class="card-meta"><span>🛰️ ${sys.bases.length} bases</span><span>🪐 ${(sys.bodies || []).length} bodies</span></div>
        <div class="progress small"><div class="progress-fill ${c}" style="width:${pct}%"></div></div>
        <small class="muted">${charted}/${ids.length} sites charted</small>`;
      grid.appendChild(card);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  // ---- Starbase tab ----
  function renderStation() {
    const wrap = el('div', 'panel');
    const sys = curSystem(g);
    const base = curBase(g);
    const fid = base.factionId;
    const fac = FACTIONS[fid];
    const rep = factionRep(g, fid);
    const hostile = hostileHereUI(g);

    wrap.appendChild(el('div', 'sysinfo', `<h3>${fac.icon} ${base.name} <small class="muted">· ${base.type}</small></h3>
      <p class="muted">${base.desc}</p>
      <p class="muted">${sys.name} · ${fac.name} (${standingName(rep)}, ${rep}) · ${fac.lawful ? 'Lawful' : 'Lawless'} · Fuel ${base.station.fuelPrice} cr/u · Repair ×${base.station.repairCostPerHp}</p>`));

    // ----- starbase interior map -----
    wrap.appendChild(el('h3', null, '🛰️ Starbase Interior'));
    const deck = el('div', 'facility-grid');
    for (const f of base.facilities) {
      const info = FACILITY_INFO[f];
      if (!info) continue;
      const cell = el('div', 'facility');
      cell.innerHTML = `<div class="facility-ico">${info.icon}</div><div class="facility-name">${info.name}</div><div class="facility-desc muted">${info.desc}</div>`;
      // clicking a facility jumps to its relevant tab where one exists
      const jump = { market: 'market', refinery: 'refinery', contracts: 'contracts', cantina: 'operations' }[f];
      if (jump) { cell.classList.add('clickable'); cell.onclick = () => { tab = jump; render(); }; }
      deck.appendChild(cell);
    }
    wrap.appendChild(deck);

    // ----- dock at another base in this system -----
    const others = sys.bases.filter(bid => bid !== g.currentBase);
    if (others.length) {
      wrap.appendChild(el('h3', null, '🚢 Other Starbases in System'));
      const dockGrid = el('div', 'card-grid');
      for (const bid of others) {
        const b2 = BASES[bid];
        const f2 = FACTIONS[b2.factionId];
        const r2 = factionRep(g, b2.factionId);
        const card = el('div', 'card');
        card.innerHTML = `<div class="card-head"><strong>${f2.icon} ${b2.name}</strong><span class="muted">${b2.type}</span></div>
          <p class="muted">${b2.desc}</p>
          <div class="card-meta"><span>${f2.name}</span><span>🤝 ${standingName(r2)}</span>${b2.shipyard ? '<span>🏗️ Shipyard</span>' : ''}</div>`;
        const btn = el('button', 'btn full', 'Dock here');
        btn.disabled = !!g.mission || !!g.pendingDistress || !!g.pendingEncounter;
        btn.onclick = () => notify(Engine.dockAt(g, bid));
        card.appendChild(btn);
        dockGrid.appendChild(card);
      }
      wrap.appendChild(dockGrid);
    }

    // ----- services -----
    wrap.appendChild(el('h3', null, '🔧 Services'));
    if (hostile) {
      wrap.appendChild(el('div', 'warn', `⚠️ ${fac.name} is hostile toward you — this base refuses repairs and fuel. Improve your standing or dock elsewhere.`));
    } else if (rep !== 0) {
      wrap.appendChild(el('p', 'muted', rep > 0
        ? 'Your standing earns a discount on repairs, fuel and better sell prices here.'
        : 'Your poor standing means a surcharge on repairs, fuel and worse sell prices here.'));
    }
    const svc = el('div', 'config-row');
    const repairBtn = el('button', 'btn', '🔧 Repair All Systems');
    repairBtn.disabled = !!g.mission || hostile;
    repairBtn.onclick = () => notify(Engine.repairAll(g));
    svc.appendChild(repairBtn);
    for (const [lbl, n] of [['⛽ Fuel +10', 10], ['⛽ Fuel +50', 50]]) {
      const b = el('button', 'btn', lbl);
      b.disabled = hostile;
      b.onclick = () => notify(Engine.refuel(g, n));
      svc.appendChild(b);
    }
    wrap.appendChild(svc);

    // ----- shipyard + outfitter (only at bases with a shipyard) -----
    if (!base.shipyard) {
      wrap.appendChild(el('h3', null, '🏗️ Shipyard'));
      wrap.appendChild(el('p', 'muted', `${base.name} has no shipyard. Dock at a base with a 🏗️ Shipyard to buy hulls and modules.`));
      return wrap;
    }
    wrap.appendChild(el('h3', null, '🏗️ Shipyard'));
    const shipGrid = el('div', 'card-grid');
    for (const [id, ship] of Object.entries(SHIPS)) {
      const owned = g.ownedShips.includes(id);
      const active = g.activeShip === id;
      const card = el('div', 'card');
      card.innerHTML = `<div class="card-head"><strong>${ship.name}</strong><span class="muted">${ship.class}</span></div>
        <p class="muted">${ship.desc}</p>
        <div class="card-meta"><span>🛡️ ${ship.base.hull}</span><span>🪨 ${ship.base.armor}</span><span>⚛️${ship.slots.reactor} 🔫${ship.slots.weapon} ⛏️${ship.slots.mining} 📦${ship.slots.cargo}</span></div>`;
      const b = el('button', 'btn full', active ? 'Active' : owned ? 'Switch to' : `Buy — ${fmt(ship.cost)} cr`);
      b.disabled = active || !!g.mission;
      b.onclick = () => notify(owned ? Engine.switchShip(g, id) : Engine.buyShip(g, id));
      card.appendChild(b);
      shipGrid.appendChild(card);
    }
    wrap.appendChild(shipGrid);

    wrap.appendChild(el('h3', null, '🔩 Outfitter'));
    const modGrid = el('div', 'card-grid');
    for (const [id, m] of Object.entries(MODULES)) {
      if (m.cost <= 0) continue; // starter gear not sold
      const card = el('div', 'card');
      const statStr = Object.entries(m.stats || {}).map(([k, v]) => `${k} +${v}`).join(', ') || (m.power ? `+${m.power} power` : '');
      card.innerHTML = `<div class="card-head"><strong>${m.name}</strong><span class="muted">${m.slot}</span></div>
        <p class="muted">${statStr}</p>
        <div class="card-meta"><span>${m.power ? '+' + m.power + ' pw' : (m.draw || 0) + ' pw'}</span><span>${m.heat ? (m.heat > 0 ? '+' : '') + m.heat + ' 🔥' : ''}</span></div>`;
      const b = el('button', 'btn full', `Buy — ${fmt(m.cost)} cr`);
      b.onclick = () => notify(Engine.buyModule(g, id));
      card.appendChild(b);
      modGrid.appendChild(card);
    }
    wrap.appendChild(modGrid);
    return wrap;
  }

  // ---------- GalNet news ----------
  function timeAgo(t) {
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return s + 's ago';
    const m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  }
  function renderNews() {
    const wrap = el('div', 'panel');
    wrap.appendChild(el('h3', null, '📡 GalNet — Galactic News Feed'));
    wrap.appendChild(el('div', 'muted', 'Dispatches from across the cluster — markets, factions, science, the frontier and beyond. Updates continuously.'));

    const feed = el('div', 'news-feed');
    const items = g.news || [];
    if (!items.length) {
      feed.appendChild(el('div', 'muted', 'The wire is quiet… for now.'));
    } else {
      for (const item of items) {
        const card = el('div', 'news-item cat-' + item.cat);
        card.appendChild(el('div', 'news-icon', item.icon || '📰'));
        const body = el('div', 'news-body');
        body.appendChild(el('div', 'news-text', item.text));
        body.appendChild(el('div', 'news-meta muted', `${item.outlet} · ${timeAgo(item.t)}`));
        card.appendChild(body);
        feed.appendChild(card);
      }
    }
    wrap.appendChild(feed);
    g.newsSeen = Date.now(); // opening the feed clears the unread badge
    return wrap;
  }

  // the scrolling headline bar under the header. Rebuilt only when the newest
  // headline changes, so the CSS scroll animation isn't restarted every frame.
  let lastTickerT = null;
  function renderTicker() {
    const host = $('#newsticker');
    if (!host) return;
    const items = g.news || [];
    if (!items.length) { host.classList.add('hidden'); lastTickerT = null; return; }
    host.classList.remove('hidden');
    if (items[0].t === lastTickerT) return;
    lastTickerT = items[0].t;
    host.innerHTML = '';
    const label = el('div', 'ticker-label', '📡 GalNet');
    label.onclick = () => { tab = 'news'; render(); };
    host.appendChild(label);
    const view = el('div', 'ticker-view');
    view.onclick = () => { tab = 'news'; render(); };
    const heads = items.slice(0, 8);
    if (setting('reduceMotion')) {
      view.appendChild(el('div', 'ticker-static', `${heads[0].icon || '📰'} ${heads[0].text}`));
    } else {
      const piece = heads.map(i => `<span class="ticker-item">${i.icon || '📰'} ${i.text}</span>`).join('<span class="ticker-sep">•</span>');
      const track = el('div', 'ticker-track', piece + '<span class="ticker-sep">•</span>' + piece);
      track.style.animationDuration = (heads.length * 7) + 's';
      view.appendChild(track);
    }
    host.appendChild(view);
  }

  // ---------- log ----------
  function renderLog() {
    const host = $('#log');
    host.innerHTML = '';
    for (const entry of g.log.slice(0, 40)) {
      host.appendChild(el('div', 'log-line ' + (entry.cls || ''), entry.text));
    }
  }

  // ---------- full + partial renders ----------
  function render() {
    renderTopbar();
    renderTabs();
    renderTicker();
    renderMissionBanner();
    renderBody();
    renderLog();
  }
  // lighter refresh used after actions: rebuild everything (cheap enough)
  function refresh() { render(); }
  // called every animation frame: only update live timers + topbar + log
  function tickRender() {
    renderTopbar();
    renderTicker();
    renderMissionBanner();
    // live-refresh refinery progress bar if visible
    if (tab === 'refinery' && g.refineJob) renderBody();
    // refresh the news feed when fresh headlines land (cheap: only on count change)
    if (tab === 'news' && (g.news || []).length !== lastNewsBodyLen) {
      lastNewsBodyLen = (g.news || []).length;
      renderBody();
    }
    renderLog();
    renderToasts();
    juiceTick();
  }

  // sound + visual flourishes driven by new log entries and state changes
  function juiceTick() {
    const fresh = (g.log || []).filter(e => e.t > lastSoundT);
    if (fresh.length) {
      lastSoundT = g.log[0].t;
      const classes = fresh.map(e => e.cls);
      if (classes.includes('level')) { snd('fanfare'); goldPulse(); }
      else if (classes.includes('bad')) snd('error');
      else if (classes.includes('go')) snd('launch');
    }
    const runs = (g.stats && g.stats.runs) || 0;
    if (lastRuns && runs > lastRuns) snd('return');
    lastRuns = runs;
    // hull damage feedback: float the loss + a red screen flash
    const hull = (g.systems && g.systems.hull) || 0;
    if (lastHull !== null && hull < lastHull - 0.5) {
      floatNum(`-${Math.round(lastHull - hull)} 🛡️`, 'dmg');
      damageFlash();
    }
    lastHull = hull;
  }

  // ---------- modal overlay ----------
  function closeModal() { const o = $('#overlay'); if (o) o.remove(); }
  function modal(titleHtml, bodyNode, actions) {
    closeModal();
    const ov = el('div', 'overlay'); ov.id = 'overlay';
    ov.onclick = (e) => { if (e.target === ov) closeModal(); };
    const box = el('div', 'modal');
    box.appendChild(el('div', 'modal-head', titleHtml));
    const body = el('div', 'modal-body'); body.appendChild(bodyNode); box.appendChild(body);
    const foot = el('div', 'modal-foot');
    for (const a of (actions || [{ label: 'Close', cls: 'btn' }])) {
      const b = el('button', a.cls || 'btn', a.label);
      b.onclick = () => { if (a.onClick) a.onClick(); if (!a.keepOpen) closeModal(); };
      foot.appendChild(b);
    }
    box.appendChild(foot);
    ov.appendChild(box);
    document.body.appendChild(ov);
  }

  // ---------- toasts ----------
  let activeToasts = [];
  function renderToasts() {
    // drain new engine toasts
    if (g.toasts && g.toasts.length) {
      for (const t of g.toasts) activeToasts.push({ text: t.text, kind: t.kind, until: Date.now() + 4500 });
      g.toasts.length = 0;
    }
    let host = $('#toasts');
    if (!host) { host = el('div', null); host.id = 'toasts'; document.body.appendChild(host); }
    const now = Date.now();
    activeToasts = activeToasts.filter(t => t.until > now);
    host.innerHTML = '';
    if (!setting('toasts')) { activeToasts = []; return; } // toasts disabled in settings
    for (const t of activeToasts.slice(-4)) host.appendChild(el('div', 'toast toast-' + (t.kind || ''), t.text));
  }

  // ---------- offline "while you were away" summary ----------
  function snapshot(game) {
    return {
      credits: game.credits,
      fleetPending: game.fleetPendingCr || 0,
      stock: { ...(game.fleetStock || {}) },
      runs: (game.stats && game.stats.runs) || 0,
      achievements: (game.achievements || []).length,
    };
  }
  function fmtDuration(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  function offlineSummary(before, elapsedMs) {
    const body = el('div');
    body.appendChild(el('p', 'muted', `You were away for <b>${fmtDuration(elapsedMs)}</b>. Your operations kept running:`));
    const rows = el('div', 'offline-rows');
    const incomeDelta = Math.floor((g.fleetPendingCr || 0) - before.fleetPending);
    const runsDelta = ((g.stats && g.stats.runs) || 0) - before.runs;
    const achDelta = (g.achievements || []).length - before.achievements;
    // harvested/refined stockpile delta
    const stockDelta = {};
    for (const [id, q] of Object.entries(g.fleetStock || {})) {
      const d = Math.floor(q) - Math.floor(before.stock[id] || 0);
      if (d > 0) stockDelta[id] = d;
    }
    const stockEntries = Object.entries(stockDelta);
    // nothing worth interrupting the player for
    if (incomeDelta <= 0 && runsDelta <= 0 && achDelta <= 0 && !stockEntries.length) return false;
    const addRow = (icon, label, val) => { if (val) rows.appendChild(el('div', 'offline-row', `<span>${icon} ${label}</span><b>${val}</b>`)); };
    addRow('💰', 'Fleet income accrued', incomeDelta > 0 ? `+${fmt(incomeDelta)} cr` : '');
    addRow('🚀', 'Missions completed', runsDelta > 0 ? `${runsDelta}` : '');
    addRow('🏆', 'Achievements unlocked', achDelta > 0 ? `${achDelta}` : '');
    if (stockEntries.length) {
      const str = stockEntries.sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => `${n}× ${RESOURCES[id].icon} ${RESOURCES[id].name}`).join(', ');
      rows.appendChild(el('div', 'offline-row wide', `<span>🛰️ Fleet harvested/refined</span><span class="muted">${str}</span>`));
    }
    body.appendChild(rows);
    const actions = [];
    if (incomeDelta > 0) actions.push({ label: `Collect ${fmt(incomeDelta)} cr`, cls: 'btn', onClick: () => { Engine.claimFleet(g); refresh(); } });
    actions.push({ label: 'Welcome back', cls: 'btn' });
    modal('<strong>🌙 While you were away</strong>', body, actions);
    return true;
  }

  // ---------- first-launch tutorial ----------
  function tutorial() {
    const body = el('div', 'tutorial');
    body.innerHTML = `
      <p>You're a broke pilot in a rusty shuttle on the frontier. Build a career however you like — miner, trader, soldier, industrialist. It's an <b>idle</b> game: send your ship out, let timers run, come back richer.</p>
      <div class="tut-sec"><b>🛰️ The core loop</b><p class="muted">Launch a run on the <b>Activities</b> tab → it returns with cargo, XP and maybe damage → <b>⚗️ Refinery</b> turns ore into goods → <b>💱 Market</b> sells it (and buys low to sell high elsewhere).</p></div>
      <div class="tut-sec"><b>🌌 Explore</b><p class="muted"><b>Galaxy</b> jumps between systems; the <b>🪐 System</b> tab is where you scan planets, moons and deep space to uncover sites and work them.</p></div>
      <div class="tut-sec"><b>🤝 Grow</b><p class="muted"><b>Contracts</b> pay faction reputation; <b>🛠️ Operations</b> hires crew and builds a fleet that earns and harvests while you're away; <b>🛰️ Starbase</b> repairs, refuels and sells ships & modules.</p></div>
      <div class="tut-sec"><b>📖 Long game</b><p class="muted">The <b>Codex</b> tracks discovery, lifetime production, achievements (each grants a permanent perk) and <b>Prestige</b> for lasting bonuses.</p></div>
      <p class="tut-tip">💡 New here? Follow the <b>🎯 Objectives</b> at the top of the Activities tab — they pay credits and walk you through everything. Reopen this anytime with <b>❓ Help</b>.</p>`;
    modal('<strong>🚀 Welcome to SpaceBake</strong>', body, [{ label: "Let's fly", cls: 'btn' }]);
  }

  // ---------- settings ----------
  function settingRow(labelHtml, control) {
    const row = el('div', 'set-row');
    row.appendChild(el('span', 'set-label', labelHtml));
    row.appendChild(control);
    return row;
  }
  function settingsModal() {
    if (typeof Settings === 'undefined') return;
    const s = Settings.all();
    const body = el('div', 'settings');
    // volume sliders
    const mkSlider = (val, on) => { const r = el('input'); r.type = 'range'; r.min = 0; r.max = 100; r.value = val; r.oninput = () => on(+r.value); return r; };
    body.appendChild(settingRow('🔊 Master volume', mkSlider(Math.round(s.masterVol * 100), v => { Settings.set('masterVol', v / 100); })));
    body.appendChild(settingRow('🎵 Music volume', mkSlider(Math.round(s.musicVol * 100), v => { Settings.set('musicVol', v / 100); })));
    // checkboxes
    const mkCheck = (checked, on) => { const c = el('input'); c.type = 'checkbox'; c.checked = checked; c.onchange = () => on(c.checked); return c; };
    body.appendChild(settingRow('Abbreviate big numbers <small class="muted">(1.2M)</small>', mkCheck(s.numAbbrev, v => { Settings.set('numAbbrev', v); refresh(); })));
    body.appendChild(settingRow('Unlock toast popups', mkCheck(s.toasts, v => Settings.set('toasts', v))));
    body.appendChild(settingRow('Screen effects & floating numbers', mkCheck(s.effects, v => Settings.set('effects', v))));
    body.appendChild(settingRow('Reduce motion <small class="muted">(pause starfield)</small>', mkCheck(s.reduceMotion, v => Settings.set('reduceMotion', v))));
    // autosave cadence
    const sel = el('select');
    for (const [v, lbl] of [[5, 'Every 5s'], [15, 'Every 15s'], [30, 'Every 30s'], [0, 'Only on exit']]) {
      const o = el('option', null, lbl); o.value = v; if (s.autosaveSec === v) o.selected = true; sel.appendChild(o);
    }
    sel.onchange = () => Settings.set('autosaveSec', +sel.value);
    body.appendChild(settingRow('💾 Autosave', sel));
    modal('<strong>⚙️ Settings</strong>', body, [{ label: 'Done', cls: 'btn' }]);
  }

  // ---------- save export / import ----------
  function dataModal() {
    const body = el('div');
    body.appendChild(el('p', 'muted', 'Copy your save to back it up or move devices, or paste one in to load it. Importing overwrites your current game.'));
    const ta = el('textarea', 'save-box'); ta.value = exportSave(g);
    ta.setAttribute('spellcheck', 'false');
    body.appendChild(ta);
    body.appendChild(el('small', 'muted', 'Tip: select-all and copy, or edit then Load.'));
    modal('<strong>⤓ Save Data</strong>', body, [
      { label: 'Copy', cls: 'btn', keepOpen: true, onClick: () => { try { ta.select(); navigator.clipboard && navigator.clipboard.writeText(ta.value); } catch (e) {} } },
      { label: 'Load pasted save', cls: 'btn danger', onClick: () => importSave(ta.value) },
      { label: 'Close', cls: 'btn' },
    ]);
  }

  return { init, setState, render, refresh, tickRender, offlineSummary, snapshot, dataModal, tutorial, settingsModal };
})();
