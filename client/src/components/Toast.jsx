import { useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import './Toast.css';

const VARIANT_ICONS = {
  error: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};

export function Toast({
  message,
  variant = 'error',
  toastKey,
  closeLabel = 'Đóng thông báo',
  durationMs = 3600,
  onDismiss,
}) {
  useEffect(() => {
    if (!message) return undefined;

    const timer = setTimeout(() => {
      if (typeof onDismiss === 'function') {
        onDismiss();
      }
    }, durationMs);

    return () => clearTimeout(timer);
  }, [message, toastKey, durationMs, onDismiss]);

  if (!message) {
    return null;
  }

  const normalizedVariant = VARIANT_ICONS[variant] ? variant : 'info';
  const Icon = VARIANT_ICONS[normalizedVariant];
  const renderKey = toastKey ?? `${normalizedVariant}:${message}`;

  return (
    <div
      key={renderKey}
      className={`toast toast--${normalizedVariant}`}
      role="status"
      aria-live={normalizedVariant === 'error' ? 'assertive' : 'polite'}
      data-testid="toast"
      data-variant={normalizedVariant}
      style={{ '--toast-duration': `${durationMs}ms` }}
    >
      <span className="toast__icon" aria-hidden="true">
        <Icon size={18} strokeWidth={2.25} />
      </span>
      <div className="toast__message">{message}</div>
      {typeof onDismiss === 'function' && (
        <button
          type="button"
          className="toast__dismiss"
          onClick={onDismiss}
          aria-label={closeLabel}
          title={closeLabel}
        >
          <X size={16} strokeWidth={2.25} aria-hidden="true" />
        </button>
      )}
      <span className="toast__progress" aria-hidden="true" />
    </div>
  );
}

export default Toast;
