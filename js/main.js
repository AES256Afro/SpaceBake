/* SpaceBake — bootstrap: load/create state, run the game loop, wire controls. */

(function () {
  let g = loadGame();
  let isNew = false;
  if (!g) { g = newGame(); isNew = true; }

  // Offline catch-up: if a mission was running and its timer elapsed while away,
  // the next tick will resolve it. Refinery batches likewise complete on tick.
  // (We keep it simple: time passed naturally via wall-clock endsAt timestamps.)

  UI.init(g);
  if (isNew) {
    Engine.logLine(g, 'Welcome to Kharon Station, pilot. Your Rustbucket Shuttle is fuelled and waiting.', 'good');
    Engine.logLine(g, 'Tip: Launch a Common Asteroid Belt run, then refine and sell. Watch your heat and hull.', 'event');
    UI.refresh();
  }

  // main loop ~5fps for logic, requestAnimationFrame for smooth timers
  let lastSave = Date.now();
  function loop() {
    Engine.tick(g);
    UI.setState(g);
    UI.tickRender();
    // autosave every 5s
    if (Date.now() - lastSave > 5000) { saveGame(g); lastSave = Date.now(); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // a steadier logic tick so missions resolve promptly even in background-ish tabs
  setInterval(() => { Engine.tick(g); }, 500);

  // save on unload
  window.addEventListener('beforeunload', () => saveGame(g));

  // header controls
  document.getElementById('btn-save').onclick = () => { saveGame(g); Engine.logLine(g, 'Game saved.', 'good'); UI.refresh(); };
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
