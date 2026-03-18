/* eslint-disable react-hooks/purity */
import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useAuthStore } from '../store/useAuthStore';

// --- WHOT CARD DESIGN ---
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
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `radial-gradient(circle at 10px 10px, #000 2px, transparent 2px)`, backgroundSize: '20px 20px' }} />
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

// --- REALISTIC 3D DICE COMPONENT ---
const Dice3D = ({ value, rolling }) => {
  // Rotations required to show each face correctly to the camera
  const rotations = {
    1: 'rotateX(0deg) rotateY(0deg)',
    2: 'rotateX(-90deg) rotateY(0deg)',
    3: 'rotateY(-90deg) rotateZ(0deg)',
    4: 'rotateY(90deg) rotateZ(0deg)',
    5: 'rotateX(90deg) rotateY(0deg)',
    6: 'rotateX(180deg) rotateY(0deg)',
  };

  // If rolling, spin rapidly on multiple axes
  const transform = rolling 
    ? `rotateX(${Math.floor(Math.random() * 4 + 4) * 90}deg) rotateY(${Math.floor(Math.random() * 4 + 4) * 90}deg)` 
    : rotations[value || 1];

  const Face = ({ dots, rotation }) => (
    <div 
      className="absolute w-full h-full bg-white border border-gray-300 rounded-lg shadow-inner grid grid-cols-3 grid-rows-3 p-1.5 gap-1"
      style={{ transform: `${rotation} translateZ(24px)` }}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="flex items-center justify-center">
          {dots.includes(i) && <div className="w-2.5 h-2.5 bg-black rounded-full" />}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ perspective: '800px' }} className="w-12 h-12 shadow-2xl rounded-lg">
      <div 
        className={`relative w-full h-full transition-transform ${rolling ? 'duration-300 ease-linear' : 'duration-700 ease-out'}`}
        style={{ transformStyle: 'preserve-3d', transform }}
      >
        <Face dots={[4]} rotation="rotateY(0deg)" /> {/* 1 */}
        <Face dots={[0,8]} rotation="rotateX(-90deg)" /> {/* 2 */}
        <Face dots={[0,4,8]} rotation="rotateY(-90deg)" /> {/* 3 */}
        <Face dots={[0,2,6,8]} rotation="rotateY(90deg)" /> {/* 4 */}
        <Face dots={[0,2,4,6,8]} rotation="rotateX(90deg)" /> {/* 5 */}
        <Face dots={[0,2,3,5,6,8]} rotation="rotateX(180deg)" /> {/* 6 */}
      </div>
    </div>
  );
};

