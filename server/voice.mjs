/**
 * Mèo Nổ — Voice Presence & WebRTC Signaling Helpers (ES Module)
 *
 * Pure helpers for managing per-room voice states (`micOn`, `speaking`)
 * and validating/sanitizing WebRTC peer-to-peer signaling payloads.
 */

const VALID_SIGNAL_TYPES = new Set(['offer', 'answer', 'ice', 'candidate']);

/**
 * Ensures `room.voiceStates` is a `Map` (`playerId -> { micOn, speaking }`) and returns it.
 *
 * @param {object} room
 * @returns {Map<string, { micOn: boolean, speaking: boolean }>}
 */
export function ensureVoiceStates(room) {
  if (!room || typeof room !== 'object') {
    return new Map();
  }
  if (!(room.voiceStates instanceof Map)) {
    room.voiceStates = new Map();
  }
  return room.voiceStates;
}

/**
 * Builds a plain object mapping current room `playerId`s to `{ micOn, speaking }`.
 * Returns entries only for players currently present in `room.players`.
 *
 * @param {object} room
 * @returns {Record<string, { micOn: boolean, speaking: boolean }>}
 */
export function toVoicePeersPayload(room) {
  if (!room || !Array.isArray(room.players) || !(room.voiceStates instanceof Map)) {
    return {};
  }

  const currentPlayerIds = new Set();
  for (const player of room.players) {
    if (player && typeof player.id === 'string' && player.id) {
      currentPlayerIds.add(player.id);
    }
  }

  const peers = {};
  for (const [playerId, state] of room.voiceStates.entries()) {
    if (!currentPlayerIds.has(playerId) || !state || typeof state !== 'object') {
      continue;
    }
    peers[playerId] = {
      micOn: Boolean(state.micOn),
      speaking: Boolean(state.speaking),
    };
  }
  return peers;
}

/**
 * Validates room membership for `playerId`, updates their voice state
 * (`speaking` is forced false when `micOn` is false), and returns `toVoicePeersPayload(room)`.
 * Returns `null` if the room or player is invalid.
 *
 * @param {object} room
 * @param {string} playerId
 * @param {{ micOn?: boolean, speaking?: boolean }} [state]
 * @returns {Record<string, { micOn: boolean, speaking: boolean }> | null}
 */
export function setPlayerVoiceState(room, playerId, state = {}) {
  if (!room || typeof room !== 'object' || !Array.isArray(room.players)) {
    return null;
  }
  if (typeof playerId !== 'string' || !playerId) {
    return null;
  }
  const exists = room.players.some((p) => p && p.id === playerId);
  if (!exists) {
    return null;
  }

  const { micOn = false, speaking = false } =
    state && typeof state === 'object' ? state : {};
  const nextMicOn = Boolean(micOn);
  const nextSpeaking = nextMicOn && Boolean(speaking);

  const voiceStates = ensureVoiceStates(room);
  voiceStates.set(playerId, {
    micOn: nextMicOn,
    speaking: nextSpeaking,
  });

  return toVoicePeersPayload(room);
}

/**
 * Removes `playerId` from `room.voiceStates` and returns `toVoicePeersPayload(room)`.
 *
 * @param {object} room
 * @param {string} playerId
 * @returns {Record<string, { micOn: boolean, speaking: boolean }>}
 */
export function clearPlayerVoiceState(room, playerId) {
  if (!room || typeof room !== 'object') {
    return {};
  }
  if (room.voiceStates instanceof Map && typeof playerId === 'string' && playerId) {
    room.voiceStates.delete(playerId);
  }
  return toVoicePeersPayload(room);
}

function sanitizeDescription(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const sanitized = {};
  if (typeof raw.type === 'string') {
    sanitized.type = raw.type;
  }
  if (typeof raw.sdp === 'string') {
    sanitized.sdp = raw.sdp;
  }
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

function sanitizeCandidate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const sanitized = {};
  if (typeof raw.candidate === 'string') {
    sanitized.candidate = raw.candidate;
  }
  if (raw.sdpMid === null || typeof raw.sdpMid === 'string') {
    sanitized.sdpMid = raw.sdpMid;
  }
  if (
    raw.sdpMLineIndex === null ||
    (typeof raw.sdpMLineIndex === 'number' && Number.isFinite(raw.sdpMLineIndex))
  ) {
    sanitized.sdpMLineIndex = raw.sdpMLineIndex;
  }
  if (raw.usernameFragment === null || typeof raw.usernameFragment === 'string') {
    sanitized.usernameFragment = raw.usernameFragment;
  }
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Validates and sanitizes a WebRTC signaling payload between two players in `room`.
 * Returns `{ to, type, description, candidate }` or `null` if invalid.
 *
 * @param {object} room
 * @param {string} senderId
 * @param {object} payload
 * @returns {{ to: string, type: 'offer' | 'answer' | 'ice', description: object | null, candidate: object | null } | null}
 */
export function validateVoiceSignal(room, senderId, payload) {
  if (!room || typeof room !== 'object' || !Array.isArray(room.players)) {
    return null;
  }
  if (typeof senderId !== 'string' || !senderId) {
    return null;
  }
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const to = typeof payload.to === 'string' ? payload.to : '';
  if (!to || to === senderId) {
    return null;
  }

  const hasSender = room.players.some((p) => p && p.id === senderId);
  const hasTarget = room.players.some((p) => p && p.id === to);
  if (!hasSender || !hasTarget) {
    return null;
  }

  if (typeof payload.type !== 'string' || !VALID_SIGNAL_TYPES.has(payload.type)) {
    return null;
  }

  const type = payload.type === 'candidate' ? 'ice' : payload.type;
  return {
    to,
    type,
    description: type === 'ice' ? null : sanitizeDescription(payload.description),
    candidate: type === 'ice' ? sanitizeCandidate(payload.candidate) : null,
  };
}
