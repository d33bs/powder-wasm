# powder-wasm

**powder-wasm** is a browser-playable version of **POWDER**, Jeff Lait’s classic
roguelike. It runs on desktop and mobile, can be installed like an app, and
works offline after the first complete load.

**Play:** <https://d33bs.github.io/powder-wasm/>

> POWDER was created by **Jeff Lait**. This is an **unofficial** WebAssembly
> port of POWDER 1.18 and is not affiliated with or endorsed by him. The game
> engine is preserved as POWDER; this project adds the browser shell, controls,
> saving, installability, and deployment packaging.

## What to expect

POWDER is a traditional roguelike: movement is grid-based, choices matter, and
death is permanent. If your character dies, that run is over. Loading is meant
to resume an active run, not undo death.

This browser version adds:

- Desktop keyboard play.
- Mobile-friendly on-screen controls.
- Autosave through browser storage.
- Installable app behavior on supported browsers.
- Offline play after the app has been cached.
- Export/import options for save files.

## Playing

Open the game in a browser. On desktop, use the keyboard. On touch devices, the
on-screen controls appear automatically.

### Desktop controls

| Action | Key |
| --- | --- |
| Move | Arrow keys, WASD, or numpad |
| Wait | `5` or Space |
| Confirm | Enter |
| Back / cancel | Esc |
| Inventory | `i` |
| Pick up item | `g` |
| Command menu | `V` |

### Mobile controls

The on-screen buttons cover the common actions:

- **D-pad**: move.
- **Center dot**: wait.
- **OK**: confirm.
- **Get**: pick up an item.
- **Inv**: inventory.
- **Actions**: open POWDER’s in-game command menu for commands like Search,
  Open, Close, Swap, and similar actions.
- **Back**: cancel prompts or return from menus.

Movement and wait buttons support press-and-hold repeat after a short delay.

## Saves, death, and loading

The game autosaves to your browser’s local storage area while you play and when
you leave the page. Reloading the page and choosing **Load** resumes an active
run when one exists.

Important roguelike behavior:

- If your character fully dies, Load is disabled for that dead run.
- Quitting after death should not preserve a loadable save.
- Saves are per browser and per device unless you export/import them manually.
- Private browsing modes may delete saves when the browser closes.

Use the settings menu to export, import, or reset browser save storage.

## Installing and offline play

On supported browsers, use **Install**, **Add to Home Screen**, or your browser’s
app-install prompt. After the first complete load, the app shell and WebAssembly
files are cached for offline use.

Offline behavior still depends on the browser:

- The first load requires network access.
- Installed/offline use should work after the service worker cache is populated.
- Browsers can evict storage under pressure, though the app requests persistent
  storage when available.

## Settings

The settings menu includes:

- Control scheme selection.
- Control/button sizing.
- High contrast.
- Larger text.
- Reduced motion.
- Save export/import/reset.
- Install button when supported by the browser.

## About this port

The original POWDER engine is compiled to WebAssembly with Emscripten. The
browser layer provides the page UI, touch controls, persistent browser saves,
offline caching, and GitHub Pages packaging.

The deployable site is static: there is no backend server.

## Local preview for contributors

You only need this section if you are changing the project.

Prerequisites:

- Emscripten SDK (`emsdk`)
- A native C++ compiler and GNU make
- Python 3

Common commands:

```bash
make                 # show available commands
make serve           # serve existing web/ build at http://127.0.0.1:8765
make preview         # build, then serve
make build           # build powder.js and powder.wasm
make stop            # stop the managed preview server
```

The WebAssembly build must be served over HTTP; do not open `web/index.html`
directly with `file://`.

## Deployment

The project is designed for GitHub Pages. Pushing to `main` runs
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), builds the
WebAssembly output, and publishes `web/`.

For a new repository, enable Pages under:

**Settings → Pages → Source: GitHub Actions**

## License and attribution

POWDER © 2003–2009 Jeff Lait. The bundled POWDER source in `engine/` is under
Creative Commons Sampling Plus 1.0; see [`engine/COPYING`](engine/COPYING) and
[`engine/LICENSE.TXT`](engine/LICENSE.TXT).

The browser port code outside `engine/` is MIT licensed; see [`LICENSE`](LICENSE).

Additional notes are in [`NOTICE.md`](NOTICE.md) and
[`LICENSE-NOTES.md`](LICENSE-NOTES.md). Original POWDER site:
<https://www.zincland.com/powder/>.
