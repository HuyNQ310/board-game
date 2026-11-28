// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useVoiceChat } from './useVoiceChat.js';

function createMockSocket() {
  const listeners = new Map();
  return {
    on: vi.fn((event, cb) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(cb);
    }),
    off: vi.fn((event, cb) => {
      listeners.get(event)?.delete(cb);
    }),
    emit: vi.fn(),
    trigger(event, payload) {
      const set = listeners.get(event);
      if (!set) return;
      for (const cb of [...set]) {
        cb(payload);
      }
    },
  };
}

function createMockTrack(kind = 'audio') {
  return {
    kind,
    stop: vi.fn(),
  };
}

function createMockStream(track = createMockTrack('audio')) {
  return {
    getTracks: vi.fn(() => [track]),
    getAudioTracks: vi.fn(() => [track]),
    _track: track,
  };
}

function setupWebRTCMocks() {
  const peerConnections = [];

  class MockRTCPeerConnection {
    constructor(config) {
      this.config = config;
      this.signalingState = 'stable';
      this.localDescription = null;
      this.remoteDescription = null;
      this._senders = [];
      this.onicecandidate = null;
      this.ontrack = null;
      this.onnegotiationneeded = null;
      this.oniceconnectionstatechange = null;
      this.onconnectionstatechange = null;

      this.addTrack = vi.fn((track) => {
        const sender = {
          track,
          replaceTrack: vi.fn(async (nextTrack) => {
            sender.track = nextTrack;
          }),
        };
        this._senders.push(sender);
        return sender;
      });
      this.getSenders = vi.fn(() => this._senders);
      this.createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'mock-offer-sdp' }));
      this.createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'mock-answer-sdp' }));
      this.setLocalDescription = vi.fn(async (desc) => {
        this.localDescription = desc;
        if (desc?.type === 'offer') {
          this.signalingState = 'have-local-offer';
        } else if (desc?.type === 'answer') {
          this.signalingState = 'stable';
        }
      });
      this.setRemoteDescription = vi.fn(async (desc) => {
        this.remoteDescription = desc;
        if (desc?.type === 'offer') {
          this.signalingState = 'have-remote-offer';
        } else if (desc?.type === 'answer') {
          this.signalingState = 'stable';
        }
      });
      this.addIceCandidate = vi.fn(async () => {});
      this.close = vi.fn(() => {
        this.signalingState = 'closed';
      });

      peerConnections.push(this);
    }
  }

  Object.defineProperty(window, 'RTCPeerConnection', {
    configurable: true,
    writable: true,
    value: MockRTCPeerConnection,
  });

  return { peerConnections, MockRTCPeerConnection };
}

function setupMediaDevicesMock(impl) {
  const getUserMedia = vi.fn(impl);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    writable: true,
    value: { getUserMedia },
  });
  return getUserMedia;
}

