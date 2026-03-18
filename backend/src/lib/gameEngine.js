import crypto from 'crypto';

const gameSessions = new Map();
const pendingInvites = new Map();

// --- WHOT MECHANICS ---
const suits = ['circle', 'triangle', 'cross', 'star', 'square'];
const actionNumbers = new Set([1, 2, 5, 8, 14]);
const numberedCardsBySuit = {
  circle: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  triangle: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  cross: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  square: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  star: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
};

const createWhotDeck = () => {
  const deck = [];
  suits.forEach((suit) => {
    numberedCardsBySuit[suit].forEach((number) => {
      deck.push({ id: `${suit}-${number}-${crypto.randomUUID()}`, suit, number, label: `${number}` });
    });
  });

  for (let i = 0; i < 4; i += 1) {
    deck.push({ id: `whot-20-${i}-${crypto.randomUUID()}`, suit: 'whot', number: 20, label: 'WHOT' });
  }

  return deck.sort(() => Math.random() - 0.5);
};

const initWhotState = (players) => {
  const deck = createWhotDeck();
  const hands = {};

  players.forEach((playerId) => {
    hands[playerId] = deck.splice(0, 5);
  });

  let top = deck.shift();
  while ((top?.suit === 'whot' || actionNumbers.has(top?.number)) && deck.length) {
    deck.push(top);
    top = deck.shift();
  }

  return {
    deck,
    discard: [top],
    hands,
    currentPlayer: players[0],
    requestedSuit: null,
    winnerId: null,
  };
};

const canPlayWhotCard = ({ card, topCard, requestedSuit }) => {
  if (card.suit === 'whot') return true;
  if (requestedSuit) return card.suit === requestedSuit;
  return card.suit === topCard.suit || card.number === topCard.number;
};

// --- LUDO MECHANICS ---
const rollDice = () => Math.floor(Math.random() * 6) + 1;

// Universal safe spots on the 52-square perimeter
const ludoSafeSpots = new Set([8, 21, 34, 47]);
const playerColorSets = [
  ['red', 'blue'],
  ['green', 'yellow'],
];
const colorOffsets = {
  red: 0,
  green: 13,
  yellow: 39,
  blue: 26,
};

const createPlayerTokens = (colors) => colors.flatMap((color) => Array.from({ length: 4 }, () => ({ color, pos: -1 })));

const initLudoState = (players) => ({
  tokens: {
    [players[0]]: createPlayerTokens(playerColorSets[0]),
    [players[1]]: createPlayerTokens(playerColorSets[1]),
  },
  currentPlayer: players[0],
  diceValues: [],
  hasBonusRoll: false,
  winnerId: null,
  lastMove: null,
});

const nextPlayer = (players, current) => players[(players.indexOf(current) + 1) % players.length];

const getUniversalPos = (relativePos, color) => {
  if (relativePos < 0 || relativePos > 51) return -1;
  return (relativePos + colorOffsets[color]) % 52;
};

const canUnlockToken = (diceValues) => diceValues.includes(6);

const hasAnyValidMove = (tokens, diceValues) => {
  if (!diceValues.length) return false;

  if (tokens.some((token) => token.pos === -1) && canUnlockToken(diceValues)) {
    return true;
  }

  return tokens.some((token) => (
    token.pos >= 0 && token.pos < 57 && diceValues.some((die) => token.pos + die <= 57)
  ));
};

