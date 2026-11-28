import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { io as createIoClient } from 'socket.io-client';

import {
  ensureVoiceStates,
  toVoicePeersPayload,
  setPlayerVoiceState,
  clearPlayerVoiceState,
  validateVoiceSignal,
} from './voice.mjs';

const serverDir = path.dirname(fileURLToPath(import.meta.url));

function makeRoom(playerIds = ['p1', 'p2']) {
  return {
    code: 'ABCDE',
    players: playerIds.map((id, index) => ({
      id,
      name: `Player ${index + 1}`,
      connected: true,
    })),
  };
}

test('ensureVoiceStates initializes and reuses room.voiceStates Map', () => {
  const room = makeRoom();
  const map1 = ensureVoiceStates(room);
  assert.ok(map1 instanceof Map);
  assert.equal(room.voiceStates, map1);

  map1.set('p1', { micOn: true, speaking: false });
  const map2 = ensureVoiceStates(room);
  assert.equal(map2, map1);
  assert.deepEqual(map2.get('p1'), { micOn: true, speaking: false });

  assert.ok(ensureVoiceStates(null) instanceof Map);
});

test('toVoicePeersPayload filters to current room.players and coerces booleans', () => {
  const room = makeRoom(['p1', 'p2']);
  assert.deepEqual(toVoicePeersPayload(room), {});
  assert.deepEqual(toVoicePeersPayload(null), {});

  const states = ensureVoiceStates(room);
  states.set('p1', { micOn: 1, speaking: 0 });
  states.set('p2', { micOn: 1, speaking: 'yes' });
  states.set('stale-player', { micOn: true, speaking: true });

  assert.deepEqual(toVoicePeersPayload(room), {
    p1: { micOn: true, speaking: false },
    p2: { micOn: true, speaking: true },
  });
});

test('setPlayerVoiceState validates membership and forces speaking=false when micOn=false', () => {
  const room = makeRoom(['p1', 'p2']);

  assert.equal(setPlayerVoiceState(null, 'p1', { micOn: true }), null);
  assert.equal(setPlayerVoiceState(room, '', { micOn: true }), null);
  assert.equal(setPlayerVoiceState(room, 'outsider', { micOn: true }), null);

  const peers1 = setPlayerVoiceState(room, 'p1', { micOn: false, speaking: true });
  assert.deepEqual(peers1, {
    p1: { micOn: false, speaking: false },
  });

  const peers2 = setPlayerVoiceState(room, 'p1', { micOn: true, speaking: true });
  assert.deepEqual(peers2, {
    p1: { micOn: true, speaking: true },
  });
});

test('clearPlayerVoiceState deletes entry and returns remaining room peers', () => {
  const room = makeRoom(['p1', 'p2']);
  setPlayerVoiceState(room, 'p1', { micOn: true, speaking: false });
  setPlayerVoiceState(room, 'p2', { micOn: true, speaking: true });

  const afterClear = clearPlayerVoiceState(room, 'p1');
  assert.deepEqual(afterClear, {
    p2: { micOn: true, speaking: true },
  });
  assert.equal(room.voiceStates.has('p1'), false);

  assert.deepEqual(clearPlayerVoiceState(null, 'p1'), {});
});

test('validateVoiceSignal validates sender, target, type, and sanitizes offer/answer/ice', () => {
  const room = makeRoom(['p1', 'p2', 'p3']);

  // Valid offer with extra noise stripped
  const offer = validateVoiceSignal(room, 'p1', {
    to: 'p2',
    type: 'offer',
    description: { type: 'offer', sdp: 'v=0...', extra: 'ignored' },
    candidate: { candidate: 'should-be-nulled' },
  });
  assert.deepEqual(offer, {
    to: 'p2',
    type: 'offer',
    description: { type: 'offer', sdp: 'v=0...' },
    candidate: null,
  });

  // Valid answer
  const answer = validateVoiceSignal(room, 'p2', {
    to: 'p1',
    type: 'answer',
    description: { type: 'answer', sdp: 'v=0-ans' },
  });
  assert.deepEqual(answer, {
    to: 'p1',
    type: 'answer',
    description: { type: 'answer', sdp: 'v=0-ans' },
    candidate: null,
  });

  // Valid ice candidate
  const ice = validateVoiceSignal(room, 'p1', {
    to: 'p3',
    type: 'ice',
    description: { type: 'offer', sdp: 'ignored' },
    candidate: {
      candidate: 'candidate:1 1 UDP 123',
      sdpMid: '0',
      sdpMLineIndex: 0,
      usernameFragment: 'ufrag',
      junk: true,
    },
  });
  assert.deepEqual(ice, {
    to: 'p3',
    type: 'ice',
    description: null,
    candidate: {
      candidate: 'candidate:1 1 UDP 123',
      sdpMid: '0',
      sdpMLineIndex: 0,
      usernameFragment: 'ufrag',
    },
  });

  // Valid candidate alias (normalized to 'ice')
  const candidateAlias = validateVoiceSignal(room, 'p1', {
    to: 'p3',
    type: 'candidate',
    candidate: { candidate: 'candidate:2 1 UDP 456', sdpMid: '0', sdpMLineIndex: 0 },
  });
  assert.deepEqual(candidateAlias, {
    to: 'p3',
    type: 'ice',
    description: null,
    candidate: { candidate: 'candidate:2 1 UDP 456', sdpMid: '0', sdpMLineIndex: 0 },
  });

  // Invalid cases
  assert.equal(validateVoiceSignal(null, 'p1', { to: 'p2', type: 'offer' }), null);
  assert.equal(validateVoiceSignal(room, 'outsider', { to: 'p2', type: 'offer' }), null);
  assert.equal(validateVoiceSignal(room, 'p1', { to: 'p1', type: 'offer' }), null);
  assert.equal(validateVoiceSignal(room, 'p1', { to: 'outsider', type: 'offer' }), null);
  assert.equal(validateVoiceSignal(room, 'p1', { to: 123, type: 'offer' }), null);
  assert.equal(validateVoiceSignal(room, 'p1', { to: 'p2', type: 'bye' }), null);
  assert.equal(validateVoiceSignal(room, 'p1', null), null);
});

