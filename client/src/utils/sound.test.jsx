// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  playCountdownBeep,
  playCardPlaySound,
  playCardDrawSound,
  playCardDealSound,
} from './sound.js';

describe('sound helpers', () => {
  const origAudioContext = window.AudioContext;

  afterEach(() => {
    window.AudioContext = origAudioContext;
    vi.restoreAllMocks();
  });

  it('degrades cleanly to no-op when AudioContext is unavailable', () => {
    delete window.AudioContext;
    expect(() => playCountdownBeep(5)).not.toThrow();
    expect(() => playCardPlaySound()).not.toThrow();
    expect(() => playCardDrawSound()).not.toThrow();
    expect(() => playCardDealSound(5)).not.toThrow();
  });

  it('synthesizes nodes cleanly for play, draw, deal, and countdown when AudioContext exists', () => {
    const startMock = vi.fn();
    const stopMock = vi.fn();
    const mockCtx = {
      currentTime: 0,
      sampleRate: 44100,
      state: 'running',
      destination: {},
      createOscillator: vi.fn(() => ({
        type: 'sine',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: startMock,
        stop: stopMock,
      })),
      createGain: vi.fn(() => ({
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      })),
      createBiquadFilter: vi.fn(() => ({
        type: 'bandpass',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        Q: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
      })),
      createBuffer: vi.fn(() => ({
        getChannelData: vi.fn(() => new Float32Array(2048)),
      })),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: startMock,
        stop: stopMock,
      })),
    };

    window.AudioContext = vi.fn(() => mockCtx);

    playCountdownBeep(5);
    playCardPlaySound();
    playCardDrawSound();
    playCardDealSound(4);

    // 1 osc beep + (1 noise + 1 thump) play + 1 noise draw + 4 flicks deal = 8 sources started
    expect(startMock).toHaveBeenCalledTimes(8);
    expect(stopMock).toHaveBeenCalledTimes(8);
  });
});
