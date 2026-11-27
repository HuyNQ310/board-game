// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DefuseDialog from './DefuseDialog.jsx';

describe('DefuseDialog', () => {
  describe('Visibility', () => {
    it('renders nothing when open is false', () => {
      const { container } = render(<DefuseDialog open={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders the dialog when open is true', () => {
      render(<DefuseDialog open={true} deckCount={10} insertAt={0} />);
      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toBeDefined();
    });
  });

  describe('DefuseDialog không đóng được khi chưa đặt bom (strict modal constraint)', () => {
    it('renders NO cancel, close, or dismiss button — the confirm "Đặt bom" button is the only button rendered', () => {
      render(
        <DefuseDialog
          open={true}
          deckCount={5}
          insertAt={0}
        />
      );

      // Verify that all buttons rendered in the dialog equate to exactly 1 button: the confirm button
      const allButtons = screen.getAllByRole('button');
      expect(allButtons).toHaveLength(1);

      const confirmButton = allButtons[0];
      expect(confirmButton).toHaveClass('defuse-dialog__confirm-btn');
      expect(confirmButton.textContent).toContain('Đặt bom');

      // Assert that there are NO dismissive / cancel / close controls anywhere
      expect(screen.queryByRole('button', { name: /hủy|cancel|close|đóng|thoát/i })).toBeNull();
      expect(screen.queryByLabelText(/hủy|cancel|close|đóng|thoát/i)).toBeNull();
    });

    it('does not allow closing via Escape key (rules.md 8.4)', () => {
      render(
        <DefuseDialog
          open={true}
          deckCount={5}
          insertAt={0}
        />
      );

      // Trigger Escape key on window
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      window.dispatchEvent(event);

      // The dialog remains rendered in DOM
      expect(screen.getByRole('alertdialog')).toBeDefined();
      expect(screen.getByRole('button', { name: /đặt bom/i })).toBeDefined();
    });
  });

  describe('Slider and position selection', () => {
    it('renders slider input bounded by deckCount', () => {
      render(
        <DefuseDialog
          open={true}
          deckCount={12}
          insertAt={3}
        />
      );

      const slider = screen.getByRole('slider');
      expect(slider).toBeDefined();
      expect(slider.getAttribute('min')).toBe('0');
      expect(slider.getAttribute('max')).toBe('12');
      expect(slider.getAttribute('value')).toBe('3');
    });

    it('calls onInsertAtChange when slider value changes', () => {
      const onInsertAtChange = vi.fn();
      render(
        <DefuseDialog
          open={true}
          deckCount={10}
          insertAt={0}
          onInsertAtChange={onInsertAtChange}
        />
      );

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '4' } });

      expect(onInsertAtChange).toHaveBeenCalledTimes(1);
      expect(onInsertAtChange).toHaveBeenCalledWith(4);
    });
  });

  describe('Confirmation', () => {
    it('calls onConfirm when the "Đặt bom" button is clicked', () => {
      const onConfirm = vi.fn();
      render(
        <DefuseDialog
          open={true}
          deckCount={8}
          insertAt={2}
          onConfirm={onConfirm}
        />
      );

      const confirmButton = screen.getByRole('button', { name: /đặt bom/i });
      fireEvent.click(confirmButton);

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('Localization support via t prop', () => {
    it('uses custom strings provided in t prop', () => {
      const customT = {
        defuseTitle: 'Đã chặn nổ thành công!',
        defusePrompt: 'Chọn ngăn để nhét bom:',
        placeBomb: 'Xác nhận gài bom',
        topOfDeck: 'Đầu bộ bài (0)',
        bottomOfDeck: 'Đáy bộ bài',
      };

      render(
        <DefuseDialog
          open={true}
          deckCount={5}
          insertAt={0}
          t={customT}
        />
      );

      expect(screen.getByText('Đã chặn nổ thành công!')).toBeDefined();
      expect(screen.getByText('Chọn ngăn để nhét bom:')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Xác nhận gài bom' })).toBeDefined();
      expect(screen.getByText('Đầu bộ bài (0)')).toBeDefined();
    });
  });
});
