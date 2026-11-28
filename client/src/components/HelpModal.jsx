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
import {
  BookOpen,
  X,
  Crosshair,
  RefreshCw,
  Bomb,
  Layers,
  Scissors,
  Swords,
  Moon,
  Shuffle,
  HandHeart,
  Eye,
  Ban,
  Cat,
  Utensils,
  Cookie,
  AlertTriangle,
} from 'lucide-react';
import './HelpModal.css';

const HELP_CARDS = [
  {
    key: 'boom',
    Icon: Bomb,
    viName: 'Mèo Bùm',
    enName: 'Exploding Kitten',
    viRule: 'Rút phải là bị loại, trừ khi có Kìm Cắt Dây. Không thể tự ý đánh ra.',
    enRule: 'Eliminated if drawn, unless you have a Defuse card. Cannot be played from your hand.',
  },
  {
    key: 'defuse',
    Icon: Scissors,
    viName: 'Kìm Cắt Dây',
    enName: 'Defuse',
    viRule: 'Cứu mạng khi rút phải Mèo Bùm và nhét lại bom vào bộ rút. Không đánh riêng được.',
    enRule: 'Saves you when drawing an Exploding Kitten and lets you re-insert it into the draw pile. Cannot be played directly.',
  },
  {
    key: 'attack',
    Icon: Swords,
    viName: 'Truy Đuổi',
    enName: 'Attack',
    viRule: 'Kết thúc lượt không rút bài; người chơi kế tiếp phải thực hiện 2 lượt.',
    enRule: 'End your turn without drawing a card; the next player must take 2 turns.',
  },
  {
    key: 'skip',
    Icon: Moon,
    viName: 'Ngủ Trưa',
    enName: 'Skip',
    viRule: 'Kết thúc lượt chơi của bạn ngay lập tức mà không cần rút bài.',
    enRule: 'Immediately end your turn without drawing a card.',
  },
  {
    key: 'reverse',
    Icon: RefreshCw,
    viName: 'Đảo Chiều',
    enName: 'Reverse',
    viRule: 'Đổi hướng chơi và kết thúc lượt mà không rút bài.',
    enRule: 'Reverse the direction of play and end your turn without drawing a card.',
  },
  {
    key: 'shuffle',
    Icon: Shuffle,
    viName: 'Xáo Trộn',
    enName: 'Shuffle',
    viRule: 'Xáo trộn lại toàn bộ bộ bài rút; lượt của bạn vẫn tiếp tục.',
    enRule: 'Shuffle the entire draw pile; your turn continues.',
  },
  {
    key: 'favor',
    Icon: HandHeart,
    viName: 'Nài Nỉ',
    enName: 'Favor',
    viRule: 'Chọn 1 người chơi còn sống để lấy ngẫu nhiên 1 lá bài của họ; lượt tiếp tục.',
    enRule: 'Choose a living player to take 1 random card from their hand; your turn continues.',
  },
  {
    key: 'peek',
    Icon: Eye,
    viName: 'Mắt Thần',
    enName: 'See the Future',
    viRule: 'Xem trước 3 lá bài trên cùng của bộ rút (chỉ mình thấy); lượt tiếp tục.',
    enRule: 'Privately view the top 3 cards of the draw pile; your turn continues.',
  },
  {
    key: 'nope',
    Icon: Ban,
    viName: 'KHÔNG!',
    enName: 'Nope',
    viRule: 'Chặn bất kỳ hành động nào (kể cả một lá KHÔNG! khác), trừ lá Mèo Bùm hoặc Kìm Cắt Dây.',
    enRule: 'Stop any action (even another Nope), except an Exploding Kitten or a Defuse card.',
  },
  {
    key: 'cat',
    Icon: Cat,
    viName: 'Mèo Vằn',
    enName: 'Striped Cat',
    viRule: 'Chơi cặp 2 lá Mèo Vằn giống nhau, chọn 1 người để lấy ngẫu nhiên 1 lá của họ.',
    enRule: 'Play a pair of 2 matching Striped Cats to steal 1 random card from a chosen player.',
  },
  {
    key: 'taco',
    Icon: Utensils,
    viName: 'Mèo Taco',
    enName: 'Taco Cat',
    viRule: 'Chơi cặp 2 lá Mèo Taco giống nhau, chọn 1 người để lấy ngẫu nhiên 1 lá của họ.',
    enRule: 'Play a pair of 2 matching Taco Cats to steal 1 random card from a chosen player.',
  },
  {
    key: 'potato',
    Icon: Cookie,
    viName: 'Mèo Khoai Tây',
    enName: 'Hairy Potato Cat',
    viRule: 'Chơi cặp 2 lá Mèo Khoai Tây giống nhau, chọn 1 người để lấy ngẫu nhiên 1 lá của họ.',
    enRule: 'Play a pair of 2 matching Hairy Potato Cats to steal 1 random card from a chosen player.',
  },
];

