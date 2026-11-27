/**
 * HelpModal.jsx
 * Modal dialog displaying condensed game rules, turn structure, and card descriptions.
 *
 * Component API:
 * - HelpModal({ open, onClose, t })
 * - Pure props-driven modal component.
 * - When `open` is false, renders nothing (null).
 *
 * Expected `t` prop keys (optional UI strings):
 * - t.helpTitle: "Hướng dẫn chơi" (Dialog title)
 * - t.helpCloseButton: "Đóng" (Close button label / aria-label)
 * - t.helpAriaLabel: "Hộp thoại hướng dẫn chơi" (Accessibility label for the dialog)
 *
 * Note on content / i18n architecture:
 * As specified in requirements, the bulk of the educational rules and card descriptions
 * is maintained as condensed Vietnamese content directly inside this component rather
 * than routed through the `t`/i18n string tables, keeping long-form guide content
 * self-contained and easily readable on mobile screens.
 */

import { useEffect } from 'react';
import './HelpModal.css';

export default function HelpModal({ open = false, onClose, t = {} }) {
  // Listen for Escape key to close the dialog (conforms to project modal pattern)
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

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && typeof onClose === 'function') {
      onClose();
    }
  };

  const titleText = t.helpTitle || 'Hướng dẫn chơi';
  const closeButtonText = t.helpCloseButton || 'Đóng';

  return (
    <div
      className="help-modal-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="help-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        aria-label={t.helpAriaLabel || titleText}
      >
        <header className="help-modal-header">
          <div className="help-modal-header__title-group">
            <span className="help-modal-header__icon" aria-hidden="true">📖</span>
            <h2 id="help-modal-title" className="help-modal-header__title">
              {titleText}
            </h2>
          </div>
          <button
            type="button"
            className="help-modal-close-icon-btn"
            onClick={onClose}
            aria-label={closeButtonText}
          >
            ✕
          </button>
        </header>

        <div className="help-modal-body">
          {/* 1. Mục tiêu ván chơi */}
          <section className="help-modal-section">
            <h3 className="help-modal-section__title">🎯 Mục tiêu ván chơi</h3>
            <ul className="help-modal-list">
              <li>Người chơi sống sót cuối cùng trên bàn là người chiến thắng.</li>
              <li>Rút phải <strong>Mèo Bùm</strong> mà không có lá <strong>Kìm Cắt Dây</strong>, bạn sẽ bị nổ và bị loại khỏi ván chơi ngay lập tức.</li>
            </ul>
          </section>

          {/* 2. Cấu trúc lượt chơi cơ bản */}
          <section className="help-modal-section">
            <h3 className="help-modal-section__title">🔄 Lượt chơi của bạn</h3>
            <ul className="help-modal-list">
              <li>Trong lượt của mình, bạn có thể đánh <strong>bất kỳ số lượng lá bài hành động</strong> nào (hoặc không đánh lá nào).</li>
              <li>Lượt chơi chỉ kết thúc khi bạn thực hiện một trong các cách sau:
                <ul className="help-modal-sublist">
                  <li><strong>Rút 1 lá bài</strong>: Rút lá trên cùng của bộ rút; nếu là bài thường thì vào tay bạn và lượt kết thúc.</li>
                  <li><strong>Đánh Ngủ Trưa (Skip)</strong>: Kết thúc lượt của bạn ngay lập tức mà không cần rút bài.</li>
                  <li><strong>Đánh Truy Đuổi (Attack)</strong>: Kết thúc lượt không rút bài, ép người chơi kế tiếp phải thực hiện 2 lượt.</li>
                </ul>
              </li>
              <li>Các lá hành động khác (<em>Xáo Trộn</em>, <em>Mắt Thần</em>, <em>Nài Nỉ</em>, <em>Mèo Vằn</em>) không làm kết thúc lượt chơi.</li>
            </ul>
          </section>

          {/* 3. Khi rút phải bom */}
          <section className="help-modal-section">
            <h3 className="help-modal-section__title">💣 Khi rút phải Mèo Bùm</h3>
            <ul className="help-modal-list">
              <li><strong>Không có Kìm Cắt Dây</strong>: Bị loại khỏi ván chơi ngay lập tức. Toàn bộ bài trên tay bị chuyển vào xấp bài đã đánh.</li>
              <li><strong>Có Kìm Cắt Dây</strong>: Bạn được cứu sống! Lá Kìm Cắt Dây sẽ bị bỏ vào bài đã đánh. Bạn được bí mật chọn vị trí nhét lại Mèo Bùm vào bộ rút (từ trên cùng đến sâu nhất).</li>
            </ul>
          </section>

          {/* 4. Chi tiết 8 loại lá bài */}
          <section className="help-modal-section">
            <h3 className="help-modal-section__title">🃏 8 loại lá bài</h3>
            <div className="help-modal-cards-list">
              <div className="help-modal-card-row help-modal-card-row--boom">
                <span className="help-modal-card-row__icon" aria-hidden="true">💣</span>
                <div className="help-modal-card-row__content">
                  <span className="help-modal-card-row__name">Mèo Bùm</span>
                  <span className="help-modal-card-row__rule">Rút phải là bị loại, trừ khi có Kìm Cắt Dây. Không thể tự ý đánh ra.</span>
                </div>
              </div>

              <div className="help-modal-card-row help-modal-card-row--defuse">
                <span className="help-modal-card-row__icon" aria-hidden="true">✂️</span>
                <div className="help-modal-card-row__content">
                  <span className="help-modal-card-row__name">Kìm Cắt Dây</span>
                  <span className="help-modal-card-row__rule">Cứu mạng khi rút phải Mèo Bùm và nhét lại bom vào bộ rút. Không đánh riêng được.</span>
                </div>
              </div>

              <div className="help-modal-card-row help-modal-card-row--attack">
                <span className="help-modal-card-row__icon" aria-hidden="true">⚔️</span>
                <div className="help-modal-card-row__content">
                  <span className="help-modal-card-row__name">Truy Đuổi</span>
                  <span className="help-modal-card-row__rule">Kết thúc lượt không rút bài; người chơi kế tiếp phải thực hiện 2 lượt.</span>
                </div>
              </div>

              <div className="help-modal-card-row help-modal-card-row--skip">
                <span className="help-modal-card-row__icon" aria-hidden="true">💤</span>
                <div className="help-modal-card-row__content">
                  <span className="help-modal-card-row__name">Ngủ Trưa</span>
                  <span className="help-modal-card-row__rule">Kết thúc lượt chơi của bạn ngay lập tức mà không cần rút bài.</span>
                </div>
              </div>

              <div className="help-modal-card-row help-modal-card-row--shuffle">
                <span className="help-modal-card-row__icon" aria-hidden="true">🔀</span>
                <div className="help-modal-card-row__content">
                  <span className="help-modal-card-row__name">Xáo Trộn</span>
                  <span className="help-modal-card-row__rule">Xáo trộn lại toàn bộ bộ bài rút; lượt của bạn vẫn tiếp tục.</span>
                </div>
              </div>

              <div className="help-modal-card-row help-modal-card-row--favor">
                <span className="help-modal-card-row__icon" aria-hidden="true">🤲</span>
                <div className="help-modal-card-row__content">
                  <span className="help-modal-card-row__name">Nài Nỉ</span>
                  <span className="help-modal-card-row__rule">Chọn 1 người chơi còn sống để lấy ngẫu nhiên 1 lá bài của họ; lượt tiếp tục.</span>
                </div>
              </div>

              <div className="help-modal-card-row help-modal-card-row--peek">
                <span className="help-modal-card-row__icon" aria-hidden="true">👁️</span>
                <div className="help-modal-card-row__content">
                  <span className="help-modal-card-row__name">Mắt Thần</span>
                  <span className="help-modal-card-row__rule">Xem trước 3 lá bài trên cùng của bộ rút (chỉ mình thấy); lượt tiếp tục.</span>
                </div>
              </div>

              <div className="help-modal-card-row help-modal-card-row--cat">
                <span className="help-modal-card-row__icon" aria-hidden="true">🐱</span>
                <div className="help-modal-card-row__content">
                  <span className="help-modal-card-row__name">Mèo Vằn</span>
                  <span className="help-modal-card-row__rule">Chơi đúng 1 cặp 2 lá cùng lúc, chọn 1 người để lấy ngẫu nhiên 1 lá của họ.</span>
                </div>
              </div>
            </div>
          </section>

          {/* 5. Ràng buộc quan trọng */}
          <section className="help-modal-section">
            <h3 className="help-modal-section__title">📌 Ràng buộc quan trọng</h3>
            <ul className="help-modal-list">
              <li>Không thể nhắm vào chính mình hoặc người chơi đã bị loại.</li>
              <li>Khi bộ bài rút cạn, bài đã đánh sẽ được xáo lại thành bộ rút mới.</li>
              <li>Mỗi lượt có đồng hồ đếm ngược 30 giây suy nghĩ; hết giờ sẽ tự động rút bài.</li>
            </ul>
          </section>
        </div>

        <footer className="help-modal-footer">
          <button
            type="button"
            className="help-modal-footer__close-btn"
            onClick={onClose}
            aria-label={closeButtonText}
          >
            {closeButtonText}
          </button>
        </footer>
      </div>
    </div>
  );
}
