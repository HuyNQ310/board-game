/**
 * Web Audio API sound helpers for countdown alerts and tabletop card actions.
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

function resumeIfSuspended(ctx) {
  if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
    ctx.resume().catch(() => {});
  }
}

function createNoiseBuffer(ctx, durationSec) {
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/**
 * Registers a passive interaction listener so browsers allow Web Audio
 * playback even if an alert or opponent card action fires while idle.
 */
export function ensureAudioUnlocked() {
  if (typeof window === 'undefined' || unlockBound) return;
  unlockBound = true;
  const unlock = () => {
    try {
      const ctx = getAudioContext();
      resumeIfSuspended(ctx);
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
    resumeIfSuspended(ctx);

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

/**
 * Plays a crisp felt tabletop card-slap sound when playing a card onto DiscardPile.
 */
export function playCardPlaySound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    resumeIfSuspended(ctx);

    const now = ctx.currentTime;

    // 1. Crisp paper snap via bandpass-filtered noise burst
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 0.075);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(420, now + 0.065);
    filter.Q.setValueAtTime(1.1, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.24, now + 0.008);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.075);

    // 2. Soft tabletop thump underneath
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(195, now);
    osc.frequency.exponentialRampToValueAtTime(72, now + 0.07);

    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.exponentialRampToValueAtTime(0.18, now + 0.006);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch {}
}

/**
 * Plays a soft card-slide swoosh when drawing a card.
 */
export function playCardDrawSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    resumeIfSuspended(ctx);

    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 0.09);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 0.08);
    filter.Q.setValueAtTime(1.4, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.09);
  } catch {}
}

/**
 * Plays a crisp staggered flick sequence when dealing initial cards.
 *
 * @param {number} [cardCount=5]
 */
export function playCardDealSound(cardCount = 5) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    resumeIfSuspended(ctx);

    const count = Math.min(Math.max(1, Number(cardCount) || 5), 6);
    const base = ctx.currentTime;

    for (let i = 0; i < count; i++) {
      const startAt = base + i * 0.085;
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx, 0.055);

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(950 + i * 90, startAt);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.095, startAt + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.05);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(startAt);
      noise.stop(startAt + 0.055);
    }
  } catch {}
}
