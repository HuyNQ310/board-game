import { useState, useEffect, useRef, useCallback } from 'react';

const STUN_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const EMPTY_PLAYERS = [];
const VAD_POLL_INTERVAL_MS = 120;
const VAD_RMS_THRESHOLD = 0.025;
const VAD_SILENCE_HOLD_TICKS = 2;

function checkMicSupported() {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof window !== 'undefined' &&
    typeof window.RTCPeerConnection === 'function'
  );
}

function mapGetUserMediaError(err) {
  const name = err?.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'MIC_PERMISSION_DENIED';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'MIC_NOT_FOUND';
  }
  return 'MIC_ERROR';
}

function toMutedSet(mutedVoiceIds) {
  if (!mutedVoiceIds) return new Set();
  if (mutedVoiceIds instanceof Set) {
    return new Set(Array.from(mutedVoiceIds, String));
  }
  if (Array.isArray(mutedVoiceIds)) {
    return new Set(mutedVoiceIds.map(String));
  }
  return new Set();
}

function normalizePeersPayload(peers) {
  if (!peers) return {};
  const normalized = {};
  if (Array.isArray(peers)) {
    for (const item of peers) {
      const id = item?.playerId ?? item?.id;
      if (!id) continue;
      normalized[String(id)] = {
        micOn: Boolean(item.micOn),
        speaking: Boolean(item.speaking),
      };
    }
    return normalized;
  }
  if (typeof peers === 'object') {
    for (const [id, status] of Object.entries(peers)) {
      if (!id) continue;
      normalized[String(id)] = {
        micOn: Boolean(status?.micOn),
        speaking: Boolean(status?.speaking),
      };
    }
  }
  return normalized;
}

function applyAudioMute(audioEl, muted) {
  if (!audioEl) return;
  const isMuted = Boolean(muted);
  audioEl.muted = isMuted;
  audioEl.volume = isMuted ? 0 : 1;
}

function createManagedAudioElement(muted) {
  if (typeof document === 'undefined') return null;
  const audioEl = document.createElement('audio');
  audioEl.autoplay = true;
  audioEl.playsInline = true;
  audioEl.setAttribute?.('playsinline', '');
  applyAudioMute(audioEl, muted);
  return audioEl;
}

function cleanupPeerEntry(entry) {
  if (!entry) return;
  if (entry.pc) {
    entry.pc.onicecandidate = null;
    entry.pc.ontrack = null;
    entry.pc.onnegotiationneeded = null;
    entry.pc.oniceconnectionstatechange = null;
    entry.pc.onconnectionstatechange = null;
    try {
      entry.pc.close?.();
    } catch {
      // Ignore errors while closing peer connection
    }
  }
  if (entry.audioEl) {
    try {
      entry.audioEl.pause?.();
      entry.audioEl.srcObject = null;
      entry.audioEl.remove?.();
    } catch {
      // Ignore errors while cleaning up audio element
    }
  }
}

function getConnectedOpponentIds(players, myPlayerId) {
  const myIdStr = myPlayerId != null ? String(myPlayerId) : null;
  const ids = new Set();
  if (!Array.isArray(players)) return ids;
  for (const peer of players) {
    if (!peer || peer.id == null) continue;
    const peerId = String(peer.id);
    if (myIdStr && peerId === myIdStr) continue;
    if (peer.connected === false) continue;
    ids.add(peerId);
  }
  return ids;
}

/**
 * Browser microphone capture, Web Audio VAD, and WebRTC mesh voice chat hook.
 *
 * @param {object} params
 * @param {object|null} params.socket
 * @param {string|null} params.roomCode
 * @param {string|null} params.myPlayerId
 * @param {Array<object>} [params.players]
 * @param {Set<string>|Array<string>} [params.mutedVoiceIds]
 * @param {(code: string) => void} [params.onError]
 * @returns {{ micOn: boolean, micBusy: boolean, micSupported: boolean, voicePeers: Record<string, { micOn: boolean, speaking: boolean }>, toggleMic: () => Promise<void>, stopMic: () => void }}
 */
