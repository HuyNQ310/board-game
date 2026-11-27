import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  reducer,
  initialState,
  ACTION_TYPES,
  ROOM_STATE_RECEIVED,
  GAME_STATE_RECEIVED,
  ERROR_RECEIVED,
  TOAST_CLEARED,
  SCREEN_CHANGED,
  LOCALE_CHANGED,
} from './store.js';

describe('store reducer in isolation', () => {
  it('provides the correct initial state shape', () => {
    assert.deepEqual(initialState, {
      screen: 'home',
      roomState: null,
      gameState: null,
      locale: 'vi',
      toast: null,
    });
  });

  describe('game-state-received with VERSION_GUARD (rules.md section 6.7)', () => {
    it('sets initial gameState when gameState is currently null', () => {
      const incomingState = {
        version: 0,
        phase: 'play',
        currentPlayerId: 'player-1',
        turnsLeft: 1,
        players: [],
      };
      const action = {
        type: GAME_STATE_RECEIVED,
        payload: incomingState,
      };
      const nextState = reducer(initialState, action);

      assert.deepEqual(nextState.gameState, incomingState);
      assert.strictEqual(nextState.gameState.version, 0);
    });

    it('replaces gameState when receiving an action with a higher version', () => {
      const currentState = {
        ...initialState,
        gameState: {
          version: 1,
          phase: 'play',
          deckCount: 20,
        },
      };
      const higherState = {
        version: 2,
        phase: 'play',
        deckCount: 19,
      };
      const action = {
        type: 'game-state-received',
        payload: higherState,
      };
      const nextState = reducer(currentState, action);

      assert.deepEqual(nextState.gameState, higherState);
      assert.strictEqual(nextState.gameState.version, 2);
    });

    it('ignores game-state-received action when receiving a lower version (returns unchanged state)', () => {
      const currentGameState = {
        version: 5,
        phase: 'play',
        deckCount: 15,
      };
      const currentState = {
        ...initialState,
        gameState: currentGameState,
      };
      const lowerState = {
        version: 4,
        phase: 'play',
        deckCount: 16,
      };
      const action = {
        type: 'game-state-received',
        payload: lowerState,
      };
      const nextState = reducer(currentState, action);

      // Must return identical state reference (ignored completely), never regressing
      assert.strictEqual(nextState, currentState);
      assert.strictEqual(nextState.gameState.version, 5);
      assert.deepEqual(nextState.gameState, currentGameState);
    });

    it('ignores game-state-received action when receiving an equal version (returns unchanged state)', () => {
      const currentGameState = {
        version: 5,
        phase: 'play',
        deckCount: 15,
      };
      const currentState = {
        ...initialState,
        gameState: currentGameState,
      };
      const equalState = {
        version: 5,
        phase: 'play',
        deckCount: 14,
      };
      const action = {
        type: 'game-state-received',
        payload: equalState,
      };
      const nextState = reducer(currentState, action);

      // Must return identical state reference
      assert.strictEqual(nextState, currentState);
      assert.strictEqual(nextState.gameState.deckCount, 15);
    });

    it('supports gameState property on action object in addition to payload', () => {
      const currentState = {
        ...initialState,
        gameState: { version: 1 },
      };
      const nextState = reducer(currentState, {
        type: 'game-state-received',
        gameState: { version: 3 },
      });

      assert.strictEqual(nextState.gameState.version, 3);
    });
  });

  describe('error-received and toast-cleared', () => {
    it('sets toast when receiving an error-received action with object payload', () => {
      const errorObj = {
        code: 'NOT_YOUR_TURN',
        message: 'Chưa đến lượt bạn',
      };
      const action = {
        type: ERROR_RECEIVED,
        payload: errorObj,
      };
      const nextState = reducer(initialState, action);

      assert.deepEqual(nextState.toast, errorObj);
    });

    it('sets toast when error is passed under error property', () => {
      const action = {
        type: 'error-received',
        error: 'Tên phải từ 1 đến 16 ký tự',
      };
      const nextState = reducer(initialState, action);

      assert.strictEqual(nextState.toast, 'Tên phải từ 1 đến 16 ký tự');
    });

    it('sets toast when code and message are top-level on action', () => {
      const action = {
        type: 'error-received',
        code: 'ROOM_NOT_FOUND',
        message: 'Không tìm thấy phòng',
      };
      const nextState = reducer(initialState, action);

      assert.deepEqual(nextState.toast, {
        code: 'ROOM_NOT_FOUND',
        message: 'Không tìm thấy phòng',
      });
    });

    it('clears toast when receiving a toast-cleared action', () => {
      const stateWithToast = {
        ...initialState,
        toast: { code: 'SERVER_ERROR', message: 'Có lỗi xảy ra' },
      };
      const action = {
        type: TOAST_CLEARED,
      };
      const nextState = reducer(stateWithToast, action);

      assert.strictEqual(nextState.toast, null);
    });

    it('returns unchanged state if toast is already null on toast-cleared', () => {
      const nextState = reducer(initialState, { type: 'toast-cleared' });
      assert.strictEqual(nextState, initialState);
    });
  });

  describe('room-state-received and screen derivation', () => {
    it('updates roomState and transitions screen to lobby when status is lobby', () => {
      const room = { code: 'K7M2Q', status: 'lobby', players: [] };
      const nextState = reducer(initialState, {
        type: ROOM_STATE_RECEIVED,
        payload: room,
      });

      assert.deepEqual(nextState.roomState, room);
      assert.strictEqual(nextState.screen, 'lobby');
    });

    it('transitions screen to game when room status is playing', () => {
      const room = { code: 'K7M2Q', status: 'playing', players: [] };
      const nextState = reducer(initialState, {
        type: 'room-state-received',
        payload: room,
      });

      assert.strictEqual(nextState.screen, 'game');
    });

    it('transitions screen to gameOver when room status is finished', () => {
      const room = { code: 'K7M2Q', status: 'finished', players: [] };
      const nextState = reducer(initialState, {
        type: 'room-state-received',
        payload: room,
      });

      assert.strictEqual(nextState.screen, 'gameOver');
    });

    it('transitions screen to home when roomState is reset to null', () => {
      const activeState = {
        ...initialState,
        roomState: { code: 'K7M2Q', status: 'lobby' },
        screen: 'lobby',
      };
      const nextState = reducer(activeState, {
        type: 'room-state-received',
        payload: null,
      });

      assert.strictEqual(nextState.roomState, null);
      assert.strictEqual(nextState.screen, 'home');
    });
  });

  describe('screen-changed and locale-changed', () => {
    it('updates screen when screen-changed is dispatched', () => {
      const nextState = reducer(initialState, {
        type: SCREEN_CHANGED,
        payload: 'lobby',
      });

      assert.strictEqual(nextState.screen, 'lobby');
    });

    it('returns same state if screen is unchanged', () => {
      const nextState = reducer(initialState, {
        type: 'screen-changed',
        payload: 'home',
      });

      assert.strictEqual(nextState, initialState);
    });

    it('updates locale when locale-changed is dispatched', () => {
      const nextState = reducer(initialState, {
        type: LOCALE_CHANGED,
        payload: 'en',
      });

      assert.strictEqual(nextState.locale, 'en');
    });

    it('returns same state if locale is unchanged', () => {
      const nextState = reducer(initialState, {
        type: 'locale-changed',
        payload: 'vi',
      });

      assert.strictEqual(nextState, initialState);
    });
  });

  describe('default / unknown action handling', () => {
    it('returns unmodified state reference for unknown action type', () => {
      const nextState = reducer(initialState, { type: 'UNKNOWN_ACTION' });
      assert.strictEqual(nextState, initialState);
    });

    it('returns unmodified state when action is invalid or missing', () => {
      assert.strictEqual(reducer(initialState, null), initialState);
      assert.strictEqual(reducer(initialState, undefined), initialState);
    });
  });
});
