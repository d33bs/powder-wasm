/*
 * POWDER Web -- Emscripten / WebAssembly platform entry point.
 *
 * This is a NEW platform backend added for the browser build.  It mirrors
 * port/linux/linuxmain.cpp exactly: POWDER's own main() (in ../../main.cpp)
 * is compiled under the name gba_main() and invoked from a thin real main().
 *
 * The POWDER engine sources themselves are unmodified upstream 1.18; the only
 * port-specific C++ change lives in ../sdl/hamfake.cpp (Asyncify-friendly
 * event wait).  Persistent-save filesystem setup (IDBFS) is performed by the
 * web shell (web/app.js) via Module.preRun before main() runs.
 *
 * See ../../LICENSE.TXT and the project NOTICE.md / LICENSE-NOTES.md for the
 * original POWDER license (CC Sampling Plus 1.0) and attribution to Jeff Lait.
 */

#include <SDL.h>

#ifdef main
#undef main
#endif
#define main gba_main

#include "../../main.cpp"

#undef main

#ifdef __EMSCRIPTEN__
#include <emscripten.h>

// Browser autosave hook (called from the web shell, web/app.js).
//
// POWDER only writes a "loadable" save (savecount >= 1) on a clean quit or via
// the in-game Save menu; abruptly closing a browser tab would otherwise lose
// progress. This mirrors the Android suspend path (which calls saveGame(true))
// and is NOT a gameplay change -- it is platform save behaviour.
//
// Safety: with -sASYNCIFY the engine only yields to JS while idle inside
// hamfake_awaitEvent() (between turns), so this runs at a quiescent point.
// saveGame() performs synchronous serialization and never unwinds, so calling
// it here does not disturb the parked main loop. It is a no-op unless a real
// game is in progress.
extern "C" EMSCRIPTEN_KEEPALIVE void
powder_autosave()
{
    MOB *avatar = MOB::getAvatar();
    if (avatar && avatar->getHP() > 0 && !glbTutorial)
        saveGame(true);
}

// Queue POWDER's native Command Menu shortcut. Sending an uppercase key via
// browser KeyboardEvent is unreliable in SDL 1's Emscripten shim because its
// Unicode value depends on separately tracked modifier state. Going through
// POWDER's keyboard queue preserves the normal in-game menu and input flow.
extern "C" EMSCRIPTEN_KEEPALIVE void
powder_open_action_menu()
{
    hamfake_insertKeyPress('V');
}

// Queue POWDER's native inventory shortcut through the same path as the
// Actions button. This avoids mixing browser KeyboardEvent synthesis with
// direct engine queue insertion when mobile users press Actions and Inventory
// back-to-back.
extern "C" EMSCRIPTEN_KEEPALIVE void
powder_open_inventory()
{
    hamfake_insertKeyPress('i');
}
#endif

int
main(int argc, char **argv)
{
    // POWDER's main loop runs until the browser tab goes away.  With
    // -sEXIT_RUNTIME=0 the runtime stays alive and Asyncify keeps the
    // single-threaded game loop cooperative (see ../sdl/hamfake.cpp).
#ifdef __EMSCRIPTEN__
    EM_ASM({
        if (typeof window !== 'undefined' &&
            typeof window.__powderMainStarted === 'function')
            window.__powderMainStarted();
    });
#endif
    gba_main();

    SDL_Quit();

    return 0;
}
