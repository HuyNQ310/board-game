import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Lobby } from './Lobby.jsx';

describe('Lobby screen', () => {
  const mockPlayers = [
    { id: 'p1', name: 'An', seat: 0, isHost: true, connected: true },
    { id: 'p2', name: 'Bình', seat: 1, isHost: false, connected: false },
    { id: 'p3', name: 'Chi', seat: 2, isHost: false, connected: true },
  ];

  describe('Host controls & Start button (rules.md Phase 2 / Section 8.2)', () => {
    it('renders the "Bắt đầu" start button when isHost is true, and it is disabled showing startDisabledReason when canStart is false', () => {
      const onStart = vi.fn();
      const reason = 'Cần ít nhất 2 người đang kết nối để bắt đầu';

      render(
        <Lobby
          isHost={true}
          canStart={false}
          startDisabledReason={reason}
          onStart={onStart}
          players={mockPlayers}
          roomCode="K7M2Q"
        />
      );

      const startButton = screen.getByRole('button', { name: /bắt đầu/i });
      expect(startButton).toBeTruthy();
      expect(startButton.disabled).toBe(true);

      // Verify startDisabledReason is shown
      const reasonElement = screen.getByText(reason);
      expect(reasonElement).toBeTruthy();
      expect(reasonElement.getAttribute('role')).toBe('status');

      // Clicking when disabled must not trigger onStart
      fireEvent.click(startButton);
      expect(onStart).not.toHaveBeenCalled();
    });

    it('enables the "Bắt đầu" start button and does not show reason when isHost is true and canStart is true', () => {
      const onStart = vi.fn();

      render(
        <Lobby
          isHost={true}
          canStart={true}
          startDisabledReason={null}
          onStart={onStart}
          players={mockPlayers}
          roomCode="K7M2Q"
        />
      );

      const startButton = screen.getByRole('button', { name: /bắt đầu/i });
      expect(startButton).toBeTruthy();
      expect(startButton.disabled).toBe(false);

      expect(screen.queryByRole('status', { name: /cần ít nhất/i })).toBeNull();

      fireEvent.click(startButton);
      expect(onStart).toHaveBeenCalledTimes(1);
    });
  });

  describe('Non-host player view (rules.md Phase 2 / Section 8.2)', () => {
    it('renders the waiting for host message instead of a start button when isHost is false', () => {
      render(
        <Lobby
          isHost={false}
          canStart={false}
          players={mockPlayers}
          roomCode="K7M2Q"
        />
      );

      // Start button must NOT be rendered
      expect(screen.queryByRole('button', { name: /bắt đầu/i })).toBeNull();

      // Waiting message must be displayed
      const waitingMessage = screen.getByText('Đang chờ chủ phòng bắt đầu');
      expect(waitingMessage).toBeTruthy();

      const waitingContainer = screen.getByRole('status');
      expect(waitingContainer).toBeTruthy();
      expect(waitingContainer.textContent).toContain('Đang chờ chủ phòng bắt đầu');
    });

    it('renders custom waiting message when provided via t prop', () => {
      render(
        <Lobby
          isHost={false}
          t={{ waitingForHostMessage: 'Chờ chủ phòng bắt đầu ván đấu…' }}
          players={mockPlayers}
          roomCode="K7M2Q"
        />
      );

      expect(screen.getByText('Chờ chủ phòng bắt đầu ván đấu…')).toBeTruthy();
      expect(screen.queryByText('Đang chờ chủ phòng bắt đầu')).toBeNull();
    });
  });

  describe('Player list and badges (rules.md Phase 2 / Section 8.2)', () => {
    it('renders a "Chủ phòng" badge on the host player', () => {
      render(
        <Lobby
          isHost={false}
          players={mockPlayers}
          roomCode="K7M2Q"
        />
      );

      // Only An has isHost=true
      const hostBadges = screen.getAllByLabelText('Chủ phòng');
      expect(hostBadges).toHaveLength(1);
      expect(hostBadges[0].textContent).toContain('Chủ phòng');
    });

    it('renders an "Đang offline" badge on a disconnected player', () => {
      render(
        <Lobby
          isHost={false}
          players={mockPlayers}
          roomCode="K7M2Q"
        />
      );

      // Bình has connected=false
      const offlineBadges = screen.getAllByLabelText('Đang offline');
      expect(offlineBadges).toHaveLength(1);
      expect(offlineBadges[0].textContent).toContain('Đang offline');
    });

    it('renders a "Sẵn sàng" badge on connected players who are not offline', () => {
      render(
        <Lobby
          isHost={false}
          players={mockPlayers}
          roomCode="K7M2Q"
        />
      );

      // An and Chi are connected=true
      const onlineBadges = screen.getAllByLabelText('Sẵn sàng');
      expect(onlineBadges).toHaveLength(2);
    });

    it('renders players sorted by seat number ascending', () => {
      // Pass players out of seat order
      const unsortedPlayers = [
        { id: 'p2', name: 'Bình', seat: 1, connected: true },
        { id: 'p3', name: 'Chi', seat: 2, connected: true },
        { id: 'p1', name: 'An', seat: 0, connected: true, isHost: true },
      ];

      const { container } = render(
        <Lobby
          isHost={true}
          players={unsortedPlayers}
          roomCode="K7M2Q"
        />
      );

      const playerNames = Array.from(
        container.querySelectorAll('.lobby-player-item .player-name')
      ).map((el) => el.textContent);

      expect(playerNames).toEqual(['An', 'Bình', 'Chi']);
    });

    it('displays the player count relative to max 6 players', () => {
      render(
        <Lobby
          isHost={false}
          players={mockPlayers}
          roomCode="K7M2Q"
        />
      );

      expect(screen.getByText('3/6')).toBeTruthy();
    });
  });

  describe('Room code display and action controls', () => {
    it('renders the room code in the display area', () => {
      render(
        <Lobby
          isHost={false}
          players={mockPlayers}
          roomCode="K7M2Q"
        />
      );

      expect(screen.getByText('K7M2Q')).toBeTruthy();
      expect(screen.getByLabelText('Mã phòng: K7M2Q')).toBeTruthy();
    });

    it('calls onCopyCode when clicking the copy-code button', () => {
      const onCopyCode = vi.fn();
      render(
        <Lobby
          isHost={false}
          players={mockPlayers}
          roomCode="K7M2Q"
          onCopyCode={onCopyCode}
        />
      );

      const copyButton = screen.getByRole('button', { name: /sao chép/i });
      fireEvent.click(copyButton);

      expect(onCopyCode).toHaveBeenCalledTimes(1);
    });

    it('calls onShareCode when clicking the share-code button', () => {
      const onShareCode = vi.fn();
      render(
        <Lobby
          isHost={false}
          players={mockPlayers}
          roomCode="K7M2Q"
          onShareCode={onShareCode}
        />
      );

      const shareButton = screen.getByRole('button', { name: /chia sẻ/i });
      fireEvent.click(shareButton);

      expect(onShareCode).toHaveBeenCalledTimes(1);
    });

    it('calls onLeave when clicking the leave-room button', () => {
      const onLeave = vi.fn();
      render(
        <Lobby
          isHost={false}
          players={mockPlayers}
          roomCode="K7M2Q"
          onLeave={onLeave}
        />
      );

      const leaveButton = screen.getByRole('button', { name: /rời phòng/i });
      fireEvent.click(leaveButton);

      expect(onLeave).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom display translations (t prop)', () => {
    it('renders custom labels and text across the lobby screen', () => {
      const customT = {
        title: 'Sảnh Chờ Trận',
        roomCodeLabel: 'Mã Phiên',
        copyCodeButton: 'Copy mã',
        copyCodeAriaLabel: 'Copy mã phiên chơi',
        shareCodeButton: 'Share mã',
        shareCodeAriaLabel: 'Share link phiên chơi',
        playerListTitle: 'Danh sách tay chơi',
        seatLabel: 'Vị trí',
        hostBadge: 'Trưởng phòng',
        offlineBadge: 'Mất sóng',
        onlineBadge: 'Trực tuyến',
        startButton: 'Khai cuộc',
        waitingForHostMessage: 'Đang đợi trưởng phòng khai cuộc',
        leaveRoomButton: 'Thoát sảnh',
      };

      const { rerender } = render(
        <Lobby
          isHost={true}
          canStart={true}
          t={customT}
          players={mockPlayers}
          roomCode="XYZ89"
        />
      );

      expect(screen.getByText('Sảnh Chờ Trận')).toBeTruthy();
      expect(screen.getByText('Mã Phiên')).toBeTruthy();
      expect(screen.getByRole('button', { name: /copy/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /share/i })).toBeTruthy();
      expect(screen.getByText('Danh sách tay chơi')).toBeTruthy();
      expect(screen.getAllByText(/Vị trí/i).length).toBeGreaterThan(0);
      expect(screen.getByLabelText('Trưởng phòng')).toBeTruthy();
      expect(screen.getByLabelText('Mất sóng')).toBeTruthy();
      expect(screen.getAllByLabelText('Trực tuyến')).toHaveLength(2);
      expect(screen.getByRole('button', { name: 'Khai cuộc' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Thoát sảnh' })).toBeTruthy();

      // Test non-host waiting translation
      rerender(
        <Lobby
          isHost={false}
          t={customT}
          players={mockPlayers}
          roomCode="XYZ89"
        />
      );

      expect(screen.getByText('Đang đợi trưởng phòng khai cuộc')).toBeTruthy();
    });
  });
});
