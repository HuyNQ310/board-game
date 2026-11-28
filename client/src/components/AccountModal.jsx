import { useState, useEffect } from 'react';
import {
  User,
  Trophy,
  X,
  LogOut,
  RefreshCw,
  LogIn,
  UserPlus,
  AlertCircle,
  Info,
} from 'lucide-react';
import './AccountModal.css';

const DEFAULT_STRINGS = {
  vi: {
    title: 'Tài khoản & Xếp hạng',
    closeAriaLabel: 'Đóng hộp thoại tài khoản',
    tabAccount: 'Tài khoản',
    tabLeaderboard: 'Bảng xếp hạng',
    login: 'Đăng nhập',
    register: 'Đăng ký',
    username: 'Tên đăng nhập',
    usernamePlaceholder: '3–20 ký tự (chữ, số, _, ., -)',
    password: 'Mật khẩu',
    passwordPlaceholder: 'Ít nhất 6 ký tự',
    displayName: 'Tên hiển thị (tùy chọn)',
    displayNamePlaceholder: '1–16 ký tự (mặc định theo tên đăng nhập)',
    submit: 'Tiếp tục',
    loginSubmit: 'Đăng nhập',
    registerSubmit: 'Tạo tài khoản',
    submitting: 'Đang xử lý…',
    logout: 'Đăng xuất',
    stats: 'Thống kê cá nhân',
    gamesPlayed: 'Số ván đã chơi',
    wins: 'Số ván thắng',
    winRate: 'Tỉ lệ thắng',
    guestNote:
      'Bạn vẫn có thể chơi ngay ở chế độ Khách mà không cần đăng nhập. Đăng nhập giúp lưu giao diện bài/bàn, ngôn ngữ và thống kê thắng vào cơ sở dữ liệu.',
    leaderboardTitle: 'Bảng xếp hạng',
    leaderboardSubtitle: 'Top người chơi có số trận thắng cao nhất',
    leaderboardLoading: 'Đang tải bảng xếp hạng…',
    leaderboardEmpty: 'Chưa có trận đấu hoàn chỉnh nào được ghi nhận.',
    leaderboardRank: 'Hạng',
    leaderboardPlayer: 'Người chơi',
    leaderboardWins: 'Thắng',
    leaderboardGames: 'Số ván',
    refreshLeaderboard: 'Làm mới',
    errors: {
      USERNAME_INVALID: 'Tên đăng nhập phải từ 3 đến 20 ký tự (chữ, số, _, ., -)',
      PASSWORD_INVALID: 'Mật khẩu phải từ 6 ký tự trở lên',
      NAME_INVALID: 'Tên hiển thị phải từ 1 đến 16 ký tự',
      USERNAME_TAKEN: 'Tên đăng nhập đã được sử dụng',
      INVALID_CREDENTIALS: 'Sai tên đăng nhập hoặc mật khẩu',
      UNAUTHORIZED: 'Vui lòng đăng nhập để tiếp tục',
    },
  },
  en: {
    title: 'Account & Leaderboard',
    closeAriaLabel: 'Close account dialog',
    tabAccount: 'Account',
    tabLeaderboard: 'Leaderboard',
    login: 'Log in',
    register: 'Register',
    username: 'Username',
    usernamePlaceholder: '3–20 chars (letters, numbers, _, ., -)',
    password: 'Password',
    passwordPlaceholder: 'At least 6 characters',
    displayName: 'Display name (optional)',
    displayNamePlaceholder: '1–16 chars (defaults to username)',
    submit: 'Continue',
    loginSubmit: 'Log in',
    registerSubmit: 'Create account',
    submitting: 'Submitting…',
    logout: 'Log out',
    stats: 'Player stats',
    gamesPlayed: 'Games played',
    wins: 'Wins',
    winRate: 'Win rate',
    guestNote:
      'You can still play right away as a Guest without logging in. Logging in saves your card/table themes, language, and win stats to the database.',
    leaderboardTitle: 'Leaderboard',
    leaderboardSubtitle: 'Top players ranked by wins',
    leaderboardLoading: 'Loading leaderboard…',
    leaderboardEmpty: 'No finished matches recorded yet.',
    leaderboardRank: 'Rank',
    leaderboardPlayer: 'Player',
    leaderboardWins: 'Wins',
    leaderboardGames: 'Games',
    refreshLeaderboard: 'Refresh',
    errors: {
      USERNAME_INVALID: 'Username must be 3–20 characters (letters, numbers, _, ., -)',
      PASSWORD_INVALID: 'Password must be at least 6 characters',
      NAME_INVALID: 'Display name must be between 1 and 16 characters',
      USERNAME_TAKEN: 'Username is already taken',
      INVALID_CREDENTIALS: 'Invalid username or password',
      UNAUTHORIZED: 'Please log in to continue',
    },
  },
};

