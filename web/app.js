/*
 * POWDER Web -- browser shell bootstrap.
 *
 * This script defines the Emscripten `Module` object BEFORE powder.js loads,
 * so it must appear first in index.html. It wires up the canvas, persistent
 * saves (IndexedDB via Emscripten IDBFS), and basic status/About UI.
 *
 * The game engine itself is unmodified POWDER 1.18 (see NOTICE.md). All of the
 * browser integration lives here in the shell, isolated from gameplay logic.
 */
(function () {
  "use strict";

  var canvas = document.getElementById("canvas");
  var statusEl = document.getElementById("status");
  var loadingEl = document.getElementById("loading");
  var loadingText = document.getElementById("loading-text");

  function setStatus(text) {
    if (statusEl && text) statusEl.textContent = text;
  }

  var ready = false;
  var CONTROLS_HINT =
    "Move: Arrows / WASD  ·  Confirm: Enter  ·  Wait: Space  ·  Inventory: i  ·  Menu: Esc";

  // POWDER (built without CHANGE_WORK_DIRECTORY) reads/writes its save and
  // config files in the current working directory. We mount IndexedDB-backed
  // storage there so saves survive reloads and work offline.
  var SAVE_DIR = "/powder";

  // Cache-buster for powder.wasm (kept in sync with the ?v= on the script tags
  // in index.html). Lets local rebuilds load fresh; harmless in production.
  var ASSET_VERSION = "2";

  var Module = {
    canvas: canvas,
    arguments: [],

    // Route powder.wasm (and any data files) through the same cache-buster.
    locateFile: function (path, prefix) { return prefix + path + "?v=" + ASSET_VERSION; },

    // Route engine stdout/stderr to the dev console.
    print: function () { console.log.apply(console, arguments); },
    printErr: function () { console.warn.apply(console, arguments); },

    // Mount persistent storage and pull existing saves in BEFORE main() runs.
    // POWDER reads its save file (powder.sav) during startup, so we must block
    // the runtime on the IndexedDB restore via addRunDependency -- otherwise the
    // engine boots against an empty save and the "Load" menu option never shows.
    preRun: [function () {
      try {
        FS.mkdir(SAVE_DIR);
        FS.mount(IDBFS, {}, SAVE_DIR);
        FS.chdir(SAVE_DIR);
        Module.addRunDependency("idbfs-load");
        FS.syncfs(true, function (err) {
          if (err) console.warn("[powder] IDBFS initial load failed:", err);
          Module.removeRunDependency("idbfs-load");
        });
      } catch (e) {
        console.warn("[powder] persistent-save setup failed; saves will not " +
                     "persist this session:", e);
      }
    }],

    onRuntimeInitialized: function () {
      ready = true;
      setStatus(CONTROLS_HINT);
      if (loadingEl) loadingEl.style.display = "none";
      try { canvas.focus(); } catch (e) {}
    },

    // Emscripten reports download/instantiation progress here (load phase only;
    // once ready we keep the controls hint instead of letting it reset).
    setStatus: function (text) {
      if (loadingText && text) loadingText.textContent = text;
      if (!ready) setStatus(text || "Loading…");
    },
  };

  // Expose for powder.js (loaded next) and for debugging.
  window.Module = Module;

  // ---- Autosave + persist to IndexedDB -----------------------------------
  // POWDER only writes a loadable save (savecount >= 1) on a clean quit or via
  // the in-game Save menu. To avoid losing progress when a browser tab is just
  // closed, we periodically trigger an engine-side checkpoint -- saveGame(true),
  // the very call POWDER's Android suspend path uses -- then flush IDBFS to
  // IndexedDB. The ccall only runs while the engine is idle (Asyncify yields in
  // awaitEvent), and is a no-op unless a game is in progress, so it is safe.
  function syncToIDB() {
    if (typeof FS !== "undefined" && FS.syncfs) {
      try { FS.syncfs(false, function () {}); } catch (e) {}
    }
  }
  function autosave() {
    if (ready && Module.ccall) {
      try { Module.ccall("powder_autosave", null, [], []); } catch (e) {}
    }
    syncToIDB();
  }
  setInterval(autosave, 15000);
  window.addEventListener("pagehide", autosave);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") autosave();
  });

  function focusGame() {
    try { canvas.focus(); } catch (e) {}
  }

  // ---- About dialog ------------------------------------------------------
  var aboutBtn = document.getElementById("about-btn");
  var aboutDlg = document.getElementById("about");
  if (aboutBtn && aboutDlg) {
    aboutBtn.addEventListener("click", function () {
      if (aboutDlg.showModal) aboutDlg.showModal();
      this.blur();
    });
    // When the dialog closes, return focus to the game (not the About button,
    // which would otherwise swallow Enter/Space).
    aboutDlg.addEventListener("close", focusGame);
  }

  // ---- Fullscreen toggle -------------------------------------------------
  var fsBtn = document.getElementById("fullscreen-btn");
  var appEl = document.getElementById("app");
  function toggleFullscreen() {
    var d = document;
    var active = d.fullscreenElement || d.webkitFullscreenElement;
    if (!active && appEl) {
      var req = appEl.requestFullscreen || appEl.webkitRequestFullscreen;
      if (req) req.call(appEl);
    } else {
      var exit = d.exitFullscreen || d.webkitExitFullscreen;
      if (exit) exit.call(d);
    }
  }
  if (fsBtn) {
    fsBtn.addEventListener("click", function () {
      toggleFullscreen();
      this.blur();
      focusGame();
    });
  }

  // ---- Stop game keys from scrolling the page ----------------------------
  // POWDER uses arrows/space; the browser would otherwise scroll. preventDefault
  // cancels only the scroll, not delivery to the engine's document listener.
  var SCROLL_KEYS = {
    ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1,
    " ": 1, Spacebar: 1, PageUp: 1, PageDown: 1, Home: 1, End: 1
  };
  window.addEventListener("keydown", function (e) {
    if (aboutDlg && aboutDlg.open) return;            // let the dialog have keys
    var ae = document.activeElement;
    if (ae && (ae.tagName === "BUTTON" || ae.tagName === "INPUT")) return;
    if (SCROLL_KEYS[e.key]) e.preventDefault();
  }, { capture: true });

  // Keep keyboard focus on the game so keypresses reach POWDER.
  canvas.addEventListener("mousedown", focusGame);
})();
