import crypto from 'crypto';

const gameSessions = new Map();
const pendingInvites = new Map();

const suits = ['circle', 'triangle', 'cross', 'star', 'square'];
const whotNumbers = [1,2,3,4,5,7,8,10,11,12,13,14];

const createWhotDeck = () => {
  const deck = [];
  suits.forEach((suit) => {
    whotNumbers.forEach((number) => {
      deck.push({ id: `${suit}-${number}-${crypto.randomUUID()}`, suit, number, label: `${number}` });
    });
  });
  for (let i = 0; i < 5; i += 1) {
    deck.push({ id: `whot-20-${i}-${crypto.randomUUID()}`, suit: 'whot', number: 20, label: 'WHOT' });
  }
  return deck.sort(() => Math.random() - 0.5);
};

const initWhotState = (players) => {
  const deck = createWhotDeck();
  const hands = {};
  players.forEach((playerId) => {
    hands[playerId] = deck.splice(0, 6);
  });
  let top = deck.shift();
  while (top?.suit === 'whot' && deck.length) top = deck.shift();
  return {
    deck,
    discard: [top],
    hands,
    currentPlayer: players[0],
    pendingDraw: 0,
    skipNext: false,
    winnerId: null,
  };
};

const canPlayWhotCard = (card, topCard) => card.suit === 'whot' || card.suit === topCard.suit || card.number === topCard.number;

const rollDice = () => Math.floor(Math.random() * 6) + 1;

const ludoSafeSpots = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const initLudoState = (players) => ({
  tokens: {
    [players[0]]: [-1, -1, -1, -1],
    [players[1]]: [-1, -1, -1, -1],
  },
  currentPlayer: players[0],
  diceValue: null,
  winnerId: null,
});

const nextPlayer = (players, current) => players[(players.indexOf(current) + 1) % players.length];

const ludoEntryIndex = (playerIndex) => (playerIndex === 0 ? 0 : 26);

const ludoHomeStart = 52;

const buildPublicState = (session, viewerId) => {
  if (session.gameType === 'whot') {
    const opponentId = session.players.find((id) => id !== viewerId);
    return {
      sessionId: session.id,
      gameType: session.gameType,
      status: session.status,
      currentPlayer: session.state.currentPlayer,
      pendingDraw: session.state.pendingDraw,
      topCard: session.state.discard[session.state.discard.length - 1],
      myHand: session.state.hands[viewerId] || [],
      myCount: session.state.hands[viewerId]?.length || 0,
      opponentCount: session.state.hands[opponentId]?.length || 0,
      deckCount: session.state.deck.length,
      winnerId: session.state.winnerId,
      players: session.players,
    };
  }

  return {
    sessionId: session.id,
    gameType: session.gameType,
    status: session.status,
    currentPlayer: session.state.currentPlayer,
    diceValue: session.state.diceValue,
    tokens: session.state.tokens,
    winnerId: session.state.winnerId,
    players: session.players,
  };
};

export const createInvite = ({ fromUserId, toUserId, gameType }) => {
  const id = crypto.randomUUID();
  const invite = { id, fromUserId, toUserId, gameType, createdAt: Date.now() };
  pendingInvites.set(id, invite);
  return invite;
};

export const getInvite = (inviteId) => pendingInvites.get(inviteId);
export const clearInvite = (inviteId) => pendingInvites.delete(inviteId);

export const createSession = ({ gameType, playerA, playerB }) => {
  const id = crypto.randomUUID();
  const players = [playerA, playerB];
  const state = gameType === 'whot' ? initWhotState(players) : initLudoState(players);
  const session = { id, gameType, players, state, status: 'active' };
  gameSessions.set(id, session);
  return session;
};

export const getSession = (id) => gameSessions.get(id);

export const getPlayerState = (sessionId, playerId) => {
  const session = getSession(sessionId);
  if (!session) return null;
  return buildPublicState(session, playerId);
};

