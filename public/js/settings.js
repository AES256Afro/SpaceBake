/* SpaceBake — player settings, persisted to localStorage independently of the
 * save game (so they survive resets and prestige). Read via Settings.get(key).
 */
const Settings = (() => {
  const KEY = 'spacebake.settings';
  const defaults = {
    masterVol: 0.32,    // 0..1 overall audio level
    musicVol: 0.5,      // 0..1 ambient music level
    numAbbrev: false,   // abbreviate big numbers (1.2M) vs full (1,200,000)
    toasts: true,       // show unlock/level toast popups
    effects: true,      // screen pulses, flashes, floating numbers
    reduceMotion: false,// pause the animated starfield
    autosaveSec: 5,     // autosave interval in seconds (0 = only on exit)
  };
  let s = Object.assign({}, defaults);
  try { Object.assign(s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}

  function persist() { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function get(k) { return s[k]; }
  function set(k, v) { s[k] = v; persist(); apply(); }
  function apply() {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('reduce-motion', !!s.reduceMotion);
    }
    if (typeof Sound !== 'undefined') {
      Sound.setMasterVolume(s.masterVol);
      Sound.setMusicVolume(s.musicVol);
    }
  }
  return { get, set, all: () => Object.assign({}, s), apply, defaults };
})();
