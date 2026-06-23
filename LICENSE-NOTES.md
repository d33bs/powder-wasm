# License Notes

POWDER Web combines several components under different licenses. This file
documents each one and lists every change made to the upstream POWDER source, so
that attribution and license obligations are clear and verifiable.

---

## 1. The POWDER engine — Creative Commons Sampling Plus 1.0

Everything under [`engine/`](engine/) is POWDER 1.18 by **Jeff Lait**, © 2003–2009,
licensed under **Creative Commons Sampling Plus 1.0**. The authoritative license
text ships with the source: [`engine/COPYING`](engine/COPYING) (source license) and
[`engine/LICENSE.TXT`](engine/LICENSE.TXT) (binary/distribution license). Key points
(paraphrased — the files are authoritative):

- This is **not** an open-source license; the code is **not** "free".
- You **may** redistribute the **unchanged** source **non-commercially**.
- You **may** modify the source "as are technically necessary" to **port** it to
  other platforms or to make it compile, and you may publish those changes.
- You **may not** "fork" the POWDER distribution into a divergent work.
- Attribution to Jeff Lait must be preserved and not obscured.

POWDER Web complies with these terms: it is a **non-commercial port**, the engine
is vendored **unchanged** except for the porting modifications listed in §5, all
license/credit files are preserved, and attribution is shown in-app (the About
dialog and the title screen) and throughout this repository.

> **Hosting:** GitHub Pages hosting of this project is free and non-commercial.

## 2. Mersenne Twister — BSD 3-Clause

`engine/mt19937ar.c` (Makoto Matsumoto and Takuji Nishimura) is under its own
BSD 3-Clause license; see the header at the top of that file. It is used
unchanged.

## 3. SDL — LGPL

Desktop POWDER links **SDL 1.2** (LGPL). The browser build does **not** bundle
SDL: it compiles against the SDL1 implementation **built into the Emscripten
SDK** (`-sUSE_SDL=1`), which is part of the toolchain, not this repository. SDL's
source is available from <https://www.libsdl.org/> and from the original POWDER
download page.

## 4. Tilesets / artwork — separate licenses

The bitmap tilesets under `engine/gfx/` are the work of their respective
creators. In particular, the **Adam Bolt** tileset is copyright Adam Bolt and is
licensed separately (see the POWDER "artpack" distribution). Only the tiles that
ship with the POWDER source distribution are included here; no additional artpack
is bundled.

## 5. POWDER Web shell & tooling — MIT

All original work in this repository — the browser shell ([`web/`](web/)), the
build/serve scripts ([`scripts/`](scripts/)), and the CI/deploy configuration
([`.github/`](.github/)) — is licensed under the MIT License; see
[`LICENSE`](LICENSE). This does **not** cover anything under `engine/`.

---

## 6. Exact changes to the upstream POWDER source

The vendored engine is POWDER 1.18 as published at zincland.com. The **only**
modifications are the technically-necessary porting changes below. No gameplay,
balance, AI, or content file is altered.

**Added (new files — the Emscripten platform backend):**

- `engine/port/emscripten/emmain.cpp` — browser entry point. Mirrors
  `engine/port/linux/linuxmain.cpp` (compiles POWDER's `main()` as `gba_main()`
  and calls it). Also exposes one exported helper, `powder_autosave()`, which
  calls the engine's own `saveGame(true)` — the identical checkpoint POWDER's
  Android suspend path uses. The web shell calls it periodically and when the
  tab is hidden so a browser tab-close doesn't lose progress. This is platform
  save behaviour, not a gameplay change (mechanics, balance, and the save
  format are untouched).
- `engine/port/emscripten/Makefile` — compiles & links the engine with `em++`
  and Emscripten's SDL1 into `powder.js` + `powder.wasm`. Adds the build flag
  `-Wno-c++11-narrowing` (the auto-generated tile/enum tables initialise `u8`
  arrays from high-bit `char` constants — legal in the C++03 POWDER targeted, a
  hard error under modern clang; the byte values are unchanged).

**Modified (one file, guarded by `#ifdef __EMSCRIPTEN__` so the desktop/SDL build
is byte-for-byte unaffected):**

- `engine/port/sdl/hamfake.cpp`
  - `#include <emscripten.h>` (Emscripten only).
  - `hamfake_awaitEvent()` — the browser cannot block the main thread, so the
    blocking `SDL_WaitEvent()` is replaced (Emscripten only) with
    `emscripten_sleep(16)` (requires `-sASYNCIFY`), which yields one frame to the
    browser to deliver input, then drives the VBL frame tick directly.
  - `ham_StartIntHandler()` — skips registering the `SDL_AddTimer()` callback
    under Emscripten (the frame tick is driven from `hamfake_awaitEvent()`
    instead).
  - `rebuildVideoSystemFromGlobals()` and the two screen-scaling functions —
    use Emscripten SDL1's native 32-bit canvas surface and map RGB values into
    its actual pixel format. The desktop path remains packed 24-bit. This
    prevents byte-stride colour corruption in the browser framebuffer.

All other files under `engine/` are upstream-verbatim. Files generated at build
time (`glbdef.cpp`, `license.cpp`, `credits.cpp`, `encyclopedia.cpp`,
`gfx/all_bitmaps.cpp`, `rooms/allrooms.cpp`) are produced by POWDER's own
`support/` tools and are not committed.
