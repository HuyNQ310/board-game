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

import './Home.css';

export function Home({
  t,
  name,
  onNameChange,
  onCreateRoom,
  onJoinRoom,
  joinCode,
  onJoinCodeChange,
  isResuming,
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

  return (
    <main className="home-screen">
      <header className="home-header">
        <h1 className="home-title">{t?.title || 'Mèo Nổ'}</h1>
        {t?.subtitle && <p className="home-subtitle">{t.subtitle}</p>}
      </header>

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
    </main>
  );
}

export default Home;
