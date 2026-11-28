// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import * as soundModule from '../utils/sound.js';
import ActionBar from './ActionBar.jsx';

describe('ActionBar', () => {
  describe('Draw button ("Rút bài")', () => {
    it('is disabled by default when canDraw prop is omitted', () => {
      render(<ActionBar />);
      const drawButton = screen.getByRole('button', { name: /rút bài/i });
      expect(drawButton).toBeDefined();
      expect(drawButton.disabled).toBe(true);
    });

    it('is disabled when canDraw is false', () => {
      render(<ActionBar canDraw={false} />);
      const drawButton = screen.getByRole('button', { name: /rút bài/i });
      expect(drawButton.disabled).toBe(true);
    });

    it('is enabled only when canDraw is true (đến lượt)', () => {
      render(<ActionBar canDraw={true} />);
      const drawButton = screen.getByRole('button', { name: /rút bài/i });
      expect(drawButton.disabled).toBe(false);
    });

    it('calls onDraw when clicked while enabled', () => {
      const onDraw = vi.fn();
      render(<ActionBar canDraw={true} onDraw={onDraw} />);
      const drawButton = screen.getByRole('button', { name: /rút bài/i });

      fireEvent.click(drawButton);
      expect(onDraw).toHaveBeenCalledTimes(1);
    });

    it('does not trigger onDraw when clicked while disabled', () => {
      const onDraw = vi.fn();
      render(<ActionBar canDraw={false} onDraw={onDraw} />);
      const drawButton = screen.getByRole('button', { name: /rút bài/i });

      fireEvent.click(drawButton);
      expect(onDraw).not.toHaveBeenCalled();
    });
  });

  describe('Optional action buttons conditional rendering', () => {
    it('does not render any action buttons by default when all canX props are omitted/false', () => {
      const { container } = render(<ActionBar canDraw={false} />);

      // Only the draw button should exist
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveClass('action-bar__btn--draw');

      // None of the optional action buttons should be in DOM
      expect(container.querySelector('.action-bar__btn--skip')).toBeNull();
      expect(container.querySelector('.action-bar__btn--attack')).toBeNull();
      expect(container.querySelector('.action-bar__btn--favor')).toBeNull();
      expect(container.querySelector('.action-bar__btn--cat-pair')).toBeNull();
      expect(container.querySelector('.action-bar__btn--peek')).toBeNull();
      expect(container.querySelector('.action-bar__btn--shuffle')).toBeNull();
      expect(container.querySelector('.action-bar__btn--reverse')).toBeNull();
      expect(container.querySelector('.action-bar__nope-row')).toBeNull();
    });

    it('renders skip button only when canSkip is true and triggers onSkip', () => {
      const onSkip = vi.fn();
      const { rerender } = render(<ActionBar canSkip={false} onSkip={onSkip} />);
      expect(screen.queryByRole('button', { name: /bỏ qua/i })).toBeNull();

      rerender(<ActionBar canSkip={true} onSkip={onSkip} />);
      const skipButton = screen.getByRole('button', { name: /bỏ qua/i });
      expect(skipButton).toBeDefined();

      fireEvent.click(skipButton);
      expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('renders attack button only when canAttack is true and triggers onAttack', () => {
      const onAttack = vi.fn();
      const { rerender } = render(<ActionBar canAttack={false} onAttack={onAttack} />);
      expect(screen.queryByRole('button', { name: /tấn công/i })).toBeNull();

      rerender(<ActionBar canAttack={true} onAttack={onAttack} />);
      const attackButton = screen.getByRole('button', { name: /tấn công/i });
      expect(attackButton).toBeDefined();

      fireEvent.click(attackButton);
      expect(onAttack).toHaveBeenCalledTimes(1);
    });

    it('renders favor button only when canFavor is true and triggers onFavor', () => {
      const onFavor = vi.fn();
      const { rerender } = render(<ActionBar canFavor={false} onFavor={onFavor} />);
      expect(screen.queryByRole('button', { name: /nhờ vả/i })).toBeNull();

      rerender(<ActionBar canFavor={true} onFavor={onFavor} />);
      const favorButton = screen.getByRole('button', { name: /nhờ vả/i });
      expect(favorButton).toBeDefined();

      fireEvent.click(favorButton);
      expect(onFavor).toHaveBeenCalledTimes(1);
    });

    it('renders catPair button only when canCatPair is true and triggers onCatPair', () => {
      const onCatPair = vi.fn();
      const { rerender } = render(<ActionBar canCatPair={false} onCatPair={onCatPair} />);
      expect(screen.queryByRole('button', { name: /chơi cặp mèo/i })).toBeNull();

      rerender(<ActionBar canCatPair={true} onCatPair={onCatPair} />);
      const catPairButton = screen.getByRole('button', { name: /chơi cặp mèo/i });
      expect(catPairButton).toBeDefined();

      fireEvent.click(catPairButton);
      expect(onCatPair).toHaveBeenCalledTimes(1);
    });

    it('renders peek button only when canPeek is true and triggers onPeek', () => {
      const onPeek = vi.fn();
      const { rerender } = render(<ActionBar canPeek={false} onPeek={onPeek} />);
      expect(screen.queryByRole('button', { name: /nhìn trước/i })).toBeNull();

      rerender(<ActionBar canPeek={true} onPeek={onPeek} />);
      const peekButton = screen.getByRole('button', { name: /nhìn trước/i });
      expect(peekButton).toBeDefined();

      fireEvent.click(peekButton);
      expect(onPeek).toHaveBeenCalledTimes(1);
    });

    it('renders shuffle button only when canShuffle is true and triggers onShuffle', () => {
      const onShuffle = vi.fn();
      const { rerender } = render(<ActionBar canShuffle={false} onShuffle={onShuffle} />);
      expect(screen.queryByRole('button', { name: /xáo bài/i })).toBeNull();

      rerender(<ActionBar canShuffle={true} onShuffle={onShuffle} />);
      const shuffleButton = screen.getByRole('button', { name: /xáo bài/i });
      expect(shuffleButton).toBeDefined();

      fireEvent.click(shuffleButton);
      expect(onShuffle).toHaveBeenCalledTimes(1);
    });

    it('renders reverse button only when canReverse is true and triggers onReverse', () => {
      const onReverse = vi.fn();
      const { rerender } = render(<ActionBar canReverse={false} onReverse={onReverse} />);
      expect(screen.queryByRole('button', { name: /đảo chiều/i })).toBeNull();

      rerender(<ActionBar canReverse={true} onReverse={onReverse} />);
      const reverseButton = screen.getByRole('button', { name: /đảo chiều/i });
      expect(reverseButton).toBeDefined();
      expect(reverseButton).toHaveClass('action-bar__btn--reverse');

      fireEvent.click(reverseButton);
      expect(onReverse).toHaveBeenCalledTimes(1);
    });

    it('renders multiple action buttons simultaneously when their respective flags are true', () => {
      render(
        <ActionBar
          canDraw={true}
          canSkip={true}
          canAttack={true}
          canFavor={true}
          canCatPair={true}
          canPeek={true}
          canShuffle={true}
        />
      );

      const buttons = screen.getAllByRole('button');
      // Draw + 6 action buttons = 7 buttons
      expect(buttons).toHaveLength(7);
      expect(screen.getByRole('button', { name: /rút bài/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /bỏ qua/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /tấn công/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /nhờ vả/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /chơi cặp mèo/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /nhìn trước/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /xáo bài/i })).toBeDefined();
    });
  });

  describe('Turns badge and localization', () => {
    it('displays turns badge when turnsLeft > 1', () => {
      render(<ActionBar turnsLeft={2} />);
      expect(screen.getByText('Còn 2 lượt')).toBeDefined();
    });

    it('does not display turns badge when turnsLeft is 1 or less', () => {
      const { rerender } = render(<ActionBar turnsLeft={1} />);
      expect(screen.queryByText(/còn/i)).toBeNull();

      rerender(<ActionBar turnsLeft={0} />);
      expect(screen.queryByText(/còn/i)).toBeNull();
    });

    it('respects custom translations provided via t prop', () => {
      const customT = {
        actionBarAriaLabel: 'Bảng nút lệnh',
        draw: 'Rút ngay',
        skip: 'Nhường',
      };
      render(<ActionBar t={customT} canDraw={true} canSkip={true} />);

      expect(screen.getByRole('toolbar', { name: 'Bảng nút lệnh' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Rút ngay' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Nhường' })).toBeDefined();
    });
  });

  describe('Nope reaction phase', () => {
    it('does not render nope row when isNopePhase is false', () => {
      const { container } = render(
        <ActionBar
          isNopePhase={false}
          canNope={true}
          canPassNope={true}
          nopePromptText="Có ai muốn KHÔNG không?"
        />
      );
      expect(container.querySelector('.action-bar__nope-row')).toBeNull();
      expect(screen.queryByRole('button', { name: /không!/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /cho qua/i })).toBeNull();
    });

    it('renders nope prompt, nope button, and pass button when isNopePhase is true', () => {
      const onNope = vi.fn();
      const onPassNope = vi.fn();
      const { container } = render(
        <ActionBar
          isNopePhase={true}
          canNope={true}
          onNope={onNope}
          canPassNope={true}
          onPassNope={onPassNope}
          nopePromptText="Alice vừa đánh Truy Đuổi!"
        />
      );

      expect(container.querySelector('.action-bar__nope-row')).not.toBeNull();
      expect(screen.getByText('Alice vừa đánh Truy Đuổi!')).toBeDefined();

      const nopeBtn = screen.getByRole('button', { name: /không!/i });
      expect(nopeBtn).toHaveClass('action-bar__btn--nope');
      expect(nopeBtn.disabled).toBe(false);
      fireEvent.click(nopeBtn);
      expect(onNope).toHaveBeenCalledTimes(1);

      const passBtn = screen.getByRole('button', { name: /cho qua/i });
      expect(passBtn).toHaveClass('action-bar__btn--pass-nope');
      fireEvent.click(passBtn);
      expect(onPassNope).toHaveBeenCalledTimes(1);
    });

    it('disables nope button when canNope is false and hides pass button when canPassNope is false', () => {
      const onNope = vi.fn();
      render(
        <ActionBar
          isNopePhase={true}
          canNope={false}
          onNope={onNope}
          canPassNope={false}
        />
      );

      const nopeBtn = screen.getByRole('button', { name: /không!/i });
      expect(nopeBtn.disabled).toBe(true);
      fireEvent.click(nopeBtn);
      expect(onNope).not.toHaveBeenCalled();

      expect(screen.queryByRole('button', { name: /cho qua/i })).toBeNull();
    });

    it('uses custom translations for reverse, nope, and passNope', () => {
      render(
        <ActionBar
          canReverse={true}
          isNopePhase={true}
          canNope={true}
          canPassNope={true}
          t={{
            reverse: 'Quay xe',
            nope: 'Chặn ngay',
            passNope: 'Bỏ qua chặn',
          }}
        />
      );

      expect(screen.getByRole('button', { name: 'Quay xe' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Chặn ngay' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Bỏ qua chặn' })).toBeDefined();
    });
  });

  describe('Countdown 5s sound effect', () => {
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('plays a beep once per second from 5s down to 1s, not above 5s', () => {
      vi.useFakeTimers();
      const baseNow = new Date('2026-11-28T12:00:00Z').getTime();
      vi.setSystemTime(baseNow);
      const beepSpy = vi.spyOn(soundModule, 'playCountdownBeep').mockImplementation(() => {});

      render(<ActionBar canDraw={true} turnDeadline={baseNow + 7000} />);
      expect(beepSpy).not.toHaveBeenCalled();

      act(() => { vi.advanceTimersByTime(1000); }); // 6s
      expect(beepSpy).not.toHaveBeenCalled();

      act(() => { vi.advanceTimersByTime(1000); }); // 5s
      expect(beepSpy).toHaveBeenCalledTimes(1);
      expect(beepSpy).toHaveBeenLastCalledWith(5);

      act(() => { vi.advanceTimersByTime(1000); }); // 4s
      act(() => { vi.advanceTimersByTime(1000); }); // 3s
      act(() => { vi.advanceTimersByTime(1000); }); // 2s
      act(() => { vi.advanceTimersByTime(1000); }); // 1s
      expect(beepSpy.mock.calls.map((c) => c[0])).toEqual([5, 4, 3, 2, 1]);

      act(() => { vi.advanceTimersByTime(1000); }); // 0s
      expect(beepSpy).toHaveBeenCalledTimes(5);
    });

    it('ticks steadily without skipping seconds even when deadline has sub-second offset', () => {
      vi.useFakeTimers();
      const baseNow = new Date('2026-11-28T12:00:00Z').getTime();
      vi.setSystemTime(baseNow);

      render(<ActionBar canDraw={true} turnDeadline={baseNow + 9995} />);
      expect(screen.getByTestId('turn-countdown')).toHaveTextContent('Còn 10 giây');

      for (let expected = 9; expected >= 0; expected--) {
        act(() => {
          vi.advanceTimersByTime(1000);
        });
        expect(screen.getByTestId('turn-countdown')).toHaveTextContent(
          `Còn ${expected} giây`
        );
      }
    });
  });

  describe('Contextual Play Selected button', () => {
    it('renders and triggers onPlaySelected when playSelectedLabel/canPlaySelected are set', () => {
      const onPlaySelected = vi.fn();
      render(
        <ActionBar
          canDraw={true}
          canPlaySelected={true}
          onPlaySelected={onPlaySelected}
          playSelectedLabel="Đánh Mắt Thần"
        />
      );

      const playBtn = screen.getByTestId('play-selected-btn');
      expect(playBtn).toHaveTextContent('Đánh Mắt Thần');
      expect(playBtn.disabled).toBe(false);
      fireEvent.click(playBtn);
      expect(onPlaySelected).toHaveBeenCalledTimes(1);
    });
  });
});
