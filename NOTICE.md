# NOTICE

**POWDER** is created by **Jeff Lait**.

This repository ("POWDER Web") is an **unofficial** port that compiles the
original POWDER 1.18 source to WebAssembly so it can run in a web browser. It is
**not** affiliated with or endorsed by Jeff Lait.

- Original game and source: <https://www.zincland.com/powder/>
- Version ported: **POWDER 1.18** (vendored verbatim under [`engine/`](engine/))
- The POWDER engine source is © 2003–2009 Jeff Lait and is used under the
  **Creative Commons Sampling Plus 1.0** license (see
  [`engine/COPYING`](engine/COPYING) and [`engine/LICENSE.TXT`](engine/LICENSE.TXT)).

## What this project is — and is not

This is a **port**, not a fork. The POWDER game engine, AI, combat, items, world
generation, and save format are **unmodified**. No game balance or mechanics have
been changed. The only engine-side changes are the small, technically-necessary
modifications required to compile and run under Emscripten — these are confined
to a new platform backend and are enumerated in
[`LICENSE-NOTES.md`](LICENSE-NOTES.md).

Everything that is *new* in this project — the browser shell, build scripts, and
deployment tooling — is original work and lives outside `engine/`.

## Component licenses (summary)

| Component | License |
|-----------|---------|
| POWDER engine (`engine/`, incl. the Emscripten port changes) | Creative Commons Sampling Plus 1.0 |
| Mersenne Twister RNG (`engine/mt19937ar.c`) | BSD 3-Clause (see its file header) |
| SDL (the browser build uses Emscripten's bundled SDL1) | LGPL |
| Bundled tilesets (`engine/gfx/`) | Per their respective creators; the Adam Bolt tileset is licensed separately |
| POWDER Web shell & tooling (`web/`, `scripts/`, `.github/`) | MIT (see [`LICENSE`](LICENSE)) |

See [`LICENSE-NOTES.md`](LICENSE-NOTES.md) for the full details and the exact list
of porting changes.
