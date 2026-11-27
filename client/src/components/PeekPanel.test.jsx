// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PeekPanel from './PeekPanel.jsx';

describe('PeekPanel', () => {
  describe('PeekPanel chỉ hiện cho người đánh (null vs array rendering)', () => {
    /**
     * NOTE: As defined in rules.md sections 6.6, 8.2 and section 11 Phase 3 test criteria:
     * "PeekPanel chỉ hiện cho người đánh"
     * Visibility to only the player who played the Peek card is an engine / server
     * integration responsibility: `viewFor(state, playerId)` populates `state.peek`
     * with the 3 top cards exclusively for the acting player and returns `peek: null`
     * for everyone else.
     *
     * The PeekPanel component respects this contract by rendering `null` whenever `peek`
     * is null, undefined, or empty, and only rendering its panel when a non-empty array
     * is provided.
     */
    it('renders nothing when peek is null', () => {
      const { container } = render(<PeekPanel peek={null} />);
      expect(container.firstChild).toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('renders nothing when peek is undefined (default prop)', () => {
      const { container } = render(<PeekPanel />);
      expect(container.firstChild).toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('renders nothing when peek is an empty array', () => {
      const { container } = render(<PeekPanel peek={[]} />);
      expect(container.firstChild).toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('Rendering 3 entries in order', () => {
    it('renders all 3 entries in exact top-to-bottom order when peek is a 3-item array of card types', () => {
      const peekCards = ['boom', 'skip', 'defuse'];

      render(<PeekPanel peek={peekCards} />);

      // Region and heading should exist
      const region = screen.getByRole('dialog');
      expect(region).toBeDefined();
      expect(screen.getByText('Nhìn trước 3 lá bài')).toBeDefined();

      // List of 3 cards
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);

      // 1st entry: Top position ("1. Trên cùng") with "Mèo Bùm"
      expect(listItems[0].textContent).toContain('1. Trên cùng');
      expect(listItems[0].textContent).toContain('Mèo Bùm');

      // 2nd entry: Middle position ("2. Ở giữa") with "Ngủ Trưa"
      expect(listItems[1].textContent).toContain('2. Ở giữa');
      expect(listItems[1].textContent).toContain('Ngủ Trưa');

      // 3rd entry: Bottom position ("3. Thứ ba") with "Kìm Cắt Dây"
      expect(listItems[2].textContent).toContain('3. Thứ ba');
      expect(listItems[2].textContent).toContain('Kìm Cắt Dây');
    });

    it('renders all 3 entries in order when peek contains card objects ({ type })', () => {
      const peekCards = [
        { type: 'attack' },
        { type: 'favor' },
        { type: 'shuffle' },
      ];

      render(<PeekPanel peek={peekCards} />);

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);

      // Position 1: attack -> Truy Đuổi
      expect(listItems[0].textContent).toContain('1. Trên cùng');
      expect(listItems[0].textContent).toContain('Truy Đuổi');

      // Position 2: favor -> Nài Nỉ
      expect(listItems[1].textContent).toContain('2. Ở giữa');
      expect(listItems[1].textContent).toContain('Nài Nỉ');

      // Position 3: shuffle -> Xáo Trộn
      expect(listItems[2].textContent).toContain('3. Thứ ba');
      expect(listItems[2].textContent).toContain('Xáo Trộn');
    });
  });

  describe('Localization support via t prop', () => {
    it('uses custom strings provided via t prop for panel title and card names', () => {
      const customT = {
        peekTitle: 'Xem bài bí mật',
        peekSubtitle: 'Ba lá tiếp theo trong cọc:',
        peekCardTop: 'Vị trí #1',
        peekCardMiddle: 'Vị trí #2',
        peekCardBottom: 'Vị trí #3',
        boom: 'Bom nổ',
        cat: 'Mèo thường',
        peek: 'Mắt nhìn',
      };

      render(
        <PeekPanel
          peek={['boom', 'cat', 'peek']}
          t={customT}
        />
      );

      expect(screen.getByText('Xem bài bí mật')).toBeDefined();
      expect(screen.getByText('Ba lá tiếp theo trong cọc:')).toBeDefined();

      const listItems = screen.getAllByRole('listitem');
      expect(listItems[0].textContent).toContain('Vị trí #1');
      expect(listItems[0].textContent).toContain('Bom nổ');

      expect(listItems[1].textContent).toContain('Vị trí #2');
      expect(listItems[1].textContent).toContain('Mèo thường');

      expect(listItems[2].textContent).toContain('Vị trí #3');
      expect(listItems[2].textContent).toContain('Mắt nhìn');
    });
  });

  describe('Custom card renderer', () => {
    it('delegates card rendering to renderCard prop when provided', () => {
      const renderCard = vi.fn(({ type, label }) => (
        <div data-testid={`custom-card-${type}`}>{label}</div>
      ));

      render(
        <PeekPanel
          peek={['boom', 'defuse', 'attack']}
          renderCard={renderCard}
        />
      );

      expect(renderCard).toHaveBeenCalledTimes(3);

      expect(renderCard).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          type: 'boom',
          label: 'Mèo Bùm',
          faceDown: false,
        })
      );
      expect(renderCard).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: 'defuse',
          label: 'Kìm Cắt Dây',
          faceDown: false,
        })
      );
      expect(renderCard).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          type: 'attack',
          label: 'Truy Đuổi',
          faceDown: false,
        })
      );

      expect(screen.getByTestId('custom-card-boom')).toBeDefined();
      expect(screen.getByTestId('custom-card-defuse')).toBeDefined();
      expect(screen.getByTestId('custom-card-attack')).toBeDefined();
    });
  });
});