function resolveStrings(locale, t) {
  const base = locale === 'en' ? DEFAULT_STRINGS.en : DEFAULT_STRINGS.vi;
  const accountOverrides =
    t && typeof t === 'object' && t.account && typeof t.account === 'object'
      ? t.account
      : t && typeof t === 'object'
        ? t
        : {};
  const errorOverrides =
    t && typeof t === 'object' && t.errors && typeof t.errors === 'object'
      ? t.errors
      : {};

  return {
    ...base,
    ...accountOverrides,
    errors: {
      ...base.errors,
      ...errorOverrides,
    },
  };
}

/**
 * Accessible Account & Leaderboard modal dialog.
 * Supports optional login/register, logged-in profile stats, and top players leaderboard.
 */
export function AccountModal({
  open = false,
  onClose,
  user = null,
  leaderboard = [],
  loadingLeaderboard = false,
  authBusy = false,
  authError = null,
  onLogin,
  onRegister,
  onLogout,
  onRefreshLeaderboard,
  locale = 'vi',
  t = {},
  initialTab = 'account',
}) {
  const [activeTab, setActiveTab] = useState(
    initialTab === 'leaderboard' ? 'leaderboard' : 'account'
  );
  const [authMode, setAuthMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab === 'leaderboard' ? 'leaderboard' : 'account');
      setLocalError(null);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (typeof onClose === 'function') {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const strings = resolveStrings(locale, t);
  const isEn = locale === 'en';

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && typeof onClose === 'function') {
      onClose();
    }
  };

  const handleSwitchTab = (tab) => {
    setActiveTab(tab);
    if (tab === 'leaderboard') {
      onRefreshLeaderboard?.();
    }
  };

  const handleSwitchAuthMode = (mode) => {
    setAuthMode(mode);
    setLocalError(null);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (authBusy) return;

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      setLocalError(strings.errors.USERNAME_INVALID);
      return;
    }

    if (password.length < 6) {
      setLocalError(strings.errors.PASSWORD_INVALID);
      return;
    }

    const trimmedDisplayName = displayName.trim();
    if (authMode === 'register' && trimmedDisplayName.length > 16) {
      setLocalError(strings.errors.NAME_INVALID);
      return;
    }

    setLocalError(null);
    if (authMode === 'register') {
      onRegister?.({
        username: trimmedUsername,
        password,
        displayName: trimmedDisplayName || undefined,
      });
    } else {
      onLogin?.({
        username: trimmedUsername,
        password,
      });
    }
  };

  const rawError = localError || authError;
  const resolvedError = rawError
    ? strings.errors[rawError] || String(rawError)
    : null;

  const gamesPlayed = Number(user?.gamesPlayed ?? 0);
  const wins = Number(user?.wins ?? 0);
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  const avatarInitial = (user?.displayName || user?.username || 'M')
    .trim()
    .charAt(0)
    .toUpperCase();

  const submitLabel = authBusy
    ? strings.submitting
    : authMode === 'register'
      ? strings.registerSubmit || strings.register
      : strings.loginSubmit || strings.login;

  const entries = Array.isArray(leaderboard) ? leaderboard : [];

  return (
    <div
      className="account-modal-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="account-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
      >
        <header className="account-modal-header">
          <div className="account-modal-header__title-group">
            <span className="account-modal-header__icon" aria-hidden="true">
              {activeTab === 'leaderboard' ? (
                <Trophy size={18} aria-hidden="true" />
              ) : (
                <User size={18} aria-hidden="true" />
              )}
            </span>
            <h2 id="account-modal-title" className="account-modal-header__title">
              {strings.title}
            </h2>
          </div>
          <button
            type="button"
            className="account-modal-close-btn"
            onClick={onClose}
            aria-label={strings.closeAriaLabel}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="account-modal-tabs" role="tablist" aria-label={strings.title}>
          <button
            type="button"
            role="tab"
            id="tab-account"
            aria-selected={activeTab === 'account'}
            aria-controls="panel-account"
            className={`account-modal-tab ${activeTab === 'account' ? 'account-modal-tab--active' : ''}`}
            onClick={() => handleSwitchTab('account')}
            data-testid="account-tab-account"
          >
            <User size={16} aria-hidden="true" />
            <span>{strings.tabAccount}</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-leaderboard"
            aria-selected={activeTab === 'leaderboard'}
            aria-controls="panel-leaderboard"
            className={`account-modal-tab ${activeTab === 'leaderboard' ? 'account-modal-tab--active' : ''}`}
            onClick={() => handleSwitchTab('leaderboard')}
            data-testid="account-tab-leaderboard"
          >
            <Trophy size={16} aria-hidden="true" />
            <span>{strings.tabLeaderboard}</span>
          </button>
        </div>

        <div className="account-modal-body">
          {activeTab === 'account' ? (
            <section
              id="panel-account"
              role="tabpanel"
              aria-labelledby="tab-account"
              className="account-modal-panel"
            >
              {user ? (
                <div className="account-profile">
                  <div className="account-profile-card">
                    <div className="account-profile-avatar" aria-hidden="true">
                      {avatarInitial}
                    </div>
                    <div className="account-profile-identity">
                      <div className="account-profile-display-name">
                        {user.displayName}
                      </div>
                      <div className="account-profile-username">
                        @{user.username}
                      </div>
                    </div>
                  </div>

                  <div className="account-stats-section">
                    <h3 className="account-section-heading">{strings.stats}</h3>
                    <div className="account-stats-grid">
                      <div className="account-stat-card">
                        <span className="account-stat-value" data-testid="account-stat-games">
                          {gamesPlayed}
                        </span>
                        <span className="account-stat-label">
                          {strings.gamesPlayed}
                        </span>
                      </div>
                      <div className="account-stat-card">
                        <span className="account-stat-value" data-testid="account-stat-wins">
                          {wins}
                        </span>
                        <span className="account-stat-label">
                          {strings.wins}
                        </span>
                      </div>
                      <div className="account-stat-card">
                        <span className="account-stat-value">
                          {winRate}%
                        </span>
                        <span className="account-stat-label">
                          {strings.winRate}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="account-btn account-btn--danger"
                    onClick={() => onLogout?.()}
                    disabled={authBusy}
                    data-testid="account-logout-btn"
                  >
                    <LogOut size={16} aria-hidden="true" />
                    <span>{strings.logout}</span>
                  </button>
                </div>
              ) : (
                <div className="account-auth">
                  <div
                    className="account-mode-switch"
                    role="group"
                    aria-label={isEn ? 'Authentication mode' : 'Chế độ tài khoản'}
                  >
                    <button
                      type="button"
                      className={`account-mode-btn ${authMode === 'login' ? 'account-mode-btn--active' : ''}`}
                      aria-pressed={authMode === 'login'}
                      onClick={() => handleSwitchAuthMode('login')}
                      data-testid="account-mode-login"
                    >
                      <LogIn size={15} aria-hidden="true" />
                      <span>{strings.login}</span>
                    </button>
                    <button
                      type="button"
                      className={`account-mode-btn ${authMode === 'register' ? 'account-mode-btn--active' : ''}`}
                      aria-pressed={authMode === 'register'}
                      onClick={() => handleSwitchAuthMode('register')}
                      data-testid="account-mode-register"
                    >
                      <UserPlus size={15} aria-hidden="true" />
                      <span>{strings.register}</span>
                    </button>
                  </div>

                  <form className="account-form" onSubmit={handleFormSubmit} noValidate>
                    {resolvedError && (
                      <div
                        className="account-modal-error"
                        role="alert"
                        data-testid="account-auth-error"
                      >
                        <AlertCircle size={16} aria-hidden="true" />
                        <span>{resolvedError}</span>
                      </div>
                    )}

                    <div className="account-field">
                      <label htmlFor="account-username" className="account-label">
                        {strings.username}
                        <span className="account-required" aria-hidden="true"> *</span>
                      </label>
                      <input
                        id="account-username"
                        name="username"
                        type="text"
                        className="account-input"
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          if (localError) setLocalError(null);
                        }}
                        placeholder={strings.usernamePlaceholder}
                        minLength={3}
                        maxLength={20}
                        required
                        autoComplete="username"
                        disabled={authBusy}
                      />
                    </div>

                    <div className="account-field">
                      <label htmlFor="account-password" className="account-label">
                        {strings.password}
                        <span className="account-required" aria-hidden="true"> *</span>
                      </label>
                      <input
                        id="account-password"
                        name="password"
                        type="password"
                        className="account-input"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (localError) setLocalError(null);
                        }}
                        placeholder={strings.passwordPlaceholder}
                        minLength={6}
                        required
                        autoComplete={
                          authMode === 'login' ? 'current-password' : 'new-password'
                        }
                        disabled={authBusy}
                      />
                    </div>

                    {authMode === 'register' && (
                      <div className="account-field">
                        <label htmlFor="account-display-name" className="account-label">
                          {strings.displayName}
                        </label>
                        <input
                          id="account-display-name"
                          name="displayName"
                          type="text"
                          className="account-input"
                          value={displayName}
                          onChange={(e) => {
                            setDisplayName(e.target.value);
                            if (localError) setLocalError(null);
                          }}
                          placeholder={strings.displayNamePlaceholder}
                          maxLength={16}
                          autoComplete="nickname"
                          disabled={authBusy}
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      className="account-btn account-btn--primary"
                      disabled={authBusy}
                      data-testid="account-submit-btn"
                    >
                      {submitLabel}
                    </button>
                  </form>

                  <div className="account-modal-guest-note">
                    <Info size={16} aria-hidden="true" className="account-modal-guest-note__icon" />
                    <p>{strings.guestNote}</p>
                  </div>
                </div>
              )}
            </section>
          ) : (
            <section
              id="panel-leaderboard"
              role="tabpanel"
              aria-labelledby="tab-leaderboard"
              className="account-modal-panel"
            >
              <div className="account-leaderboard-header">
                <div>
                  <h3 className="account-section-heading">{strings.leaderboardTitle}</h3>
                  <p className="account-leaderboard-subtitle">{strings.leaderboardSubtitle}</p>
                </div>
                {typeof onRefreshLeaderboard === 'function' && (
                  <button
                    type="button"
                    className="account-refresh-btn"
                    onClick={() => onRefreshLeaderboard()}
                    disabled={loadingLeaderboard}
                    aria-label={strings.refreshLeaderboard}
                    data-testid="account-refresh-leaderboard-btn"
                  >
                    <RefreshCw
                      size={15}
                      aria-hidden="true"
                      className={loadingLeaderboard ? 'account-spin' : ''}
                    />
                    <span>{strings.refreshLeaderboard}</span>
                  </button>
                )}
              </div>

              {loadingLeaderboard && entries.length === 0 ? (
                <div className="account-leaderboard-state" role="status">
                  <RefreshCw size={20} aria-hidden="true" className="account-spin" />
                  <span>{strings.leaderboardLoading}</span>
                </div>
              ) : entries.length === 0 ? (
                <div className="account-leaderboard-state" data-testid="account-leaderboard-empty">
                  <Trophy size={24} aria-hidden="true" />
                  <span>{strings.leaderboardEmpty}</span>
                </div>
              ) : (
                <div className="account-leaderboard-table-wrap">
                  <table className="account-leaderboard-table">
                    <thead>
                      <tr>
                        <th scope="col">{strings.leaderboardRank}</th>
                        <th scope="col">{strings.leaderboardPlayer}</th>
                        <th scope="col" className="account-num-col">{strings.leaderboardWins}</th>
                        <th scope="col" className="account-num-col">{strings.leaderboardGames}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, index) => {
                        const rank = index + 1;
                        const isSelf =
                          user &&
                          ((entry.id && user.id && entry.id === user.id) ||
                            (entry.username &&
                              user.username &&
                              entry.username.toLowerCase() === user.username.toLowerCase()));
                        return (
                          <tr
                            key={entry.id || entry.username || rank}
                            className={`account-leaderboard-row ${isSelf ? 'account-leaderboard-row--self' : ''}`}
                          >
                            <td className="account-rank-cell">
                              <span
                                className={`account-rank-badge ${rank <= 3 ? `account-rank-badge--top${rank}` : ''}`}
                              >
                                #{rank}
                              </span>
                            </td>
                            <td className="account-player-cell">
                              <span className="account-player-name">
                                {entry.displayName || entry.username}
                              </span>
                              <span className="account-player-handle">
                                @{entry.username}
                              </span>
                            </td>
                            <td className="account-num-col account-wins-cell">
                              {entry.wins ?? 0}
                            </td>
                            <td className="account-num-col">
                              {entry.gamesPlayed ?? 0}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default AccountModal;
