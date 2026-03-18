import { create } from 'zustand';
import toast from 'react-hot-toast';
import { useAuthStore } from './useAuthStore';

let dashboardTimer = null;

const showDashboardForAWhile = (set) => {
  if (dashboardTimer) clearTimeout(dashboardTimer);
  set({ isDashboardVisible: true });
  dashboardTimer = setTimeout(() => {
    set({ isDashboardVisible: false });
  }, 7000);
};

export const useGameStore = create((set, get) => ({
  pendingInvite: null,
  activeGame: null,
  dashboard: null,
  isDashboardVisible: false,

  startInvite: (gameType, toUserId) => {
    const socket = useAuthStore.getState().socket;
    if (!toUserId) {
      toast.error('Select a chat user first.');
      return;
    }
    if (!socket?.connected) {
      toast.error('Socket not connected yet. Please try again.');
      return;
    }
    socket.emit('game:invite', { gameType, toUserId });
  },

  respondInvite: (accepted) => {
    const socket = useAuthStore.getState().socket;
    const invite = get().pendingInvite;
    if (!socket?.connected || !invite) return;
    socket.emit('game:invite:response', { inviteId: invite.id, accepted });
    set({ pendingInvite: null });
  },

  sendAction: (action) => {
    const socket = useAuthStore.getState().socket;
    const game = get().activeGame;
    if (!socket?.connected || !game) return;
    socket.emit('game:action', { sessionId: game.sessionId, action });
  },

  forfeitGame: () => {
    const socket = useAuthStore.getState().socket;
    const game = get().activeGame;
    if (!socket?.connected || !game) return;
    socket.emit('game:forfeit', { sessionId: game.sessionId });
    set({ activeGame: null });
  },

  requestDashboard: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket?.connected) {
      toast.error('Socket not connected yet.');
      return;
    }
    socket.emit('game:dashboard:request');
  },

  closeGame: () => set({ activeGame: null }),

  subscribeGameEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off('game:invite');
    socket.off('game:state');
    socket.off('game:ended');
    socket.off('game:dashboard');
    socket.off('game:error');
    socket.off('game:invite:declined');
    socket.off('game:invite:sent');

    socket.on('game:invite', (invite) => set({ pendingInvite: invite }));
    socket.on('game:state', (state) => set({ activeGame: state }));

    socket.on('game:invite:sent', ({ gameType }) => {
      toast.success(`${String(gameType || 'Game').toUpperCase()} invite sent`);
    });

    socket.on('game:ended', ({ winnerId }) => {
      const me = useAuthStore.getState().authUser?._id;
      toast.success(winnerId === me ? 'You won 🎉' : 'Game over. Good match!');
      set({ activeGame: null });
      get().requestDashboard();
    });

    socket.on('game:dashboard', (dashboard) => {
      set({ dashboard });
      showDashboardForAWhile(set);
      if (!dashboard) {
        toast('No game stats yet. Play a match first.');
      }
    });

    socket.on('game:error', ({ message }) => toast.error(message));
    socket.on('game:invite:declined', () => toast('Invite declined'));
  },
}));

// ==========================================
// BACKEND ENGINE LOGIC (Session Management)
// ==========================================

const gameSessions = new Map();
const pendingInvites = new Map();

// --- WHOT MECHANICS ---
const suits = ['circle', 'triangle', 'cross', 'star', 'square'];
const whotNumbers = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14];

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
const ludoSafeSpots = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const initLudoState = (players) => ({
  tokens: {
    [players[0]]: [-1, -1, -1, -1],
    [players[1]]: [-1, -1, -1, -1],
  },
  currentPlayer: players[0],
  diceValues: [], 
  hasBonusRoll: false,
  winnerId: null,
});

const nextPlayer = (players, current) => players[(players.indexOf(current) + 1) % players.length];

const getUniversalPos = (relativePos, playerIndex) => {
  if (relativePos < 0 || relativePos > 51) return -1;
  const offset = playerIndex === 0 ? 0 : 13; 
  return (relativePos + offset) % 52;
};

