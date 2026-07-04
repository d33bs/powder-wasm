/*
 * POWDER Web -- browser shell bootstrap.
 *
 * Defines the Emscripten `Module` before powder.js loads (must be first in
 * index.html), then wires: persistent saves (IDBFS) + autosave, on-screen touch
 * controls (D-pad / tap / swipe), a settings panel (control scheme, display &
 * accessibility, save export/import/reset), fullscreen, and focus handling.
 *
 * The POWDER engine is unmodified gameplay (see NOTICE.md); everything here is
 * browser integration in the shell. Touch input is delivered to the engine as
 * synthetic key events (POWDER uses four-way movement for normal characters).
 */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $("canvas");
  var statusEl = $("status");
  var loadingEl = $("loading");
  var loadingText = $("loading-text");
  var touchControls = $("touch-controls");
  var dpad = $("dpad");
  var screenEl = $("screen");
  var gameFrame = $("game-frame");
  var quickstart = $("quickstart");
  var quickstartDismiss = $("quickstart-dismiss");
  var saveStateEl = $("save-state");
  var offlineStateEl = $("offline-state");
  var storageStateEl = $("storage-state");
  var installTopBtn = $("install-top-btn");
  var installSettingsBtn = $("install-settings-btn");
  var installHelpDlg = $("install-help");

  var ready = false;
  var startupRevealed = false;
  var statusTimer = null;
  var CONTROLS_HINT =
    "Move: Arrows / WASD  ·  Actions: V  ·  Back: Esc  ·  Inventory: i";
  var TOUCH_CONTROLS_HINT = "Actions: all commands  ·  Back: cancel";

  function setStatus(text) { if (statusEl && text) statusEl.textContent = text; }
  function setTransientStatus(text, ms) {
    if (statusTimer !== null) clearTimeout(statusTimer);
    setStatus(text);
    statusTimer = setTimeout(function () {
      statusTimer = null;
      updateControlsHint();
    }, ms || 4500);
  }
  function updateControlsHint() {
    if (!ready) return;
    setStatus(document.body.classList.contains("controls-on") ?
      TOUCH_CONTROLS_HINT : CONTROLS_HINT);
  }

  var SAVE_DIR = "/powder";
  var ASSET_VERSION = "44"; // keep in sync with ?v= on script tags in index.html

  // Fit and center the complete 4:3 SDL surface without cropping. Keeping the
  // frame within both dimensions prevents horizontal overflow on phones.
  function fitGameFrame() {
    if (!screenEl || !gameFrame) return;
    var availableWidth = screenEl.clientWidth;
    var availableHeight = screenEl.clientHeight;
    if (availableWidth <= 0 || availableHeight <= 0) return;
    var width, height;

    if (availableWidth / availableHeight > 4 / 3) {
      height = Math.floor(availableHeight);
      width = Math.floor(height * 4 / 3);
    } else {
      width = Math.floor(availableWidth);
      height = Math.floor(width * 3 / 4);
    }
    if (width > 0 && height > 0) {
      gameFrame.style.width = width + "px";
      gameFrame.style.height = height + "px";
    }
  }
  if (typeof ResizeObserver !== "undefined" && screenEl) {
    new ResizeObserver(fitGameFrame).observe(screenEl);
  } else {
    window.addEventListener("resize", fitGameFrame);
  }
  fitGameFrame();

  // ----------------------------------------------------------------- Module
  var Module = {
    canvas: canvas,
    arguments: [],
    locateFile: function (path, prefix) { return prefix + path + "?v=" + ASSET_VERSION; },
    print: function () { console.log.apply(console, arguments); },
    printErr: function () { console.warn.apply(console, arguments); },

    // Mount persistent storage and restore saves BEFORE main() runs (POWDER
    // reads its save at startup; addRunDependency blocks main on the restore).
    preRun: [function () {
      try {
        FS.mkdir(SAVE_DIR);
        FS.mount(IDBFS, {}, SAVE_DIR);
        FS.chdir(SAVE_DIR);
        Module.addRunDependency("idbfs-load");
        FS.syncfs(true, function (err) {
          if (err) console.warn("[powder] IDBFS load failed:", err);
          Module.removeRunDependency("idbfs-load");
        });
      } catch (e) {
        console.warn("[powder] persistent-save setup failed:", e);
      }
    }],

    onRuntimeInitialized: function () {
      ready = true;
      document.title = "powder-wasm";
      setTimeout(function () { document.title = "powder-wasm"; }, 0);
      setTimeout(function () { document.title = "powder-wasm"; }, 1000);
      updateControlsHint();
      if (loadingText) loadingText.textContent = "Starting POWDER…";
      // Ask the browser not to evict the app cache or IndexedDB saves under
      // storage pressure. Browsers may decline based on their own policy, so
      // offline play still relies on the service-worker cache either way.
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then(updateStorageState).catch(updateStorageState);
      }
      updateSaveState();
      updateOfflineState();
      updateStorageState();
    },

    setStatus: function (text) {
      if (loadingText && text) loadingText.textContent = text;
      if (!ready) setStatus(text || "Loading…");
    },
  };
  window.Module = Module;

  function revealStartedGame() {
    if (startupRevealed) return;
    startupRevealed = true;
    if (loadingEl) loadingEl.style.display = "none";
    maybeShowQuickstart();
    focusGame();
  }

  window.__powderMainStarted = function () {
    // Emscripten reports runtime initialization before it calls POWDER's main().
    // On Android Chrome, hiding the loader at that point can expose an empty
    // canvas. Wait until the native entry point has actually been reached, then
    // give the browser a short paint window for the initial SDL surface.
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        setTimeout(revealStartedGame, 750);
      });
    });
  };

  function focusGame() { try { canvas.focus(); } catch (e) {} }

  // -------------------------------------------------------------- Autosave
  // POWDER only writes a loadable save on a clean quit; autosave via the
  // engine's own saveGame(true) checkpoint (Android suspend path) so closing a
  // tab doesn't lose progress. Safe: ccall only runs while the engine is idle.
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
    updateSaveState();
  }
  setInterval(autosave, 15000);
  window.addEventListener("pagehide", autosave);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") autosave();
  });

  // ----------------------------------------------------- Key synthesis
  var KEYCODES = {
    ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39,
    Enter: 13, Escape: 27, " ": 32, Backspace: 8,
    "1": 49, "2": 50, "3": 51, "4": 52, "5": 53, "6": 54, "7": 55, "8": 56, "9": 57
  };
  function keyCodeFor(k) {
    if (KEYCODES[k] != null) return KEYCODES[k];
    return k.length === 1 ? k.toUpperCase().charCodeAt(0) : 0;
  }
  function codeFor(k) {
    if (/^[a-z]$/i.test(k)) return "Key" + k.toUpperCase();
    if (/^[0-9]$/.test(k)) return "Digit" + k;
    if (k === " ") return "Space";
    return k;
  }
  function dispatchKey(type, key, code, keyCode, shifted) {
    document.dispatchEvent(new KeyboardEvent(type, {
      key: key, code: code, keyCode: keyCode, which: keyCode,
      shiftKey: shifted, bubbles: true, cancelable: true
    }));
  }
  function sendKey(key) {
    var kc = keyCodeFor(key);
    var code = codeFor(key);
    var shifted = /^[A-Z]$/.test(key);

    // Emscripten SDL1 derives character case from its tracked modifier state,
    // not only KeyboardEvent.shiftKey. Emit the physical Shift transitions so
    // uppercase shortcuts such as V reach POWDER as uppercase rather than v.
    if (shifted) dispatchKey("keydown", "Shift", "ShiftLeft", 16, true);
    dispatchKey("keydown", key, code, kc, shifted);
    dispatchKey("keyup", key, code, kc, shifted);
    if (shifted) dispatchKey("keyup", "Shift", "ShiftLeft", 16, false);
  }

  // --------------------------------------------------- Touch buttons (D-pad)
  var HOLD_DELAY_MS = 350;
  var HOLD_REPEAT_MS = 120;
  var activeHoldStop = null;

  function stopActiveHold() {
    if (activeHoldStop) activeHoldStop();
  }

  function bindButton(btn) {
    var key = btn.getAttribute("data-key");
    if (!key) return;
    btn.addEventListener("pointerdown", function (e) {
      e.preventDefault();      // don't steal focus / no double-tap zoom
      stopActiveHold();
      sendKey(key);
      if (key === "Escape") {
        setTransientStatus("Back cancels prompts and closes in-game menus.", 3000);
      }

      // POWDER movement is turn-based, so repeat complete key presses rather
      // than holding a keydown state that could become stuck after a gesture.
      if (key.indexOf("Arrow") === 0 || key === "5") {
        var delayTimer = null;
        var repeatTimer = null;
        var stopHold = function () {
          if (delayTimer !== null) clearTimeout(delayTimer);
          if (repeatTimer !== null) clearInterval(repeatTimer);
          delayTimer = repeatTimer = null;
          if (activeHoldStop === stopHold) activeHoldStop = null;
        };

        activeHoldStop = stopHold;
        try { btn.setPointerCapture(e.pointerId); } catch (err) {}
        delayTimer = setTimeout(function () {
          sendKey(key);
          repeatTimer = setInterval(function () { sendKey(key); }, HOLD_REPEAT_MS);
        }, HOLD_DELAY_MS);
      }
    });
    btn.addEventListener("pointerup", stopActiveHold);
    btn.addEventListener("pointercancel", stopActiveHold);
    btn.addEventListener("lostpointercapture", stopActiveHold);
    btn.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }
  Array.prototype.forEach.call(document.querySelectorAll(".dbtn, .abtn"), bindButton);
  window.addEventListener("blur", stopActiveHold);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") stopActiveHold();
  });

  // ------------------------------------------------ Native action menu
  var lastModeButton = null;
  var lastModeButtonAt = 0;
  var MODE_SWITCH_CANCEL_MS = 2000;

  function openNativeMode(mode, ccallName) {
    if (!ready || !Module.ccall) return;

    // Actions and Inventory both open blocking in-game UI. A rapid switch from
    // one to the other should cancel the current in-game prompt before opening
    // the next mode, but this cancel must not be baked into every native
    // command because startup menus such as initial god selection are also
    // driven by the same keyboard queue.
    var now = Date.now();
    var shouldCancelFirst = lastModeButton &&
      lastModeButton !== mode &&
      now - lastModeButtonAt < MODE_SWITCH_CANCEL_MS;
    lastModeButton = mode;
    lastModeButtonAt = now;

    if (shouldCancelFirst) {
      Module.ccall("powder_cancel_prompt", null, [], []);
      setTimeout(function () {
        if (ready && Module.ccall) Module.ccall(ccallName, null, [], []);
      }, 80);
    } else {
      Module.ccall(ccallName, null, [], []);
    }
  }

  var actionsBtn = $("actions-btn");
  if (actionsBtn) {
    actionsBtn.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      openNativeMode("actions", "powder_open_action_menu");
      setTransientStatus("Actions: choose a command. If it asks for a direction, use arrows or Back.", 6000);
      focusGame();
    });
  }

  var inventoryBtn = $("inventory-btn");
  if (inventoryBtn) {
    inventoryBtn.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      openNativeMode("inventory", "powder_open_inventory");
      setTransientStatus("Inventory: choose an item, or use Back to cancel.", 4500);
      focusGame();
    });
  }

  // --------------------------------------------------- Tap / swipe to move
  var tapEnabled = false;
  var tapStart = null;
  function dirKeyFromDelta(dx, dy) {
    // Normal POWDER characters cannot move diagonally. Resolve taps and
    // swipes to their dominant axis so every gesture performs one valid turn.
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx < 0 ? "ArrowLeft" : "ArrowRight";
    }
    return dy < 0 ? "ArrowUp" : "ArrowDown";
  }
  canvas.addEventListener("pointerdown", function (e) {
    focusGame();
    if (tapEnabled) tapStart = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("pointerup", function (e) {
    if (!tapEnabled || !tapStart) return;
    var rect = gameFrame ? gameFrame.getBoundingClientRect() : canvas.getBoundingClientRect();
    var dx = e.clientX - tapStart.x, dy = e.clientY - tapStart.y;
    if (Math.hypot(dx, dy) > 24) {
      sendKey(dirKeyFromDelta(dx, dy));           // swipe
    } else {
      var tx = e.clientX - (rect.left + rect.width / 2);
      var ty = e.clientY - (rect.top + rect.height / 2);
      if (Math.hypot(tx, ty) < rect.width * 0.10) sendKey("5"); // tap centre = wait
      else sendKey(dirKeyFromDelta(tx, ty));      // tap = step toward it
    }
    tapStart = null;
  });

  // ----------------------------------------------------------- Settings
  var SETTINGS_KEY = "powder.settings";
  var QUICKSTART_KEY = "powder.quickstart.dismissed";
  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; }
  }
  function persistSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
  }
  var settings = loadSettings();
  if (!settings.scheme) settings.scheme = "auto";
  if (!settings.controlsize) settings.controlsize = "comfortable";

  var ctrlScheme = $("ctrl-scheme");
  var ctrlSize = $("ctrl-size");
  var optContrast = $("opt-contrast");
  var optLargeText = $("opt-largetext");
  var optReduceMotion = $("opt-reducemotion");

  function isTouch() {
    return ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  }
  function applySettings() {
    document.body.classList.toggle("contrast", !!settings.contrast);
    document.body.classList.toggle("large-text", !!settings.largetext);
    document.body.classList.toggle("reduced-motion", !!settings.reducemotion);
    document.body.classList.toggle("controls-compact", settings.controlsize === "compact");
    document.body.classList.toggle("controls-large", settings.controlsize === "large");

    var scheme = settings.scheme || "auto";
    var show = scheme !== "off" && (scheme !== "auto" || isTouch());
    touchControls.hidden = !show;
    document.body.classList.toggle("controls-on", show);
    dpad.style.display = (show && scheme === "tap") ? "none" : "";
    tapEnabled = show && scheme === "tap";

    fitGameFrame();
    updateControlsHint();

    if (ctrlScheme) ctrlScheme.value = scheme;
    if (ctrlSize) ctrlSize.value = settings.controlsize || "comfortable";
    if (optContrast) optContrast.checked = !!settings.contrast;
    if (optLargeText) optLargeText.checked = !!settings.largetext;
    if (optReduceMotion) optReduceMotion.checked = !!settings.reducemotion;
  }

  if (ctrlScheme) ctrlScheme.addEventListener("change", function () {
    settings.scheme = ctrlScheme.value; persistSettings(); applySettings(); focusGame();
  });
  if (ctrlSize) ctrlSize.addEventListener("change", function () {
    settings.controlsize = ctrlSize.value; persistSettings(); applySettings(); focusGame();
  });
  function bindToggle(el, prop) {
    if (!el) return;
    el.addEventListener("change", function () {
      settings[prop] = el.checked; persistSettings(); applySettings();
    });
  }
  bindToggle(optContrast, "contrast");
  bindToggle(optLargeText, "largetext");
  bindToggle(optReduceMotion, "reducemotion");

  applySettings();

  // ----------------------------------------------------- Settings dialog
  var settingsDlg = $("settings");
  var menuBtn = $("menu-btn");
  if (menuBtn && settingsDlg) {
    menuBtn.addEventListener("click", function () {
      updateSaveState();
      updateOfflineState();
      updateStorageState();
      if (settingsDlg.showModal) settingsDlg.showModal();
      this.blur();
    });
    settingsDlg.addEventListener("close", focusGame);
  }

  // ----------------------------------------------------- Save management
  function readSaveCount() {
    try {
      var data = FS.readFile(SAVE_DIR + "/powder.sav");
      if (!data || data.length < 8) return null;
      if (String.fromCharCode(data[0], data[1], data[2], data[3], data[4], data[5]) !== "POWDER") {
        return null;
      }
      return data[7];
    } catch (e) {
      return null;
    }
  }
  function updateSaveState() {
    if (!saveStateEl) return;
    if (!ready || typeof FS === "undefined") {
      saveStateEl.textContent = "Checking save state…";
      return;
    }
    var count = readSaveCount();
    if (count === null) {
      saveStateEl.textContent = "No saved data in this browser yet.";
    } else if (count === 0) {
      saveStateEl.textContent = "No active run to Load. Scores and settings are still saved.";
    } else if (count === 1) {
      saveStateEl.textContent = "Active run saved. Reload and choose Load to resume.";
    } else {
      saveStateEl.textContent = "Active run saved after a prior Load; POWDER may mark it as save-scummed.";
    }
  }
  function exportSave() {
    try {
      var data = FS.readFile(SAVE_DIR + "/powder.sav");
      var blob = new Blob([data], { type: "application/octet-stream" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "powder.sav";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (e) {
      alert("No saved game to export yet — start a game first.");
    }
  }
  function importSave(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        FS.writeFile(SAVE_DIR + "/powder.sav", new Uint8Array(reader.result));
        FS.syncfs(false, function () { location.reload(); });
      } catch (e) { alert("Import failed: " + e); }
    };
    reader.readAsArrayBuffer(file);
  }
  function resetStorage() {
    if (!confirm("Erase all saved games and settings in this browser? This cannot be undone.")) return;
    try {
      FS.readdir(SAVE_DIR).forEach(function (f) {
        if (f !== "." && f !== "..") { try { FS.unlink(SAVE_DIR + "/" + f); } catch (e) {} }
      });
    } catch (e) {}
    try { localStorage.removeItem(SETTINGS_KEY); } catch (e) {}
    if (typeof FS !== "undefined" && FS.syncfs) FS.syncfs(false, function () { location.reload(); });
    else location.reload();
  }
  var importInput = $("import-file");
  if ($("save-export")) $("save-export").addEventListener("click", exportSave);
  if ($("save-import")) $("save-import").addEventListener("click", function () { importInput && importInput.click(); });
  if (importInput) importInput.addEventListener("change", function () {
    if (importInput.files && importInput.files[0]) importSave(importInput.files[0]);
  });
  if ($("save-reset")) $("save-reset").addEventListener("click", resetStorage);

  // ----------------------------------------------------- Quick start
  function maybeShowQuickstart() {
    if (!quickstart) return;
    try {
      if (localStorage.getItem(QUICKSTART_KEY)) return;
    } catch (e) {}
    quickstart.hidden = false;
  }
  if (quickstartDismiss && quickstart) {
    quickstartDismiss.addEventListener("click", function () {
      quickstart.hidden = true;
      try { localStorage.setItem(QUICKSTART_KEY, "1"); } catch (e) {}
      focusGame();
    });
  }

  // ----------------------------------------------------- Offline / install
  var installPromptEvent = null;
  var installBtns = [installTopBtn, installSettingsBtn].filter(Boolean);
  function setInstallButtonsVisible(visible) {
    installBtns.forEach(function (btn) { btn.hidden = !visible; });
  }
  function isStandaloneApp() {
    return window.matchMedia("(display-mode: standalone)").matches ||
           window.navigator.standalone === true;
  }
  function maybeShowInstallButtons() {
    setInstallButtonsVisible(!isStandaloneApp());
  }
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    installPromptEvent = e;
    maybeShowInstallButtons();
  });
  installBtns.forEach(function (installBtn) {
    installBtn.addEventListener("click", function () {
      if (!installPromptEvent) {
        if (installHelpDlg && installHelpDlg.showModal) installHelpDlg.showModal();
        else alert("To install on Android Chrome, open the browser menu and choose Install app or Add to Home screen.");
        return;
      }
      installPromptEvent.prompt();
      installPromptEvent.userChoice.finally(function () {
        installPromptEvent = null;
        setInstallButtonsVisible(false);
        focusGame();
      });
    });
  });
  window.addEventListener("appinstalled", function () {
    installPromptEvent = null;
    setInstallButtonsVisible(false);
  });
  maybeShowInstallButtons();
  function updateOfflineState() {
    if (!offlineStateEl) return;
    if (!("caches" in window)) {
      offlineStateEl.textContent = "Offline cache is not available in this browser.";
      return;
    }
    caches.match("powder.wasm?v=" + ASSET_VERSION).then(function (hit) {
      offlineStateEl.textContent = hit ?
        "Offline cache ready: the app shell and WebAssembly are cached." :
        "Offline cache is warming up. Leave this page open until loading finishes.";
    }).catch(function () {
      offlineStateEl.textContent = "Offline cache status is unavailable.";
    });
  }
  function updateStorageState() {
    if (!storageStateEl) return;
    if (!navigator.storage || !navigator.storage.persisted) {
      storageStateEl.textContent = "Persistent storage status is unavailable.";
      return;
    }
    navigator.storage.persisted().then(function (persisted) {
      storageStateEl.textContent = persisted ?
        "Browser storage is persistent." :
        "Browser storage is usable, but the browser may evict it under storage pressure.";
    }).catch(function () {
      storageStateEl.textContent = "Persistent storage status is unavailable.";
    });
  }

  // ----------------------------------------------------- Fullscreen
  var fsBtn = $("fullscreen-btn");
  var appEl = $("app");
  if (fsBtn) fsBtn.addEventListener("click", function () {
    var d = document;
    var active = d.fullscreenElement || d.webkitFullscreenElement;
    if (!active && appEl) {
      var req = appEl.requestFullscreen || appEl.webkitRequestFullscreen;
      if (req) req.call(appEl);
    } else {
      var exit = d.exitFullscreen || d.webkitExitFullscreen;
      if (exit) exit.call(d);
    }
    this.blur(); focusGame();
  });

  // ------------------------------------------ Stop game keys scrolling page
  var SCROLL_KEYS = {
    ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1,
    " ": 1, Spacebar: 1, PageUp: 1, PageDown: 1, Home: 1, End: 1
  };
  window.addEventListener("keydown", function (e) {
    if (settingsDlg && settingsDlg.open) return;
    var ae = document.activeElement;
    if (ae && (ae.tagName === "BUTTON" || ae.tagName === "INPUT" || ae.tagName === "SELECT")) return;
    if (SCROLL_KEYS[e.key]) e.preventDefault();
  }, { capture: true });

  canvas.addEventListener("mousedown", focusGame);

  // ----------------------------------------------------- PWA service worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js")
        .then(function () { return navigator.serviceWorker.ready; })
        .then(updateOfflineState)
        .catch(function (e) {
          console.warn("[powder] service worker registration failed:", e);
          updateOfflineState();
        });
    });
  }
})();
