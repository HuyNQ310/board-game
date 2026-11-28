// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SeatRing } from './SeatRing.jsx';

const SAMPLE_PLAYERS = [
  { id: 'p1', name: 'An', handCount: 5, alive: true, connected: true },
  { id: 'p2', name: 'Bình', handCount: 4, alive: true, connected: true },
  { id: 'p3', name: 'Chi', handCount: 3, alive: true, connected: true },
];

describe('SeatRing', () => {
  afterEach(() => {
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
});
