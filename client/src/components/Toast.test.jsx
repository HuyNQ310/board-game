// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Toast from './Toast.jsx';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when message is empty', () => {
    const { container } = render(<Toast message="" onDismiss={vi.fn()} />);
    expect(container.querySelector('[data-testid="toast"]')).toBeNull();
  });

  it('renders error, warning, success, and info variants cleanly', () => {
    const { rerender } = render(
      <Toast message="Không tìm thấy phòng" variant="error" onDismiss={vi.fn()} />
    );

    const toastEl = screen.getByTestId('toast');
    expect(toastEl).toHaveClass('toast--error');
    expect(toastEl).toHaveAttribute('data-variant', 'error');
    expect(toastEl).toHaveAttribute('role', 'status');
    expect(toastEl).toHaveTextContent('Không tìm thấy phòng');

    rerender(<Toast message="Đã sao chép!" variant="success" onDismiss={vi.fn()} />);
    expect(screen.getByTestId('toast')).toHaveClass('toast--success');

    rerender(<Toast message="Cảnh báo" variant="warning" onDismiss={vi.fn()} />);
    expect(screen.getByTestId('toast')).toHaveClass('toast--warning');

    rerender(<Toast message="Thông tin" variant="info" onDismiss={vi.fn()} />);
    expect(screen.getByTestId('toast')).toHaveClass('toast--info');
  });

  it('calls onDismiss when clicking the close button or after durationMs', () => {
    const onDismiss = vi.fn();
    render(
      <Toast
        message="Không tìm thấy phòng"
        closeLabel="Đóng thông báo"
        durationMs={3000}
        onDismiss={onDismiss}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it('resets auto-dismiss timer when toastKey changes even with the same message', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <Toast
        message="Không tìm thấy phòng"
        toastKey={1}
        durationMs={3000}
        onDismiss={onDismiss}
      />
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    rerender(
      <Toast
        message="Không tìm thấy phòng"
        toastKey={2}
        durationMs={3000}
        onDismiss={onDismiss}
      />
    );

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
