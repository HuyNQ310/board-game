import React, { useEffect } from 'react';
import './Toast.css';

export function Toast({ message, onDismiss }) {
  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      if (typeof onDismiss === 'function') {
        onDismiss();
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) {
    return null;
  }

  return (
    <div
      className="toast"
      role="status"
      aria-live="polite"
      data-testid="toast"
    >
      <div className="toast__message">{message}</div>
      {typeof onDismiss === 'function' && (
        <button
          type="button"
          className="toast__dismiss"
          onClick={onDismiss}
          aria-label="Đóng thông báo"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default Toast;
