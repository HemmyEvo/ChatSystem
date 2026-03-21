import crypto from 'crypto';

const gameSessions = new Map();
const pendingInvites = new Map();

// ==========================================
// --- WHOT MECHANICS ---
// ==========================================
const suits = ['circle', 'triangle', 'cross', 'star', 'square'];
const actionNumbers = new Set([1, 2, 5, 8, 14]);
const numberedCardsBySuit = {
  circle: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  triangle: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  cross: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  square: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  star: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
};

const createWhotDeck = () => {
  const deck = [];
  suits.forEach((suit) => {
    numberedCardsBySuit[suit].forEach((number) => {
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

// ==========================================
// --- LUDO MECHANICS ---
// ==========================================
const rollDice = () => Math.floor(Math.random() * 6) + 1;

const ludoSafeSpots = new Set([8, 21, 34, 47]);
const playerColorSets = [
  ['red', 'blue'],
  ['green', 'yellow'],
];
const colorOffsets = { red: 0, green: 13, yellow: 39, blue: 26 };

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
  if (tokens.some((token) => token.pos === -1) && canUnlockToken(diceValues)) return true;
  return tokens.some((token) => (
    token.pos >= 0 && token.pos < 57 && diceValues.some((die) => token.pos + die <= 57)
  ));
};

// ==========================================
// --- FOOTBALL MECHANICS ---
// ==========================================
// Pitch: 105m x 68m grid. Goals at Y: 30-38 on X:0 and X:105
const PITCH_LENGTH = 105;
const PITCH_WIDTH = 68;
const GOAL_MIN_Y = 30;
const GOAL_MAX_Y = 38;

const PLAYER_TEMPLATES = {
  GK:  { role: 'GK', pace: 40, pass: 60, shoot: 10, tackle: 30, save: 85, stamina: 100 },
  DEF: { role: 'DEF', pace: 65, pass: 65, shoot: 30, tackle: 80, save: 10, stamina: 100 },
  MID: { role: 'MID', pace: 75, pass: 85, shoot: 70, tackle: 65, save: 10, stamina: 100 },
  FWD: { role: 'FWD', pace: 85, pass: 70, shoot: 85, tackle: 30, save: 10, stamina: 100 },
};

// Standard 4-4-2 coordinates relative to attacking right (Team A)
const BASE_FORMATION = [
  { ...PLAYER_TEMPLATES.GK, x: 5, y: 34 },
  { ...PLAYER_TEMPLATES.DEF, x: 20, y: 15 }, { ...PLAYER_TEMPLATES.DEF, x: 18, y: 28 }, 
  { ...PLAYER_TEMPLATES.DEF, x: 18, y: 40 }, { ...PLAYER_TEMPLATES.DEF, x: 20, y: 53 },
  { ...PLAYER_TEMPLATES.MID, x: 45, y: 15 }, { ...PLAYER_TEMPLATES.MID, x: 40, y: 28 }, 
  { ...PLAYER_TEMPLATES.MID, x: 40, y: 40 }, { ...PLAYER_TEMPLATES.MID, x: 45, y: 53 },
  { ...PLAYER_TEMPLATES.FWD, x: 65, y: 25 }, { ...PLAYER_TEMPLATES.FWD, x: 65, y: 43 },
];

const mirrorPosition = (p) => ({ ...p, x: PITCH_LENGTH - p.x, y: PITCH_WIDTH - p.y });

const initFootballState = (players) => {
  const teamA = BASE_FORMATION.map((p, i) => ({ ...p, id: `A${i}`, cards: 0 }));
  const teamB = BASE_FORMATION.map((p, i) => ({ ...mirrorPosition(p), id: `B${i}`, cards: 0 }));

  return {
    teams: { [players[0]]: teamA, [players[1]]: teamB },
    ball: { x: PITCH_LENGTH / 2, y: PITCH_WIDTH / 2, controlledBy: null, possessionTeam: null },
    match: { minute: 0, score: { [players[0]]: 0, [players[1]]: 0 }, state: 'kickoff' },
    turn: { currentPlayer: players[0], actionPoints: 5, logs: [] },
    winnerId: null
  };
};

// Math Helpers for Football Interceptions & Movement
const getDistance = (p1, p2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
const distSquared = (v, w) => Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
const distToSegment = (p, v, w) => {
  let l2 = distSquared(v, w);
  if (l2 === 0) return getDistance(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return getDistance(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
};

const checkOffside = (passer, receiver, defenders, attackingDir) => {
  // Can't be offside in own half or behind the ball
  if (attackingDir === 1 && (receiver.x <= PITCH_LENGTH / 2 || receiver.x <= passer.x)) return false;
  if (attackingDir === -1 && (receiver.x >= PITCH_LENGTH / 2 || receiver.x >= passer.x)) return false;

  // Count defenders closer to the goal line than the receiver
  let deeperDefenders = 0;
  defenders.forEach(def => {
    if (attackingDir === 1 && def.x >= receiver.x) deeperDefenders++;
    if (attackingDir === -1 && def.x <= receiver.x) deeperDefenders++;
  });

  // Offside if fewer than 2 defenders (usually GK + 1 outfield player) are deeper
  return deeperDefenders < 2;
};

const resetPositions = (state, players, isTeamAKickoff) => {
  state.teams[players[0]] = BASE_FORMATION.map((p, i) => ({ ...state.teams[players[0]][i], x: p.x, y: p.y }));
  state.teams[players[1]] = BASE_FORMATION.map((p, i) => {
    const mirrored = mirrorPosition(p);
    return { ...state.teams[players[1]][i], x: mirrored.x, y: mirrored.y };
  });
  state.ball = { x: PITCH_LENGTH / 2, y: PITCH_WIDTH / 2, controlledBy: null, possessionTeam: isTeamAKickoff ? players[0] : players[1] };
  state.match.state = 'kickoff';
  state.turn.currentPlayer = isTeamAKickoff ? players[0] : players[1];
  state.turn.actionPoints = 5;
};


// ==========================================
// --- GLOBAL API ---
// ==========================================

const buildPublicState = (session, viewerId) => {
  const base = {
    sessionId: session.id,
    gameType: session.gameType,
    status: session.status,
    players: session.players,
  };

  if (session.gameType === 'whot') {
    const opponentId = session.players.find((id) => id !== viewerId);
    return {
      ...base,
      currentPlayer: session.state.currentPlayer,
      requestedSuit: session.state.requestedSuit,
      topCard: session.state.discard[session.state.discard.length - 1],
      myHand: session.state.hands[viewerId] || [],
      myCount: session.state.hands[viewerId]?.length || 0,
      opponentCount: session.state.hands[opponentId]?.length || 0,
      deckCount: session.state.deck.length,
      winnerId: session.state.winnerId,
    };
  }

  if (session.gameType === 'football') {
    return {
      ...base,
      teams: session.state.teams,
      ball: session.state.ball,
      match: session.state.match,
      turn: session.state.turn,
      winnerId: session.state.winnerId,
    };
  }

  return {
    ...base,
    currentPlayer: session.state.currentPlayer,
    diceValue1: session.state.diceValues[0] || null,
    diceValue2: session.state.diceValues[1] || null,
    tokens: session.state.tokens,
    winnerId: session.state.winnerId,
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
  
  let state;
  if (gameType === 'whot') state = initWhotState(players);
  else if (gameType === 'football') state = initFootballState(players);
  else state = initLudoState(players);

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

  const isWhot = session.gameType === 'whot';
  const isLudo = session.gameType === 'ludo';
  const isFootball = session.gameType === 'football';

  const currentPlayerCheck = isFootball ? session.state.turn.currentPlayer : session.state.currentPlayer;
  if (currentPlayerCheck !== playerId) return { error: 'Wait for your turn.' };

  // ==========================================
  // WHOT ACTION LOGIC
  // ==========================================
  if (isWhot) {
    const hand = session.state.hands[playerId];
    const topCard = session.state.discard[session.state.discard.length - 1];

    if (action.type === 'draw') {
      if (hand.some((card) => canPlayWhotCard({ card, topCard, requestedSuit: session.state.requestedSuit }))) {
        return { error: 'You already have a valid move.' };
      }

      if (!session.state.deck.length) {
        const opponentId = session.players.find((id) => id !== playerId);
        const myWhotCount = hand.filter((c) => c.suit === 'whot').length;
        const oppWhotCount = session.state.hands[opponentId].filter((c) => c.suit === 'whot').length;

        if (myWhotCount > oppWhotCount) session.state.winnerId = opponentId;
        else if (oppWhotCount > myWhotCount) session.state.winnerId = playerId;
        else session.state.winnerId = null;
        
        session.status = 'completed';
        return { session };
      }

      hand.push(session.state.deck.shift());
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

        for (let i = 0; i < drawCount && session.state.deck.length; i += 1) opponentHand.push(session.state.deck.shift());
        session.state.currentPlayer = playerId;
      } else {
        session.state.currentPlayer = nextPlayer(session.players, playerId);
      }
    } else return { error: 'Unsupported action.' };

  // ==========================================
  // LUDO ACTION LOGIC
  // ==========================================
  } else if (isLudo) {
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
      if (Number.isNaN(tokenIndex) || tokenIndex < 0 || tokenIndex >= playerTokens.length) return { error: 'Invalid token.' };

      const token = playerTokens[tokenIndex];
      const previousPos = token.pos;
      let nextPos = token.pos;
      const diceValues = session.state.diceValues;
      const requestedDieIndex = Number.isInteger(action.dieIndex) ? action.dieIndex : null;
      let diceToConsume = [];

      if (token.pos === -1) {
        const selectedDie = requestedDieIndex !== null ? diceValues[requestedDieIndex] : null;
        if (selectedDie === 6) { diceToConsume = [requestedDieIndex]; nextPos = 0; } 
        else if (requestedDieIndex === null && diceValues.includes(6)) { diceToConsume = [diceValues.indexOf(6)]; nextPos = 0; } 
        else return { error: 'Need a single die showing 6 to bring token out.' };
      } else {
        if (action.useTotal && diceValues.length > 1) {
          const sum = diceValues.reduce((a, b) => a + b, 0);
          if (token.pos + sum > 57) return { error: 'Total move overshoots home.' };
          diceToConsume = diceValues.map((_, i) => i);
          nextPos = token.pos + sum;
        } else if (requestedDieIndex !== null) {
          if (requestedDieIndex < 0 || requestedDieIndex >= diceValues.length) return { error: 'Choose a valid die first.' };
          if (token.pos + diceValues[requestedDieIndex] > 57) return { error: 'That die overshoots home for this token.' };
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

      if (isKill) {
        const remainingDiceCount = diceValues.length - diceToConsume.length;
        if (remainingDiceCount > 0) {
          const remainingDice = diceValues.filter((_, i) => !diceToConsume.includes(i));
          const hasOtherPlayableTokens = playerTokens.some((t, idx) => {
            if (idx === tokenIndex) return false;
            if (t.pos === -1 && remainingDice.includes(6)) return true;
            if (t.pos >= 0 && t.pos < 57) return remainingDice.some(d => t.pos + d <= 57);
            return false;
          });
          if (!hasOtherPlayableTokens) return { error: 'Move blocked: You cannot kill because you have no other tokens to play your remaining dice.' };
        }
      }

      diceToConsume.sort((a, b) => b - a).forEach((dieIndex) => { session.state.diceValues.splice(dieIndex, 1); });

      if (isKill) {
        tokensToKill.forEach(({ token: oppToken, index: oppIdx }) => {
          capturedTokens.push({ playerId: opponentId, tokenIndex: oppIdx, color: oppToken.color, fromPos: oppToken.pos });
          oppToken.pos = -1; 
        });
        token.pos = -2;
        session.state.hasBonusRoll = true;
      } else { token.pos = nextPos; }

      session.state.lastMove = {
        id: crypto.randomUUID(), playerId, tokenIndex, color: token.color,
        fromPos: previousPos, toPos: token.pos, capturedTokens, reachedHome: token.pos === 57 || token.pos === -2,
      };

      const isPlayerFinished = (tokens) => tokens.every((t) => t.pos === 57 || t.pos === -2);
      if (isPlayerFinished(playerTokens)) { session.state.winnerId = playerId; session.status = 'completed'; } 
      else if (isPlayerFinished(opponentTokens)) { session.state.winnerId = opponentId; session.status = 'completed'; }

      if (session.state.diceValues.length === 0 && session.status === 'active') {
        if (session.state.hasBonusRoll) session.state.hasBonusRoll = false;
        else session.state.currentPlayer = nextPlayer(session.players, playerId);
      }
    } else return { error: 'Unsupported action.' };

  // ==========================================
  // FOOTBALL ACTION LOGIC
  // ==========================================
  } else if (isFootball) {
    const s = session.state;
    const opponentId = session.players.find(id => id !== playerId);
    const myTeam = s.teams[playerId];
    const oppTeam = s.teams[opponentId];
    const isPlayerA = playerId === session.players[0];
    const attackingDir = isPlayerA ? 1 : -1;

    // Helper to switch turns
    const switchTurn = () => {
      s.turn.currentPlayer = opponentId;
      s.turn.actionPoints = 5;
      s.match.minute += 1;
      if (s.match.minute >= 90) session.status = 'completed';
    };

    if (action.type === 'end_turn') {
      switchTurn();
      return { session };
    }

    if (s.turn.actionPoints <= 0) return { error: 'No Action Points left.' };

    const footballer = myTeam.find(p => p.id === action.footballerId);
    if (!footballer) return { error: 'Footballer not found.' };

    // 1. MOVE
    if (action.type === 'move') {
      if (footballer.cards === 2) return { error: 'Player is sent off.' };
      const dist = getDistance(footballer, { x: action.targetX, y: action.targetY });
      const maxMove = (footballer.pace / 10) * (footballer.stamina / 100); 
      
      if (dist > maxMove) return { error: `Move too far. Max distance: ${maxMove.toFixed(1)}m` };
      
      footballer.x = Math.max(0, Math.min(PITCH_LENGTH, action.targetX));
      footballer.y = Math.max(0, Math.min(PITCH_WIDTH, action.targetY));
      footballer.stamina = Math.max(10, footballer.stamina - dist);
      
      if (s.ball.controlledBy === footballer.id) {
        s.ball.x = footballer.x;
        s.ball.y = footballer.y;
      }
      
      s.turn.actionPoints -= 1;
      s.turn.logs.push(`${footballer.role} moved to ${footballer.x}, ${footballer.y}.`);

    // 2. PASS
    } else if (action.type === 'pass') {
      if (s.ball.controlledBy !== footballer.id) return { error: 'This player does not have the ball.' };
      
      const targetPlayer = myTeam.find(p => p.id === action.targetPlayerId);
      if (!targetPlayer) return { error: 'Target player not found.' };

      // Offside Check
      if (checkOffside(footballer, targetPlayer, oppTeam, attackingDir)) {
        s.turn.logs.push(`OFFSIDE! Pass intercepted by referee. Turnover.`);
        s.ball.possessionTeam = opponentId;
        s.ball.controlledBy = oppTeam.find(p => p.role === 'GK').id;
        s.match.state = 'free_kick';
        switchTurn();
        return { session };
      }

      // Interception Mechanics
      const passDistance = getDistance(footballer, targetPlayer);
      let interceptedBy = null;
      let highestInterceptScore = -1;

      oppTeam.forEach(defender => {
        if (defender.cards === 2) return;
        const distToPass = distToSegment(defender, footballer, targetPlayer);
        // Defenders within 3m of the pass line can attempt interception
        if (distToPass < 3.0) {
          const interceptChance = (defender.tackle * 0.6) + (defender.pace * 0.4) - (distToPass * 10);
          const passQuality = (footballer.pass * 0.7) + (Math.random() * 30) - (passDistance * 0.5);
          
          if (interceptChance > passQuality && interceptChance > highestInterceptScore) {
            highestInterceptScore = interceptChance;
            interceptedBy = defender;
          }
        }
      });

      if (interceptedBy) {
        s.ball.controlledBy = interceptedBy.id;
        s.ball.possessionTeam = opponentId;
        s.ball.x = interceptedBy.x;
        s.ball.y = interceptedBy.y;
        s.turn.logs.push(`Pass INTERCEPTED by ${interceptedBy.role}!`);
        switchTurn();
      } else {
        s.ball.controlledBy = targetPlayer.id;
        s.ball.x = targetPlayer.x;
        s.ball.y = targetPlayer.y;
        s.turn.logs.push(`Successful pass to ${targetPlayer.role}.`);
        s.turn.actionPoints -= 1;
      }

    // 3. SHOOT
    } else if (action.type === 'shoot') {
      if (s.ball.controlledBy !== footballer.id) return { error: 'Player does not have the ball.' };
      
      const goalX = isPlayerA ? PITCH_LENGTH : 0;
      const targetY = Math.max(GOAL_MIN_Y, Math.min(GOAL_MAX_Y, action.targetY || 34));
      
      const distToGoal = getDistance(footballer, { x: goalX, y: targetY });
      if (distToGoal > 40) return { error: 'Too far to shoot.' };

      const oppGK = oppTeam.find(p => p.role === 'GK');
      const shotPower = footballer.shoot + (Math.random() * 20) - (distToGoal * 0.8);
      
      // GK positioning penalty
      const gkDistFromTraj = distToSegment(oppGK, footballer, { x: goalX, y: targetY });
      const gkSaveAbility = oppGK.save + (Math.random() * 20) - (gkDistFromTraj * 5);

      if (shotPower > gkSaveAbility) {
        s.turn.logs.push(`GOAL!!! ${footballer.role} scores from ${Math.round(distToGoal)}m!`);
        s.match.score[playerId] += 1;
        resetPositions(s, session.players, isPlayerA ? false : true); // Opponent kicks off
      } else {
        s.turn.logs.push(`SAVED by the Keeper!`);
        s.ball.controlledBy = oppGK.id;
        s.ball.possessionTeam = opponentId;
        s.ball.x = oppGK.x;
        s.ball.y = oppGK.y;
        switchTurn();
      }

    // 4. TACKLE
    } else if (action.type === 'tackle') {
      const targetId = action.targetId;
      const targetOpp = oppTeam.find(p => p.id === targetId);
      
      if (!targetOpp || s.ball.controlledBy !== targetId) return { error: 'Target does not have the ball.' };
      
      const dist = getDistance(footballer, targetOpp);
      if (dist > 2.5) return { error: 'Too far to tackle. Move closer.' };

      // Tackle calculation
      const tackleRoll = footballer.tackle + Math.random() * 20;
      const evadeRoll = targetOpp.pace + Math.random() * 20;

      if (tackleRoll > evadeRoll + 15) { // Clean tackle
        s.ball.controlledBy = footballer.id;
        s.ball.possessionTeam = playerId;
        s.turn.logs.push(`Clean tackle by ${footballer.role}! Possession won.`);
        s.turn.actionPoints -= 1;
      } else if (tackleRoll < evadeRoll - 20) { // Missed completely
        footballer.stamina -= 15;
        s.turn.logs.push(`${footballer.role} missed the tackle.`);
        s.turn.actionPoints -= 1;
      } else { // FOUL
        const foulSeverity = Math.random() * 100;
        s.turn.logs.push(`FOUL by ${footballer.role}!`);
        
        if (foulSeverity > 90) {
          footballer.cards = 2; // Red Card
          s.turn.logs.push(`RED CARD! ${footballer.role} is sent off!`);
        } else if (foulSeverity > 60) {
          footballer.cards += 1;
          s.turn.logs.push(`Yellow card to ${footballer.role}.`);
          if (footballer.cards >= 2) s.turn.logs.push(`SECOND YELLOW! ${footballer.role} is sent off!`);
        }

        s.match.state = 'free_kick';
        s.ball.x = targetOpp.x;
        s.ball.y = targetOpp.y;
        switchTurn();
      }
    } else return { error: 'Unsupported football action.' };
    
    // Auto turn transition if AP is exhausted
    if (s.turn.actionPoints <= 0 && s.turn.currentPlayer === playerId) {
      switchTurn();
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