export function useVoiceChat({
  socket,
  roomCode,
  myPlayerId,
  players = EMPTY_PLAYERS,
  mutedVoiceIds,
  onError,
} = {}) {
  const micSupported = checkMicSupported();

  const [micOn, setMicOn] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [voicePeers, setVoicePeers] = useState({});

  const socketRef = useRef(socket);
  const roomCodeRef = useRef(roomCode);
  const myPlayerIdRef = useRef(myPlayerId);
  const playersRef = useRef(players);
  const onErrorRef = useRef(onError);
  const mutedSetRef = useRef(toMutedSet(mutedVoiceIds));

  socketRef.current = socket;
  roomCodeRef.current = roomCode;
  myPlayerIdRef.current = myPlayerId;
  playersRef.current = players;
  onErrorRef.current = onError;

  const micOnRef = useRef(false);
  const micBusyRef = useRef(false);
  const speakingRef = useRef(false);
  const localStreamRef = useRef(null);
  const vadCleanupRef = useRef(null);
  const peersRef = useRef(new Map());
  const micAttemptIdRef = useRef(0);
  const lastEmittedStatusRef = useRef({ micOn: false, speaking: false });
  const hasPlayerListRef = useRef(false);

  const emitVoiceStatus = useCallback((nextMicOn, nextSpeaking, { force = false } = {}) => {
    const prev = lastEmittedStatusRef.current;
    if (!force && prev.micOn === nextMicOn && prev.speaking === nextSpeaking) {
      return;
    }
    lastEmittedStatusRef.current = { micOn: nextMicOn, speaking: nextSpeaking };
    socketRef.current?.emit('voice:status', {
      micOn: nextMicOn,
      speaking: nextSpeaking,
    });
  }, []);

  const stopVad = useCallback(() => {
    if (vadCleanupRef.current) {
      vadCleanupRef.current();
      vadCleanupRef.current = null;
    }
    speakingRef.current = false;
  }, []);

  const startLocalVad = useCallback(
    (stream) => {
      stopVad();
      try {
        if (typeof window === 'undefined') return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (typeof AudioCtx !== 'function') return;

        const audioCtx = new AudioCtx();
        if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
          audioCtx.resume().catch(() => {});
        }
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);

        const binCount = analyser.frequencyBinCount || 256;
        const dataArray = new Uint8Array(binCount);
        let silenceTicks = 0;

        const intervalId = setInterval(() => {
          if (!micOnRef.current) return;
          try {
            if (typeof analyser.getByteTimeDomainData !== 'function') return;
            analyser.getByteTimeDomainData(dataArray);
            let sumSq = 0;
            for (let i = 0; i < dataArray.length; i += 1) {
              const normalized = (dataArray[i] - 128) / 128;
              sumSq += normalized * normalized;
            }
            const rms = Math.sqrt(sumSq / dataArray.length);
            if (rms > VAD_RMS_THRESHOLD) {
              silenceTicks = 0;
              if (!speakingRef.current) {
                speakingRef.current = true;
                emitVoiceStatus(true, true);
              }
            } else {
              silenceTicks += 1;
              if (speakingRef.current && silenceTicks >= VAD_SILENCE_HOLD_TICKS) {
                speakingRef.current = false;
                emitVoiceStatus(true, false);
              }
            }
          } catch {
            // Ignore transient analyser errors
          }
        }, VAD_POLL_INTERVAL_MS);

        vadCleanupRef.current = () => {
          clearInterval(intervalId);
          try {
            source.disconnect?.();
          } catch {
            // Ignore disconnect errors
          }
          try {
            analyser.disconnect?.();
          } catch {
            // Ignore disconnect errors
          }
          try {
            if (typeof audioCtx.close === 'function' && audioCtx.state !== 'closed') {
              audioCtx.close().catch?.(() => {});
            }
          } catch {
            // Ignore close errors
          }
        };
      } catch {
        // AudioContext unavailable or blocked; mic continues without local VAD
      }
    },
    [emitVoiceStatus, stopVad]
  );

  const negotiateWithPeer = useCallback(async (peerId, entry) => {
    if (!entry?.pc || entry.makingOffer) return;
    try {
      entry.makingOffer = true;
      const offer = await entry.pc.createOffer();
      await entry.pc.setLocalDescription(offer);
      const description = entry.pc.localDescription || offer;
      socketRef.current?.emit('voice:signal', {
        to: peerId,
        type: description?.type || 'offer',
        description,
      });
    } catch {
      // Ignore negotiation errors during disconnect/glare
    } finally {
      entry.makingOffer = false;
    }
  }, []);

  const ensurePeerConnection = useCallback((peerId) => {
    const id = String(peerId);
    const existing = peersRef.current.get(id);
    if (existing) return existing;
    if (typeof window === 'undefined' || typeof window.RTCPeerConnection !== 'function') {
      return null;
    }

    const pc = new window.RTCPeerConnection(STUN_CONFIG);
    const entry = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      pendingCandidates: [],
      sender: null,
      audioEl: null,
      remoteStream: null,
    };
    peersRef.current.set(id, entry);

    pc.onicecandidate = (event) => {
      if (event?.candidate && socketRef.current) {
        socketRef.current.emit('voice:signal', {
          to: id,
          type: 'candidate',
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const stream =
        event?.streams?.[0] ||
        (typeof window !== 'undefined' &&
        typeof window.MediaStream === 'function' &&
        event?.track
          ? new window.MediaStream([event.track])
          : null);
      entry.remoteStream = stream;

      const isMuted = mutedSetRef.current.has(id);
      if (!entry.audioEl) {
        entry.audioEl = createManagedAudioElement(isMuted);
      }
      if (entry.audioEl) {
        entry.audioEl.srcObject = stream;
        applyAudioMute(entry.audioEl, isMuted);
        if (typeof entry.audioEl.play === 'function') {
          const playResult = entry.audioEl.play();
          if (playResult && typeof playResult.catch === 'function') {
            playResult.catch(() => {});
          }
        }
      }
    };

    pc.onnegotiationneeded = () => {
      if (micOnRef.current && localStreamRef.current) {
        negotiateWithPeer(id, entry);
      }
    };

    return entry;
  }, [negotiateWithPeer]);

  const attachLocalStreamToPeer = useCallback(
    async (peerId, stream) => {
      const entry = ensurePeerConnection(peerId);
      if (!entry?.pc) return;

      const track = stream?.getAudioTracks?.()[0] || stream?.getTracks?.()[0] || null;
      if (!track) return;

      const senders = typeof entry.pc.getSenders === 'function' ? entry.pc.getSenders() : [];
      const existingSender =
        entry.sender || senders.find((s) => s?.track?.kind === 'audio') || null;

      if (existingSender && typeof existingSender.replaceTrack === 'function') {
        if (existingSender.track !== track) {
          try {
            await existingSender.replaceTrack(track);
          } catch {
            // Fall through if replaceTrack fails
          }
        }
        entry.sender = existingSender;
        return;
      }

      if (typeof entry.pc.addTrack === 'function') {
        const sender = entry.pc.addTrack(track, stream);
        entry.sender = sender || entry.sender;
        await negotiateWithPeer(peerId, entry);
      }
    },
    [ensurePeerConnection, negotiateWithPeer]
  );

  const stopMic = useCallback(() => {
    micAttemptIdRef.current += 1;
    stopVad();

    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getTracks?.() || [];
      for (const track of tracks) {
        try {
          track.stop?.();
        } catch {
          // Ignore track stop errors
        }
      }
      localStreamRef.current = null;
    }

    for (const entry of peersRef.current.values()) {
      if (entry.sender && typeof entry.sender.replaceTrack === 'function') {
        try {
          const result = entry.sender.replaceTrack(null);
          if (result && typeof result.catch === 'function') {
            result.catch(() => {});
          }
        } catch {
          // Ignore replaceTrack errors
        }
      } else if (entry.sender && typeof entry.pc?.removeTrack === 'function') {
        try {
          entry.pc.removeTrack(entry.sender);
          entry.sender = null;
        } catch {
          // Ignore removeTrack errors
        }
      }
    }

    micOnRef.current = false;
    micBusyRef.current = false;
    setMicOn(false);
    setMicBusy(false);

    if (lastEmittedStatusRef.current.micOn || lastEmittedStatusRef.current.speaking) {
      emitVoiceStatus(false, false);
    }
  }, [emitVoiceStatus, stopVad]);

  const teardownAllPeers = useCallback(() => {
    stopMic();
    for (const entry of peersRef.current.values()) {
      cleanupPeerEntry(entry);
    }
    peersRef.current.clear();
    hasPlayerListRef.current = false;
    setVoicePeers({});
  }, [stopMic]);

  const toggleMic = useCallback(async () => {
    if (micBusyRef.current) return;

    if (micOnRef.current) {
      stopMic();
      return;
    }

    if (!checkMicSupported()) {
      onErrorRef.current?.('MIC_UNSUPPORTED');
      return;
    }

    if (!roomCodeRef.current || !myPlayerIdRef.current) {
      return;
    }

    const attemptId = ++micAttemptIdRef.current;
    micBusyRef.current = true;
    setMicBusy(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (
        attemptId !== micAttemptIdRef.current ||
        !roomCodeRef.current ||
        !myPlayerIdRef.current
      ) {
        const staleTracks = stream?.getTracks?.() || [];
        for (const track of staleTracks) {
          track.stop?.();
        }
        micBusyRef.current = false;
        setMicBusy(false);
        return;
      }

      localStreamRef.current = stream;
      micOnRef.current = true;
      micBusyRef.current = false;
      setMicOn(true);
      setMicBusy(false);

      emitVoiceStatus(true, false);
      startLocalVad(stream);

      const opponentIds = getConnectedOpponentIds(
        playersRef.current,
        myPlayerIdRef.current
      );
      for (const peerId of opponentIds) {
        await attachLocalStreamToPeer(peerId, stream);
      }
    } catch (err) {
      micBusyRef.current = false;
      setMicBusy(false);
      if (attemptId === micAttemptIdRef.current) {
        onErrorRef.current?.(mapGetUserMediaError(err));
      }
    }
  }, [attachLocalStreamToPeer, emitVoiceStatus, startLocalVad, stopMic]);

  // Apply mutedVoiceIds changes immediately to all managed <audio> elements
  useEffect(() => {
    const nextMutedSet = toMutedSet(mutedVoiceIds);
    mutedSetRef.current = nextMutedSet;
    for (const [peerId, entry] of peersRef.current.entries()) {
      if (entry.audioEl) {
        applyAudioMute(entry.audioEl, nextMutedSet.has(peerId));
      }
    }
  }, [mutedVoiceIds]);

  // Sync peer connections when connected player list changes
  useEffect(() => {
    if (!roomCode || !myPlayerId) return;

    if (Array.isArray(players) && players.length > 0) {
      hasPlayerListRef.current = true;
    }

    const connectedIds = getConnectedOpponentIds(players, myPlayerId);

    if (hasPlayerListRef.current) {
      for (const [peerId, entry] of peersRef.current.entries()) {
        if (!connectedIds.has(peerId)) {
          cleanupPeerEntry(entry);
          peersRef.current.delete(peerId);
        }
      }
    }

    if (micOnRef.current && localStreamRef.current) {
      for (const peerId of connectedIds) {
        attachLocalStreamToPeer(peerId, localStreamRef.current);
      }
    }
  }, [players, roomCode, myPlayerId, attachLocalStreamToPeer]);

  // Socket signaling & voice:peers synchronization
  useEffect(() => {
    if (!socket || !roomCode || !myPlayerId) {
      teardownAllPeers();
      return undefined;
    }

    const handleVoicePeers = (payload) => {
      const peers = payload?.peers ?? payload;
      setVoicePeers(normalizePeersPayload(peers));
    };

    const handleVoiceSignal = async (payload) => {
      if (!payload || payload.from == null) return;
      const peerId = String(payload.from);
      if (myPlayerIdRef.current != null && peerId === String(myPlayerIdRef.current)) {
        return;
      }

      let entry = peersRef.current.get(peerId);
      if (!entry) {
        entry = ensurePeerConnection(peerId);
        if (!entry) return;
        if (micOnRef.current && localStreamRef.current) {
          const track =
            localStreamRef.current.getAudioTracks?.()[0] ||
            localStreamRef.current.getTracks?.()[0];
          if (track && typeof entry.pc.addTrack === 'function') {
            entry.sender = entry.pc.addTrack(track, localStreamRef.current) || null;
          }
        }
      }

      const { pc } = entry;
      const signalType = payload.type || payload.description?.type;

      try {
        if (signalType === 'offer' || signalType === 'answer') {
          const description = payload.description || {
            type: signalType,
            sdp: payload.sdp,
          };
          const isOffer = signalType === 'offer';
          const isPolite = String(myPlayerIdRef.current ?? '') < peerId;
          const readyForOffer =
            !entry.makingOffer &&
            (pc.signalingState === 'stable' ||
              pc.signalingState === undefined ||
              entry.isSettingRemoteAnswerPending);
          const offerCollision = isOffer && !readyForOffer;

          entry.ignoreOffer = !isPolite && offerCollision;
          if (entry.ignoreOffer) {
            return;
          }

          entry.isSettingRemoteAnswerPending = signalType === 'answer';
          try {
            await pc.setRemoteDescription(description);
          } finally {
            entry.isSettingRemoteAnswerPending = false;
          }

          if (
            entry.pendingCandidates.length > 0 &&
            typeof pc.addIceCandidate === 'function'
          ) {
            const queued = entry.pendingCandidates.splice(0, entry.pendingCandidates.length);
            for (const cand of queued) {
              try {
                await pc.addIceCandidate(cand);
              } catch {
                // Ignore invalid/stale ICE candidate
              }
            }
          }

          if (isOffer) {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            const localDesc = pc.localDescription || answer;
            socketRef.current?.emit('voice:signal', {
              to: peerId,
              type: localDesc?.type || 'answer',
              description: localDesc,
            });
          }
        } else if (signalType === 'candidate' || payload.candidate) {
          const candidate = payload.candidate;
          if (!candidate) return;
          try {
            await pc.addIceCandidate(candidate);
          } catch {
            if (!entry.ignoreOffer && !pc.remoteDescription) {
              entry.pendingCandidates.push(candidate);
            }
          }
        }
      } catch {
        // Ignore transient signaling errors
      }
    };

    const handleConnect = () => {
      socket.emit('voice:sync');
      if (micOnRef.current) {
        emitVoiceStatus(true, speakingRef.current, { force: true });
      }
    };

    socket.on('voice:peers', handleVoicePeers);
    socket.on('voice:signal', handleVoiceSignal);
    socket.on('connect', handleConnect);
    socket.emit('voice:sync');

    return () => {
      socket.off('voice:peers', handleVoicePeers);
      socket.off('voice:signal', handleVoiceSignal);
      socket.off('connect', handleConnect);
      teardownAllPeers();
    };
  }, [socket, roomCode, myPlayerId, ensurePeerConnection, emitVoiceStatus, teardownAllPeers]);

  // Final cleanup on unmount
  useEffect(() => () => teardownAllPeers(), [teardownAllPeers]);

  return {
    micOn,
    micBusy,
    micSupported,
    voicePeers,
    toggleMic,
    stopMic,
  };
}

export default useVoiceChat;
