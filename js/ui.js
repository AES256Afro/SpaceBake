/* SpaceBake — UI rendering. Builds the DOM from game state each frame.
 * Vanilla JS, no framework. Event handlers call Engine.* then re-render.
 */

const UI = (() => {
  let g = null;
  let tab = 'activities';

  const $ = sel => document.querySelector(sel);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  function init(game) { g = game; render(); }
  function setState(game) { g = game; }

  function fmt(n) { return Math.round(n).toLocaleString(); }
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
      ['🚀', SHIPS[g.activeShip].name, 'Active ship'],
      ['🤝', repName(g.rep), 'Freebelt standing'],
    ];
    for (const [icon, val, title] of items) {
      const d = el('div', 'stat', `<span class="ico">${icon}</span><span>${val}</span>`);
      d.title = title;
      bar.appendChild(d);
    }
  }

  function repName(r) {
    if (r <= -6) return 'Hostile';
    if (r < 0) return 'Suspicious';
    if (r === 0) return 'Neutral';
    if (r < 5) return 'Friendly';
    if (r < 12) return 'Trusted';
    return 'Allied';
  }

  // ---------- mission banner ----------
  function renderMissionBanner() {
    const host = $('#mission-banner');
    host.innerHTML = '';
    if (g.pendingDistress) {
      host.appendChild(renderDistress());
      return;
    }
    if (!g.mission) { host.classList.add('hidden'); return; }
    host.classList.remove('hidden');
    const act = ACTIVITIES[g.mission.id];
    const left = timeLeft(g.mission.endsAt);
    const total = g.mission.duration;
    const pct = Math.min(100, Math.round((1 - left / total) * 100));
    const card = el('div', 'banner-card');
    card.innerHTML = `
      <div class="banner-head">
        <strong>⏳ ${act.name}</strong>
        <span>${left}s remaining</span>
      </div>
      <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>`;
    const btn = el('button', 'btn small', 'Recall Ship');
    btn.onclick = () => { Engine.recallMission(g); refresh(); };
    card.appendChild(btn);
    host.appendChild(card);
  }

  function renderDistress() {
    const sc = DISTRESS.find(s => s.id === g.pendingDistress.scenario);
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

  // ---------- tabs ----------
  const TABS = [
    ['activities', '🛰️ Activities'],
    ['refinery', '⚗️ Refinery'],
    ['ship', '🚀 Ship'],
    ['market', '💱 Market'],
    ['skills', '📊 Skills'],
    ['station', '🏗️ Station'],
  ];
  function renderTabs() {
    const host = $('#tabs');
    host.innerHTML = '';
    for (const [id, label] of TABS) {
      const b = el('button', 'tab' + (tab === id ? ' active' : ''), label);
      b.onclick = () => { tab = id; render(); };
      host.appendChild(b);
    }
  }

  // ---------- body ----------
  function renderBody() {
    const host = $('#body');
    host.innerHTML = '';
    if (tab === 'activities') host.appendChild(renderActivities());
    else if (tab === 'refinery') host.appendChild(renderRefinery());
    else if (tab === 'ship') host.appendChild(renderShip());
    else if (tab === 'market') host.appendChild(renderMarket());
    else if (tab === 'skills') host.appendChild(renderSkills());
    else if (tab === 'station') host.appendChild(renderStation());
  }

  function notify(res) {
    if (res && res.ok === false) Engine.logLine(g, res.msg, 'bad');
    refresh();
  }

  // ---- Activities tab ----
  function renderActivities() {
    const wrap = el('div', 'panel');
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
    wrap.appendChild(cfg);

    const busy = !!g.mission || !!g.pendingDistress;
    const grid = el('div', 'card-grid');
    for (const [id, act] of Object.entries(ACTIVITIES)) {
      const lvl = skillLevel(g, act.skill);
      const locked = lvl < act.reqLevel;
      const card = el('div', 'card' + (locked ? ' locked' : ''));
      const dropStr = act.drops ? act.drops.map(d => RESOURCES[d[0]].icon).join(' ') : (act.type === 'combat' ? '⚔️' : '📡');
      card.innerHTML = `
        <div class="card-head">
          <strong>${act.name}</strong>
          <span class="tag tag-${act.risk.toLowerCase()}">${act.risk}</span>
        </div>
        <p class="muted">${act.desc}</p>
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
  function renderShip() {
    const wrap = el('div', 'panel ship-panel');
    const stats = shipStats(g);
    const ship = SHIPS[g.activeShip];

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
    wrap.appendChild(left);

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
        const row = el('div', 'fit-row');
        row.innerHTML = `<span>${m.name}</span><span class="muted">${m.power ? '+' + m.power + 'pw' : (m.draw ? m.draw + 'pw' : '')} ${m.heat ? (m.heat > 0 ? '+' : '') + m.heat + '🔥' : ''}</span>`;
        const x = el('button', 'btn tiny', '✕');
        x.onclick = () => { Engine.unfitModule(g, slot, idx); refresh(); };
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
      const row = el('div', 'fit-row');
      row.innerHTML = `<span>${m.name} ×${count}</span><span class="muted">${m.slot}</span>`;
      const b = el('button', 'btn tiny', 'Fit');
      b.disabled = !!g.mission;
      b.onclick = () => notify(Engine.fitModule(g, modId));
      row.appendChild(b);
      right.appendChild(row);
    }
    wrap.appendChild(right);
    return wrap;
  }

  function sysLabel(s) { return ({ hull: 'Hull', reactor: 'Reactor', engines: 'Engines', sensors: 'Sensors', cargobay: 'Cargo Bay', weapons: 'Weapons', shields: 'Shields', lifesupport: 'Life Support' })[s] || s; }
  function slotIcon(s) { return ({ reactor: '⚛️', engine: '🚀', shield: '🔵', weapon: '🔫', mining: '⛏️', utility: '🔧', cargo: '📦' })[s] || '▫️'; }

  // ---- Market tab ----
  function renderMarket() {
    const wrap = el('div', 'panel');
    const ctrls = el('div', 'config-row');
    const sellRaw = el('button', 'btn', 'Sell all ore & salvage');
    sellRaw.onclick = () => { Engine.sellAllRaw(g); refresh(); };
    ctrls.appendChild(sellRaw);
    wrap.appendChild(ctrls);

    const items = Object.entries(g.cargo).filter(([, q]) => q > 0);
    if (!items.length) { wrap.appendChild(el('p', 'muted', 'Cargo hold is empty. Go earn something.')); return wrap; }
    const table = el('div', 'market-table');
    table.appendChild(el('div', 'mt-head', '<span>Item</span><span>Qty</span><span>Unit</span><span>Actions</span>'));
    for (const [id, qty] of items) {
      const res = RESOURCES[id];
      const price = Engine.sellPrice(g, id);
      const row = el('div', 'mt-row');
      row.innerHTML = `<span>${res.icon} ${res.name} <small class="muted">(${res.kind})</small></span><span>${qty}</span><span>${price} cr</span>`;
      const actions = el('span', 'mt-actions');
      for (const [lbl, n] of [['+1', 1], ['+10', 10], ['All', qty]]) {
        const b = el('button', 'btn tiny', lbl);
        b.onclick = () => { Engine.sellResource(g, id, n); refresh(); };
        actions.appendChild(b);
      }
      row.appendChild(actions);
      table.appendChild(row);
    }
    wrap.appendChild(table);
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

  // ---- Station tab ----
  function renderStation() {
    const wrap = el('div', 'panel');
    wrap.appendChild(el('div', 'sysinfo', `<h3>${SYSTEM.name} · ${SYSTEM.station.name}</h3>
      <p class="muted">${SYSTEM.station.desc}</p>
      <p class="muted">Faction: ${SYSTEM.faction} · Economy: ${SYSTEM.economy} · Danger: ${SYSTEM.danger}</p>`));

    // services
    const svc = el('div', 'config-row');
    const repairBtn = el('button', 'btn', '🔧 Repair All Systems');
    repairBtn.disabled = !!g.mission;
    repairBtn.onclick = () => notify(Engine.repairAll(g));
    svc.appendChild(repairBtn);
    for (const [lbl, n] of [['⛽ Fuel +10', 10], ['⛽ Fuel +50', 50]]) {
      const b = el('button', 'btn', lbl);
      b.onclick = () => notify(Engine.refuel(g, n));
      svc.appendChild(b);
    }
    wrap.appendChild(svc);

    // shipyard
    wrap.appendChild(el('h3', null, '🛒 Shipyard'));
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
      b.onclick = () => { owned ? Engine.switchShip(g, id) : notify(Engine.buyShip(g, id)); refresh(); };
      card.appendChild(b);
      shipGrid.appendChild(card);
    }
    wrap.appendChild(shipGrid);

    // module shop
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
    renderMissionBanner();
    renderBody();
    renderLog();
  }
  // lighter refresh used after actions: rebuild everything (cheap enough)
  function refresh() { render(); }
  // called every animation frame: only update live timers + topbar + log
  function tickRender() {
    renderTopbar();
    renderMissionBanner();
    // live-refresh refinery progress bar if visible
    if (tab === 'refinery' && g.refineJob) renderBody();
    renderLog();
  }

  return { init, setState, render, refresh, tickRender };
})();
