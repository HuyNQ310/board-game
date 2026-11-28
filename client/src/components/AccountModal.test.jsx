// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import AccountModal from './AccountModal.jsx';
import { getStrings } from '../i18n/index.js';

afterEach(() => {
  cleanup();
});

describe('AccountModal', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(<AccountModal open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('closes on Escape key, close button, and backdrop click', () => {
    const onClose = vi.fn();
    const { container } = render(<AccountModal open={true} onClose={onClose} />);

    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Đóng hộp thoại tài khoản' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    const backdrop = container.querySelector('.account-modal-backdrop');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('submits login credentials and displays guest note when logged out', () => {
    const onLogin = vi.fn();
    render(<AccountModal open={true} onLogin={onLogin} t={getStrings('vi')} />);

    expect(screen.getByText(/chế độ Khách/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Tên đăng nhập/i), {
      target: { value: '  meocon  ' },
    });
    fireEvent.change(screen.getByLabelText(/Mật khẩu/i), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByTestId('account-submit-btn'));

    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(onLogin).toHaveBeenCalledWith({
      username: 'meocon',
      password: 'secret123',
    });
  });

  it('switches to register mode and submits username, password, and displayName', () => {
    const onRegister = vi.fn();
    render(<AccountModal open={true} onRegister={onRegister} t={getStrings('vi')} />);

    fireEvent.click(screen.getByTestId('account-mode-register'));
    const displayNameInput = screen.getByLabelText(/Tên hiển thị/i);
    expect(displayNameInput).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Tên đăng nhập/i), {
      target: { value: 'player_one' },
    });
    fireEvent.change(screen.getByLabelText(/Mật khẩu/i), {
      target: { value: 'password123' },
    });
    fireEvent.change(displayNameInput, {
      target: { value: 'Mèo Pro' },
    });
    fireEvent.click(screen.getByTestId('account-submit-btn'));

    expect(onRegister).toHaveBeenCalledTimes(1);
    expect(onRegister).toHaveBeenCalledWith({
      username: 'player_one',
      password: 'password123',
      displayName: 'Mèo Pro',
    });
  });

  it('validates invalid fields locally and displays authError inside the form', () => {
    const onLogin = vi.fn();
    const { rerender } = render(
      <AccountModal
        open={true}
        onLogin={onLogin}
        authError="INVALID_CREDENTIALS"
        t={getStrings('vi')}
      />
    );

    expect(screen.getByTestId('account-auth-error').textContent).toContain(
      'Sai tên đăng nhập hoặc mật khẩu'
    );

    fireEvent.change(screen.getByLabelText(/Tên đăng nhập/i), {
      target: { value: 'ab' },
    });
    fireEvent.change(screen.getByLabelText(/Mật khẩu/i), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByTestId('account-submit-btn'));
    expect(onLogin).not.toHaveBeenCalled();
    expect(screen.getByTestId('account-auth-error').textContent).toContain('3 đến 20 ký tự');

    rerender(
      <AccountModal
        open={true}
        onLogin={onLogin}
        authBusy={true}
        t={getStrings('en')}
        locale="en"
      />
    );
    expect(screen.getByTestId('account-submit-btn').disabled).toBe(true);
  });

  it('shows profile stats and handles logout when user is logged in', () => {
    const onLogout = vi.fn();
    render(
      <AccountModal
        open={true}
        user={{
          id: 'u1',
          username: 'meopro',
          displayName: 'Mèo Pro',
          gamesPlayed: 12,
          wins: 5,
        }}
        onLogout={onLogout}
        t={getStrings('vi')}
      />
    );

    expect(screen.getByText('Mèo Pro')).toBeTruthy();
    expect(screen.getByText('@meopro')).toBeTruthy();
    expect(screen.getByTestId('account-stat-games').textContent).toBe('12');
    expect(screen.getByTestId('account-stat-wins').textContent).toBe('5');

    fireEvent.click(screen.getByTestId('account-logout-btn'));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('switches to leaderboard tab, calls onRefreshLeaderboard, and renders ranked rows or empty state', () => {
    const onRefreshLeaderboard = vi.fn();
    const { rerender } = render(
      <AccountModal
        open={true}
        leaderboard={[]}
        onRefreshLeaderboard={onRefreshLeaderboard}
        t={getStrings('en')}
        locale="en"
      />
    );

    fireEvent.click(screen.getByTestId('account-tab-leaderboard'));
    expect(onRefreshLeaderboard).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('account-leaderboard-empty')).toBeTruthy();
    expect(screen.getByText(/No finished matches recorded yet/i)).toBeTruthy();

    rerender(
      <AccountModal
        open={true}
        initialTab="leaderboard"
        leaderboard={[
          { id: 'u1', username: 'alice', displayName: 'Alice', wins: 8, gamesPlayed: 10 },
          { id: 'u2', username: 'bob', displayName: 'Bob', wins: 4, gamesPlayed: 9 },
        ]}
        onRefreshLeaderboard={onRefreshLeaderboard}
        t={getStrings('en')}
        locale="en"
      />
    );

    expect(screen.getByText('#1')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('@alice')).toBeTruthy();
    expect(screen.getByText('#2')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('@bob')).toBeTruthy();
  });
});
