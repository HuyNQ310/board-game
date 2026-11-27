/**
 * PeekPanel.jsx
 * Displays the top 3 cards of the deck vertically (top-to-bottom)
 * to the player who played the "peek" (Mắt Thần) card.
 *
 * Expected `t` prop keys:
 * - t.peekTitle: "Nhìn trước 3 lá bài" (Panel title)
 * - t.peekSubtitle: "Thứ tự từ trên xuống dưới của bộ rút:" (Description)
 * - t.peekAriaLabel: "Bảng xem trước bài" (Accessibility region label)
 * - t.peekCardTop: "1. Trên cùng" (Position 1 label)
 * - t.peekCardMiddle: "2. Ở giữa" (Position 2 label)
 * - t.peekCardBottom: "3. Thứ ba" (Position 3 label)
 * - Fallback card names:
 *   t.boom, t.defuse, t.attack, t.skip, t.shuffle, t.favor, t.peek, t.cat
 *
 * Rules Spec (rules.md 8.2):
 * - When `peek` is not null: render 3 cards top-to-bottom.
 * - When `peek` is null: render nothing.
 * - Only ever shown to the player who peeked.
 */

import './PeekPanel.css';

const DEFAULT_CARD_META = {
  boom: { label: 'Mèo Bùm', icon: '💣', color: '#c0392b' },
  defuse: { label: 'Kìm Cắt Dây', icon: '✂️', color: '#16a085' },
  attack: { label: 'Truy Đuổi', icon: '⚔️', color: '#d35400' },
  skip: { label: 'Ngủ Trưa', icon: '💤', color: '#f39c12' },
  shuffle: { label: 'Xáo Trộn', icon: '🔀', color: '#27ae60' },
  favor: { label: 'Nài Nỉ', icon: '🤲', color: '#e84393' },
  peek: { label: 'Mắt Thần', icon: '👁️', color: '#2980b9' },
  cat: { label: 'Mèo Vằn', icon: '🐱', color: '#8e44ad' },
};

const POSITION_KEYS = ['peekCardTop', 'peekCardMiddle', 'peekCardBottom'];
const DEFAULT_POS_LABELS = ['1. Trên cùng', '2. Ở giữa', '3. Thứ ba'];

export default function PeekPanel({
  peek = null,
  t = {},
  renderCard,
}) {
  if (!peek || !Array.isArray(peek) || peek.length === 0) {
    return null;
  }

  return (
    <aside
      className="peek-panel"
      role="region"
      aria-label={t.peekAriaLabel || t.peekTitle || 'Bảng xem trước bài'}
      aria-live="polite"
    >
      <header className="peek-panel__header">
        <span className="peek-panel__header-icon" aria-hidden="true">👁️</span>
        <div className="peek-panel__header-text">
          <h3 className="peek-panel__title">{t.peekTitle || 'Nhìn trước 3 lá bài'}</h3>
          <p className="peek-panel__subtitle">
            {t.peekSubtitle || 'Thứ tự từ trên xuống dưới của bộ rút:'}
          </p>
        </div>
      </header>

      <ol className="peek-panel__cards-list" role="list">
        {peek.map((cardItem, index) => {
          const cardType = typeof cardItem === 'string' ? cardItem : (cardItem?.type || 'unknown');
          const meta = DEFAULT_CARD_META[cardType] || { label: cardType, icon: '🎴', color: '#555555' };
          const cardLabel = t[cardType] || meta.label;
          const posLabel = t[POSITION_KEYS[index]] || DEFAULT_POS_LABELS[index] || `${index + 1}`;

          return (
            <li
              key={`peek-card-${index}`}
              className="peek-panel__item"
              role="listitem"
            >
              <div className="peek-panel__position-badge" aria-hidden="true">
                <span className="peek-panel__position-dot" style={{ backgroundColor: meta.color }} />
                <span className="peek-panel__position-text">{posLabel}</span>
              </div>

              <div className="peek-panel__card-content">
                {typeof renderCard === 'function' ? (
                  renderCard({
                    type: cardType,
                    faceDown: false,
                    label: cardLabel,
                    selected: false,
                    disabled: false,
                  })
                ) : (
                  <div
                    className="peek-panel__fallback-card"
                    style={{ borderLeftColor: meta.color }}
                  >
                    <span className="peek-panel__fallback-icon" aria-hidden="true">
                      {meta.icon}
                    </span>
                    <span className="peek-panel__fallback-name">{cardLabel}</span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
