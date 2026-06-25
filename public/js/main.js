/* SpaceBake — bootstrap: load/create state, run the game loop, wire controls. */

(function () {
  let g = loadGame();
  let isNew = false;
  if (!g) { g = newGame(); isNew = true; }

  // Offline catch-up: if a mission was running and its timer elapsed while away,
  // the next tick will resolve it. Refinery batches likewise complete on tick.
  // (We keep it simple: time passed naturally via wall-clock endsAt timestamps.)

  Settings.apply(); // sync volumes + reduce-motion from saved settings
  UI.init(g);
  if (isNew) {
    Engine.logLine(g, 'Welcome to Kharon Station, pilot. Your Rustbucket Shuttle is fuelled and waiting.', 'good');
    Engine.logLine(g, 'Tip: Launch a Common Asteroid Belt run, then refine and sell. Watch your heat and hull.', 'event');
    UI.refresh();
    UI.tutorial();
  } else {
    // offline catch-up: process elapsed time, then show a "while you were away" summary
    const elapsed = Date.now() - (g.lastTick || Date.now());
    const before = UI.snapshot(g);
    Engine.tick(g);            // settle fleet income/harvest + any mission that ended
    UI.refresh();
    if (elapsed > 60000) UI.offlineSummary(before, elapsed);
  }

  // main loop ~5fps for logic, requestAnimationFrame for smooth timers
  let lastSave = Date.now();
  function loop() {
    Engine.tick(g);
    UI.setState(g);
    UI.tickRender();
    // autosave at the player's chosen cadence (0 = only on exit)
    const autosaveMs = (Settings.get('autosaveSec') || 0) * 1000;
    if (autosaveMs && Date.now() - lastSave > autosaveMs) { saveGame(g); lastSave = Date.now(); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // a steadier logic tick so missions resolve promptly even in background-ish tabs
  setInterval(() => { Engine.tick(g); }, 500);

  // save on unload
  window.addEventListener('beforeunload', () => saveGame(g));

  // header controls
  document.getElementById('btn-save').onclick = () => { saveGame(g); Engine.logLine(g, 'Game saved.', 'good'); UI.refresh(); };
  document.getElementById('btn-data').onclick = () => { saveGame(g); UI.dataModal(); };
  document.getElementById('btn-help').onclick = () => UI.tutorial();
  document.getElementById('btn-settings').onclick = () => UI.settingsModal();

  // ---- audio ----
  const sfxBtn = document.getElementById('btn-sfx');
  const musicBtn = document.getElementById('btn-music');
  function syncAudioButtons() {
    sfxBtn.textContent = Sound.isSfx() ? '🔊' : '🔇';
    sfxBtn.classList.toggle('on', Sound.isSfx());
    musicBtn.textContent = Sound.isMusic() ? '🎵' : '🎵̶';
    musicBtn.classList.toggle('on', Sound.isMusic());
  }
  sfxBtn.onclick = () => { Sound.setSfx(!Sound.isSfx()); syncAudioButtons(); };
  musicBtn.onclick = () => { Sound.resume(); Sound.setMusic(!Sound.isMusic()); syncAudioButtons(); };
  syncAudioButtons();
  // a subtle tick on any button press
  document.addEventListener('click', (e) => { if (e.target.closest('.btn, .tab')) Sound.play('click'); });
  // browsers block audio until a gesture: resume on first interaction, start music if enabled
  window.addEventListener('pointerdown', function once() {
    Sound.resume(); if (Sound.isMusic()) Sound.startMusic();
    window.removeEventListener('pointerdown', once);
  }, { once: true });
  document.getElementById('btn-reset').onclick = () => {
    if (confirm('Wipe your save and start a new game? This cannot be undone.')) {
      wipeSave();
      g = newGame();
      UI.init(g);
      Engine.logLine(g, 'New game started.', 'good');
      UI.refresh();
    }
  };
})();
