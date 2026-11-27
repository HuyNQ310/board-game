export default {
  // 16 error messages from rules.md section 6.2
  errors: {
    NAME_INVALID: 'Name must be between 1 and 16 characters',
    ROOM_NOT_FOUND: 'Room not found',
    ROOM_FULL: 'Room is full (max 10 players)',
    ROOM_PLAYING: 'Room is currently playing, cannot join right now',
    NOT_IN_ROOM: 'You are no longer in this room',
    NOT_HOST: 'Only the host can do this',
    NEED_TWO_PLAYERS: 'At least 2 connected players are needed to start',
    NOT_YOUR_TURN: 'Not your turn',
    DEFUSE_PENDING: 'You must defuse the bomb',
    NO_CARD: 'Card not in your hand',
    INVALID_CARD: 'This card cannot be played alone',
    INVALID_TARGET: 'Invalid target',
    INVALID_ACTION: 'Invalid action',
    GAME_OVER: 'Game is over',
    RATE_LIMIT: 'Too many actions, please slow down',
    SERVER_ERROR: 'An error occurred, please try again',
  },

  // Screen strings: Home (section 8.2)
  home: {
    nameLabel: 'Player name',
    namePlaceholder: 'Enter your name (1-16 chars)',
    roomCodeLabel: 'Room code',
    roomCodePlaceholder: 'Enter 5-character code',
    createRoom: 'Create room',
    joinRoom: 'Join room',
    rejoining: 'Rejoining room…',
  },

  // Lobby strings (section 8.2)
  lobby: {
    title: 'Lobby',
    roomCode: 'Room code',
    copy: 'Copy',
    copied: 'Copied!',
    share: 'Share',
    players: 'Player list',
    host: 'Host',
    offline: 'Offline',
    start: 'Start',
    needTwoPlayers: 'At least 2 connected players are needed to start',
    leave: 'Leave room',
    waitingForHost: 'Waiting for host to start',
  },

  // Game screen strings (section 8.2)
  game: {
    seat: {
      turn: 'Your turn',
      eliminated: 'Eliminated',
      offline: 'Offline',
      cardsCount: (count) => `${count} ${count === 1 ? 'card' : 'cards'}`,
    },
    deck: 'Draw pile',
    discard: 'Discard pile',
    deckCount: (count) => `${count} ${count === 1 ? 'card' : 'cards'}`,
    discardCount: (count) => `${count} ${count === 1 ? 'card' : 'cards'}`,
    turnsLeft: (n) => `${n} ${n === 1 ? 'turn' : 'turns'} left`,
    yourHand: 'Your hand',
  },

  // Action bar button labels (section 8.2)
  actions: {
    draw: 'Draw',
    skip: 'Skip',
    attack: 'Attack',
    favor: 'Favor',
    catPair: 'Play cat pair',
    peek: 'Peek',
    shuffle: 'Shuffle',
  },

  // Dialog strings (section 8.2)
  dialog: {
    targetPicker: {
      title: 'Choose a target',
      cancel: 'Cancel',
    },
    defuse: {
      title: 'Defuse Bomb',
      top: 'Top',
      deepest: 'Deepest',
      placeBomb: 'Place bomb',
      defusing: (name) => `${name} is defusing…`,
    },
  },

  // PeekPanel label (section 8.2)
  peekPanel: {
    title: 'See the future (top 3 cards)',
  },

  // Banners: eliminated-player, disconnect (section 8.2)
  banners: {
    eliminated: 'You have been eliminated. You are spectating',
    reconnecting: 'Reconnecting…',
  },

  // Game-over screen strings (section 8.2)
  gameOver: {
    title: 'Game Over',
    winner: (name) => `${name} won the game!`,
    noWinner: 'No winner',
    playAgain: 'Play again',
    leaveRoom: 'Leave room',
    waitingForHost: 'Waiting for host to replay',
  },

  // Log line templates for EVERY event type in rules.md section E2
  log: {
    draw: (actor) => `${actor} drew a card`,
    bomb_drawn: (actor) => `${actor} drew a bomb!`,
    defused: (actor) => `${actor} defused the bomb`,
    eliminated: (actor, reason) => {
      if (reason === 'disconnect') return `${actor} was eliminated due to disconnect`;
      if (reason === 'bomb') return `${actor} was eliminated by bomb`;
      return `${actor} was eliminated`;
    },
    skip: (actor) => `${actor} played Skip`,
    attack: (actor, target) => (target ? `${actor} played Attack targeting ${target}` : `${actor} played Attack`),
    shuffle: (actor) => `${actor} played Shuffle`,
    peek: (actor) => `${actor} played Peek`,
    favor: (actor, target) => (target ? `${actor} played Favor targeting ${target}` : `${actor} played Favor`),
    cat: (actor, target) => (target ? `${actor} played a cat pair targeting ${target}` : `${actor} played a cat pair`),
    deck_reshuffled: () => 'Discard pile was reshuffled into the draw pile',
    game_over: (winner) => (winner ? `${winner} won the game!` : 'Game over, no winner'),
  },

  // Card names (section 4.1)
  cards: {
    boom: 'Bomb',
    defuse: 'Defuse',
    attack: 'Attack',
    skip: 'Skip',
    shuffle: 'Shuffle',
    favor: 'Favor',
    peek: 'Peek',
    cat: 'Cat',
  },
};
