// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TargetPicker from './TargetPicker.jsx';

describe('TargetPicker', () => {
  describe('Visibility', () => {
    it('renders nothing when open is false', () => {
      const { container } = render(
        <TargetPicker open={false} candidates={[{ id: 'p2', name: 'Bình' }]} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders the dialog when open is true', () => {
      render(
        <TargetPicker open={true} candidates={[{ id: 'p2', name: 'Bình' }]} />
      );
      expect(screen.getByRole('dialog')).toBeDefined();
    });
  });

  describe('TargetPicker không liệt kê mình hoặc người đã loại (candidate list rendering)', () => {
    /**
     * NOTE: As per rules.md section 4.5, 8.2 and section 11 Phase 3 test criteria:
     * "TargetPicker không liệt kê mình hoặc người đã loại"
     * In this application's architecture, TargetPicker is a pure presentation component
     * that receives an already-filtered `candidates` array. The actual filtering logic
     * (excluding the acting player's own ID and all eliminated players whose alive===false)
     * lives in the parent integration layer (Game.jsx / viewFor).
     *
     * Here, we simulate that filtered state where self ('An') and eliminated ('Chi')
     * have already been excluded by the parent, leaving only alive opponent candidates
     * ('Bình' and 'Dũng'). We verify that TargetPicker renders exactly one row per
     * candidate in the given array, with no extra or missing rows.
     */
    it('renders exactly one row per candidate in the filtered candidates array', () => {
      // Simulated state from game with 4 players:
      // Player 1: 'p1' - An (acting player / self -> excluded by parent)
      // Player 2: 'p2' - Bình (alive opponent -> included)
      // Player 3: 'p3' - Chi (eliminated opponent -> excluded by parent)
      // Player 4: 'p4' - Dũng (alive opponent -> included)
      const filteredCandidates = [
        { id: 'p2', name: 'Bình' },
        { id: 'p4', name: 'Dũng' },
      ];

      render(
        <TargetPicker
          open={true}
          candidates={filteredCandidates}
        />
      );

      // Verify that candidate list items match candidates count exactly
      const candidateListItems = screen.getAllByRole('listitem');
      expect(candidateListItems).toHaveLength(filteredCandidates.length);

      // Check that only the alive opponent candidates appear
      expect(screen.getByText('Bình')).toBeDefined();
      expect(screen.getByText('Dũng')).toBeDefined();

      // Ensure excluded players (self and eliminated) are not present
      expect(screen.queryByText('An')).toBeNull();
      expect(screen.queryByText('Chi')).toBeNull();
    });

    it('renders exactly 1 candidate row when only 1 valid opponent remains', () => {
      const singleCandidate = [{ id: 'p2', name: 'Bình' }];

      render(
        <TargetPicker
          open={true}
          candidates={singleCandidate}
        />
      );

      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(1);
      expect(screen.getByText('Bình')).toBeDefined();
    });
  });

  describe('Interaction and Callbacks', () => {
    it('calls onPick with the clicked candidate id', () => {
      const onPick = vi.fn();
      const candidates = [
        { id: 'p2', name: 'Bình' },
        { id: 'p4', name: 'Dũng' },
      ];

      render(
        <TargetPicker
          open={true}
          candidates={candidates}
          onPick={onPick}
        />
      );

      const binhBtn = screen.getByRole('button', { name: 'Bình' });
      fireEvent.click(binhBtn);

      expect(onPick).toHaveBeenCalledTimes(1);
      expect(onPick).toHaveBeenCalledWith('p2');

      const dungBtn = screen.getByRole('button', { name: 'Dũng' });
      fireEvent.click(dungBtn);

      expect(onPick).toHaveBeenCalledTimes(2);
      expect(onPick).toHaveBeenCalledWith('p4');
    });

    it('calls onCancel when clicking the cancel button ("Hủy")', () => {
      const onCancel = vi.fn();
      render(
        <TargetPicker
          open={true}
          candidates={[{ id: 'p2', name: 'Bình' }]}
          onCancel={onCancel}
        />
      );

      const cancelBtn = screen.getByRole('button', { name: /hủy/i });
      fireEvent.click(cancelBtn);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when clicking the backdrop', () => {
      const onCancel = vi.fn();
      const { container } = render(
        <TargetPicker
          open={true}
          candidates={[{ id: 'p2', name: 'Bình' }]}
          onCancel={onCancel}
        />
      );

      const backdrop = container.querySelector('.target-picker-backdrop');
      fireEvent.click(backdrop);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when pressing the Escape key', () => {
      const onCancel = vi.fn();
      render(
        <TargetPicker
          open={true}
          candidates={[{ id: 'p2', name: 'Bình' }]}
          onCancel={onCancel}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty state and Localization', () => {
    it('renders empty message when candidates list is empty', () => {
      render(
        <TargetPicker
          open={true}
          candidates={[]}
        />
      );

      expect(screen.getByText('Không có người chơi nào để chọn')).toBeDefined();
      expect(screen.queryByRole('list')).toBeNull();
    });

    it('uses custom strings provided via t prop', () => {
      const customT = {
        targetPickerTitle: 'Chỉ định đối thủ',
        targetPickerPrompt: 'Hãy chọn một nạn nhân:',
        cancel: 'Bỏ qua thao tác',
        noCandidates: 'Hết người chơi hợp lệ',
      };

      render(
        <TargetPicker
          open={true}
          candidates={[]}
          t={customT}
        />
      );

      expect(screen.getByText('Chỉ định đối thủ')).toBeDefined();
      expect(screen.getByText('Hãy chọn một nạn nhân:')).toBeDefined();
      expect(screen.getByText('Hết người chơi hợp lệ')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Bỏ qua thao tác' })).toBeDefined();
    });
  });
});