// Algorithm to check if a player has any legal moves left
const hasValidMoves = (tokens, diceValues) => {
  if (!diceValues || diceValues.length === 0) return false;
  
  // NIGERIAN RULE: Check if we have a natural 6, or if both dice sum to exactly 6
  const hasSix = diceValues.includes(6);
  const sumIsSix = diceValues.length === 2 && (diceValues[0] + diceValues[1] === 6);
  
  if ((hasSix || sumIsSix) && tokens.includes(-1)) return true;

  // Check if any token on the track can move without overshooting Home (57)
  for (const t of tokens) {
    if (t >= 0 && t < 57) {
      for (const d of diceValues) {
        if (t + d <= 57) return true;
      }
    }
  }
  return false;
};

const buildPublicState = (session, viewerId) => {
  if (session.gameType === 'whot') {
    const opponentId = session.players.find((id) => id !== viewerId);
    return {
      sessionId: session.id,
      gameType: session.gameType,
      status: session.status,
      currentPlayer: session.state.currentPlayer,
      pendingDraw: session.state.pendingDraw,
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
      session.state.requestedSuit = card.number === 20 ? action.requestedSuit : null;
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
    // LUDO ACTION LOGIC
    const playerIndex = session.players.indexOf(playerId);
    const playerTokens = session.state.tokens[playerId];

    if (action.type === 'roll') {
      if (session.state.diceValues.length > 0) return { error: 'You still have moves left.' };
      
      const d1 = action.dice1 || rollDice();
      const d2 = action.dice2 || rollDice();
      
      session.state.diceValues = [d1, d2];
      session.state.hasBonusRoll = (d1 === 6 || d2 === 6);

      // Skip turn immediately if no valid moves
      if (!hasValidMoves(playerTokens, session.state.diceValues)) {
        session.state.diceValues = []; 
        session.state.hasBonusRoll = false;
        session.state.currentPlayer = nextPlayer(session.players, playerId);
      }

    } else if (action.type === 'move') {
      if (session.state.diceValues.length === 0) return { error: 'Roll the dice first.' };
      
      const tokenIndex = Number(action.tokenIndex);
      if (Number.isNaN(tokenIndex) || tokenIndex < 0 || tokenIndex > 3) return { error: 'Invalid token.' };

      let pos = playerTokens[tokenIndex];

      if (pos === -1) {
        // NIGERIAN RULE FIX: Allow natural 6 OR sum of both dice to equal 6 to unlock a seed
        const die6Index = session.state.diceValues.indexOf(6);
        
        if (die6Index !== -1) {
          // Use the natural 6
          pos = 0;
          session.state.diceValues.splice(die6Index, 1);
          playerTokens[tokenIndex] = pos;
        } else if (session.state.diceValues.length === 2 && session.state.diceValues[0] + session.state.diceValues[1] === 6) {
          // Consume both dice (e.g. 3+3, 4+2, 5+1)
          pos = 0;
          session.state.diceValues = []; 
          playerTokens[tokenIndex] = pos;
        } else {
          return { error: 'Need a 6 (or dice that sum to 6) to bring token out.' };
        }
      } else {
        // Normal track movement
        let usedDieIndex = -1;
        for (let i = 0; i < session.state.diceValues.length; i++) {
          if (pos + session.state.diceValues[i] <= 57) {
            usedDieIndex = i;
            pos += session.state.diceValues[i];
            break;
          }
        }
        if (usedDieIndex === -1) return { error: 'No valid moves for this token.' };
        
        playerTokens[tokenIndex] = pos;
        session.state.diceValues.splice(usedDieIndex, 1);
      }

      // Eating Logic
      const myUniversalPos = getUniversalPos(pos, playerIndex);
      if (myUniversalPos !== -1 && !ludoSafeSpots.has(myUniversalPos)) {
        const opponentId = session.players.find((id) => id !== playerId);
        const opponentIndex = session.players.indexOf(opponentId);
        const opponentTokens = session.state.tokens[opponentId];
        
        opponentTokens.forEach((oppPos, idx) => {
          if (getUniversalPos(oppPos, opponentIndex) === myUniversalPos) {
            opponentTokens[idx] = -1; 
            session.state.hasBonusRoll = true; 
          }
        });
      }

      // Check for Win
      if (playerTokens.every((tokenPos) => tokenPos === 57)) {
        session.state.winnerId = playerId;
        session.status = 'completed';
      }

      // If the remaining die is unplayable, clear it to trigger the next turn
      if (session.state.diceValues.length > 0 && !hasValidMoves(playerTokens, session.state.diceValues)) {
        session.state.diceValues = []; 
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
