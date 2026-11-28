/**
 * Helpers for encouraging automatic landscape orientation on mobile touch devices.
 * Safely degrades to a no-op on desktop browsers and platforms that disallow orientation lock.
 */

let autoLandscapeAttempted = false;

export function isMobileTouchDevice() {
  if (typeof window === 'undefined') return false;
  const coarse =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const smallSide = Math.min(
    window.screen?.width || window.innerWidth,
    window.screen?.height || window.innerHeight
  );
  return Boolean(coarse && smallSide > 0 && smallSide <= 900);
}

/**
 * Attempts fullscreen + landscape orientation lock on mobile touch devices.
 * Must be invoked from or after a user gesture so browsers allow fullscreen/lock.
 */
export async function tryAutoLandscape({ force = false } = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (!isMobileTouchDevice()) return false;
  if (autoLandscapeAttempted && !force) return false;

  const isPortrait = window.innerHeight > window.innerWidth;
  if (!isPortrait && !force) return false;

  autoLandscapeAttempted = true;

  try {
    const docEl = document.documentElement;
    if (
      !document.fullscreenElement &&
      docEl &&
      typeof docEl.requestFullscreen === 'function'
    ) {
      await docEl.requestFullscreen().catch(() => {});
    }
  } catch {}

  try {
    if (
      window.screen?.orientation &&
      typeof window.screen.orientation.lock === 'function'
    ) {
      await window.screen.orientation.lock('landscape').catch(() => {});
      return true;
    }
  } catch {}

  return false;
}
