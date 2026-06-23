#!/usr/bin/env bash
#
# POWDER Web -- build the WebAssembly engine and stage it into web/.
#
# POWDER's own two-stage build model:
#   1. Build the NATIVE host support tools and run the data-generation
#      ("premake") step.  These emit C++ source (tiles, rooms, encyclopedia,
#      glbdef, license/credits text) that is compiled INTO the engine.
#   2. Compile + link the engine to powder.js / powder.wasm with em++.
#
# Requires the Emscripten SDK (default ~/emsdk).  Override with EMSDK=/path.
# The POWDER engine sources under engine/ are upstream 1.18; the only
# port-specific change is engine/port/{emscripten,sdl/hamfake.cpp}.

set -euo pipefail

# --- locations -------------------------------------------------------------
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE="$ROOT/engine"
WEB="$ROOT/web"
EMSDK="${EMSDK:-$HOME/emsdk}"

HOST_CXX="${HOST_CXX:-clang++}"
HOST_CC="${HOST_CC:-clang}"
WASM_CXXFLAGS="${WASM_CXXFLAGS:--O2}"

# --- emscripten env --------------------------------------------------------
# Prefer an em++ already on PATH (e.g. CI's setup-emsdk action); otherwise
# activate a local emsdk install (default ~/emsdk, override with EMSDK=).
if command -v em++ >/dev/null 2>&1; then
  echo "==> Using em++ already on PATH ($(command -v em++))"
elif [ -f "$EMSDK/emsdk_env.sh" ]; then
  echo "==> Activating Emscripten SDK ($EMSDK)"
  # shellcheck disable=SC1091
  source "$EMSDK/emsdk_env.sh" >/dev/null 2>&1
else
  echo "ERROR: em++ not on PATH and no Emscripten SDK at $EMSDK" >&2
  echo "       Install emsdk (https://emscripten.org) or set EMSDK=/path/to/emsdk" >&2
  exit 1
fi
em++ --version | head -1

# --- stage 1: native support tools ----------------------------------------
SUPPORT_TOOLS="map2c tile2c bmp2c encyclopedia2c enummaker txt2c"
echo "==> Building native support tools: $SUPPORT_TOOLS"
for tool in $SUPPORT_TOOLS; do
  make -C "$ENGINE/support/$tool" CXX="$HOST_CXX" CC="$HOST_CC" clean >/dev/null 2>&1 || true
  make -C "$ENGINE/support/$tool" CXX="$HOST_CXX" CC="$HOST_CC"
done

# --- stage 2: generate compiled-in data ------------------------------------
echo "==> Generating game data (rooms, tiles, encyclopedia, glbdef, license)"
( cd "$ENGINE/rooms" && bash buildrooms.bash )
( cd "$ENGINE/gfx"   && bash rebuild.sh )
( cd "$ENGINE" \
    && support/enummaker/enummaker source.txt \
    && support/txt2c/txt2c LICENSE.TXT license.cpp \
    && support/txt2c/txt2c CREDITS.TXT credits.cpp \
    && support/encyclopedia2c/encyclopedia2c encyclopedia.txt )

# --- stage 3: build the wasm engine ---------------------------------------
echo "==> Compiling engine to WebAssembly (em++, CXXFLAGS=$WASM_CXXFLAGS)"
make -C "$ENGINE/port/emscripten" clean >/dev/null 2>&1 || true
make -C "$ENGINE/port/emscripten" CXXFLAGS="$WASM_CXXFLAGS"

# --- stage 4: stage into web/ ---------------------------------------------
echo "==> Staging powder.js / powder.wasm into web/"
mkdir -p "$WEB"
cp "$ENGINE/port/emscripten/powder.js"   "$WEB/powder.js"
cp "$ENGINE/port/emscripten/powder.wasm" "$WEB/powder.wasm"

echo "==> Build complete:"
ls -la "$WEB/powder.js" "$WEB/powder.wasm"