const buildPublicState = (session, viewerId) => {
  if (session.gameType === 'whot') {
    const opponentId = session.players.find((id) => id !== viewerId);
    return {
      sessionId: session.id,
      gameType: session.gameType,
      status: session.status,
      currentPlayer: session.state.currentPlayer,
      requestedSuit: session.state.requestedSuit,
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
    diceValue1: session.state.diceValues[0] || null,
    diceValue2: session.state.diceValues[1] || null,
    tokens: session.state.tokens,
    winnerId: session.state.winnerId,
    players: session.players,
    availableDice: session.state.diceValues,
    lastMove: session.state.lastMove,
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

export const getActiveSessionByPlayer = (playerId) => (
  [...gameSessions.values()].find((session) => session.status === 'active' && session.players.includes(playerId)) || null
);

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
    // --- WHOT ACTION LOGIC ---
    const hand = session.state.hands[playerId];
    const topCard = session.state.discard[session.state.discard.length - 1];

    if (action.type === 'draw') {
      if (!session.state.deck.length) return { error: 'Deck is empty.' };
      if (hand.some((card) => canPlayWhotCard({ card, topCard, requestedSuit: session.state.requestedSuit }))) {
        return { error: 'You already have a valid move.' };
      }
      hand.push(session.state.deck.shift());
      session.state.requestedSuit = null;
      session.state.currentPlayer = nextPlayer(session.players, playerId);
    } else if (action.type === 'play') {
      const cardIndex = hand.findIndex((card) => card.id === action.cardId);
      if (cardIndex === -1) return { error: 'Card not found in your hand.' };
      const card = hand[cardIndex];

      if (!canPlayWhotCard({ card, topCard, requestedSuit: session.state.requestedSuit })) {
        return { error: 'Card does not match the current request.' };
      }
      if (card.number === 20 && !suits.includes(action.requestedSuit)) {
        return { error: 'Pick a requested suit for WHOT card.' };
      }

      hand.splice(cardIndex, 1);
      session.state.discard.push(card);
      session.state.requestedSuit = null;

      if (!hand.length) {
        session.state.winnerId = playerId;
        session.status = 'completed';
      } else if (card.number === 20) {
        session.state.requestedSuit = action.requestedSuit;
        session.state.currentPlayer = nextPlayer(session.players, playerId);
      } else if (actionNumbers.has(card.number)) {
        const opponentId = nextPlayer(session.players, playerId);
        const opponentHand = session.state.hands[opponentId];
        const drawCount = card.number === 2 ? 2 : card.number === 5 ? 3 : card.number === 14 ? 1 : 0;

        for (let i = 0; i < drawCount && session.state.deck.length; i += 1) {
          opponentHand.push(session.state.deck.shift());
        }

        session.state.currentPlayer = playerId;
      } else {
        session.state.currentPlayer = nextPlayer(session.players, playerId);
      }
    } else {
      return { error: 'Unsupported action.' };
    }

  } else {
    // --- LUDO ACTION LOGIC ---
    const playerTokens = session.state.tokens[playerId];

    if (action.type === 'roll') {
      if (session.state.diceValues.length > 0) return { error: 'You still have moves left.' };

      const d1 = action.dice1 || rollDice();
      const d2 = action.dice2 || rollDice();

      session.state.diceValues = [d1, d2];
      session.state.hasBonusRoll = d1 === 6 && d2 === 6;

      if (!hasAnyValidMove(playerTokens, session.state.diceValues)) {
        session.state.diceValues = [];
        session.state.hasBonusRoll = false;
        session.state.currentPlayer = nextPlayer(session.players, playerId);
      }
    } else if (action.type === 'move') {
      if (session.state.diceValues.length === 0) return { error: 'Roll the dice first.' };

      const tokenIndex = Number(action.tokenIndex);
      if (Number.isNaN(tokenIndex) || tokenIndex < 0 || tokenIndex >= playerTokens.length) {
        return { error: 'Invalid token.' };
      }

      const token = playerTokens[tokenIndex];
      const previousPos = token.pos;
      let nextPos = token.pos;
      const diceValues = session.state.diceValues;
      const requestedDieIndex = Number.isInteger(action.dieIndex) ? action.dieIndex : null;
      let diceToConsume = [];

      // Logic to pull token from Base
      if (token.pos === -1) {
        const selectedDie = requestedDieIndex !== null ? diceValues[requestedDieIndex] : null;

        if (selectedDie === 6) {
          diceToConsume = [requestedDieIndex];
          nextPos = 0;
        } else if (requestedDieIndex === null && diceValues.includes(6)) {
          diceToConsume = [diceValues.indexOf(6)];
          nextPos = 0;
        } else {
          return { error: 'Need a single die showing 6 to bring token out.' };
        }
      } else {
        // Logic for Track Movement
        if (action.useTotal && diceValues.length > 1) {
          const sum = diceValues.reduce((a, b) => a + b, 0);
          if (token.pos + sum > 57) return { error: 'Total move overshoots home.' };
          diceToConsume = diceValues.map((_, i) => i);
          nextPos = token.pos + sum;
        } else if (requestedDieIndex !== null) {
          if (requestedDieIndex < 0 || requestedDieIndex >= diceValues.length) {
            return { error: 'Choose a valid die first.' };
          }
          if (token.pos + diceValues[requestedDieIndex] > 57) {
            return { error: 'That die overshoots home for this token.' };
          }
          diceToConsume = [requestedDieIndex];
          nextPos = token.pos + diceValues[requestedDieIndex];
        } else {
          const usableDieIndex = diceValues.findIndex((die) => token.pos + die <= 57);
          if (usableDieIndex === -1) return { error: 'No valid moves for this token with current dice.' };
          diceToConsume = [usableDieIndex];
          nextPos = token.pos + diceValues[usableDieIndex];
        }
      }

      const opponentId = session.players.find((id) => id !== playerId);
      const opponentTokens = session.state.tokens[opponentId];
      let isKill = false;
      let tokensToKill = [];
      const capturedTokens = [];

      // Check if destination is occupied by an opponent
      if (nextPos !== 0) {
        const myUniversalPos = getUniversalPos(nextPos, token.color);
        if (myUniversalPos !== -1 && !ludoSafeSpots.has(myUniversalPos)) {
          opponentTokens.forEach((oppToken, oppIndex) => {
            if (getUniversalPos(oppToken.pos, oppToken.color) === myUniversalPos) {
              isKill = true;
              tokensToKill.push({ token: oppToken, index: oppIndex });
            }
          });
        }
      }

      // MANDATORY REMAINDER CHECK: Validate if player can consume leftover dice after a kill
      if (isKill) {
        const remainingDiceCount = diceValues.length - diceToConsume.length;
        if (remainingDiceCount > 0) {
          const remainingDice = diceValues.filter((_, i) => !diceToConsume.includes(i));
          
          // Check if there is AT LEAST ONE other token that can legally use the remaining dice
          const hasOtherPlayableTokens = playerTokens.some((t, idx) => {
            if (idx === tokenIndex) return false; // This token will be removed, can't use it
            if (t.pos === -1 && remainingDice.includes(6)) return true; // Token in base can come out
            if (t.pos >= 0 && t.pos < 57) {
              return remainingDice.some(d => t.pos + d <= 57); // Active token can move
            }
            return false;
          });

          if (!hasOtherPlayableTokens) {
            return { error: 'Move blocked: You cannot kill because you have no other tokens to play your remaining dice.' };
          }
        }
      }

      // Execute Move and Deduct Dice
      diceToConsume.sort((a, b) => b - a).forEach((dieIndex) => {
        session.state.diceValues.splice(dieIndex, 1);
      });

      // Execute Kill Logic
      if (isKill) {
        tokensToKill.forEach(({ token: oppToken, index: oppIdx }) => {
          capturedTokens.push({
            playerId: opponentId,
            tokenIndex: oppIdx,
            color: oppToken.color,
            fromPos: oppToken.pos,
          });
          oppToken.pos = -1; // Opponent killed: Reset to Home
        });
        
        token.pos = -2; // Killer token is removed from board
        session.state.hasBonusRoll = true;
      } else {
        token.pos = nextPos;
      }

      session.state.lastMove = {
        id: crypto.randomUUID(),
        playerId,
        tokenIndex,
        color: token.color,
        fromPos: previousPos,
        toPos: token.pos,
        capturedTokens,
        reachedHome: token.pos === 57 || token.pos === -2,
      };

      // Check Completion (57 = Reached Home, -2 = Completed via kamikaze kill)
      const isPlayerFinished = (tokens) => tokens.every((t) => t.pos === 57 || t.pos === -2);

      if (isPlayerFinished(playerTokens)) {
        session.state.winnerId = playerId;
        session.status = 'completed';
      } else if (isPlayerFinished(opponentTokens)) {
        session.state.winnerId = opponentId;
        session.status = 'completed';
      }

      // Turn Management 
      if (session.state.diceValues.length === 0 && session.status === 'active') {
        if (session.state.hasBonusRoll) {
          session.state.hasBonusRoll = false;
        } else {
          session.state.currentPlayer = nextPlayer(session.players, playerId);
        }
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
