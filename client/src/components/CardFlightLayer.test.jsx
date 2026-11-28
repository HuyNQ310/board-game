// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CardFlightLayer from './CardFlightLayer.jsx';

describe('CardFlightLayer', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when flights array is empty', () => {
    const { container } = render(<CardFlightLayer flights={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders deal, draw, and play flying cards with expected CSS variables', () => {
    const flights = [
      {
        id: 1,
        fromX: 100,
        fromY: 80,
        fromW: 74,
        fromH: 104,
        dx: -40,
        dy: 220,
        scaleEnd: 1.2,
        delayMs: 85,
        durationMs: 360,
        faceDown: true,
        variant: 'deal',
      },
      {
        id: 2,
        fromX: 200,
        fromY: 400,
        fromW: 96,
        fromH: 134,
        dx: 60,
        dy: -240,
        scaleEnd: 0.77,
        delayMs: 0,
        durationMs: 340,
        faceDown: false,
        cardType: 'skip',
        cardLabel: 'Ngủ Trưa',
        variant: 'play',
      },
    ];

    render(<CardFlightLayer flights={flights} />);

    const dealEl = screen.getByTestId('card-flight-deal');
    const playEl = screen.getByTestId('card-flight-play');
    expect(dealEl.style.getPropertyValue('--flight-delay')).toBe('85ms');
    expect(playEl.textContent).toContain('Ngủ Trưa');
    expect(playEl.style.getPropertyValue('--flight-dx')).toBe('60px');
  });
});
