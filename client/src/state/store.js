import React, { createContext, useContext, useReducer } from 'react';

/**
 * Action type constants for the game store.
 *
 * - room-state-received:
 *   Dispatched when receiving a `room:state` event from server.
 *   Updates `roomState` and derives `screen` (lobby, game, gameOver, or home).
 *
 * - game-state-received:
 *   Dispatched when receiving a `game:state` event from server.
 *   Enforces VERSION_GUARD (rules.md section 6.7): ignores any payload with
 *   version <= current gameState.version, preventing state regressions.
 *
 * - error-received:
 *   Dispatched on server or client error (e.g. `game:error` or failed ack).
 *   Sets the `toast` notification state.
 *
 * - toast-cleared:
 *   Dispatched when a toast notification expires or is dismissed.
 *   Resets `toast` to null.
 *
 * - screen-changed:
 *   Dispatched to explicitly navigate to a specific screen.
 *
 * - locale-changed:
 *   Dispatched when the user switches language ('vi' | 'en').
 */
export const ACTION_TYPES = Object.freeze({
  ROOM_STATE_RECEIVED: 'room-state-received',
  GAME_STATE_RECEIVED: 'game-state-received',
  ERROR_RECEIVED: 'error-received',
  TOAST_CLEARED: 'toast-cleared',
  SCREEN_CHANGED: 'screen-changed',
  LOCALE_CHANGED: 'locale-changed',
});

export const ROOM_STATE_RECEIVED = ACTION_TYPES.ROOM_STATE_RECEIVED;
export const GAME_STATE_RECEIVED = ACTION_TYPES.GAME_STATE_RECEIVED;
export const ERROR_RECEIVED = ACTION_TYPES.ERROR_RECEIVED;
export const TOAST_CLEARED = ACTION_TYPES.TOAST_CLEARED;
export const SCREEN_CHANGED = ACTION_TYPES.SCREEN_CHANGED;
export const LOCALE_CHANGED = ACTION_TYPES.LOCALE_CHANGED;

/**
 * Initial state shape:
 * - screen: 'home' | 'lobby' | 'game' | 'gameOver'
 * - roomState: mirrors section 6.5 `room:state` payload, null when not in a room
 * - gameState: mirrors section 6.6 `game:state` payload, null when no game active
 * - locale: 'vi' | 'en', defaults to 'vi'
 * - toast: error/notification payload or null
 */
export const initialState = Object.freeze({
  screen: 'home',
  roomState: null,
  gameState: null,
  locale: 'vi',
  toast: null,
});

/**
 * Approach for `screen`:
 * `screen` is maintained as an explicit state property initialized to 'home'.
 * We automatically derive `screen` from `roomState.status` whenever `room-state-received`
 * is dispatched:
 *   - roomState === null -> 'home'
 *   - roomState.status === 'lobby' -> 'lobby'
 *   - roomState.status === 'playing' -> 'game'
 *   - roomState.status === 'finished' -> 'gameOver'
 * In addition, explicit manual screen transitions can be performed at any time
 * via the 'screen-changed' action.
 *
 * Reducer function is a pure, independent function with no React hooks inside,
 * making it testable in isolation without a DOM or renderer.
 *
 * @param {typeof initialState} state
 * @param {{ type: string, payload?: any, [key: string]: any }} action
 * @returns {typeof initialState}
 */
export function reducer(state = initialState, action) {
  if (!action || typeof action !== 'object') {
    return state;
  }

  switch (action.type) {
    case 'room-state-received':
    case 'ROOM_STATE_RECEIVED': {
      const roomState = action.payload !== undefined ? action.payload : action.roomState ?? null;
      let screen = state.screen;
      if (!roomState) {
        screen = 'home';
      } else if (roomState.status === 'lobby') {
        screen = 'lobby';
      } else if (roomState.status === 'playing') {
        screen = 'game';
      } else if (roomState.status === 'finished') {
        screen = 'gameOver';
      }
      return {
        ...state,
        roomState,
        screen,
      };
    }

    case 'game-state-received':
    case 'GAME_STATE_RECEIVED': {
      const nextGameState = action.payload !== undefined
        ? action.payload
        : (action.gameState !== undefined ? action.gameState : null);

      if (!nextGameState) {
        return state;
      }

      // VERSION_GUARD per rules.md section 6.7:
      // "Client bỏ qua bản có version nhỏ hơn bản đang giữ"
      // If client already holds a gameState with a version,
      // ignore incoming gameState with lower or equal version (return same state unchanged).
      if (
        state.gameState &&
        typeof state.gameState.version === 'number' &&
        typeof nextGameState.version === 'number' &&
        nextGameState.version <= state.gameState.version
      ) {
        return state;
      }

      return {
        ...state,
        gameState: nextGameState,
      };
    }

    case 'error-received':
    case 'ERROR_RECEIVED': {
      let toast = null;
      if (action.payload !== undefined) {
        toast = action.payload;
      } else if (action.error !== undefined) {
        toast = action.error;
      } else if (action.message !== undefined || action.code !== undefined) {
        toast = action.code ? { code: action.code, message: action.message } : action.message;
      } else {
        toast = action;
      }
      return {
        ...state,
        toast,
      };
    }

    case 'toast-cleared':
    case 'TOAST_CLEARED': {
      if (state.toast === null) {
        return state;
      }
      return {
        ...state,
        toast: null,
      };
    }

    case 'screen-changed':
    case 'SCREEN_CHANGED': {
      const nextScreen = action.payload !== undefined ? action.payload : action.screen;
      if (!nextScreen || nextScreen === state.screen) {
        return state;
      }
      return {
        ...state,
        screen: nextScreen,
      };
    }

    case 'locale-changed':
    case 'LOCALE_CHANGED': {
      const nextLocale = action.payload !== undefined ? action.payload : action.locale;
      if (!nextLocale || nextLocale === state.locale) {
        return state;
      }
      return {
        ...state,
        locale: nextLocale,
      };
    }

    default:
      return state;
  }
}

/**
 * React Context for the store.
 */
const createCtx = createContext || React?.createContext;
export const StoreContext = typeof createCtx === 'function' ? createCtx(null) : null;

/**
 * StoreProvider component wraps children with the StoreContext.
 *
 * @param {{ children: React.ReactNode, initial?: typeof initialState, initialState?: typeof initialState }} props
 */
export function StoreProvider({ children, initial = initialState, initialState: customInitial }) {
  const reducerHook = useReducer || React?.useReducer;
  const [state, dispatch] = reducerHook(reducer, customInitial || initial);
  const createElement = React?.createElement;
  const Provider = StoreContext ? StoreContext.Provider : null;
  return createElement(Provider, { value: [state, dispatch] }, children);
}

/**
 * useStore hook returns [state, dispatch] pair from StoreContext.
 *
 * @returns {[typeof initialState, React.Dispatch<any>]}
 */
export function useStore() {
  const contextHook = useContext || React?.useContext;
  const context = contextHook(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
