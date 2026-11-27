/**
 * TargetPicker.jsx
 * Modal dialog for selecting a target player for "favor" and "catPair" actions.
 *
 * Expected `t` prop keys:
 * - t.targetPickerTitle: "Chọn người chơi" (Dialog title)
 * - t.targetPickerPrompt: "Chọn một người chơi còn sống:" (Dialog description / instructions)
 * - t.targetPickerAriaLabel: "Hộp thoại chọn mục tiêu" (Accessibility label for the dialog)
 * - t.cancel: "Hủy" (Cancel button label)
 * - t.noCandidates: "Không có người chơi nào để chọn" (Empty state text)
 *
 * Caller Contract:
 * - `candidates` is an array of `[{ id, name }]` already filtered to exclude
 *   the acting player and eliminated players per rules.md 4.5 & 8.2.
 * - This dialog is modal and closable via Escape key or clicking the backdrop / cancel button.
 */

import { useEffect } from 'react';
import './TargetPicker.css';

export default function TargetPicker({
  open = false,
  candidates = [],
  onPick,
  onCancel,
  t = {},
}) {
  // Listen for Escape key to close the dialog (rules.md 8.4)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (typeof onCancel === 'function') {
          onCancel();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && typeof onCancel === 'function') {
      onCancel();
    }
  };

  return (
    <div
      className="target-picker-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="target-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="target-picker-title"
        aria-describedby="target-picker-desc"
      >
        <header className="target-picker-header">
          <span className="target-picker-header__icon" aria-hidden="true">🎯</span>
          <h2 id="target-picker-title" className="target-picker-header__title">
            {t.targetPickerTitle || 'Chọn người chơi'}
          </h2>
        </header>

        <p id="target-picker-desc" className="target-picker-prompt">
          {t.targetPickerPrompt || 'Chọn một người chơi còn sống để thực hiện:'}
        </p>

        <div className="target-picker-body">
          {candidates && candidates.length > 0 ? (
            <ul className="target-picker-list" role="list">
              {candidates.map((candidate) => (
                <li key={candidate.id} className="target-picker-item">
                  <button
                    type="button"
                    className="target-picker-item__btn"
                    onClick={() => {
                      if (typeof onPick === 'function') {
                        onPick(candidate.id);
                      }
                    }}
                    aria-label={candidate.name}
                  >
                    <span className="target-picker-item__avatar" aria-hidden="true">👤</span>
                    <span className="target-picker-item__name">{candidate.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="target-picker-empty" role="status">
              {t.noCandidates || 'Không có người chơi nào để chọn'}
            </p>
          )}
        </div>

        <footer className="target-picker-footer">
          <button
            type="button"
            className="target-picker-cancel-btn"
            onClick={onCancel}
            aria-label={t.cancel || 'Hủy'}
          >
            <span className="target-picker-cancel-btn__icon" aria-hidden="true">✕</span>
            <span className="target-picker-cancel-btn__label">{t.cancel || 'Hủy'}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