test('Socket integration: voice:sync, voice:status, voice:signal, disconnect mute, and leave prune', async () => {
  const port = 43149;
  const srv = spawn('node', [path.join(serverDir, 'index.mjs')], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: ':memory:',
      DISCONNECT_GRACE_MS: '5000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let c1 = null;
  let c2 = null;
  let c3 = null;

  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server failed to start')), 12000);
      srv.stdout.on('data', (chunk) => {
        if (chunk.toString().includes('listening')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      srv.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        if (text.includes('EADDRINUSE')) {
          clearTimeout(timeout);
          reject(new Error(text));
        }
      });
    });

    c1 = createIoClient(`http://localhost:${port}`, { transports: ['websocket'] });
    c2 = createIoClient(`http://localhost:${port}`, { transports: ['websocket'] });
    c3 = createIoClient(`http://localhost:${port}`, { transports: ['websocket'] });

    const emitAck = (client, ev, data) => new Promise((resolve) => client.emit(ev, data, resolve));
    const peers1 = [];
    const peers2 = [];
    const signals1 = [];
    const signals2 = [];
    const signals3 = [];
    const waiters = [];
    const checkWaiters = () => {
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i]()) waiters.splice(i, 1);
      }
    };
    const waitFor = (fn, ms = 4000) =>
      new Promise((resolve, reject) => {
        if (fn()) return resolve();
        const timer = setTimeout(() => reject(new Error('Timed out waiting for voice event')), ms);
        waiters.push(() => {
          if (fn()) {
            clearTimeout(timer);
            resolve();
            return true;
          }
          return false;
        });
      });

    c1.on('voice:peers', (p) => {
      peers1.push(p);
      checkWaiters();
    });
    c2.on('voice:peers', (p) => {
      peers2.push(p);
      checkWaiters();
    });
    c1.on('voice:signal', (s) => {
      signals1.push(s);
      checkWaiters();
    });
    c2.on('voice:signal', (s) => {
      signals2.push(s);
      checkWaiters();
    });
    c3.on('voice:signal', (s) => {
      signals3.push(s);
      checkWaiters();
    });

    await Promise.all([
      new Promise((r) => c1.on('connect', r)),
      new Promise((r) => c2.on('connect', r)),
      new Promise((r) => c3.on('connect', r)),
    ]);

    const cr = await emitAck(c1, 'room:create', { playerId: 'p1', name: 'An' });
    assert.equal(cr.ok, true);
    await emitAck(c2, 'room:join', { playerId: 'p2', name: 'Bình', code: cr.code });
    await emitAck(c3, 'room:join', { playerId: 'p3', name: 'Chi', code: cr.code });

    // voice:sync starts empty
    const syncRes = await emitAck(c1, 'voice:sync', {});
    assert.deepEqual(syncRes, { ok: true, peers: {} });

    // voice:status updates room peers and acks
    const statusRes = await emitAck(c2, 'voice:status', { micOn: true, speaking: true });
    assert.deepEqual(statusRes, {
      ok: true,
      peers: { p2: { micOn: true, speaking: true } },
    });
    await waitFor(() => peers1.some((e) => e.peers?.p2?.micOn === true && e.peers?.p2?.speaking === true));

    // voice:signal forwards only to target peer
    const sigRes = await emitAck(c1, 'voice:signal', {
      to: 'p2',
      type: 'offer',
      description: { type: 'offer', sdp: 'v=0-test' },
    });
    assert.deepEqual(sigRes, { ok: true });
    await waitFor(() => signals2.length === 1);
    assert.deepEqual(signals2[0], {
      from: 'p1',
      type: 'offer',
      description: { type: 'offer', sdp: 'v=0-test' },
      candidate: null,
    });
    assert.equal(signals1.length, 0);
    assert.equal(signals3.length, 0);

    // Invalid signal rejected
    const badSig = await emitAck(c1, 'voice:signal', { to: 'p1', type: 'offer' });
    assert.equal(badSig.ok, false);

    // Disconnect immediately mutes peer in voice:peers
    c2.close();
    c2 = null;
    await waitFor(() =>
      peers1.some((e) => e.peers?.p2?.micOn === false && e.peers?.p2?.speaking === false)
    );

    // Leave prunes player from voice:peers
    await emitAck(c1, 'voice:status', { micOn: true, speaking: false });
    await emitAck(c3, 'voice:status', { micOn: true, speaking: false });
    await emitAck(c3, 'room:leave', {});
    await waitFor(() => {
      const latest = peers1[peers1.length - 1];
      return latest && latest.peers?.p1?.micOn === true && !('p3' in latest.peers);
    });
  } finally {
    c1?.close();
    c2?.close();
    c3?.close();
    srv.kill('SIGKILL');
  }
});
