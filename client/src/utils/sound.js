/**
 * Web Audio API sound helpers for turn countdown alerts.
 * Safely degrades to a no-op when AudioContext is unavailable (e.g. jsdom tests).
 */

let sharedAudioContext = null;
let unlockBound = false;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (typeof Ctx !== 'function') return null;
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new Ctx();
  }
  return sharedAudioContext;
}

/**
 * Registers a passive one-time interaction listener so browsers allow Web Audio
 * playback even if the countdown enters <= 5s while the user is idle.
 */
export function ensureAudioUnlocked() {
  if (typeof window === 'undefined' || unlockBound) return;
  unlockBound = true;
  const unlock = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        ctx.resume().catch(() => {});
      }
    } catch {}
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

/**
 * Plays a short crisp "tít" beep for the last 5 seconds of the countdown.
 * Uses a slightly brighter tone when <= 1s remaining.
 *
 * @param {number} [secondsLeft=5]
 */
export function playCountdownBeep(secondsLeft = 5) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const isFinal = typeof secondsLeft === 'number' && secondsLeft <= 1;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isFinal ? 1046.5 : 880, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  } catch {}
}
