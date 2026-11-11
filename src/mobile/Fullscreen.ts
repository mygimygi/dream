/** Fullscreen helper. Browsers only allow entering fullscreen from a user gesture (click/tap/key),
 *  so callers invoke enter() from button handlers. iPhone Safari has no element fullscreen API:
 *  there the game runs fullscreen when added to the home screen (see manifest + meta tags). */
const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
type El = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

export const Fullscreen = {
  supported(): boolean {
    const el = document.documentElement as El;
    return !!(el.requestFullscreen || el.webkitRequestFullscreen);
  },
  active(): boolean { return !!(document.fullscreenElement || doc.webkitFullscreenElement); },
  async enter() {
    if (this.active()) return;
    const el = document.documentElement as El;
    try {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    } catch { /* blocked (e.g. inside an iframe without permission) — the game still runs windowed */ }
    // phones: prefer landscape once fullscreen (ignored where unsupported)
    try {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      if (matchMedia('(pointer:coarse)').matches && o?.lock) await o.lock('landscape');
    } catch { /* not allowed on this device */ }
  },
  async exit() {
    try { if (document.exitFullscreen) await document.exitFullscreen(); else await doc.webkitExitFullscreen?.(); } catch { /* ignore */ }
  },
  toggle() { return this.active() ? this.exit() : this.enter(); },
  onChange(fn: () => void) { document.addEventListener('fullscreenchange', fn); document.addEventListener('webkitfullscreenchange', fn); },
};
