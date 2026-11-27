/**
 * @file server/timers.mjs
 * Disconnect grace period timers for players (Decision D7, D8, Section 5.4).
 */

export class DisconnectTimers {
  /**
   * @param {object} [scheduler] - Optional injectable scheduler with setTimeout and clearTimeout.
   * Defaults to global timer functions.
   */
  constructor(scheduler = {}) {
    this.scheduler = scheduler;
    this.timers = new Map();
  }

  _scheduleTimeout(fn, ms) {
    if (this.scheduler && typeof this.scheduler.setTimeout === 'function') {
      return this.scheduler.setTimeout(fn, ms);
    }
    return setTimeout(fn, ms);
  }

  _clearScheduledTimeout(id) {
    if (this.scheduler && typeof this.scheduler.clearTimeout === 'function') {
      return this.scheduler.clearTimeout(id);
    }
    return clearTimeout(id);
  }

  /**
   * Starts a disconnect timer for the given key.
   * If a timer already exists for this key, it is cancelled first.
   *
   * @param {string} key - Identifier, e.g. `${roomCode}:${playerId}`
   * @param {() => void} onExpire - Callback executed when timer expires
   * @param {number} [ms=120000] - Duration in ms (default 120 seconds per rules.md D7/D8)
   * @returns {any} The timer handle
   */
  start(key, onExpire, ms = 120000) {
    this.cancel(key);
    const timerId = this._scheduleTimeout(() => {
      this.timers.delete(key);
      if (typeof onExpire === 'function') {
        onExpire();
      }
    }, ms);
    this.timers.set(key, timerId);
    return timerId;
  }

  /**
   * Cancels the disconnect timer for the given key.
   *
   * @param {string} key - The timer key
   * @returns {boolean} True if a timer existed and was cancelled, false otherwise
   */
  cancel(key) {
    if (!this.timers.has(key)) {
      return false;
    }
    const timerId = this.timers.get(key);
    this._clearScheduledTimeout(timerId);
    this.timers.delete(key);
    return true;
  }

  /**
   * Cancels all currently scheduled disconnect timers.
   */
  cancelAll() {
    for (const timerId of this.timers.values()) {
      this._clearScheduledTimeout(timerId);
    }
    this.timers.clear();
  }

  /**
   * Checks if a timer exists for the given key.
   *
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.timers.has(key);
  }

  /**
   * Returns the count of active timers.
   *
   * @returns {number}
   */
  get size() {
    return this.timers.size;
  }
}
