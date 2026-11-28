// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { SeatRing } from './SeatRing.jsx';

const SAMPLE_PLAYERS = [
  { id: 'p1', name: 'An', handCount: 5, alive: true, connected: true },
  { id: 'p2', name: 'Bình', handCount: 4, alive: true, connected: true },
  { id: 'p3', name: 'Chi', handCount: 3, alive: true, connected: true },
];

describe('SeatRing', () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('renders floating chat bubble inside player seat when chatBubbles is passed', () => {
    render(
      <SeatRing
        players={SAMPLE_PLAYERS}
        myPlayerId="p1"
        currentPlayerId="p1"
        chatBubbles={{ p1: { text: 'Hello!' } }}
      />
    );

    const p1Seat = screen.getByTestId('seat-p1');
    const bubble = screen.getByTestId('chat-bubble-p1');
    expect(bubble).toBeDefined();
    expect(bubble.textContent).toContain('Hello!');
    expect(p1Seat.contains(bubble)).toBe(true);
    expect(screen.queryByTestId('chat-bubble-p2')).toBeNull();
  });

  it('does not render chat bubbles when chatBubbles is empty', () => {
    render(
      <SeatRing
        players={SAMPLE_PLAYERS}
        myPlayerId="p1"
        currentPlayerId="p1"
        chatBubbles={{}}
      />
    );

    expect(screen.queryByTestId('chat-bubble-p1')).toBeNull();
    expect(screen.queryByTestId('chat-bubble-p2')).toBeNull();
    expect(screen.queryByTestId('chat-bubble-p3')).toBeNull();
  });

  it('renders data-table-theme="pastel-pink" and direction={-1} ("Ngược chiều") cleanly', () => {
    render(
      <SeatRing
        players={SAMPLE_PLAYERS}
        myPlayerId="p1"
        currentPlayerId="p2"
        tableTheme="pastel-pink"
        direction={-1}
      />
    );

    const ring = screen.getByTestId('seat-ring');
    expect(ring.getAttribute('data-table-theme')).toBe('pastel-pink');

    const dirBadge = screen.getByTestId('seat-ring-direction');
    expect(dirBadge).toBeDefined();
    expect(dirBadge.textContent).toContain('Ngược chiều');
  });

  it('defaults tableTheme to "pastel-green" and supports "pastel-yellow"', () => {
    const { rerender } = render(
      <SeatRing
        players={SAMPLE_PLAYERS}
        myPlayerId="p1"
        currentPlayerId="p1"
      />
    );

    expect(screen.getByTestId('seat-ring').getAttribute('data-table-theme')).toBe('pastel-green');

    rerender(
      <SeatRing
        players={SAMPLE_PLAYERS}
        myPlayerId="p1"
        currentPlayerId="p1"
        tableTheme="pastel-yellow"
      />
    );

    expect(screen.getByTestId('seat-ring').getAttribute('data-table-theme')).toBe('pastel-yellow');
  });

  it('renders .seat-ring__timer-ring only on the active player seat and updates warning/urgent states', () => {
    vi.useFakeTimers();
    const baseNow = new Date('2026-01-01T00:00:00Z').getTime();
    vi.setSystemTime(baseNow);

    render(
      <SeatRing
        players={SAMPLE_PLAYERS}
        myPlayerId="p1"
        currentPlayerId="p2"
        turnDeadline={baseNow + 15000}
      />
    );

    const p1Seat = screen.getByTestId('seat-p1');
    const p2Seat = screen.getByTestId('seat-p2');
    const p3Seat = screen.getByTestId('seat-p3');

    const p2Ring = p2Seat.querySelector('.seat-ring__timer-ring');
    expect(p2Ring).not.toBeNull();
    expect(p1Seat.querySelector('.seat-ring__timer-ring')).toBeNull();
    expect(p3Seat.querySelector('.seat-ring__timer-ring')).toBeNull();
    expect(p2Ring.classList.contains('seat-ring__timer-ring--warning')).toBe(false);
    expect(p2Ring.classList.contains('seat-ring__timer-ring--urgent')).toBe(false);

    // Advance 6 seconds -> 9s remaining (warning <= 10s)
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    const warningRing = p2Seat.querySelector('.seat-ring__timer-ring');
    expect(warningRing).not.toBeNull();
    expect(warningRing.classList.contains('seat-ring__timer-ring--warning')).toBe(true);
    expect(warningRing.classList.contains('seat-ring__timer-ring--urgent')).toBe(false);

    // Advance 4.5 seconds -> 4.5s remaining (ceil = 5s -> urgent <= 5s)
    act(() => {
      vi.advanceTimersByTime(4500);
    });
    const urgentRing = p2Seat.querySelector('.seat-ring__timer-ring');
    expect(urgentRing).not.toBeNull();
    expect(urgentRing.classList.contains('seat-ring__timer-ring--urgent')).toBe(true);
    expect(urgentRing.classList.contains('seat-ring__timer-ring--warning')).toBe(false);

    // Advance past deadline -> ring disappears
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(p2Seat.querySelector('.seat-ring__timer-ring')).toBeNull();
  });

  it('targets pendingDefuseId during defuse phase and hides ring when deadline is absent or expired', () => {
    vi.useFakeTimers();
    const baseNow = new Date('2026-01-01T00:00:00Z').getTime();
    vi.setSystemTime(baseNow);

    const { rerender } = render(
      <SeatRing
        players={SAMPLE_PLAYERS}
        myPlayerId="p1"
        currentPlayerId="p2"
        phase="defuse"
        pendingDefuseId="p3"
        turnDeadline={baseNow + 4000}
      />
    );

    expect(screen.getByTestId('seat-p2').querySelector('.seat-ring__timer-ring')).toBeNull();
    const p3Ring = screen.getByTestId('seat-p3').querySelector('.seat-ring__timer-ring');
    expect(p3Ring).not.toBeNull();
    expect(p3Ring.classList.contains('seat-ring__timer-ring--urgent')).toBe(true);

    rerender(
      <SeatRing
        players={SAMPLE_PLAYERS}
        myPlayerId="p1"
        currentPlayerId="p2"
        phase="over"
        pendingDefuseId="p3"
        turnDeadline={null}
      />
    );

    expect(screen.getByTestId('seat-p2').querySelector('.seat-ring__timer-ring')).toBeNull();
    expect(screen.getByTestId('seat-p3').querySelector('.seat-ring__timer-ring')).toBeNull();
  });

  it('shows speaking ring when voicePeers[id].speaking is true and hides it when peer is in mutedVoiceIds', () => {
    const { rerender } = render(
      <SeatRing
        players={SAMPLE_PLAYERS}
        myPlayerId="p1"
        currentPlayerId="p1"
        voicePeers={{
          p1: { micOn: true, speaking: true },
          p2: { micOn: true, speaking: true },
          p3: { micOn: true, speaking: false },
        }}
        mutedVoiceIds={[]}
      />
    );

    const p1AvatarWrap = screen.getByTestId('seat-p1').querySelector('.seat-ring__avatar-wrap');
    const p2AvatarWrap = screen.getByTestId('seat-p2').querySelector('.seat-ring__avatar-wrap');
    const p3AvatarWrap = screen.getByTestId('seat-p3').querySelector('.seat-ring__avatar-wrap');

    expect(p1AvatarWrap.classList.contains('seat-ring__avatar-wrap--speaking')).toBe(true);
    expect(p2AvatarWrap.classList.contains('seat-ring__avatar-wrap--speaking')).toBe(true);
    expect(p3AvatarWrap.classList.contains('seat-ring__avatar-wrap--speaking')).toBe(false);
    expect(screen.getByTestId('seat-mic-badge-p2')).toBeDefined();
    expect(screen.getByTestId('seat-mic-badge-p3')).toBeDefined();

    // Mute p2 via Set (and ensure self p1 cannot be muted)
    rerender(
      <SeatRing
        players={SAMPLE_PLAYERS}
        myPlayerId="p1"
        currentPlayerId="p1"
        voicePeers={{
          p1: { micOn: true, speaking: true },
          p2: { micOn: true, speaking: true },
          p3: { micOn: true, speaking: false },
        }}
        mutedVoiceIds={new Set(['p1', 'p2'])}
      />
    );

    expect(
      screen.getByTestId('seat-p2').querySelector('.seat-ring__avatar-wrap')
        .classList.contains('seat-ring__avatar-wrap--speaking')
    ).toBe(false);
    expect(
      screen.getByTestId('seat-p1').querySelector('.seat-ring__avatar-wrap')
        .classList.contains('seat-ring__avatar-wrap--speaking')
    ).toBe(true);
    expect(
      screen.getByTestId('seat-mic-badge-p2').classList.contains('seat-ring__mic-badge--muted')
    ).toBe(true);
  });

  it('renders opponent voice/chat mute controls only on opponents, reflects aria-pressed, and invokes callbacks', () => {
    const onToggleMuteVoice = vi.fn();
    const onToggleMuteChat = vi.fn();

    const { rerender } = render(
      <SeatRing
        players={SAMPLE_PLAYERS}
        myPlayerId="p1"
        currentPlayerId="p1"
        mutedVoiceIds={[]}
        mutedChatIds={new Set()}
        onToggleMuteVoice={onToggleMuteVoice}
        onToggleMuteChat={onToggleMuteChat}
      />
    );

    // Self seat must not render opponent mute controls
    expect(screen.queryByTestId('seat-mute-voice-p1')).toBeNull();
    expect(screen.queryByTestId('seat-mute-chat-p1')).toBeNull();

    const p2VoiceBtn = screen.getByTestId('seat-mute-voice-p2');
    const p2ChatBtn = screen.getByTestId('seat-mute-chat-p2');
    const p3VoiceBtn = screen.getByTestId('seat-mute-voice-p3');
    const p3ChatBtn = screen.getByTestId('seat-mute-chat-p3');

    expect(p2VoiceBtn.getAttribute('aria-pressed')).toBe('false');
    expect(p2ChatBtn.getAttribute('aria-pressed')).toBe('false');
    expect(p3VoiceBtn.getAttribute('aria-pressed')).toBe('false');
    expect(p3ChatBtn.getAttribute('aria-pressed')).toBe('false');
    expect(p2VoiceBtn.getAttribute('aria-label')).toContain('Bình');
    expect(p2ChatBtn.getAttribute('aria-label')).toContain('Bình');

    fireEvent.click(p2VoiceBtn);
    fireEvent.click(p3ChatBtn);

    expect(onToggleMuteVoice).toHaveBeenCalledTimes(1);
    expect(onToggleMuteVoice).toHaveBeenCalledWith('p2');
    expect(onToggleMuteChat).toHaveBeenCalledTimes(1);
    expect(onToggleMuteChat).toHaveBeenCalledWith('p3');

    rerender(
      <SeatRing
        players={SAMPLE_PLAYERS}
        myPlayerId="p1"
        currentPlayerId="p1"
        mutedVoiceIds={['p2']}
        mutedChatIds={new Set(['p3'])}
        onToggleMuteVoice={onToggleMuteVoice}
        onToggleMuteChat={onToggleMuteChat}
      />
    );

    expect(screen.getByTestId('seat-mute-voice-p2').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('seat-mute-chat-p2').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('seat-mute-voice-p3').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('seat-mute-chat-p3').getAttribute('aria-pressed')).toBe('true');
  });
});
