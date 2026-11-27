// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
});
