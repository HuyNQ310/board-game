import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Home } from './Home.jsx';

describe('Home screen', () => {
  describe('Resuming state (rules.md Phase 2 / Section 8.2)', () => {
    it('shows the resuming message and hides the normal form when isResuming is true', () => {
      render(<Home isResuming={true} />);

      // Resuming container and message must be shown
      const statusElement = screen.getByRole('status');
      expect(statusElement).toBeTruthy();
      expect(screen.getByText('Đang vào lại phòng…')).toBeTruthy();

      // Normal form elements must NOT be rendered
      expect(screen.queryByLabelText(/tên người chơi/i)).toBeNull();
      expect(screen.queryByPlaceholderText(/nhập tên của bạn/i)).toBeNull();
      expect(screen.queryByRole('button', { name: /tạo phòng/i })).toBeNull();
      expect(screen.queryByLabelText(/mã phòng/i)).toBeNull();
      expect(screen.queryByPlaceholderText(/mã 5 ký tự/i)).toBeNull();
      expect(screen.queryByRole('button', { name: /vào phòng/i })).toBeNull();
    });

    it('shows custom resuming message when passed in t', () => {
      render(
        <Home
          isResuming={true}
          t={{ resumingMessage: 'Đang kết nối lại phiên chơi…' }}
        />
      );

      expect(screen.getByText('Đang kết nối lại phiên chơi…')).toBeTruthy();
      expect(screen.queryByText('Đang vào lại phòng…')).toBeNull();
    });

    it('shows the normal form when isResuming is false or omitted', () => {
      render(<Home isResuming={false} />);

      expect(screen.queryByText('Đang vào lại phòng…')).toBeNull();
      expect(screen.getByLabelText(/tên người chơi/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /tạo phòng/i })).toBeTruthy();
      expect(screen.getByLabelText(/mã phòng/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /vào phòng/i })).toBeTruthy();
    });
  });

  describe('Player name and Create Room button (rules.md Phase 2 / Section 8.2)', () => {
    it('disables the create-room button when name is empty', () => {
      const onCreateRoom = vi.fn();
      render(<Home name="" onCreateRoom={onCreateRoom} />);

      const createButton = screen.getByRole('button', { name: /tạo phòng/i });
      expect(createButton.disabled).toBe(true);

      fireEvent.click(createButton);
      expect(onCreateRoom).not.toHaveBeenCalled();
    });

    it('disables the create-room button when name is undefined or null', () => {
      const onCreateRoom = vi.fn();
      render(<Home onCreateRoom={onCreateRoom} />);

      const createButton = screen.getByRole('button', { name: /tạo phòng/i });
      expect(createButton.disabled).toBe(true);

      fireEvent.click(createButton);
      expect(onCreateRoom).not.toHaveBeenCalled();
    });

    it('disables the create-room button when name is whitespace only', () => {
      const onCreateRoom = vi.fn();
      render(<Home name="    " onCreateRoom={onCreateRoom} />);

      const createButton = screen.getByRole('button', { name: /tạo phòng/i });
      expect(createButton.disabled).toBe(true);

      fireEvent.click(createButton);
      expect(onCreateRoom).not.toHaveBeenCalled();
    });

    it('disables the create-room button when name exceeds 16 characters', () => {
      const onCreateRoom = vi.fn();
      render(<Home name="12345678901234567" onCreateRoom={onCreateRoom} />);

      const createButton = screen.getByRole('button', { name: /tạo phòng/i });
      expect(createButton.disabled).toBe(true);

      fireEvent.click(createButton);
      expect(onCreateRoom).not.toHaveBeenCalled();
    });

    it('enables the create-room button for a valid 1-character name and calls onCreateRoom on click', () => {
      const onCreateRoom = vi.fn();
      render(<Home name="A" onCreateRoom={onCreateRoom} />);

      const createButton = screen.getByRole('button', { name: /tạo phòng/i });
      expect(createButton.disabled).toBe(false);

      fireEvent.click(createButton);
      expect(onCreateRoom).toHaveBeenCalledTimes(1);
    });

    it('enables the create-room button for a valid 16-character name and calls onCreateRoom on click', () => {
      const onCreateRoom = vi.fn();
      render(<Home name="NguyenVanA123456" onCreateRoom={onCreateRoom} />);

      const createButton = screen.getByRole('button', { name: /tạo phòng/i });
      expect(createButton.disabled).toBe(false);

      fireEvent.click(createButton);
      expect(onCreateRoom).toHaveBeenCalledTimes(1);
    });

    it('calls onNameChange mock when typing into the name input', () => {
      const onNameChange = vi.fn();
      render(<Home name="" onNameChange={onNameChange} />);

      const input = screen.getByLabelText(/tên người chơi/i);
      fireEvent.change(input, { target: { value: 'Minh' } });

      expect(onNameChange).toHaveBeenCalledWith('Minh');
    });
  });

  describe('Join code field and Join Room button', () => {
    it('uppercases the value passed to onJoinCodeChange when typing in the join-code field', () => {
      const onJoinCodeChange = vi.fn();
      render(<Home joinCode="" onJoinCodeChange={onJoinCodeChange} />);

      const codeInput = screen.getByLabelText(/mã phòng/i);
      fireEvent.change(codeInput, { target: { value: 'k7m2q' } });

      expect(onJoinCodeChange).toHaveBeenCalledWith('K7M2Q');
    });

    it('uppercases lowercase mixed-case input', () => {
      const onJoinCodeChange = vi.fn();
      render(<Home joinCode="" onJoinCodeChange={onJoinCodeChange} />);

      const codeInput = screen.getByLabelText(/mã phòng/i);
      fireEvent.change(codeInput, { target: { value: 'ab3cd' } });

      expect(onJoinCodeChange).toHaveBeenCalledWith('AB3CD');
    });

    it('keeps join button disabled when name is valid but join-code is empty', () => {
      const onJoinRoom = vi.fn();
      render(<Home name="Player1" joinCode="" onJoinRoom={onJoinRoom} />);

      const joinButton = screen.getByRole('button', { name: /vào phòng/i });
      expect(joinButton.disabled).toBe(true);

      fireEvent.click(joinButton);
      expect(onJoinRoom).not.toHaveBeenCalled();
    });

    it('keeps join button disabled when name is valid but join-code is under 5 characters', () => {
      const onJoinRoom = vi.fn();
      render(<Home name="Player1" joinCode="K7M2" onJoinRoom={onJoinRoom} />);

      const joinButton = screen.getByRole('button', { name: /vào phòng/i });
      expect(joinButton.disabled).toBe(true);

      fireEvent.click(joinButton);
      expect(onJoinRoom).not.toHaveBeenCalled();
    });

    it('keeps join button disabled when name is valid but join-code is over 5 characters', () => {
      const onJoinRoom = vi.fn();
      render(<Home name="Player1" joinCode="K7M2QX" onJoinRoom={onJoinRoom} />);

      const joinButton = screen.getByRole('button', { name: /vào phòng/i });
      expect(joinButton.disabled).toBe(true);

      fireEvent.click(joinButton);
      expect(onJoinRoom).not.toHaveBeenCalled();
    });

    it('keeps join button disabled when join-code has 5 characters but name is empty or invalid', () => {
      const onJoinRoom = vi.fn();
      const { rerender } = render(<Home name="" joinCode="K7M2Q" onJoinRoom={onJoinRoom} />);

      const joinButton = screen.getByRole('button', { name: /vào phòng/i });
      expect(joinButton.disabled).toBe(true);

      rerender(<Home name="   " joinCode="K7M2Q" onJoinRoom={onJoinRoom} />);
      expect(joinButton.disabled).toBe(true);

      rerender(<Home name="12345678901234567" joinCode="K7M2Q" onJoinRoom={onJoinRoom} />);
      expect(joinButton.disabled).toBe(true);

      fireEvent.click(joinButton);
      expect(onJoinRoom).not.toHaveBeenCalled();
    });

    it('enables the join button when both name is valid and join-code has 5 characters, and calls onJoinRoom on click', () => {
      const onJoinRoom = vi.fn();
      render(<Home name="Player1" joinCode="K7M2Q" onJoinRoom={onJoinRoom} />);

      const joinButton = screen.getByRole('button', { name: /vào phòng/i });
      expect(joinButton.disabled).toBe(false);

      fireEvent.click(joinButton);
      expect(onJoinRoom).toHaveBeenCalledTimes(1);
    });

    it('calls onJoinRoom when the join form is submitted with valid name and 5-char code', () => {
      const onJoinRoom = vi.fn();
      const { container } = render(<Home name="Player1" joinCode="K7M2Q" onJoinRoom={onJoinRoom} />);

      const form = container.querySelector('form.home-action-join');
      expect(form).toBeTruthy();
      fireEvent.submit(form);

      expect(onJoinRoom).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom display translations (t prop)', () => {
    it('renders custom labels and placeholders when provided in t', () => {
      const customT = {
        title: 'Mèo Nổ Custom',
        subtitle: 'Phiên bản thử nghiệm',
        nameLabel: 'Tên đại diện',
        namePlaceholder: 'Nhập biệt danh của bạn',
        createRoomButton: 'Tạo phòng mới',
        orDivider: 'hoặc chọn',
        joinCodeLabel: 'Nhập mã phòng',
        joinCodePlaceholder: 'Mã phòng 5 chữ',
        joinRoomButton: 'Vào ngay',
      };

      render(<Home t={customT} />);

      expect(screen.getByText('Mèo Nổ Custom')).toBeTruthy();
      expect(screen.getByText('Phiên bản thử nghiệm')).toBeTruthy();
      expect(screen.getByLabelText(/Tên đại diện/i)).toBeTruthy();
      expect(screen.getByPlaceholderText('Nhập biệt danh của bạn')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Tạo phòng mới' })).toBeTruthy();
      expect(screen.getByText('hoặc chọn')).toBeTruthy();
      expect(screen.getByLabelText(/Nhập mã phòng/i)).toBeTruthy();
      expect(screen.getByPlaceholderText('Mã phòng 5 chữ')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Vào ngay' })).toBeTruthy();
    });
  });
});
