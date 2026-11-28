/**
 * Shape of `t` (translations / display strings) expected by Home:
 * - t.title: Title of the game / screen (default: "Mèo Nổ")
 * - t.subtitle: Subtitle or tagline (optional, e.g. "Game thẻ bài sinh tồn")
 * - t.nameLabel: Label for player name input (default: "Tên người chơi")
 * - t.namePlaceholder: Placeholder for name input (default: "Nhập tên của bạn (1-16 ký tự)")
 * - t.createRoomButton: Text for create room button (default: "Tạo phòng")
 * - t.orDivider: Text dividing create and join actions (default: "hoặc")
 * - t.joinCodeLabel: Label for room code input (default: "Mã phòng")
 * - t.joinCodePlaceholder: Placeholder for room code (default: "Mã 5 ký tự")
 * - t.joinRoomButton: Text for join room button (default: "Vào phòng")
 * - t.resumingMessage: Message shown when auto-reconnecting (default: "Đang vào lại phòng…")
 */

import { Bomb, Palette, Layers, Zap, Smartphone } from 'lucide-react';
import Card from '../components/Card.jsx';
import LocaleFlag from '../components/FlagIcon.jsx';
import './Home.css';

const PREVIEW_CARDS = [
  { type: 'boom', vi: 'Mèo Bùm', en: 'Boom Cat' },
  { type: 'nope', vi: 'KHÔNG!', en: 'Nope!' },
  { type: 'reverse', vi: 'Đảo Chiều', en: 'Reverse' },
  { type: 'defuse', vi: 'Kìm Cắt Dây', en: 'Defuse' },
];

const FEATURE_PILLS = {
  vi: [
    { icon: Layers, text: '12 loại lá bài' },
    { icon: Zap, text: 'KHÔNG! & Đảo Chiều' },
    { icon: Smartphone, text: 'Mobile & Desktop' },
  ],
  en: [
    { icon: Layers, text: '12 Card Types' },
    { icon: Zap, text: 'NOPE! & Reverse' },
    { icon: Smartphone, text: 'Mobile & Desktop' },
  ],
};

export function Home({
  t,
  name,
  onNameChange,
  onCreateRoom,
  onJoinRoom,
  joinCode,
  onJoinCodeChange,
  isResuming,
  onOpenThemePicker,
  onToggleLocale,
  cardTheme = 'deck1',
  tableTheme = 'pastel-green',
  locale = 'vi',
}) {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const isNameValid = trimmedName.length >= 1 && trimmedName.length <= 16;

  const trimmedJoinCode = typeof joinCode === 'string' ? joinCode.trim() : '';
  const isJoinCodeValid = trimmedJoinCode.length === 5;
  const canJoin = isNameValid && isJoinCodeValid;

  const handleNameChange = (e) => {
    onNameChange?.(e.target.value);
  };

  const handleJoinCodeChange = (e) => {
    const uppercased = e.target.value.toUpperCase();
    onJoinCodeChange?.(uppercased);
  };

  const handleCreateClick = (e) => {
    e.preventDefault();
    if (isNameValid) {
      onCreateRoom?.();
    }
  };

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (canJoin) {
      onJoinRoom?.();
    }
  };

  const isEn = locale === 'en';
  const featurePills = isEn ? FEATURE_PILLS.en : FEATURE_PILLS.vi;

  return (
    <main className="home-screen" data-table-theme={tableTheme}>
      <div className="home-topbar">
        <div className="home-brand-badge">
          <Bomb size={16} aria-hidden="true" />
          <span>{isEn ? 'Exploding Kittens • 2–10 players' : 'Mèo Nổ • 2–10 người'}</span>
        </div>

        {(typeof onToggleLocale === 'function' || typeof onOpenThemePicker === 'function') && (
          <div className="home-topbar-actions">
            {typeof onToggleLocale === 'function' && (
              <button
                type="button"
                className="btn btn-lang-toggle"
                onClick={onToggleLocale}
                aria-label={isEn ? 'Switch to Vietnamese' : 'Chuyển sang Tiếng Anh'}
                data-testid="lang-toggle-btn"
              >
                <LocaleFlag locale={locale} size={18} />
                <span>{isEn ? 'EN' : 'VI'}</span>
              </button>
            )}

            {typeof onOpenThemePicker === 'function' && (
              <button
                type="button"
                className="btn btn-theme-picker"
                onClick={onOpenThemePicker}
                aria-label={isEn ? 'Choose card & table theme' : 'Chọn giao diện bài và bàn'}
              >
                <Palette size={16} aria-hidden="true" />
                <span>{isEn ? 'Themes' : 'Giao diện'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      <section className="home-hero">
        <header className="home-showcase home-header">
          <h1 className="home-title">{t?.title || 'Mèo Nổ'}</h1>
          {t?.subtitle && <p className="home-subtitle">{t.subtitle}</p>}

          <div className="home-card-fan" aria-hidden="true">
            {PREVIEW_CARDS.map((card, index) => (
              <div
                key={card.type}
                className={`home-card-fan__item home-card-fan__item--${index}`}
              >
                <Card
                  type={card.type}
                  label={locale === 'en' ? card.en : card.vi}
                  cardTheme={cardTheme}
                  locale={locale}
                />
              </div>
            ))}
          </div>

          <ul className="home-feature-pills" aria-label={isEn ? 'Highlights' : 'Điểm nổi bật'}>
            {featurePills.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="home-feature-pill"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </header>

        <div className="home-panel">
          {isResuming ? (
            <div className="home-card home-resuming" role="status" aria-live="polite">
              <div className="home-spinner" aria-hidden="true" />
              <p className="home-resuming-text">
                {t?.resumingMessage || 'Đang vào lại phòng…'}
              </p>
            </div>
          ) : (
            <div className="home-card">
              {/* Player Name Input (Required) */}
              <div className="home-field">
                <label htmlFor="player-name" className="home-label">
                  {t?.nameLabel || 'Tên người chơi'}
                  <span className="home-required" aria-hidden="true"> *</span>
                </label>
                <input
                  id="player-name"
                  type="text"
                  className="home-input"
                  value={name || ''}
                  onChange={handleNameChange}
                  placeholder={t?.namePlaceholder || 'Nhập tên của bạn (1-16 ký tự)'}
                  maxLength={16}
                  required
                  autoComplete="nickname"
                />
              </div>

              {/* Create Room Button */}
              <div className="home-action-create">
                <button
                  type="button"
                  className="btn btn-primary home-btn-create"
                  onClick={handleCreateClick}
                  disabled={!isNameValid}
                >
                  {t?.createRoomButton || 'Tạo phòng'}
                </button>
              </div>

              {/* Section Divider */}
              <div className="home-divider" role="separator">
                <span>{t?.orDivider || 'hoặc'}</span>
              </div>

              {/* Join Room Form */}
              <form className="home-action-join" onSubmit={handleJoinSubmit}>
                <div className="home-field">
                  <label htmlFor="join-code" className="home-label">
                    {t?.joinCodeLabel || 'Mã phòng'}
                  </label>
                  <input
                    id="join-code"
                    type="text"
                    className="home-input home-input-code"
                    value={joinCode || ''}
                    onChange={handleJoinCodeChange}
                    placeholder={t?.joinCodePlaceholder || 'Mã 5 ký tự'}
                    maxLength={5}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-secondary home-btn-join"
                  disabled={!canJoin}
                >
                  {t?.joinRoomButton || 'Vào phòng'}
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default Home;
