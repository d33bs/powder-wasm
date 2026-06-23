# POWDER Web -- Emscripten / WebAssembly engine build.
#
# Mirrors port/linux/Makefile, but compiles & links the engine with em++ and
# Emscripten's built-in SDL1 (-sUSE_SDL=1), producing powder.js + powder.wasm.
#
# IMPORTANT: this Makefile builds ONLY the wasm engine.  The native host
# support tools (../../support/*) and the data-generation "premake" step must
# be run FIRST with the native compiler -- scripts/build.sh handles that
# staging and then invokes this Makefile.  (Running `make premake` here would
# wrongly try to build the host tools with em++.)

TARGET = powder.js

CXX = em++

# Compile-time flags.  -DLINUX selects the Un*x/SDL code paths (POWDER treats
# Emscripten as a Linux-like SDL target); __EMSCRIPTEN__ is predefined by em++.
# -Wno-c++11-narrowing: the auto-generated tile/enum tables (glbdef.cpp,
# all_bitmaps.cpp, ...) initialise u8 arrays from high-bit char constants like
# '\207'; legal in the C++03 POWDER targeted, a narrowing error under modern
# clang.  Suppressing it is a technically-necessary porting flag (no behaviour
# change -- the byte values are identical).
EM_CFLAGS = -DLINUX -I ../../port/sdl -sUSE_SDL=1 -Wno-c++11-narrowing

# Link-time flags:
#   ASYNCIFY        - let POWDER's blocking input/frame loop yield to the browser
#   IDBFS           - persistent (IndexedDB-backed) saves
#   FORCE_FILESYSTEM- keep FS available for the IDBFS mount done from JS
#   EXIT_RUNTIME=0  - POWDER's main loop never returns; keep the runtime alive
EM_LFLAGS = -sUSE_SDL=1 \
	    -sASYNCIFY \
	    -sASYNCIFY_STACK_SIZE=131072 \
	    -sALLOW_MEMORY_GROWTH=1 \
	    -sFORCE_FILESYSTEM=1 \
	    -lidbfs.js \
	    -sEXIT_RUNTIME=0 \
	    -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,callMain,FS,IDBFS,addRunDependency,removeRunDependency

OFILES = emmain.o \
	 ../sdl/hamfake.o \
	 ../../action.o \
	 ../../assert.o \
	 ../../ai.o \
	 ../../artifact.o \
	 ../../bmp.o \
	 ../../build.o \
	 ../../buf.o \
	 ../../control.o \
	 ../../creature.o \
	 ../../dpdf_table.o \
	 ../../encyc_support.o \
	 ../../gfxengine.o \
	 ../../grammar.o \
	 ../../hiscore.o \
	 ../../input.o \
	 ../../intrinsic.o \
	 ../../item.o \
	 ../../map.o \
	 ../../mobref.o \
	 ../../msg.o \
	 ../../name.o \
	 ../../piety.o \
	 ../../rand.o \
	 ../../signpost.o \
	 ../../smokestack.o \
	 ../../speed.o \
	 ../../sramstream.o \
	 ../../stylus.o \
	 ../../victory.o \
	 ../../encyclopedia.o \
	 ../../glbdef.o \
	 ../../credits.o \
	 ../../license.o \
	 ../../gfx/all_bitmaps.o \
	 ../../rooms/allrooms.o

all: $(TARGET)

$(TARGET): $(OFILES)
	$(CXX) -o $(TARGET) $(OFILES) $(EM_LFLAGS) $(CXXFLAGS) $(LDFLAGS)

.cpp.o:
	$(CXX) $(EM_CFLAGS) -c $< -o $@ $(CXXFLAGS)

clean:
	$(RM) $(OFILES)
	$(RM) $(TARGET) powder.wasm
