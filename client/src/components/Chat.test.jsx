// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Chat } from './Chat.jsx';

afterEach(() => {
  cleanup();
});

describe('Chat', () => {
  it('opens .chat-panel and focuses the chat message input when pressing Enter on window while closed', () => {
    const messages = [{ id: '1', playerId: 'p2', name: 'An', text: 'Chào!', at: Date.now() }];
    const { container } = render(<Chat messages={messages} myPlayerId="p1" onSend={vi.fn()} />);

    expect(screen.getByTestId('chat-toggle-btn')).toBeDefined();
    expect(screen.getByTestId('chat-unread-badge').textContent).toBe('1');
    expect(container.querySelector('.chat-panel')).toBeNull();

    const wasNotPrevented = fireEvent.keyDown(window, { key: 'Enter' });
    expect(wasNotPrevented).toBe(false);

    const panel = container.querySelector('.chat-panel');
    expect(panel).not.toBeNull();
    const input = screen.getByTestId('chat-input');
    expect(document.activeElement).toBe(input);
  });

  it('does NOT open Chat on Enter when focus or target is an interactive element', () => {
    const { container } = render(
      <div>
        <button type="button" data-testid="other-btn">
          Rút bài
        </button>
        <input type="text" data-testid="other-input" />
        <div contentEditable="true" suppressContentEditableWarning tabIndex={0} data-testid="editable-div" />
        <Chat messages={[]} myPlayerId="p1" onSend={vi.fn()} />
      </div>
    );

    const otherBtn = screen.getByTestId('other-btn');
    otherBtn.focus();
    fireEvent.keyDown(otherBtn, { key: 'Enter' });
    expect(container.querySelector('.chat-panel')).toBeNull();

    const otherInput = screen.getByTestId('other-input');
    otherInput.focus();
    fireEvent.keyDown(otherInput, { key: 'Enter' });
    expect(container.querySelector('.chat-panel')).toBeNull();

    const editable = screen.getByTestId('editable-div');
    editable.focus();
    fireEvent.keyDown(editable, { key: 'Enter' });
    expect(container.querySelector('.chat-panel')).toBeNull();
  });

  it('does NOT open Chat on Enter when focus or target is inside a modal dialog or backdrop', () => {
    const { container } = render(
      <div>
        <div role="dialog" tabIndex={-1} data-testid="modal-dialog">
          <div data-testid="dialog-inner" tabIndex={0}>
            Modal content
          </div>
        </div>
        <div className="defuse-dialog-backdrop">
          <div data-testid="defuse-inner" tabIndex={0}>
            Defuse
          </div>
        </div>
        <Chat messages={[]} myPlayerId="p1" onSend={vi.fn()} />
      </div>
    );

    const dialogInner = screen.getByTestId('dialog-inner');
    dialogInner.focus();
    fireEvent.keyDown(dialogInner, { key: 'Enter' });
    expect(container.querySelector('.chat-panel')).toBeNull();

    const defuseInner = screen.getByTestId('defuse-inner');
    defuseInner.focus();
    fireEvent.keyDown(defuseInner, { key: 'Enter' });
    expect(container.querySelector('.chat-panel')).toBeNull();
  });

  it('does NOT open Chat on Enter with modifier keys, repeat, or defaultPrevented', () => {
    const { container } = render(<Chat messages={[]} myPlayerId="p1" onSend={vi.fn()} />);

    fireEvent.keyDown(window, { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'Enter', metaKey: true });
    fireEvent.keyDown(window, { key: 'Enter', altKey: true });
    fireEvent.keyDown(window, { key: 'Enter', repeat: true });

    const preventedEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    preventedEvent.preventDefault();
    window.dispatchEvent(preventedEvent);

    expect(container.querySelector('.chat-panel')).toBeNull();
  });

  it('closes Chat on Escape and submits message on Enter while open', () => {
    const onSend = vi.fn();
    const { container } = render(<Chat messages={[]} myPlayerId="p1" onSend={onSend} />);

    // Open via Enter on window
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(container.querySelector('.chat-panel')).not.toBeNull();

    const input = screen.getByTestId('chat-input');
    expect(document.activeElement).toBe(input);

    // Type message and submit with Enter
    fireEvent.change(input, { target: { value: '  Xin chào!  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('Xin chào!');
    expect(input.value).toBe('');

    // Close via Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('.chat-panel')).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId('chat-toggle-btn'));
  });

  it('opens player controls drawer and toggles per-player voice and chat mute callbacks with aria-pressed', () => {
    const players = [
      { id: 'p1', name: 'Tôi', connected: true },
      { id: 'p2', name: 'An', connected: true },
      { id: 'p3', name: 'Bình', connected: false },
    ];
    const mutedVoice = new Set();
    const mutedChat = [];
    const onToggleMuteVoice = vi.fn();
    const onToggleMuteChat = vi.fn();

    const { rerender, container } = render(
      <Chat
        messages={[]}
        myPlayerId="p1"
        onSend={vi.fn()}
        players={players}
        voicePeers={{ p2: { micOn: true, speaking: true } }}
        mutedVoiceIds={mutedVoice}
        mutedChatIds={mutedChat}
        onToggleMuteVoice={onToggleMuteVoice}
        onToggleMuteChat={onToggleMuteChat}
      />
    );

    // Open chat panel
    fireEvent.click(screen.getByTestId('chat-toggle-btn'));

    const filtersBtn = screen.getByTestId('chat-player-filters-btn');
    expect(filtersBtn.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('chat-player-filters')).toBeNull();
    expect(screen.queryByTestId('chat-player-filters-badge')).toBeNull();

    // Open player controls drawer
    fireEvent.click(filtersBtn);
    expect(filtersBtn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('chat-player-filters')).toBeDefined();

    // Only other players (p2, p3) are listed, not myPlayerId (p1)
    expect(screen.queryByTestId('chat-player-row-p1')).toBeNull();
    expect(screen.getByTestId('chat-player-row-p2')).toBeDefined();
    expect(screen.getByTestId('chat-player-row-p3')).toBeDefined();

    // Speaking indicator shown for p2 when speaking && !isVoiceMuted
    expect(container.querySelector('[data-testid="chat-player-row-p2"] .chat-player-row__speaking')).not.toBeNull();

    const voiceBtnP2 = screen.getByTestId('chat-filter-voice-p2');
    const chatBtnP2 = screen.getByTestId('chat-filter-chat-p2');
    expect(voiceBtnP2.getAttribute('aria-pressed')).toBe('false');
    expect(chatBtnP2.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(voiceBtnP2);
    expect(onToggleMuteVoice).toHaveBeenCalledTimes(1);
    expect(onToggleMuteVoice).toHaveBeenCalledWith('p2');

    fireEvent.click(chatBtnP2);
    expect(onToggleMuteChat).toHaveBeenCalledTimes(1);
    expect(onToggleMuteChat).toHaveBeenCalledWith('p2');

    // Rerender with p2 muted for both voice and chat
    rerender(
      <Chat
        messages={[]}
        myPlayerId="p1"
        onSend={vi.fn()}
        players={players}
        voicePeers={{ p2: { micOn: true, speaking: true } }}
        mutedVoiceIds={new Set(['p2'])}
        mutedChatIds={['p2']}
        onToggleMuteVoice={onToggleMuteVoice}
        onToggleMuteChat={onToggleMuteChat}
      />
    );

    expect(screen.getByTestId('chat-filter-voice-p2').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('chat-filter-chat-p2').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('chat-player-filters-badge').textContent).toBe('1');
    // Speaking indicator hidden once voice is muted
    expect(container.querySelector('[data-testid="chat-player-row-p2"] .chat-player-row__speaking')).toBeNull();
  });

  it('shows localized empty state in player controls drawer when there are no other players', () => {
    render(
      <Chat
        messages={[]}
        myPlayerId="p1"
        onSend={vi.fn()}
        players={[{ id: 'p1', name: 'Tôi', connected: true }]}
        onToggleMuteVoice={vi.fn()}
        onToggleMuteChat={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('chat-toggle-btn'));
    fireEvent.click(screen.getByTestId('chat-player-filters-btn'));
    expect(screen.getByTestId('chat-player-filters-empty').textContent).toBe('Chưa có người chơi khác');
  });

  it('filters out messages from players in mutedChatIds and does not increment unread badge', () => {
    const baseTime = Date.now();
    const initialMessages = [
      { id: 'm1', playerId: 'p2', name: 'An', text: 'Tin bị ẩn', at: baseTime },
      { id: 'm2', playerId: 'p3', name: 'Bình', text: 'Xin chào mọi người', at: baseTime + 1000 },
    ];

    const { rerender } = render(
      <Chat
        messages={initialMessages}
        myPlayerId="p1"
        onSend={vi.fn()}
        mutedChatIds={new Set(['p2'])}
      />
    );

    // Only p3's message counts toward unread badge (1, not 2)
    expect(screen.getByTestId('chat-unread-badge').textContent).toBe('1');

    // Another message from muted player p2 arrives while closed -> badge stays 1
    rerender(
      <Chat
        messages={[
          ...initialMessages,
          { id: 'm3', playerId: 'p2', name: 'An', text: 'Spam bị ẩn', at: baseTime + 2000 },
        ]}
        myPlayerId="p1"
        onSend={vi.fn()}
        mutedChatIds={new Set(['p2'])}
      />
    );
    expect(screen.getByTestId('chat-unread-badge').textContent).toBe('1');

    // Open chat panel and verify only p3's message is rendered
    fireEvent.click(screen.getByTestId('chat-toggle-btn'));
    expect(screen.queryByText('Tin bị ẩn')).toBeNull();
    expect(screen.queryByText('Spam bị ẩn')).toBeNull();
    expect(screen.getByText('Xin chào mọi người')).toBeDefined();
  });

  it('renders mic toggle button in header when onToggleMic is provided and invokes it on click', () => {
    const onToggleMic = vi.fn();
    const { rerender } = render(
      <Chat
        messages={[]}
        myPlayerId="p1"
        onSend={vi.fn()}
        micOn={false}
        micBusy={false}
        onToggleMic={onToggleMic}
      />
    );

    fireEvent.click(screen.getByTestId('chat-toggle-btn'));

    const micBtn = screen.getByTestId('chat-mic-toggle-btn');
    expect(micBtn.getAttribute('aria-pressed')).toBe('false');
    expect(micBtn.disabled).toBe(false);

    fireEvent.click(micBtn);
    expect(onToggleMic).toHaveBeenCalledTimes(1);

    rerender(
      <Chat
        messages={[]}
        myPlayerId="p1"
        onSend={vi.fn()}
        micOn={true}
        micBusy={true}
        onToggleMic={onToggleMic}
      />
    );

    const activeMicBtn = screen.getByTestId('chat-mic-toggle-btn');
    expect(activeMicBtn.getAttribute('aria-pressed')).toBe('true');
    expect(activeMicBtn.className).toContain('is-active');
    expect(activeMicBtn.disabled).toBe(true);
  });
});
