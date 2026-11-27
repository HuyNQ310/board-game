/**
 * ConfirmDialog.jsx
 * Generic yes/no confirmation modal, styled consistently with
 * TargetPicker/PeekPanel (backdrop + centered dialog, Escape/backdrop/
 * cancel-button all dismiss it) -- used in place of the native
 * `window.confirm()` alert, which doesn't match the app's visual style and
 * can't be restyled or made accessible-consistent with the rest of the UI.
 *
 * Props:
 * - open: boolean
 * - title: string
 * - message: string
 * - confirmLabel / cancelLabel: button text (defaults: "Xác nhận" / "Hủy")
 * - onConfirm / onCancel: callbacks
 */

import { useEffect } from 'react';
import './ConfirmDialog.css';

export default function ConfirmDialog({
  open = false,
  title = 'Xác nhận',
  message = '',
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (typeof onCancel === 'function') onCancel();
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
    <div className="confirm-dialog-backdrop" onClick={handleBackdropClick} role="presentation">
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <header className="confirm-dialog__header">
          <span className="confirm-dialog__icon" aria-hidden="true">⚠️</span>
          <h2 id="confirm-dialog-title" className="confirm-dialog__title">{title}</h2>
        </header>

        <p id="confirm-dialog-message" className="confirm-dialog__message">{message}</p>

        <footer className="confirm-dialog__footer">
          <button
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--confirm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
