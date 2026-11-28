import { useState, useEffect, useRef } from 'react';
import { playCountdownBeep } from '../utils/sound.js';

/**
 * Tracks remaining whole seconds until `turnDeadline` (epoch ms) using 100ms
 * sampling so transitions never skip or double-stall, and optionally plays
 * the countdown beep once per second for 5..1 seconds remaining.
 *
 * @param {number|null|undefined} turnDeadline
 * @param {{ beepUnderFive?: boolean }} [options]
 * @returns {number|null}
 */
export function useCountdown(turnDeadline, { beepUnderFive = true } = {}) {
  const [prevTurnDeadline, setPrevTurnDeadline] = useState(turnDeadline);
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (
      typeof turnDeadline === 'number' &&
      !Number.isNaN(turnDeadline) &&
      turnDeadline > Date.now()
    ) {
      return Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000));
    }
    return null;
  });

  if (turnDeadline !== prevTurnDeadline) {
    setPrevTurnDeadline(turnDeadline);
    if (
      typeof turnDeadline === 'number' &&
      !Number.isNaN(turnDeadline) &&
      turnDeadline > Date.now()
    ) {
      setSecondsLeft(Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000)));
    } else {
      setSecondsLeft(null);
    }
  }

  useEffect(() => {
    if (
      typeof turnDeadline !== 'number' ||
      Number.isNaN(turnDeadline) ||
      turnDeadline <= Date.now()
    ) {
      setSecondsLeft(null);
      return undefined;
    }

    const computeRemaining = () => {
      const diff = turnDeadline - Date.now();
      return Math.max(0, Math.ceil(diff / 1000));
    };

    setSecondsLeft(computeRemaining());

    const intervalId = setInterval(() => {
      const remaining = computeRemaining();
      setSecondsLeft((prev) => (prev === remaining ? prev : remaining));
      if (remaining <= 0) {
        clearInterval(intervalId);
      }
    }, 100);

    return () => {
      clearInterval(intervalId);
    };
  }, [turnDeadline]);

  const lastBeepKeyRef = useRef(null);
  useEffect(() => {
    if (
      !beepUnderFive ||
      typeof turnDeadline !== 'number' ||
      typeof secondsLeft !== 'number' ||
      secondsLeft < 1 ||
      secondsLeft > 5
    ) {
      return;
    }
    const beepKey = `${turnDeadline}:${secondsLeft}`;
    if (lastBeepKeyRef.current === beepKey) {
      return;
    }
    lastBeepKeyRef.current = beepKey;
    playCountdownBeep(secondsLeft);
  }, [beepUnderFive, secondsLeft, turnDeadline]);

  return secondsLeft;
}
