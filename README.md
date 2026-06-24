# POWDER Web

A browser-based, mobile-friendly, installable port of **POWDER** — Jeff Lait's
classic roguelike — compiled to **WebAssembly** with Emscripten. It runs entirely
in the browser with **no backend**, and deploys automatically to GitHub Pages.

> POWDER is created by **Jeff Lait**. This is an **unofficial** port of POWDER
> 1.18 and is not affiliated with or endorsed by him. The game engine is
> unmodified — this is a *port*, not a fork. See [`NOTICE.md`](NOTICE.md) and
> [`LICENSE-NOTES.md`](LICENSE-NOTES.md).

**Play:** https://d33bs.github.io/powder-wasm/ (after the first deploy)

---

## Status

| Milestone | State |
|-----------|-------|
| **1. Engine compiles & launches** | ✅ Title screen, new game, keyboard — verified |
| **2. Save / load** | ✅ Autosave → IndexedDB → resume via **Load**, plus Export / Import / Reset in the menu |
| **3. Touch controls + responsive** | ✅ 8-way D-pad + action buttons, or tap/swipe to move; portrait & landscape |
| **4. PWA: offline + installable** | ✅ Web manifest + service worker (full app shell cached for offline), app icons |
| **5. Accessibility** | ✅ High-contrast, larger-text, reduced-motion, 44px targets, always-visible controls help |
| **6. Public release** | ✅ Docs, attribution, GitHub Pages workflow |

## How it works

POWDER already abstracts its platform layer (a "fake HAM" over SDL). This port
adds a new **Emscripten** backend alongside the existing ones (Linux, DS, GBA, …)
rather than changing the game:

- The engine is compiled with `em++` against Emscripten's built-in **SDL1**.
- POWDER's blocking input/frame loop is made browser-cooperative with
  **Asyncify** (`emscripten_sleep`) — no engine rewrite.
- The build is **single-threaded**, so it works on GitHub Pages (which cannot
  send the COOP/COEP headers that WASM threads would require).
- Saves use **IndexedDB** via Emscripten's **IDBFS**; the shell adds autosave on
  top so a tab-close never loses progress.
- Touch controls and tap/swipe are translated into the same key events POWDER
  reads on the keyboard, so the engine sees identical input.
- A **service worker** caches the app shell + WebAssembly for offline play, and a
  **web manifest** makes it installable.
- POWDER's own `support/` tools bake tiles/rooms/encyclopedia into the binary,
  so the deployable site is just the shell plus `powder.js` / `powder.wasm`.

## Repository layout

```
engine/                 POWDER 1.18 source (vendored verbatim) + the new port
  port/emscripten/        new: Emscripten entry point + Makefile (+ autosave hook)
  port/sdl/hamfake.cpp    modified: browser yield + SDL canvas pixel format
web/                    browser shell + build output
  index.html app.js style.css   shell (UI, touch controls, settings, saves)
  manifest.webmanifest          PWA manifest
  service-worker.js             offline cache (app shell + wasm)
  assets/                       app icons
  powder.js powder.wasm         build output (git-ignored; produced by build.sh)
scripts/
  build.sh                one-shot build: host tools -> data-gen -> em++ -> web/
  serve.py                static dev server (correct application/wasm MIME)
.github/workflows/      CI: build the WASM and deploy web/ to GitHub Pages
NOTICE.md, LICENSE-NOTES.md, LICENSE
```

## Prerequisites

- **Emscripten SDK** (`emsdk`) — install per
  <https://emscripten.org/docs/getting_started/downloads.html>. By default the
  build looks in `~/emsdk`; override with `EMSDK=/path/to/emsdk`.
- A **native C++ compiler** (clang or gcc) and **GNU make** — used to build
  POWDER's host-side `support/` tools.
- **Python 3** — only for the local dev server.

## Build

```bash
make build
```

This (1) builds POWDER's native support tools, (2) generates the compiled-in game
data, (3) compiles the engine to `powder.js` + `powder.wasm` with `em++`, and (4)
stages the output into `web/`.

## Run locally

The WASM must be served over HTTP (not `file://`):

```bash
make serve                        # serves web/ at http://127.0.0.1:8765
```

Then open <http://127.0.0.1:8765>.

`make preview` builds and serves in one command. Rerunning `make serve` or
`make preview` safely replaces this project's previous preview server; use
`make stop` to stop it explicitly. Override the port with, for example,
`make serve PORT=8766`.

## Deploy

Pushing to `main` triggers
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which installs
Emscripten, runs `scripts/build.sh`, and publishes `web/` to GitHub Pages. Enable
it once under **Settings → Pages → Source: GitHub Actions**.

## Controls

**Desktop (keyboard):**

| Action | Key |
|--------|-----|
| Move (8-way) | Arrow keys / WASD / numpad 1-9 |
| Confirm | Enter |
| Wait | `5` / Space |
| Inventory | `i` |
| Pick up | `g` |
| Command menu (keyboard) | `V` |
| Back / cancel | Esc |

**Touch (phones/tablets):** on-screen controls appear automatically. Open the
menu (**☰**) → *Controls* to choose:

- **D-pad + buttons** — an 8-way pad plus Confirm / Get / Inventory / Menu.
- **Tap / swipe to move** — tap or swipe toward an adjacent tile to step; tap
  the centre to wait. Action buttons remain on screen.

There's also a **fullscreen** button (**⛶**). Touch input is delivered to the
engine as the same key events the keyboard produces, so gameplay is identical.
Use **Actions** to open POWDER's in-game Command Menu, then move through the
list and press **OK** to choose an action such as Search. Use **Back** to cancel
the current prompt or return from the menu. Hold a movement arrow to keep
walking, or hold **Wait** to pass turns, after a short delay. Tap either for a
single turn.

## Settings, saves & PWA

Open the menu (**☰**) for:

- **Display & accessibility** — high contrast, larger text, reduced motion.
- **Saves** — your game **autosaves** to your browser's IndexedDB (via IDBFS)
  every few seconds and when you leave the tab, so closing it won't lose
  progress; reload and choose **Load** to resume. You can also **Export** a
  `.sav` file, **Import** one, or **Reset storage**. (Autosave mirrors POWDER's
  own Android suspend-save; the save format and mechanics are unchanged.)

**Install:** POWDER Web is a Progressive Web App — your browser will offer
"Install" / "Add to Home Screen". After the first complete load it works
**offline**: the service worker caches the full app and WebAssembly, and the app
requests persistent browser storage to reduce automatic eviction. Saves are
per-browser. Private-browsing modes may still discard storage when closed.

## License & attribution

POWDER Web bundles two licensing layers:

- **`engine/`** — POWDER © 2003–2009 Jeff Lait, under **Creative Commons Sampling
  Plus 1.0** ([`engine/COPYING`](engine/COPYING),
  [`engine/LICENSE.TXT`](engine/LICENSE.TXT)).
- **Everything else** (`web/`, `scripts/`, `.github/`) — MIT
  ([`LICENSE`](LICENSE)).

Full details, component licenses, and the exact list of porting changes are in
[`LICENSE-NOTES.md`](LICENSE-NOTES.md). Original project:
<https://www.zincland.com/powder/>.