describe('useVoiceChat', () => {
  const originalCreateElement = document.createElement.bind(document);
  let createdAudioElements = [];

  beforeEach(() => {
    createdAudioElements = [];
    vi.spyOn(document, 'createElement').mockImplementation((tag, options) => {
      const el = originalCreateElement(tag, options);
      if (String(tag).toLowerCase() === 'audio') {
        el.play = vi.fn(() => Promise.resolve());
        el.pause = vi.fn();
        createdAudioElements.push(el);
      }
      return el;
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete window.RTCPeerConnection;
    delete window.AudioContext;
    delete window.webkitAudioContext;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it('starts with mic OFF, detects support, syncs on mount, and does not request mic automatically', () => {
    setupWebRTCMocks();
    const getUserMedia = setupMediaDevicesMock(async () => createMockStream());
    const socket = createMockSocket();

    const { result } = renderHook(() =>
      useVoiceChat({
        socket,
        roomCode: 'ABCDE',
        myPlayerId: 'p1',
        players: [
          { id: 'p1', connected: true },
          { id: 'p2', connected: true },
        ],
      })
    );

    expect(result.current.micOn).toBe(false);
    expect(result.current.micBusy).toBe(false);
    expect(result.current.micSupported).toBe(true);
    expect(result.current.voicePeers).toEqual({});
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('voice:sync');
  });

  it('reports micSupported=false and calls onError(MIC_UNSUPPORTED) when browser APIs are missing', async () => {
    const socket = createMockSocket();
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useVoiceChat({
        socket,
        roomCode: 'ABCDE',
        myPlayerId: 'p1',
        onError,
      })
    );

    expect(result.current.micSupported).toBe(false);

    await act(async () => {
      await result.current.toggleMic();
    });

    expect(onError).toHaveBeenCalledWith('MIC_UNSUPPORTED');
    expect(result.current.micOn).toBe(false);
  });

  it('turns mic ON, acquires stream with DSP options, emits voice:status, and negotiates with connected opponents only', async () => {
    const { peerConnections } = setupWebRTCMocks();
    const track = createMockTrack();
    const stream = createMockStream(track);
    let resolveGUM;
    const getUserMedia = setupMediaDevicesMock(
      () =>
        new Promise((resolve) => {
          resolveGUM = resolve;
        })
    );
    const socket = createMockSocket();

    const players = [
      { id: 'p1', connected: true },
      { id: 'p2', connected: true },
      { id: 'p3', connected: false },
    ];

    const { result } = renderHook(() =>
      useVoiceChat({
        socket,
        roomCode: 'ABCDE',
        myPlayerId: 'p1',
        players,
      })
    );

    let togglePromise;
    act(() => {
      togglePromise = result.current.toggleMic();
    });

    expect(result.current.micBusy).toBe(true);
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    await act(async () => {
      resolveGUM(stream);
      await togglePromise;
    });

    expect(result.current.micBusy).toBe(false);
    expect(result.current.micOn).toBe(true);
    expect(socket.emit).toHaveBeenCalledWith('voice:status', {
      micOn: true,
      speaking: false,
    });

    // Only p2 is connected opponent
    expect(peerConnections).toHaveLength(1);
    const pc = peerConnections[0];
    expect(pc.config).toEqual({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    expect(pc.addTrack).toHaveBeenCalledWith(track, stream);
    expect(pc.createOffer).toHaveBeenCalled();
    expect(pc.setLocalDescription).toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('voice:signal', {
      to: 'p2',
      type: 'offer',
      description: { type: 'offer', sdp: 'mock-offer-sdp' },
    });
  });

  it('maps getUserMedia errors to MIC_PERMISSION_DENIED, MIC_NOT_FOUND, and MIC_ERROR', async () => {
    setupWebRTCMocks();
    const socket = createMockSocket();
    const onError = vi.fn();

    const err = (name) => Object.assign(new Error(name), { name });

    const getUserMedia = setupMediaDevicesMock(async () => {
      throw err('NotAllowedError');
    });

    const { result } = renderHook(() =>
      useVoiceChat({ socket, roomCode: 'ABCDE', myPlayerId: 'p1', onError })
    );

    await act(async () => {
      await result.current.toggleMic();
    });
    expect(onError).toHaveBeenLastCalledWith('MIC_PERMISSION_DENIED');

    getUserMedia.mockRejectedValueOnce(err('NotFoundError'));
    await act(async () => {
      await result.current.toggleMic();
    });
    expect(onError).toHaveBeenLastCalledWith('MIC_NOT_FOUND');

    getUserMedia.mockRejectedValueOnce(err('AbortError'));
    await act(async () => {
      await result.current.toggleMic();
    });
    expect(onError).toHaveBeenLastCalledWith('MIC_ERROR');
    expect(result.current.micOn).toBe(false);
    expect(result.current.micBusy).toBe(false);
  });

  it('detects voice activity via AudioContext/AnalyserNode and emits speaking changes', async () => {
    vi.useFakeTimers();
    setupWebRTCMocks();
    setupMediaDevicesMock(async () => createMockStream());
    const socket = createMockSocket();

    let sampleByte = 128; // silent baseline
    const mockClose = vi.fn(async () => {});
    class MockAudioContext {
      constructor() {
        this.state = 'running';
        this.close = mockClose;
      }
      createMediaStreamSource() {
        return { connect: vi.fn(), disconnect: vi.fn() };
      }
      createAnalyser() {
        return {
          fftSize: 512,
          smoothingTimeConstant: 0.4,
          frequencyBinCount: 64,
          disconnect: vi.fn(),
          getByteTimeDomainData: (arr) => {
            arr.fill(sampleByte);
          },
        };
      }
    }

    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    });

    const { result } = renderHook(() =>
      useVoiceChat({ socket, roomCode: 'ABCDE', myPlayerId: 'p1' })
    );

    await act(async () => {
      await result.current.toggleMic();
    });

    expect(socket.emit).toHaveBeenCalledWith('voice:status', {
      micOn: true,
      speaking: false,
    });

    // Simulate loud speech
    sampleByte = 190;
    act(() => {
      vi.advanceTimersByTime(130);
    });
    expect(socket.emit).toHaveBeenCalledWith('voice:status', {
      micOn: true,
      speaking: true,
    });

    // Simulate returning to silence (2 ticks hysteresis = 240ms)
    sampleByte = 128;
    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(socket.emit).toHaveBeenLastCalledWith('voice:status', {
      micOn: true,
      speaking: false,
    });

    act(() => {
      result.current.stopMic();
    });
    expect(mockClose).toHaveBeenCalled();
  });

  it('normalizes voice:peers updates from both object maps and arrays', () => {
    setupWebRTCMocks();
    const socket = createMockSocket();

    const { result } = renderHook(() =>
      useVoiceChat({ socket, roomCode: 'ABCDE', myPlayerId: 'p1' })
    );

    act(() => {
      socket.trigger('voice:peers', {
        peers: { p2: { micOn: true, speaking: true } },
      });
    });
    expect(result.current.voicePeers).toEqual({
      p2: { micOn: true, speaking: true },
    });

    act(() => {
      socket.trigger('voice:peers', {
        peers: [{ playerId: 'p3', micOn: true, speaking: false }],
      });
    });
    expect(result.current.voicePeers).toEqual({
      p3: { micOn: true, speaking: false },
    });
  });

  it('receives remote offers while mic is OFF, sends answer, plays remote audio, and respects mutedVoiceIds', async () => {
    const { peerConnections } = setupWebRTCMocks();
    const socket = createMockSocket();

    const { rerender } = renderHook(
      ({ mutedVoiceIds }) =>
        useVoiceChat({
          socket,
          roomCode: 'ABCDE',
          myPlayerId: 'p1',
          mutedVoiceIds,
        }),
      { initialProps: { mutedVoiceIds: new Set(['p2']) } }
    );

    await act(async () => {
      socket.trigger('voice:signal', {
        from: 'p2',
        type: 'offer',
        description: { type: 'offer', sdp: 'remote-sdp' },
      });
    });

    expect(peerConnections).toHaveLength(1);
    const pc = peerConnections[0];
    expect(pc.setRemoteDescription).toHaveBeenCalledWith({
      type: 'offer',
      sdp: 'remote-sdp',
    });
    expect(pc.createAnswer).toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('voice:signal', {
      to: 'p2',
      type: 'answer',
      description: { type: 'answer', sdp: 'mock-answer-sdp' },
    });

    // Deliver remote audio track
    const remoteStream = createMockStream();
    act(() => {
      pc.ontrack?.({ streams: [remoteStream], track: remoteStream._track });
    });

    expect(createdAudioElements).toHaveLength(1);
    const audioEl = createdAudioElements[0];
    expect(audioEl.autoplay).toBe(true);
    expect(audioEl.playsInline).toBe(true);
    expect(audioEl.srcObject).toBe(remoteStream);
    // Initially muted via Set(['p2'])
    expect(audioEl.muted).toBe(true);
    expect(audioEl.volume).toBe(0);

    // Unmute by updating mutedVoiceIds to empty array
    rerender({ mutedVoiceIds: [] });
    expect(audioEl.muted).toBe(false);
    expect(audioEl.volume).toBe(1);

    // Mute again via array ['p2']
    rerender({ mutedVoiceIds: ['p2'] });
    expect(audioEl.muted).toBe(true);
    expect(audioEl.volume).toBe(0);
  });

  it('applies Polite Peer collision rules (polite accepts offer, impolite ignores colliding offer)', async () => {
    const { peerConnections } = setupWebRTCMocks();
    const socketPolite = createMockSocket();

    // Polite peer: 'p1' < 'p2'
    renderHook(() =>
      useVoiceChat({ socket: socketPolite, roomCode: 'ABCDE', myPlayerId: 'p1' })
    );

    // Trigger initial signal or create peer via candidate/offer then put in have-local-offer
    await act(async () => {
      socketPolite.trigger('voice:signal', {
        from: 'p2',
        type: 'candidate',
        candidate: { candidate: 'cand-1' },
      });
    });

    const politePc = peerConnections[0];
    politePc.signalingState = 'have-local-offer';

    await act(async () => {
      socketPolite.trigger('voice:signal', {
        from: 'p2',
        type: 'offer',
        description: { type: 'offer', sdp: 'colliding-offer' },
      });
    });

    expect(politePc.setRemoteDescription).toHaveBeenCalledWith({
      type: 'offer',
      sdp: 'colliding-offer',
    });
    expect(politePc.createAnswer).toHaveBeenCalled();

    // Impolite peer: 'p2' > 'p1'
    const socketImpolite = createMockSocket();
    renderHook(() =>
      useVoiceChat({ socket: socketImpolite, roomCode: 'ABCDE', myPlayerId: 'p2' })
    );

    await act(async () => {
      socketImpolite.trigger('voice:signal', {
        from: 'p1',
        type: 'candidate',
        candidate: { candidate: 'cand-2' },
      });
    });

    const impolitePc = peerConnections[1];
    impolitePc.signalingState = 'have-local-offer';

    await act(async () => {
      socketImpolite.trigger('voice:signal', {
        from: 'p1',
        type: 'offer',
        description: { type: 'offer', sdp: 'colliding-offer-2' },
      });
    });

    expect(impolitePc.setRemoteDescription).not.toHaveBeenCalled();
    expect(impolitePc.createAnswer).not.toHaveBeenCalled();
  });

  it('stops tracks, replaces sender track with null, and emits micOn=false on stopMic; cleans up PCs and audio on room leave or unmount', async () => {
    const { peerConnections } = setupWebRTCMocks();
    const track1 = createMockTrack();
    const stream1 = createMockStream(track1);
    const track2 = createMockTrack();
    const stream2 = createMockStream(track2);

    const getUserMedia = setupMediaDevicesMock(async () => stream1);
    const socket = createMockSocket();

    const { result, rerender, unmount } = renderHook(
      ({ roomCode, players }) =>
        useVoiceChat({
          socket,
          roomCode,
          myPlayerId: 'p1',
          players,
        }),
      {
        initialProps: {
          roomCode: 'ABCDE',
          players: [
            { id: 'p1', connected: true },
            { id: 'p2', connected: true },
          ],
        },
      }
    );

    await act(async () => {
      await result.current.toggleMic();
    });

    const pc = peerConnections[0];
    const sender = pc._senders[0];

    // Attach remote audio element too
    act(() => {
      pc.ontrack?.({ streams: [createMockStream()], track: createMockTrack() });
    });
    const audioEl = createdAudioElements[0];

    // Turn mic OFF via toggleMic
    await act(async () => {
      await result.current.toggleMic();
    });

    expect(result.current.micOn).toBe(false);
    expect(track1.stop).toHaveBeenCalledTimes(1);
    expect(sender.replaceTrack).toHaveBeenCalledWith(null);
    expect(socket.emit).toHaveBeenLastCalledWith('voice:status', {
      micOn: false,
      speaking: false,
    });
    expect(pc.close).not.toHaveBeenCalled();

    // Turn mic back ON -> reuses sender.replaceTrack
    getUserMedia.mockResolvedValueOnce(stream2);
    await act(async () => {
      await result.current.toggleMic();
    });
    expect(sender.replaceTrack).toHaveBeenCalledWith(track2);

    // Leave room (roomCode -> null)
    rerender({
      roomCode: null,
      players: [{ id: 'p1', connected: true }],
    });

    expect(track2.stop).toHaveBeenCalledTimes(1);
    expect(pc.close).toHaveBeenCalledTimes(1);
    expect(audioEl.pause).toHaveBeenCalled();
    expect(audioEl.srcObject).toBeNull();
    expect(result.current.voicePeers).toEqual({});

    unmount();
  });
});