// --- ANIMATED CLEAN LUDO TOKEN ---
const LudoToken = ({ color, targetPathIndex, pathArray, homePos, isMine, onClick, disabled }) => {
  const [displayIndex, setDisplayIndex] = useState(targetPathIndex);

  // Stepping Animation Effect
  useEffect(() => {
    if (displayIndex !== targetPathIndex) {
      if (targetPathIndex === -1) {
        setDisplayIndex(-1); // Eaten, instant home
      } else if (displayIndex === -1 && targetPathIndex === 0) {
        setDisplayIndex(0); // Exiting house
      } else {
        const step = displayIndex < targetPathIndex ? 1 : -1;
        const timer = setTimeout(() => {
          setDisplayIndex(prev => prev + step);
        }, 150); // Speed of the steps
        return () => clearTimeout(timer);
      }
    }
  }, [displayIndex, targetPathIndex]);

  const position = displayIndex === -1 ? homePos : (pathArray[displayIndex] || { x: 50, y: 50 });

  const getNigerianColor = (color) => {
    const colors = {
      red: 'bg-red-600',
      green: 'bg-green-600',
      blue: 'bg-blue-600',
      yellow: 'bg-yellow-400'
    };
    return colors[color] || 'bg-gray-600';
  };

  return (
    <div 
      className="absolute z-20 transition-all duration-150 ease-linear" 
      style={{ left: `${position.x}%`, top: `${position.y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          relative w-6 h-6 sm:w-8 sm:h-8 rounded-full 
          ${getNigerianColor(color)}
          border-2 border-white shadow-[0_4px_6px_rgba(0,0,0,0.5)]
          ${isMine && !disabled ? 'hover:scale-125 cursor-pointer ring-2 ring-white animate-pulse' : ''}
          ${disabled ? 'opacity-90 cursor-not-allowed' : ''}
        `}
      >
        {/* Clean design: 3D lighting reflection, NO numbers or stars */}
        <div className="absolute inset-0.5 sm:inset-1 rounded-full border-t-2 border-white/40 bg-black/10"></div>
      </button>
    </div>
  );
};

// --- NIGERIAN LUDO BOARD ---
const NigerianLudoBoard = ({ game, onMove, onRoll }) => {
  const me = useAuthStore.getState().authUser?._id;
  const myTurn = game.currentPlayer === me;
  const [diceRolling, setDiceRolling] = useState(false);
  const [dice1, setDice1] = useState(1);
  const [dice2, setDice2] = useState(1);

  // 15x15 Grid Coordinate Generator
  const getCoord = (col, row) => ({ x: ((col + 0.5) / 15) * 100, y: ((row + 0.5) / 15) * 100 });

  const generatePath = (startCol, startRow, moves) => {
    let path = [];
    let [c, r] = [startCol, startRow];
    moves.forEach(([dc, dr, steps]) => {
      for (let i = 0; i < steps; i++) {
        c += dc; r += dr;
        path.push(getCoord(c, r));
      }
    });
    return path;
  };

  const ludoPath = {
    red: [getCoord(1, 6), ...generatePath(1, 6, [[1,0,4], [0,-1,6], [1,0,2], [0,1,6], [1,0,6], [0,1,2], [-1,0,6], [0,1,6], [-1,0,2], [0,-1,6], [-1,0,5], [0,-1,1], [1,0,5]])],
    green: [getCoord(8, 1), ...generatePath(8, 1, [[0,1,4], [1,0,6], [0,1,2], [-1,0,6], [0,1,6], [-1,0,2], [0,-1,6], [-1,0,6], [0,-1,2], [1,0,6], [0,-1,5], [1,0,1], [0,1,5]])],
    yellow: [getCoord(6, 13), ...generatePath(6, 13, [[0,-1,4], [-1,0,6], [0,-1,2], [1,0,6], [0,-1,6], [1,0,2], [0,1,6], [1,0,6], [0,1,2], [-1,0,6], [0,1,5], [-1,0,1], [0,-1,5]])],
    blue: [getCoord(13, 8), ...generatePath(13, 8, [[-1,0,4], [0,1,6], [-1,0,2], [0,-1,6], [-1,0,6], [0,-1,2], [1,0,6], [0,-1,6], [1,0,2], [0,1,6], [1,0,5], [0,1,1], [-1,0,5]])]
  };

  const homePositions = {
    red: [getCoord(2.5, 2.5), getCoord(3.5, 2.5), getCoord(2.5, 3.5), getCoord(3.5, 3.5)],
    green: [getCoord(11.5, 2.5), getCoord(12.5, 2.5), getCoord(11.5, 3.5), getCoord(12.5, 3.5)],
    yellow: [getCoord(2.5, 11.5), getCoord(3.5, 11.5), getCoord(2.5, 12.5), getCoord(3.5, 12.5)],
    blue: [getCoord(11.5, 11.5), getCoord(12.5, 11.5), getCoord(11.5, 12.5), getCoord(12.5, 12.5)]
  };

  const getPlayerColor = (playerId) => {
    const players = Object.keys(game.tokens || {});
    return ['red', 'green', 'yellow', 'blue'][players.indexOf(playerId)] || 'red';
  };

  const handleRoll = () => {
    setDiceRolling(true);
    const r1 = Math.floor(Math.random() * 6) + 1;
    const r2 = Math.floor(Math.random() * 6) + 1;
    
    // Simulate tumble duration
    setTimeout(() => {
      setDice1(r1); setDice2(r2);
      setDiceRolling(false);
      onRoll([r1, r2]);
    }, 800);
  };

  // Sync state dice back to visual dice if updated externally
  useEffect(() => {
    if (game.diceValue1 && !diceRolling) setDice1(game.diceValue1);
    if (game.diceValue2 && !diceRolling) setDice2(game.diceValue2);
  }, [game.diceValue1, game.diceValue2]);

  return (
    <div className="flex-1 p-2 sm:p-6 flex flex-col items-center gap-4">
      {/* Turn Indicator */}
      <div className={`px-8 py-3 rounded-full text-white font-black text-lg shadow-xl border-2 ${myTurn ? 'bg-green-600 border-green-400 animate-pulse' : 'bg-red-600 border-red-800'}`}>
        {myTurn ? '🎲 YOUR TURN!' : '👤 OPPONENT\'S TURN'}
        {(game.diceValue1 || game.diceValue2) && ` • Rolled: ${game.diceValue1 || ''} & ${game.diceValue2 || ''}`}
      </div>

      <div className="relative w-full max-w-[600px] aspect-square bg-[#0a230f] rounded-lg p-2 sm:p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-8 border-[#3b1c0a]">
        
        {/* SVG Board */}
        <div className="relative w-full h-full bg-white shadow-inner overflow-hidden border-2 border-black">
          <svg viewBox="0 0 150 150" className="absolute inset-0 w-full h-full pointer-events-none">
            <rect x="0" y="0" width="60" height="60" fill="#dc2626" />
            <rect x="90" y="0" width="60" height="60" fill="#16a34a" />
            <rect x="0" y="90" width="60" height="60" fill="#facc15" />
            <rect x="90" y="90" width="60" height="60" fill="#2563eb" />

            <rect x="10" y="60" width="10" height="10" fill="#dc2626" />
            <rect x="10" y="70" width="50" height="10" fill="#dc2626" />
            <polygon points="20,72 28,75 20,78" fill="white" opacity="0.6" />
            <polygon points="35,72 43,75 35,78" fill="white" opacity="0.6" />

            <rect x="80" y="10" width="10" height="10" fill="#16a34a" />
            <rect x="70" y="10" width="10" height="50" fill="#16a34a" />
            <polygon points="72,20 75,28 78,20" fill="white" opacity="0.6" />
            <polygon points="72,35 75,43 78,35" fill="white" opacity="0.6" />

            <rect x="60" y="130" width="10" height="10" fill="#facc15" />
            <rect x="70" y="90" width="10" height="50" fill="#facc15" />
            <polygon points="72,130 75,122 78,130" fill="white" opacity="0.6" />
            <polygon points="72,115 75,107 78,115" fill="white" opacity="0.6" />

            <rect x="130" y="80" width="10" height="10" fill="#2563eb" />
            <rect x="90" y="70" width="50" height="10" fill="#2563eb" />
            <polygon points="130,72 122,75 130,78" fill="white" opacity="0.6" />
            <polygon points="115,72 107,75 115,78" fill="white" opacity="0.6" />

            <polygon points="60,60 90,60 75,75" fill="#16a34a" />
            <polygon points="90,60 90,90 75,75" fill="#2563eb" />
            <polygon points="60,90 90,90 75,75" fill="#facc15" />
            <polygon points="60,60 60,90 75,75" fill="#dc2626" />
            <circle cx="75" cy="75" r="4" fill="white" />


            <g stroke="black" strokeWidth="0.5" opacity="0.8">
              {[60, 70, 80, 90].map(x => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="150" />)}
              {[10, 20, 30, 40, 50, 100, 110, 120, 130, 140].map(x => (
                <React.Fragment key={`vx${x}`}><line x1={x} y1="60" x2={x} y2="90" /></React.Fragment>
              ))}
              {[60, 70, 80, 90].map(y => <line key={`h${y}`} x1="0" y1={y} x2="150" y2={y} />)}
              {[10, 20, 30, 40, 50, 100, 110, 120, 130, 140].map(y => (
                <React.Fragment key={`hy${y}`}><line x1="60" y1={y} x2="90" y2={y} /></React.Fragment>
              ))}
            </g>
            
           
          </svg>

          {/* Tokens Rendering */}
          {game.tokens && Object.entries(game.tokens).map(([playerId, tokenPositions]) => {
            const color = getPlayerColor(playerId);
            const isMine = playerId === me;
            
            return tokenPositions.map((pos, tokenIdx) => {
              return (
                <LudoToken
                  key={`${playerId}-${tokenIdx}`}
                  color={color}
                  targetPathIndex={pos} 
                  pathArray={ludoPath[color]}
                  homePos={homePositions[color][tokenIdx]}
                  isMine={isMine}
                  disabled={!isMine || !myTurn || (!game.diceValue1 && !game.diceValue2)}
                  onClick={() => onMove(tokenIdx)}
                />
              );
            });
          })}
        </div>

        {/* 3D DICE CENTER PIECE */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="bg-black/40 backdrop-blur-sm p-4 rounded-3xl shadow-2xl flex flex-col items-center gap-3 pointer-events-auto">
            <div className="flex gap-4">
              <Dice3D value={dice1} rolling={diceRolling} />
              <Dice3D value={dice2} rolling={diceRolling} />
            </div>
            <button
              onClick={handleRoll}
              disabled={!myTurn || game.diceValue1}
              className={`
                mt-1 px-8 py-2 rounded-full font-bold
                bg-gradient-to-r from-yellow-400 to-yellow-600 text-black 
                border-2 border-white
                ${!myTurn || game.diceValue1 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 shadow-[0_0_15px_rgba(250,204,21,0.8)] cursor-pointer animate-pulse'}
              `}
            >
              ROLL
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

// --- NIGERIAN WHOT VIEW ---
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
              {['circle', 'triangle', 'cross', 'star', 'square'].map(suit => (
                <button
                  key={suit} onClick={() => handleSuitSelect(suit)}
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
          {game.myHand.map(card => (
            <WhotCardDesign key={card.id} card={card} playable={isPlayable(card)} disabled={!myTurn} onPlay={() => handlePlayCard(card)} />
          ))}
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={onDraw} disabled={!myTurn}
          className={`px-8 py-3 rounded-full font-bold text-lg bg-gradient-to-r from-yellow-500 to-yellow-600 text-black transform transition-all ${myTurn ? 'hover:scale-110 hover:shadow-2xl' : 'opacity-50 cursor-not-allowed'}`}
        >
          🎴 Draw Card
        </button>
      </div>
    </div>
  );
};

// --- MAIN GAME LAYER ---
export default function GameLayer() {
  const { 
    pendingInvite, respondInvite, activeGame, 
    dashboard, isDashboardVisible, forfeitGame, closeGame,
    sendAction 
  } = useGameStore();
  const me = useAuthStore((s) => s.authUser);

  const handlePlayCard = (cardId, requestedSuit) => sendAction({ type: 'play', cardId, requestedSuit });
  const handleDrawCard = () => sendAction({ type: 'draw' });
  const handleMoveToken = (tokenIndex) => sendAction({ type: 'move', tokenIndex });
  const handleRollDice = (diceValues) => sendAction({ type: 'roll', dice1: diceValues[0], dice2: diceValues[1] });

  return (
    <>
      {/* Invite Modal */}
      {pendingInvite && (
        <div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center">
          <div className="bg-gradient-to-b from-green-900 to-green-800 border-4 border-yellow-500 p-8 rounded-2xl text-white w-96">
            <div className="text-center mb-4"><span className="text-6xl">🎮</span></div>
            <h3 className="text-2xl font-bold text-center mb-2">Game Invite!</h3>
            <p className="text-center text-lg mb-6">
              {pendingInvite.fromUser?.fullname} invited you to play{' '}
              <span className="font-bold text-yellow-300">{pendingInvite.gameType.toUpperCase()}</span>
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => respondInvite(false)} className="px-6 py-2 bg-red-600 rounded-full font-bold hover:bg-red-700">Decline</button>
              <button onClick={() => respondInvite(true)} className="px-6 py-2 bg-green-600 rounded-full font-bold hover:bg-green-700">Accept 🎉</button>
            </div>
          </div>
        </div>
      )}

      {/* Active Game */}
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
                <button onClick={closeGame} className="px-4 py-2 bg-gray-700 rounded-full font-bold hover:bg-gray-600 transition">Close</button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {activeGame.gameType === 'whot' ? (
              <NigerianWhotView game={activeGame} onPlayCard={handlePlayCard} onDraw={handleDrawCard} />
            ) : (
              <NigerianLudoBoard game={activeGame} onMove={handleMoveToken} onRoll={handleRollDice} />
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

      {/* Dashboard */}
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
          </div>
        </div>
      )}
    </>
  );
}