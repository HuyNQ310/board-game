export default {
  // 16 error messages from rules.md section 6.2
  errors: {
    NAME_INVALID: 'Tên phải từ 1 đến 16 ký tự',
    ROOM_NOT_FOUND: 'Không tìm thấy phòng',
    ROOM_FULL: 'Phòng đã đủ 10 người',
    ROOM_PLAYING: 'Phòng đang chơi, không thể vào lúc này',
    NOT_IN_ROOM: 'Bạn không còn trong phòng này',
    NOT_HOST: 'Chỉ chủ phòng mới làm được việc này',
    NEED_TWO_PLAYERS: 'Cần ít nhất 2 người đang kết nối để bắt đầu',
    NOT_YOUR_TURN: 'Chưa đến lượt bạn',
    DEFUSE_PENDING: 'Bạn đang phải gỡ bom',
    NO_CARD: 'Không có lá này trong tay',
    INVALID_CARD: 'Lá này không thể đánh riêng',
    INVALID_TARGET: 'Mục tiêu không hợp lệ',
    INVALID_ACTION: 'Hành động không hợp lệ',
    GAME_OVER: 'Ván đã kết thúc',
    RATE_LIMIT: 'Thao tác quá nhanh, thử lại sau chút',
    SERVER_ERROR: 'Có lỗi xảy ra, vui lòng thử lại',
    SESSION_REPLACED: 'Phiên kết nối đã được mở ở một tab hoặc thiết bị khác',
    CREATE_ROOM_FAILED: 'Không thể tạo phòng',
    JOIN_ROOM_FAILED: 'Không thể vào phòng',
    START_GAME_FAILED: 'Không thể bắt đầu ván',
    REMATCH_FAILED: 'Không thể chơi lại',
  },

  // Screen strings: Home (section 8.2)
  home: {
    nameLabel: 'Tên người chơi',
    namePlaceholder: 'Nhập tên của bạn (1-16 ký tự)',
    roomCodeLabel: 'Mã phòng',
    roomCodePlaceholder: 'Nhập mã phòng 5 ký tự',
    createRoom: 'Tạo phòng',
    joinRoom: 'Vào phòng',
    rejoining: 'Đang vào lại phòng…',
  },

  // Lobby strings (section 8.2)
  lobby: {
    title: 'Phòng chờ',
    roomCode: 'Mã phòng',
    copy: 'Sao chép',
    copied: 'Đã sao chép!',
    copyAriaLabel: 'Sao chép mã phòng',
    share: 'Chia sẻ',
    shareAriaLabel: 'Chia sẻ mã phòng',
    shareTitle: 'Mèo Nổ',
    shareText: (code) => `Mã phòng Mèo Nổ: ${code}`,
    players: 'Danh sách người chơi',
    seatLabel: 'Ghế',
    host: 'Chủ phòng',
    offline: 'Đang offline',
    onlineBadge: 'Sẵn sàng',
    start: 'Bắt đầu',
    needTwoPlayers: 'Cần ít nhất 2 người đang kết nối để bắt đầu',
    leave: 'Rời phòng',
    waitingForHost: 'Đang chờ chủ phòng bắt đầu',
  },

  // Game screen strings (section 8.2)
  game: {
    seat: {
      turn: 'Đến lượt',
      eliminated: 'Đã bị loại',
      offline: 'Offline',
      youTag: '(Bạn)',
      cardsCount: (count) => `${count} lá`,
    },
    seatRingAriaLabel: 'Ghế người chơi',
    deck: 'Bộ rút',
    discard: 'Bài đã đánh',
    deckCount: (count) => `${count} lá`,
    discardCount: (count) => `${count} lá`,
    turnsLeft: (n) => `Còn ${n} lượt`,
    yourHand: 'Tay bài của bạn',
    directionCw: 'Thuận chiều',
    directionCcw: 'Ngược chiều',
    playAreaAriaLabel: 'Khu vực bài và thao tác',
    themeLabel: 'Giao diện',
    themeAriaLabel: 'Tùy chỉnh giao diện bài và bàn',
    helpAriaLabel: 'Xem hướng dẫn chơi',
    leaveLabel: 'Rời phòng',
    confirmLeaveLabel: 'Xác nhận rời?',
    cancelLabel: 'Hủy',
    logTitle: 'Nhật ký',
    logAriaLabel: 'Nhật ký trò chơi',
    logExpandAriaLabel: 'Mở rộng nhật ký',
    logCollapseAriaLabel: 'Thu gọn nhật ký',
    logEmpty: 'Chưa có nhật ký',
    handAriaLabel: 'Khu vực bài trên tay',
    emptyHand: 'Không có lá bài nào trên tay',
    selected: 'Đã chọn',
    unselected: 'Chưa chọn',
    cardDisabled: 'Không thể đánh',
  },

  // Action bar button labels (section 8.2)
  actions: {
    actionBarAriaLabel: 'Thanh hành động',
    draw: 'Rút bài',
    playSelected: 'Đánh bài',
    skip: 'Bỏ qua',
    reverse: 'Đảo chiều',
    attack: 'Tấn công',
    favor: 'Nhờ vả',
    catPair: 'Chơi cặp mèo',
    peek: 'Nhìn trước',
    shuffle: 'Xáo bài',
    nope: 'KHÔNG!',
    passNope: 'Cho qua',
    countdown: (seconds) => `Còn ${seconds} giây`,
  },

  // Nope reaction banner
  nopeBanner: {
    title: (actor, cardName) => `${actor} đánh ${cardName}`,
    noped: (actor, count) => `${actor} đã KHÔNG! (×${count})`,
    promptAllow: 'Bấm KHÔNG! để chặn hoặc chờ hết giờ',
    pass: 'Cho qua',
  },

  // Dialog strings (section 8.2)
  dialog: {
    targetPicker: {
      title: 'Chọn mục tiêu',
      prompt: 'Chọn một người chơi còn sống để thực hiện:',
      ariaLabel: 'Hộp thoại chọn mục tiêu',
      cancel: 'Hủy',
      noCandidates: 'Không có người chơi nào để chọn',
    },
    defuse: {
      title: 'Gỡ bom',
      prompt: 'Chọn vị trí đặt lại Mèo Bùm vào bộ rút bài:',
      ariaLabel: 'Hộp thoại gỡ bom',
      sliderAriaLabel: 'Vị trí đặt lại bom trong bộ rút',
      top: 'Trên cùng',
      deepest: 'Sâu nhất',
      insertPosition: (n, total) => `Vị trí: ${n} / ${total}`,
      insertPositionTopDesc: 'Lá tiếp theo sẽ rút (trên cùng)',
      insertPositionBottomDesc: 'Dưới cùng bộ bài rút',
      insertPositionDesc: (n) => `Lá thứ ${n} từ trên xuống`,
      placeBomb: 'Đặt bom',
      defusing: (name) => `${name} đang gỡ bom…`,
    },
  },

  // PeekPanel label (section 8.2)
  peekPanel: {
    title: 'Nhìn trước (3 lá trên cùng)',
    subtitle: 'Thứ tự từ trái sang phải (1 → 2 → 3):',
    cardTop: '1. Trên cùng',
    cardMiddle: '2. Ở giữa',
    cardBottom: '3. Thứ ba',
    close: 'Đóng',
  },

  // Chat panel strings
  chat: {
    title: 'Trò chuyện',
    placeholder: 'Nhập tin nhắn...',
    sendButton: 'Gửi',
    empty: 'Chưa có tin nhắn nào',
    you: 'Bạn',
    inputAriaLabel: 'Nội dung tin nhắn',
    regionAriaLabel: 'Hộp trò chuyện',
    listAriaLabel: 'Danh sách tin nhắn',
    openButtonAriaLabel: 'Mở hộp trò chuyện',
    closeButton: 'Đóng trò chuyện',
    unreadButtonAriaLabel: (n) => `Trò chuyện (${n} tin nhắn mới)`,
  },

  // Banners: eliminated-player, disconnect (section 8.2)
  banners: {
    eliminated: 'Bạn đã bị loại. Bạn đang xem',
    reconnecting: 'Đang kết nối lại…',
  },

  // Game-over screen strings (section 8.2)
  gameOver: {
    title: 'Kết thúc ván',
    winnerLabel: 'Người chiến thắng',
    winner: (name) => `${name} đã chiến thắng!`,
    noWinner: 'Không ai thắng',
    playAgain: 'Chơi lại',
    leaveRoom: 'Rời phòng',
    waitingForHost: 'Đang chờ chủ phòng chơi lại',
  },

  // Log line templates for EVERY event type in rules.md section E2
  log: {
    draw: (actor) => `${actor} rút một lá`,
    bomb_drawn: (actor) => `${actor} rút phải bom!`,
    defused: (actor) => `${actor} đã gỡ bom thành công`,
    eliminated: (actor, reason) => {
      if (reason === 'disconnect') return `${actor} bị loại do mất kết nối`;
      if (reason === 'bomb') return `${actor} bị loại do bom nổ`;
      return `${actor} đã bị loại`;
    },
    skip: (actor) => `${actor} đánh Bỏ qua`,
    reverse: (actor) => `${actor} đánh Đảo Chiều`,
    attack: (actor, target) => (target ? `${actor} đánh Tấn công nhắm vào ${target}` : `${actor} đánh Tấn công`),
    shuffle: (actor) => `${actor} đánh Xáo bài`,
    peek: (actor) => `${actor} đánh Nhìn trước`,
    favor: (actor, target) => (target ? `${actor} đánh Nhờ vả nhắm vào ${target}` : `${actor} đánh Nhờ vả`),
    cat: (actor, target, cardName) => {
      const label = cardName ? `cặp ${cardName}` : 'cặp mèo';
      return target ? `${actor} chơi ${label} nhắm vào ${target}` : `${actor} chơi ${label}`;
    },
    nope: (actor, target, count) => `${actor} đánh KHÔNG!${count > 1 ? ` (×${count})` : ''}`,
    action_cancelled: (actor, cardName) => `Hành động ${cardName || ''} của ${actor} đã bị chặn!`,
    deck_reshuffled: () => 'Đã xáo lại bài đã đánh thành bộ rút',
    game_over: (winner) => (winner ? `${winner} đã chiến thắng!` : 'Ván chơi kết thúc, không ai thắng'),
  },

  // Card names (12 cards)
  cards: {
    boom: 'Mèo Bùm',
    defuse: 'Kìm Cắt Dây',
    attack: 'Truy Đuổi',
    skip: 'Ngủ Trưa',
    reverse: 'Đảo Chiều',
    shuffle: 'Xáo Trộn',
    favor: 'Nài Nỉ',
    peek: 'Mắt Thần',
    nope: 'KHÔNG!',
    cat: 'Mèo Vằn',
    taco: 'Mèo Taco',
    potato: 'Mèo Khoai Tây',
  },
};