export const applyGameAction = ({ sessionId, playerId, action }) => {
  const session = getSession(sessionId);
  if (!session || session.status !== 'active') return { error: 'Game session not found.' };
  if (!session.players.includes(playerId)) return { error: 'You are not part of this game.' };
  if (session.state.currentPlayer !== playerId) return { error: 'Wait for your turn.' };

  if (session.gameType === 'whot') {
    const hand = session.state.hands[playerId];
    const topCard = session.state.discard[session.state.discard.length - 1];

    if (action.type === 'draw') {
      if (!session.state.deck.length) return { error: 'Deck is empty.' };
      const drawCount = Math.max(1, session.state.pendingDraw || 1);
      for (let i = 0; i < drawCount && session.state.deck.length; i += 1) {
        hand.push(session.state.deck.shift());
      }
      session.state.pendingDraw = 0;
      session.state.currentPlayer = nextPlayer(session.players, playerId);
    } else if (action.type === 'play') {
      const cardIndex = hand.findIndex((card) => card.id === action.cardId);
      if (cardIndex === -1) return { error: 'Card not found in your hand.' };
      const card = hand[cardIndex];
      if (!canPlayWhotCard(card, topCard)) return { error: 'Card does not match suit, number, or WHOT.' };

      hand.splice(cardIndex, 1);
      session.state.discard.push(card);

      if (card.number === 2) session.state.pendingDraw += 2;
      if (card.number === 5) session.state.pendingDraw += 3;
      if (card.number === 8) session.state.skipNext = true;

      if (!hand.length) {
        session.state.winnerId = playerId;
        session.status = 'completed';
      } else if (card.number === 1) {
        session.state.currentPlayer = playerId;
      } else {
        const next = nextPlayer(session.players, playerId);
        session.state.currentPlayer = session.state.skipNext ? nextPlayer(session.players, next) : next;
        session.state.skipNext = false;
      }
    } else {
      return { error: 'Unsupported action.' };
    }
  } else {
    const playerIndex = session.players.indexOf(playerId);
    const playerTokens = session.state.tokens[playerId];

    if (action.type === 'roll') {
      if (session.state.diceValue) return { error: 'You have an active dice roll.' };
      session.state.diceValue = rollDice();
    } else if (action.type === 'move') {
      const steps = session.state.diceValue;
      if (!steps) return { error: 'Roll the dice first.' };
      const tokenIndex = Number(action.tokenIndex);
      if (Number.isNaN(tokenIndex) || tokenIndex < 0 || tokenIndex > 3) return { error: 'Invalid token.' };

      let pos = playerTokens[tokenIndex];
      if (pos === -1) {
        if (steps !== 6) return { error: 'Need a 6 to bring token out.' };
        pos = ludoEntryIndex(playerIndex);
      } else {
        pos += steps;
        if (pos > 57) return { error: 'Move exceeds home path.' };
      }
      playerTokens[tokenIndex] = pos;

      const opponentId = session.players.find((id) => id !== playerId);
      const opponentTokens = session.state.tokens[opponentId];
      opponentTokens.forEach((oppPos, idx) => {
        if (oppPos === pos && pos < ludoHomeStart && !ludoSafeSpots.has(pos)) {
          opponentTokens[idx] = -1;
        }
      });

      const allHome = playerTokens.every((tokenPos) => tokenPos === 57);
      if (allHome) {
        session.state.winnerId = playerId;
        session.status = 'completed';
      }

      if (steps === 6 && session.status === 'active') {
        session.state.diceValue = null;
      } else {
        session.state.diceValue = null;
        session.state.currentPlayer = nextPlayer(session.players, playerId);
      }
    } else {
      return { error: 'Unsupported action.' };
    }
  }

  return { session };
};

export const forfeitSession = ({ sessionId, playerId }) => {
  const session = getSession(sessionId);
  if (!session) return null;
  const winnerId = session.players.find((id) => id !== playerId);
  session.state.winnerId = winnerId;
  session.status = 'completed';
  return session;
};
