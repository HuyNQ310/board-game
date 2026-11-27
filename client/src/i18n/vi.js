export default {
  // 16 error messages from rules.md section 6.2
  errors: {
    NAME_INVALID: 'Tên phải từ 1 đến 16 ký tự',
    ROOM_NOT_FOUND: 'Không tìm thấy phòng',
    ROOM_FULL: 'Phòng đã đủ 6 người',
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
    share: 'Chia sẻ',
    players: 'Danh sách người chơi',
    host: 'Chủ phòng',
    offline: 'Đang offline',
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
      cardsCount: (count) => `${count} lá`,
    },
    deck: 'Bộ rút',
    discard: 'Bài đã đánh',
    deckCount: (count) => `${count} lá`,
    discardCount: (count) => `${count} lá`,
    turnsLeft: (n) => `Còn ${n} lượt`,
    yourHand: 'Tay bài của bạn',
  },

  // Action bar button labels (section 8.2)
  actions: {
    draw: 'Rút bài',
    skip: 'Bỏ qua',
    attack: 'Tấn công',
    favor: 'Nhờ vả',
    catPair: 'Chơi cặp mèo',
    peek: 'Nhìn trước',
    shuffle: 'Xáo bài',
  },

  // Dialog strings (section 8.2)
  dialog: {
    targetPicker: {
      title: 'Chọn mục tiêu',
      cancel: 'Hủy',
    },
    defuse: {
      title: 'Gỡ bom',
      top: 'Trên cùng',
      deepest: 'Sâu nhất',
      placeBomb: 'Đặt bom',
      defusing: (name) => `${name} đang gỡ bom…`,
    },
  },

  // PeekPanel label (section 8.2)
  peekPanel: {
    title: 'Nhìn trước (3 lá trên cùng)',
  },

  // Banners: eliminated-player, disconnect (section 8.2)
  banners: {
    eliminated: 'Bạn đã bị loại. Bạn đang xem',
    reconnecting: 'Đang kết nối lại…',
  },

  // Game-over screen strings (section 8.2)
  gameOver: {
    title: 'Kết thúc ván',
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
    attack: (actor, target) => (target ? `${actor} đánh Tấn công nhắm vào ${target}` : `${actor} đánh Tấn công`),
    shuffle: (actor) => `${actor} đánh Xáo bài`,
    peek: (actor) => `${actor} đánh Nhìn trước`,
    favor: (actor, target) => (target ? `${actor} đánh Nhờ vả nhắm vào ${target}` : `${actor} đánh Nhờ vả`),
    cat: (actor, target) => (target ? `${actor} chơi cặp mèo nhắm vào ${target}` : `${actor} chơi cặp mèo`),
    deck_reshuffled: () => 'Đã xáo lại bài đã đánh thành bộ rút',
    game_over: (winner) => (winner ? `${winner} đã chiến thắng!` : 'Ván chơi kết thúc, không ai thắng'),
  },

  // Card names (section 4.1)
  cards: {
    boom: 'Bom',
    defuse: 'Gỡ bom',
    attack: 'Tấn công',
    skip: 'Bỏ qua',
    shuffle: 'Xáo bài',
    favor: 'Nhờ vả',
    peek: 'Nhìn trước',
    cat: 'Mèo',
  },
};