export default function HelpModal({ open = false, onClose, t = {}, locale = 'vi' }) {
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

  const isEn = locale === 'en';
  const titleText = t.helpTitle || (isEn ? 'How to Play' : 'Hướng dẫn chơi');
  const closeButtonText = t.helpCloseButton || (isEn ? 'Close' : 'Đóng');

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
            <span className="help-modal-header__icon" aria-hidden="true">
              <BookOpen size={18} aria-hidden="true" />
            </span>
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
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="help-modal-body">
          {/* 1. Objective */}
          <section className="help-modal-section">
            <h3 className="help-modal-section__title">
              <Crosshair size={18} aria-hidden="true" />
              <span>{isEn ? 'Game Objective' : 'Mục tiêu ván chơi'}</span>
            </h3>
            {isEn ? (
              <ul className="help-modal-list">
                <li>The last surviving player at the table wins the game.</li>
                <li>If you draw an <strong>Exploding Kitten</strong> without a <strong>Defuse</strong> card, you explode and are immediately eliminated.</li>
              </ul>
            ) : (
              <ul className="help-modal-list">
                <li>Người chơi sống sót cuối cùng trên bàn là người chiến thắng.</li>
                <li>Rút phải <strong>Mèo Bùm</strong> mà không có lá <strong>Kìm Cắt Dây</strong>, bạn sẽ bị nổ và bị loại khỏi ván chơi ngay lập tức.</li>
              </ul>
            )}
          </section>

          {/* 2. Turn structure */}
          <section className="help-modal-section">
            <h3 className="help-modal-section__title">
              <RefreshCw size={18} aria-hidden="true" />
              <span>{isEn ? 'Your Turn' : 'Lượt chơi của bạn'}</span>
            </h3>
            {isEn ? (
              <ul className="help-modal-list">
                <li>During your turn, you may play <strong>any number of action cards</strong> (or none at all).</li>
                <li>Your turn only ends when you do one of the following:
                  <ul className="help-modal-sublist">
                    <li><strong>Draw 1 card</strong>: Draw the top card of the draw pile; if it is safe, it goes into your hand and your turn ends.</li>
                    <li><strong>Play Skip</strong>: End your turn immediately without drawing a card.</li>
                    <li><strong>Play Reverse</strong>: Reverse the direction of play and end your turn immediately without drawing a card.</li>
                    <li><strong>Play Attack</strong>: End your turn without drawing and force the next player to take 2 turns.</li>
                  </ul>
                </li>
                <li>Other action cards (<em>Shuffle</em>, <em>See the Future</em>, <em>Favor</em>, <em>Cat pairs</em>) do not end your turn.</li>
                <li><strong>Nope Reaction Window</strong>: Whenever someone plays an action card (except Exploding Kitten or Defuse), other living players have a short window to play <strong>Nope</strong> to cancel that action (or choose <em>Allow</em>). You can also play <strong>Nope</strong> on top of another <strong>Nope</strong> to cancel it!</li>
              </ul>
            ) : (
              <ul className="help-modal-list">
                <li>Trong lượt của mình, bạn có thể đánh <strong>bất kỳ số lượng lá bài hành động</strong> nào (hoặc không đánh lá nào).</li>
                <li>Lượt chơi chỉ kết thúc khi bạn thực hiện một trong các cách sau:
                  <ul className="help-modal-sublist">
                    <li><strong>Rút 1 lá bài</strong>: Rút lá trên cùng của bộ rút; nếu là bài thường thì vào tay bạn và lượt kết thúc.</li>
                    <li><strong>Đánh Ngủ Trưa (Skip)</strong>: Kết thúc lượt của bạn ngay lập tức mà không cần rút bài.</li>
                    <li><strong>Đánh Đảo Chiều (Reverse)</strong>: Đổi hướng vòng chơi và kết thúc lượt ngay lập tức mà không cần rút bài.</li>
                    <li><strong>Đánh Truy Đuổi (Attack)</strong>: Kết thúc lượt không rút bài, ép người chơi kế tiếp phải thực hiện 2 lượt.</li>
                  </ul>
                </li>
                <li>Các lá hành động khác (<em>Xáo Trộn</em>, <em>Mắt Thần</em>, <em>Nài Nỉ</em>, <em>cặp Mèo</em>) không làm kết thúc lượt chơi.</li>
                <li><strong>Cửa sổ phản ứng KHÔNG! (Nope)</strong>: Khi có người đánh lá hành động (trừ Mèo Bùm và Kìm Cắt Dây), những người chơi còn sống khác có thời gian ngắn để đánh <strong>KHÔNG!</strong> nhằm hủy hành động đó (hoặc chọn <em>Cho qua</em>). Bạn cũng có thể đánh <strong>KHÔNG!</strong> đè lên một lá <strong>KHÔNG!</strong> khác để vô hiệu hóa nó!</li>
              </ul>
            )}
          </section>

          {/* 3. Drawing a bomb */}
          <section className="help-modal-section">
            <h3 className="help-modal-section__title">
              <Bomb size={18} aria-hidden="true" />
              <span>{isEn ? 'Drawing an Exploding Kitten' : 'Khi rút phải Mèo Bùm'}</span>
            </h3>
            {isEn ? (
              <ul className="help-modal-list">
                <li><strong>No Defuse</strong>: Immediately eliminated from the game. Your entire hand is moved to the discard pile.</li>
                <li><strong>Have Defuse</strong>: You are saved! Your Defuse card goes to the discard pile, and you secretly choose where to place the Exploding Kitten back into the draw pile (from top to deepest).</li>
              </ul>
            ) : (
              <ul className="help-modal-list">
                <li><strong>Không có Kìm Cắt Dây</strong>: Bị loại khỏi ván chơi ngay lập tức. Toàn bộ bài trên tay bị chuyển vào xấp bài đã đánh.</li>
                <li><strong>Có Kìm Cắt Dây</strong>: Bạn được cứu sống! Lá Kìm Cắt Dây sẽ bị bỏ vào bài đã đánh. Bạn được bí mật chọn vị trí nhét lại Mèo Bùm vào bộ rút (từ trên cùng đến sâu nhất).</li>
              </ul>
            )}
          </section>

          {/* 4. 12 Card Types */}
          <section className="help-modal-section">
            <h3 className="help-modal-section__title">
              <Layers size={18} aria-hidden="true" />
              <span>{isEn ? '12 Card Types' : '12 loại lá bài'}</span>
            </h3>
            <div className="help-modal-cards-list">
              {HELP_CARDS.map(({ key, Icon, viName, enName, viRule, enRule }) => (
                <div key={key} className={`help-modal-card-row help-modal-card-row--${key}`}>
                  <span className="help-modal-card-row__icon" aria-hidden="true">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <div className="help-modal-card-row__content">
                    <span className="help-modal-card-row__name">{isEn ? enName : viName}</span>
                    <span className="help-modal-card-row__rule">{isEn ? enRule : viRule}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 5. Important rules */}
          <section className="help-modal-section">
            <h3 className="help-modal-section__title">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>{isEn ? 'Important Rules' : 'Ràng buộc quan trọng'}</span>
            </h3>
            {isEn ? (
              <ul className="help-modal-list">
                <li>You cannot target yourself or eliminated players.</li>
                <li>Cat pairs require 2 matching cards of the same breed (Striped Cat, Taco Cat, or Hairy Potato Cat).</li>
                <li>When the draw pile runs out, the discard pile is reshuffled into a new draw pile.</li>
                <li>Each turn has a 30-second countdown timer; if time runs out, you automatically draw a card.</li>
              </ul>
            ) : (
              <ul className="help-modal-list">
                <li>Không thể nhắm vào chính mình hoặc người chơi đã bị loại.</li>
                <li>Chơi cặp mèo phải dùng 2 lá cùng giống mèo (Mèo Vằn, Mèo Taco hoặc Mèo Khoai Tây).</li>
                <li>Khi bộ bài rút cạn, bài đã đánh sẽ được xáo lại thành bộ rút mới.</li>
                <li>Mỗi lượt có đồng hồ đếm ngược 30 giây suy nghĩ; hết giờ sẽ tự động rút bài.</li>
              </ul>
            )}
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
