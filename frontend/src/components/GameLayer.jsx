/* eslint-disable react-hooks/purity */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BellRing, PhoneMissed } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useAuthStore } from '../store/useAuthStore';

const WhotCardDesign = ({ card, playable, onPlay, disabled }) => {
  const getSuitSymbol = (suit) => {
    const symbols = { circle: '●', triangle: '▲', cross: '✕', star: '★', square: '■', whot: '⚡' };
    return symbols[suit] || '?';
  };
  const getSuitColor = (suit) => {
    const colors = { circle: 'text-yellow-500', triangle: 'text-green-500', cross: 'text-red-500', star: 'text-blue-500', square: 'text-purple-500', whot: 'text-orange-500' };
    return colors[suit] || 'text-gray-500';
  };

  return (
    <button
      disabled={disabled || !playable}
      onClick={onPlay}
      className={`
        relative w-24 h-36 rounded-xl border-4 bg-gradient-to-br from-white to-gray-100
        ${playable ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)] animate-pulse' : 'border-gray-700'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-2 hover:shadow-2xl'}
        transition-all duration-200 transform
      `}
    >
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 10px 10px, #000 2px, transparent 2px)', backgroundSize: '20px 20px' }} />
      <div className="absolute top-1 left-1 flex flex-col items-center">
        <span className={`text-2xl font-bold ${getSuitColor(card.suit)}`}>{card.number === 20 ? '20' : card.number}</span>
        <span className={`text-xl ${getSuitColor(card.suit)}`}>{getSuitSymbol(card.suit)}</span>
      </div>
      <div className="absolute bottom-1 right-1 flex flex-col items-center rotate-180">
        <span className={`text-2xl font-bold ${getSuitColor(card.suit)}`}>{card.number === 20 ? '20' : card.number}</span>
        <span className={`text-xl ${getSuitColor(card.suit)}`}>{getSuitSymbol(card.suit)}</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center bg-gray-200/50 backdrop-blur-sm border-2 ${getSuitColor(card.suit)} border-opacity-30`}>
          <span className={`text-5xl ${getSuitColor(card.suit)}`}>{getSuitSymbol(card.suit)}</span>
        </div>
      </div>
      {card.number === 20 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 flex">
          <div className="flex-1 bg-green-600" /><div className="flex-1 bg-white" /><div className="flex-1 bg-green-600" />
        </div>
      )}
    </button>
  );
};

const Dice3D = ({ value, rolling, disabled, onClick, selected }) => {
  const rotations = {
    1: 'rotateX(0deg) rotateY(0deg)',
    2: 'rotateY(-90deg)',
    3: 'rotateX(90deg)',
    4: 'rotateX(-90deg)',
    5: 'rotateY(90deg)',
    6: 'rotateY(180deg)',
  };

  const transform = rolling
    ? `rotateX(${Math.floor(Math.random() * 4 + 4) * 90}deg) rotateY(${Math.floor(Math.random() * 4 + 4) * 90}deg)`
    : rotations[value || 1];

  const faces = [
    { value: 1, dots: [4], rotation: 'rotateY(0deg)' },
    { value: 2, dots: [0, 8], rotation: 'rotateY(90deg)' },
    { value: 3, dots: [0, 4, 8], rotation: 'rotateX(-90deg)' },
    { value: 4, dots: [0, 2, 6, 8], rotation: 'rotateX(90deg)' },
    { value: 5, dots: [0, 2, 4, 6, 8], rotation: 'rotateY(-90deg)' },
    { value: 6, dots: [0, 2, 3, 5, 6, 8], rotation: 'rotateY(180deg)' },
  ];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ perspective: '800px' }}
      className={`w-14 h-14 rounded-xl transition-all ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:scale-105 active:scale-95'} ${selected ? 'ring-4 ring-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.45)]' : ''}`}
    >
      <div
        className={`relative w-full h-full transition-transform ${rolling ? 'duration-300 ease-linear' : 'duration-700 ease-out'}`}
        style={{ transformStyle: 'preserve-3d', transform }}
      >
        {faces.map((face) => (
          <div
            key={face.value}
            className="absolute w-full h-full bg-white rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.22)] grid grid-cols-3 grid-rows-3 p-1.5 gap-1"
            style={{ transform: `${face.rotation} translateZ(28px)` }}
          >
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="flex items-center justify-center">
                {face.dots.includes(i) && <div className="w-2.5 h-2.5 bg-black rounded-full" />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </button>
  );
};

const getTokenColorClass = (color) => ({
  red: 'bg-red-600',
  green: 'bg-green-600',
  blue: 'bg-blue-600',
  yellow: 'bg-yellow-400',
}[color] || 'bg-gray-600');

const LudoToken = ({ color, targetPathIndex, pathArray, homePos, completedPos, stackOffset, isMine, onClick, disabled, isSelected }) => {
  const [displayIndex, setDisplayIndex] = useState(targetPathIndex);
  const isJumping = displayIndex !== targetPathIndex;

  useEffect(() => {
    if (displayIndex === targetPathIndex) {
      return undefined;
    }

    const nextStep = targetPathIndex === -1
      ? -1
      : displayIndex < targetPathIndex
        ? displayIndex + 1
        : displayIndex - 1;

    const timer = setTimeout(() => setDisplayIndex(nextStep), targetPathIndex === -1 ? 180 : 120);
    return () => clearTimeout(timer);
  }, [displayIndex, targetPathIndex]);

  const position = useMemo(() => {
    if (displayIndex === -1) return homePos;
    if (displayIndex >= 57) {
      return {
        x: completedPos.x + stackOffset.x,
        y: completedPos.y + stackOffset.y,
      };
    }
    return pathArray[displayIndex] || { x: 50, y: 50 };
  }, [completedPos, displayIndex, homePos, pathArray, stackOffset]);

  return (
    <div
      className={`absolute z-20 transition-all duration-300 ease-out ${isJumping ? 'animate-bounce' : ''}`}
      style={{ left: `${position.x}%`, top: `${position.y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          relative flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full
          ${getTokenColorClass(color)}
          border-2 border-white shadow-[0_4px_6px_rgba(0,0,0,0.5)]
          ${isMine && !disabled ? 'hover:scale-125 cursor-pointer ring-2 ring-white' : ''}
          ${isSelected ? 'scale-125 ring-4 ring-yellow-300' : ''}
          ${disabled ? 'opacity-90 cursor-not-allowed' : ''}
        `}
      >
        <div className="absolute inset-0.5 sm:inset-1 rounded-full border-t-2 border-white/40 bg-black/10" />
      </button>
    </div>
  );
};

const NigerianLudoBoard = ({ game, onMove, onRoll, selectedDieIndex, onSelectDie }) => {
  const me = useAuthStore.getState().authUser?._id;
  const myTurn = game.currentPlayer === me;
  const [diceRolling, setDiceRolling] = useState(false);
  const [dice1, setDice1] = useState(1);
  const [dice2, setDice2] = useState(1);
  const lastMoveSoundIdRef = useRef(null);
  const moveSoundRef = useRef(null);
  const captureSoundRef = useRef(null);

  const getCoord = (col, row) => ({ x: ((col + 0.5) / 15) * 100, y: ((row + 0.5) / 15) * 100 });
  const getCellCenter = (col, row) => ({ x: ((col + 0.5) / 15) * 100, y: ((row + 0.5) / 15) * 100 });

  const redPath = [
    [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], [7, 0], [8, 0],
    [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [14, 7], [14, 8],
    [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], [7, 14], [6, 14],
    [6, 13], [6, 12], [6, 11], [6, 10], [6, 9], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8], [0, 7], [0, 6],
    [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7],
  ].map(([c, r]) => getCellCenter(c, r));

  const rotatePath = (path, offset) => path.slice(offset, 52).concat(path.slice(0, offset)).concat(path.slice(52));
  const ludoPath = {
    red: redPath,
    green: rotatePath(redPath, 13),
    yellow: rotatePath(redPath, 39),
    blue: rotatePath(redPath, 26),
  };

  const homePositions = {
    red: [getCoord(2.2, 2.2), getCoord(3.8, 2.2), getCoord(2.2, 3.8), getCoord(3.8, 3.8)],
    green: [getCoord(10.8, 2.2), getCoord(12.4, 2.2), getCoord(10.8, 3.8), getCoord(12.4, 3.8)],
    yellow: [getCoord(2.2, 10.8), getCoord(3.8, 10.8), getCoord(2.2, 12.4), getCoord(3.8, 12.4)],
    blue: [getCoord(10.8, 10.8), getCoord(12.4, 10.8), getCoord(10.8, 12.4), getCoord(12.4, 12.4)],
  };

  const completedCenter = { x: 50, y: 50 };
  const completedOffsets = [
    { x: -2.6, y: -2.6 },
    { x: 2.6, y: -2.6 },
    { x: -2.6, y: 2.6 },
    { x: 2.6, y: 2.6 },
  ];

  const availableDice = [game.diceValue1, game.diceValue2].filter((value) => value !== null && value !== undefined);

  useEffect(() => {
    moveSoundRef.current = new Audio('/sounds/mouse-click.mp3');
    captureSoundRef.current = new Audio('/sounds/notification.mp3');

    return () => {
      moveSoundRef.current = null;
      captureSoundRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!game.lastMove?.id || lastMoveSoundIdRef.current === game.lastMove.id) return;
    lastMoveSoundIdRef.current = game.lastMove.id;

    moveSoundRef.current?.pause();
    if (moveSoundRef.current) {
      moveSoundRef.current.currentTime = 0;
      moveSoundRef.current.play().catch(() => {});
    }

    if (game.lastMove.capturedTokens?.length && captureSoundRef.current) {
      captureSoundRef.current.pause();
      captureSoundRef.current.currentTime = 0;
      captureSoundRef.current.play().catch(() => {});
    }
  }, [game.lastMove]);

  useEffect(() => {
    if (!myTurn || availableDice.length <= 1) {
      onSelectDie(null);
      return;
    }
    if (selectedDieIndex !== null && selectedDieIndex >= availableDice.length) {
      onSelectDie(null);
    }
  }, [availableDice.length, myTurn, onSelectDie, selectedDieIndex]);

  const handleRoll = () => {
    if (!myTurn || game.diceValue1 || game.diceValue2 || diceRolling) return;
    setDiceRolling(true);
    const r1 = Math.floor(Math.random() * 6) + 1;
    const r2 = Math.floor(Math.random() * 6) + 1;
    setTimeout(() => {
      setDice1(r1);
      setDice2(r2);
      setDiceRolling(false);
      onRoll([r1, r2]);
    }, 800);
  };

  useEffect(() => {
    if (!diceRolling) {
      if (game.diceValue1 !== null && game.diceValue1 !== undefined) setDice1(game.diceValue1);
      if (game.diceValue2 !== null && game.diceValue2 !== undefined) setDice2(game.diceValue2);
    }
  }, [game.diceValue1, game.diceValue2, diceRolling]);

  return (
    <div className="flex-1 p-2 sm:p-6 flex flex-col items-center gap-4">
      <div className={`px-8 py-3 rounded-full text-white font-black text-lg shadow-xl border-2 ${myTurn ? 'bg-green-600 border-green-400 animate-pulse' : 'bg-red-600 border-red-800'}`}>
        {myTurn ? '🎲 YOUR TURN!' : '👤 OPPONENT\'S TURN'}
        {(game.diceValue1 || game.diceValue2) && ` • Rolled: ${game.diceValue1 || '-'} & ${game.diceValue2 || '-'}`}
      </div>

      {!!availableDice.length && myTurn && (
        <div className="bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-white flex flex-col items-center gap-2">
          <div className="text-sm font-semibold text-yellow-300">Choose the die to count first</div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {availableDice.map((value, index) => (
              <button
                key={`${value}-${index}`}
                type="button"
                onClick={() => onSelectDie(index)}
                className={`px-4 py-2 rounded-full border text-sm font-bold transition ${selectedDieIndex === index ? 'bg-yellow-400 text-black border-yellow-200 shadow-lg' : 'bg-white/10 border-white/15 hover:bg-white/20'}`}
              >
                Use {value}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative w-full max-w-[600px] aspect-square bg-[#0a230f] rounded-lg p-2 sm:p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-8 border-[#3b1c0a]">
        <div className="relative w-full h-full bg-white shadow-inner overflow-hidden border-2 border-black">
          <svg viewBox="0 0 150 150" className="absolute inset-0 w-full h-full pointer-events-none">
            <rect x="0" y="0" width="60" height="60" fill="#dc2626" />
            <rect x="90" y="0" width="60" height="60" fill="#16a34a" />
            <rect x="0" y="90" width="60" height="60" fill="#facc15" />
            <rect x="90" y="90" width="60" height="60" fill="#2563eb" />

            <rect x="10" y="60" width="10" height="10" fill="#dc2626" />
            <rect x="10" y="70" width="50" height="10" fill="#dc2626" />
            <rect x="80" y="10" width="10" height="10" fill="#16a34a" />
            <rect x="70" y="10" width="10" height="50" fill="#16a34a" />
            <rect x="60" y="130" width="10" height="10" fill="#facc15" />
            <rect x="70" y="90" width="10" height="50" fill="#facc15" />
            <rect x="130" y="80" width="10" height="10" fill="#2563eb" />
            <rect x="90" y="70" width="50" height="10" fill="#2563eb" />

            <polygon points="60,60 90,60 75,75" fill="#16a34a" />
            <polygon points="90,60 90,90 75,75" fill="#2563eb" />
            <polygon points="60,90 90,90 75,75" fill="#facc15" />
            <polygon points="60,60 60,90 75,75" fill="#dc2626" />
            <circle cx="75" cy="75" r="7" fill="white" stroke="black" strokeWidth="0.8" />

            <g stroke="black" strokeWidth="0.5" opacity="0.8">
              {[60, 70, 80, 90].map((x) => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="150" />)}
              {[10, 20, 30, 40, 50, 100, 110, 120, 130, 140].map((x) => <line key={`vx${x}`} x1={x} y1="60" x2={x} y2="90" />)}
              {[60, 70, 80, 90].map((y) => <line key={`h${y}`} x1="0" y1={y} x2="150" y2={y} />)}
              {[10, 20, 30, 40, 50, 100, 110, 120, 130, 140].map((y) => <line key={`hy${y}`} x1="60" y1={y} x2="90" y2={y} />)}
            </g>
          </svg>

          {game.tokens && Object.entries(game.tokens).map(([playerId, tokenPositions]) => {
            const isMine = playerId === me;
            const colorCounts = {};
            const completedColorCounts = {};

            return tokenPositions.map((token, tokenIdx) => {
              const color = token.color;
              const colorIndex = colorCounts[color] || 0;
              colorCounts[color] = colorIndex + 1;

              const completedIndex = completedColorCounts[color] || 0;
              if (token.pos >= 57) {
                completedColorCounts[color] = completedIndex + 1;
              }

              return (
                <LudoToken
                  key={`${playerId}-${tokenIdx}`}
                  color={color}
                  targetPathIndex={token.pos}
                  pathArray={ludoPath[color]}
                  homePos={homePositions[color][colorIndex]}
                  completedPos={completedCenter}
                  stackOffset={completedOffsets[completedIndex % completedOffsets.length]}
                  isMine={isMine}
                  disabled={!isMine || !myTurn || (!game.diceValue1 && !game.diceValue2)}
                  isSelected={isMine && game.selectedTokenIndex === tokenIdx}
                  onClick={() => onMove(tokenIdx)}
                />
              );
            });
          })}
        </div>

        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="flex items-center justify-center gap-4 pointer-events-auto">
            <div className="flex gap-4">
              <Dice3D
                value={dice1}
                rolling={diceRolling}
                onClick={game.diceValue1 || game.diceValue2 ? () => onSelectDie(0) : handleRoll}
                disabled={!myTurn || diceRolling}
                selected={selectedDieIndex === 0 && availableDice.length > 1}
              />
              <Dice3D
                value={dice2}
                rolling={diceRolling}
                onClick={game.diceValue1 || game.diceValue2 ? () => onSelectDie(1) : handleRoll}
                disabled={!myTurn || diceRolling || (!game.diceValue2 && !diceRolling && !(!game.diceValue1 && !game.diceValue2))}
                selected={selectedDieIndex === 1 && availableDice.length > 1}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const NigerianWhotView = ({ game, onPlayCard, onDraw }) => {
  const me = useAuthStore.getState().authUser?._id;
  const myTurn = game.currentPlayer === me;
  const [showSuitSelector, setShowSuitSelector] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState(null);

  const isPlayable = (card) => {
    if (!myTurn) return false;
    if (card.suit === 'whot') return true;
    if (game.requestedSuit) return card.suit === game.requestedSuit;
    return card.suit === game.topCard?.suit || card.number === game.topCard?.number;
  };

  const handlePlayCard = (card) => {
    if (card.number === 20) {
      setSelectedCardId(card.id);
      setShowSuitSelector(true);
    } else {
      onPlayCard(card.id);
    }
  };

  const handleSuitSelect = (suit) => {
    onPlayCard(selectedCardId, suit);
    setShowSuitSelector(false);
    setSelectedCardId(null);
  };

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 text-white">
      <div className="bg-gradient-to-r from-green-800 to-green-900 rounded-xl p-4 border-2 border-yellow-500">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm opacity-80">Opponent Cards</div>
            <div className="text-2xl font-bold">{game.opponentCount}</div>
          </div>
          <div className="text-center">
            <div className="text-sm mb-1">Top Card</div>
            <WhotCardDesign card={game.topCard} disabled playable={false} />
          </div>
          <div>
            <div className="text-sm opacity-80">Deck</div>
            <div className="text-2xl font-bold">{game.deckCount}</div>
          </div>
        </div>
        <div className="mt-3 text-center">
          <span className={myTurn ? 'text-yellow-300' : 'text-gray-300'}>
            {myTurn ? '🎮 Your Turn' : '⏳ Opponent\'s Turn'}
          </span>
          {game.requestedSuit && <span className="ml-3 px-2 py-1 bg-yellow-500/30 rounded-full text-sm">Requested: {game.requestedSuit}</span>}
          {game.pendingDraw > 0 && <span className="ml-3 px-2 py-1 bg-red-500/30 rounded-full text-sm">Draw {game.pendingDraw} cards!</span>}
        </div>
      </div>

      {showSuitSelector && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gradient-to-b from-green-900 to-green-800 p-6 rounded-2xl border-4 border-yellow-500 max-w-md">
            <h3 className="text-2xl font-bold mb-4 text-center">Choose Suit 🇳🇬</h3>
            <div className="grid grid-cols-3 gap-3">
              {['circle', 'triangle', 'cross', 'star', 'square'].map((suit) => (
                <button
                  key={suit}
                  onClick={() => handleSuitSelect(suit)}
                  className="p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-all border-2 border-transparent hover:border-yellow-500"
                >
                  <div className="text-4xl mb-1">
                    {suit === 'circle' && '●'} {suit === 'triangle' && '▲'} {suit === 'cross' && '✕'} {suit === 'star' && '★'} {suit === 'square' && '■'}
                  </div>
                  <div className="text-sm capitalize">{suit}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1">
        <h4 className="text-lg mb-3">Your Cards ({game.myHand.length})</h4>
        <div className="flex flex-wrap gap-3 justify-center">
          {game.myHand.map((card) => (
            <WhotCardDesign key={card.id} card={card} playable={isPlayable(card)} disabled={!myTurn} onPlay={() => handlePlayCard(card)} />
          ))}
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={onDraw}
          disabled={!myTurn}
          className={`px-8 py-3 rounded-full font-bold text-lg bg-gradient-to-r from-yellow-500 to-yellow-600 text-black transform transition-all ${myTurn ? 'hover:scale-110 hover:shadow-2xl' : 'opacity-50 cursor-not-allowed'}`}
        >
          🎴 Draw Card
        </button>
      </div>
    </div>
  );
};

export default function GameLayer() {
  const {
    pendingInvite,
    respondInvite,
    activeGame,
    dashboard,
    isDashboardVisible,
    forfeitGame,
    closeGame,
    sendAction,
    missedGameCalls,
    roomRecovery,
    dismissRoomRecovery,
  } = useGameStore();
  const me = useAuthStore((s) => s.authUser);
  const [selectedDieIndex, setSelectedDieIndex] = useState(null);


  const diceValues = activeGame ? [activeGame.diceValue1, activeGame.diceValue2].filter((value) => value !== null && value !== undefined) : [];
  const effectiveSelectedDieIndex = diceValues.length > 1 && selectedDieIndex !== null && selectedDieIndex < diceValues.length ? selectedDieIndex : null;

  const handlePlayCard = (cardId, requestedSuit) => sendAction({ type: 'play', cardId, requestedSuit });
  const handleDrawCard = () => sendAction({ type: 'draw' });
  const handleMoveToken = (tokenIndex) => sendAction({ type: 'move', tokenIndex, dieIndex: effectiveSelectedDieIndex });
  const handleRollDice = (diceValues) => sendAction({ type: 'roll', dice1: diceValues[0], dice2: diceValues[1] });

  return (
    <>
      {pendingInvite && (
        <div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center">
          <div className="bg-gradient-to-b from-green-900 to-green-800 border-4 border-yellow-500 p-8 rounded-2xl text-white w-96">
            <div className="text-center mb-4"><span className="text-6xl">🎮</span></div>
            <h3 className="text-2xl font-bold text-center mb-2">Game Invite!</h3>
            <p className="text-center text-lg mb-6">
              {pendingInvite.fromUser?.fullname} invited you to play <span className="font-bold text-yellow-300">{pendingInvite.gameType.toUpperCase()}</span>
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => respondInvite(false)} className="px-6 py-2 bg-red-600 rounded-full font-bold hover:bg-red-700">Decline</button>
              <button onClick={() => respondInvite(true)} className="px-6 py-2 bg-green-600 rounded-full font-bold hover:bg-green-700">Accept 🎉</button>
            </div>
          </div>
        </div>
      )}

      {roomRecovery && activeGame && (
        <div className="fixed inset-0 z-[125] bg-black/85 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-gradient-to-b from-red-950 to-red-900 border-4 border-red-400 rounded-3xl p-8 text-white text-center shadow-2xl">
            <div className="text-5xl mb-4">⚠️</div>
            <h3 className="text-2xl font-black mb-3">Game room restored after refresh</h3>
            <p className="text-sm text-red-100/90 mb-6">
              You came back while this game room was still active. Forfeit the match if you want to leave, or resume to jump back in.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  dismissRoomRecovery();
                  forfeitGame();
                }}
                className="w-full px-5 py-3 rounded-full bg-red-500 hover:bg-red-400 font-black text-lg transition"
              >
                Forfeit Game
              </button>
              <button
                type="button"
                onClick={dismissRoomRecovery}
                className="w-full px-5 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-lg transition"
              >
                Resume Game
              </button>
            </div>
          </div>
        </div>
      )}

      {activeGame && (
        <div className="fixed inset-0 z-[110] bg-gradient-to-b from-green-950 via-green-900 to-green-950 flex flex-col">
          <div className="p-4 border-b-4 border-yellow-500 bg-gradient-to-r from-green-800 to-green-900">
            <div className="flex justify-between items-center text-white max-w-6xl mx-auto">
              <div className="flex items-center gap-3">
                <span className="text-4xl">🎲</span>
                <div>
                  <h2 className="text-3xl font-bold">{activeGame.gameType === 'whot' ? '🇳🇬 WHOT' : '🇳🇬 LUDO'}</h2>
                  <p className="text-sm opacity-80">Nigerian Classic</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={forfeitGame} className="px-4 py-2 bg-red-600 rounded-full font-bold hover:bg-red-700 transition">Forfeit</button>
                {!roomRecovery && <button onClick={closeGame} className="px-4 py-2 bg-gray-700 rounded-full font-bold hover:bg-gray-600 transition">Close</button>}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {activeGame.gameType === 'whot' ? (
              <NigerianWhotView game={activeGame} onPlayCard={handlePlayCard} onDraw={handleDrawCard} />
            ) : (
              <NigerianLudoBoard
                game={activeGame}
                onMove={handleMoveToken}
                onRoll={handleRollDice}
                selectedDieIndex={effectiveSelectedDieIndex}
                onSelectDie={setSelectedDieIndex}
              />
            )}
          </div>

          {activeGame.winnerId && (
            <div className="p-4 border-t-4 border-yellow-500 bg-gradient-to-r from-yellow-500 to-yellow-600 text-center">
              <span className="text-2xl font-bold text-black">
                🏆 Winner: {activeGame.winnerId === me?._id ? '🎉 You! Congratulations!' : 'Opponent'} 🏆
              </span>
            </div>
          )}
        </div>
      )}

      {missedGameCalls.length > 0 && !activeGame && (
        <div className="fixed left-4 bottom-4 z-[106] w-80 bg-slate-950/95 border border-red-500/40 rounded-2xl p-4 text-white shadow-2xl">
          <div className="flex items-center gap-2 mb-3 text-red-300">
            <PhoneMissed size={18} />
            <h4 className="font-bold">Missed game calls</h4>
          </div>
          <div className="space-y-2 max-h-52 overflow-auto pr-1">
            {missedGameCalls.slice(0, 6).map((call) => (
              <div key={call.id} className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="font-semibold">{call.fromName}</div>
                <div className="text-xs text-slate-300 mt-1">{String(call.gameType).toUpperCase()} invite while you were busy.</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {dashboard && isDashboardVisible && (
        <div className="fixed right-4 bottom-4 z-[105] bg-gradient-to-b from-green-900 to-green-800 border-2 border-yellow-500 rounded-xl p-6 text-white w-80">
          <h4 className="text-xl font-bold mb-4 flex items-center gap-2"><span>📊</span> Your Stats</h4>
          <div className="space-y-3">
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-sm opacity-80">Total Games</div>
              <div className="text-2xl font-bold">{dashboard.totalPlayed || 0}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-sm opacity-80">Wins</div>
              <div className="text-2xl font-bold text-green-400">{dashboard.totalWon || 0}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/10 rounded-lg p-2 text-center">
                <div className="text-sm">WHOT</div>
                <div className="font-bold">{dashboard.whot?.won || 0}/{dashboard.whot?.played || 0}</div>
              </div>
              <div className="bg-white/10 rounded-lg p-2 text-center">
                <div className="text-sm">LUDO</div>
                <div className="font-bold">{dashboard.ludo?.won || 0}/{dashboard.ludo?.played || 0}</div>
              </div>
            </div>
            <div className="bg-black/20 rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 text-sm font-semibold text-cyan-200"><BellRing size={15} /> Missed calls</div>
              <div className="text-2xl font-bold mt-1">{missedGameCalls.length}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
