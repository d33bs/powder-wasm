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
| **1. Engine compiles & launches in the browser** | ✅ Done — title screen renders, new game starts, keyboard works |
| **2. Save / load** | 🟡 Working — autosaves to IndexedDB and resumes via the **Load** menu (verified play → reload → resume). Import/export UI still planned |
| 3. Touch controls + responsive layout | ⏳ Planned |
| 4. PWA: offline + installable | ⏳ Planned |
| 5. Accessibility | ⏳ Planned |
| 6. Public release polish | ⏳ Planned |

## How it works

POWDER already abstracts its platform layer (a "fake HAM" over SDL). This port
adds a new **Emscripten** backend alongside the existing ones (Linux, DS, GBA, …)
rather than changing the game:

- The engine is compiled with `em++` against Emscripten's built-in **SDL1**.
- POWDER's blocking input/frame loop is made browser-cooperative with
  **Asyncify** (`emscripten_sleep`) — no engine rewrite.
- The build is **single-threaded**, so it works on GitHub Pages (which cannot
  send the COOP/COEP headers that WASM threads would require).
- Saves use **IndexedDB** via Emscripten's **IDBFS**.
- POWDER's own `support/` tools bake tiles/rooms/encyclopedia into the binary,
  so the deployable site is just `index.html`, `powder.js`, `powder.wasm`, and
  the shell assets.

## Repository layout

```
engine/                 POWDER 1.18 source (vendored verbatim) + the new port
  port/emscripten/        new: Emscripten entry point + Makefile
  port/sdl/hamfake.cpp    modified: #ifdef __EMSCRIPTEN__ browser yield only
web/                    browser shell (index.html, app.js, style.css) + build output
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
./scripts/build.sh
```

This (1) builds POWDER's native support tools, (2) generates the compiled-in game
data, (3) compiles the engine to `powder.js` + `powder.wasm` with `em++`, and (4)
stages the output into `web/`.

## Run locally

The WASM must be served over HTTP (not `file://`):

```bash
python3 scripts/serve.py          # serves web/ at http://127.0.0.1:8765
```

Then open <http://127.0.0.1:8765>.

## Deploy

Pushing to `main` triggers
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which installs
Emscripten, runs `scripts/build.sh`, and publishes `web/` to GitHub Pages. Enable
it once under **Settings → Pages → Source: GitHub Actions**.

## Controls (desktop, Milestone 1)

| Action | Key |
|--------|-----|
| Move | Arrow keys / WASD |
| Confirm | Enter |
| Wait | Space |
| Inventory | `i` |
| Pick up | `g` |
| Menu / back | Esc |

Touch controls for mobile arrive in Milestone 3.

## Saving

Your game is **autosaved** to your browser's IndexedDB (via Emscripten IDBFS)
every few seconds and whenever you leave/hide the tab — so closing the tab
won't lose progress. When you come back, choose **Load** on the title screen to
resume. (This mirrors POWDER's own Android suspend-save; the save format and
mechanics are unchanged.) Saves are per-browser; cloud/export is a stretch goal.

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
