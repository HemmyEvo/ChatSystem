import React, { useMemo, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useAuthStore } from '../store/useAuthStore';

const suitToImage = {
  circle: 'https://img.icons8.com/color/96/circled.png',
  triangle: 'https://img.icons8.com/color/96/triangle.png',
  cross: 'https://img.icons8.com/color/96/multiply.png',
  star: 'https://img.icons8.com/color/96/star--v1.png',
  square: 'https://img.icons8.com/color/96/square.png',
  whot: 'https://img.icons8.com/color/96/joker.png',
};

const WHOT_REQUEST_OPTIONS = ['circle', 'triangle', 'cross', 'star', 'square'];

const cardBorder = (playable) => (playable ? 'border-emerald-400 shadow-[0_0_22px_rgba(16,185,129,0.45)]' : 'border-slate-600');

function WhotCard({ card, playable, onPlay, disabled }) {
  return (
    <button
      disabled={disabled || !playable}
      onClick={onPlay}
      className={`w-[96px] h-[138px] rounded-2xl border-2 bg-gradient-to-b from-white to-slate-100 text-slate-900 p-2 transition hover:-translate-y-1 disabled:opacity-50 ${cardBorder(playable)}`}
    >
      <div className='flex justify-between items-start'>
        <span className='font-black text-lg'>{card.number}</span>
        <img src={suitToImage[card.suit]} alt={card.suit} className='w-6 h-6 object-contain' />
      </div>
      <div className='h-[70px] flex items-center justify-center'>
        <img src={suitToImage[card.suit]} alt={card.suit} className='w-14 h-14 object-contain drop-shadow' />
      </div>
      <div className='text-xs font-semibold uppercase tracking-wide'>{card.suit}</div>
    </button>
  );
}

function WhotView({ game }) {
  const { sendAction } = useGameStore();
  const meId = useAuthStore.getState().authUser?._id;
  const myTurn = game.currentPlayer === meId;
  const [whotChoiceForCardId, setWhotChoiceForCardId] = useState(null);

  const isPlayable = (card) => {
    if (card.suit === 'whot') return true;
    if (game.requestedSuit) return card.suit === game.requestedSuit;
    return card.suit === game.topCard?.suit || card.number === game.topCard?.number;
  };

  const playCard = (card) => {
    if (card.number === 20) {
      setWhotChoiceForCardId(card.id);
      return;
    }
    sendAction({ type: 'play', cardId: card.id });
  };

  const submitWhotRequest = (requestedSuit) => {
    if (!whotChoiceForCardId) return;
    sendAction({ type: 'play', cardId: whotChoiceForCardId, requestedSuit });
    setWhotChoiceForCardId(null);
  };

  return (
    <div className='flex-1 flex flex-col p-6 gap-4 text-white'>
      <div className='rounded-xl bg-slate-800/70 border border-slate-700 p-4 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm text-slate-300'>Opponent cards: <b>{game.opponentCount}</b></p>
          <p className='text-sm text-slate-300'>Deck: <b>{game.deckCount}</b></p>
        </div>
        <div className='flex items-center gap-3'>
          <span className='text-sm text-slate-300'>Top card</span>
          <WhotCard card={game.topCard} playable={false} disabled onPlay={() => {}} />
        </div>
        <div className='text-sm text-cyan-300'>
          {myTurn ? 'Your turn' : 'Opponent turn'}
          {game.pendingDraw ? ` • Draw penalty: ${game.pendingDraw}` : ''}
          {game.requestedSuit ? ` • Requested suit: ${game.requestedSuit}` : ''}
        </div>
      </div>

      {whotChoiceForCardId && (
        <div className='rounded-xl border border-amber-400 bg-amber-500/15 p-4'>
          <p className='mb-3 font-semibold text-amber-200'>You played WHOT. Request a suit:</p>
          <div className='flex gap-2 flex-wrap'>
            {WHOT_REQUEST_OPTIONS.map((suit) => (
              <button key={suit} onClick={() => submitWhotRequest(suit)} className='px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 hover:border-amber-300 capitalize'>
                {suit}
              </button>
            ))}
            <button onClick={() => setWhotChoiceForCardId(null)} className='px-3 py-2 rounded-lg bg-rose-900/60 border border-rose-700'>Cancel</button>
          </div>
        </div>
      )}

      <div className='flex flex-wrap gap-3 justify-center'>
        {game.myHand.map((card) => (
          <WhotCard key={card.id} card={card} playable={isPlayable(card)} disabled={!myTurn} onPlay={() => playCard(card)} />
        ))}
      </div>

      <div className='text-center'>
        <button disabled={!myTurn} onClick={() => sendAction({ type: 'draw' })} className='px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold'>Draw Card</button>
      </div>
    </div>
  );
}

const boardPath = [
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [5, 4], [4, 4], [3, 4], [2, 4], [1, 4], [0, 4], [0, 5], [0, 6],
  [1, 6], [2, 6], [3, 6], [4, 6], [4, 7], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8], [0, 9], [0, 10], [1, 10],
  [2, 10], [3, 10], [4, 10], [4, 11], [4, 12], [4, 13], [4, 14], [5, 14], [6, 14], [6, 13], [6, 12], [6, 11],
  [6, 10], [7, 10], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], [9, 14], [10, 14], [10, 13], [10, 12], [10, 11],
  [10, 10], [11, 10],
];

const homePathMe = [[11, 9], [12, 9], [13, 9], [14, 9], [14, 8], [14, 7]];
const homePathOpponent = [[3, 5], [2, 5], [1, 5], [0, 5], [0, 6], [0, 7]];

function getTokenCoord(pos, mine) {
  if (pos < 0) return mine ? [12, 12] : [2, 2];
  if (pos <= 51) return boardPath[pos] || [7, 7];
  const homeStep = pos - 52;
  return (mine ? homePathMe : homePathOpponent)[homeStep] || [7, 7];
}

function LudoView({ game }) {
  const { sendAction } = useGameStore();
  const me = useAuthStore.getState().authUser?._id;
  const myTurn = game.currentPlayer === me;
  const myTokens = game.tokens?.[me] || [];
  const opponentId = game.players.find((id) => id !== me);
  const opponentTokens = game.tokens?.[opponentId] || [];

  const allTokens = useMemo(() => ([
    ...myTokens.map((pos, idx) => ({ key: `me-${idx}`, pos, mine: true, idx })),
    ...opponentTokens.map((pos, idx) => ({ key: `opp-${idx}`, pos, mine: false, idx })),
  ]), [myTokens, opponentTokens]);

  return (
    <div className='flex-1 p-6 text-white flex flex-col gap-4 items-center'>
      <p className='text-cyan-300'>{myTurn ? 'Your turn' : 'Opponent turn'} {game.diceValue ? `• Dice: ${game.diceValue}` : ''}</p>

      <div className='relative w-[540px] h-[540px] bg-[#f8f6e8] rounded-2xl border-8 border-[#2f2f2f] shadow-2xl overflow-hidden'>
        <div className='absolute top-0 left-0 w-1/2 h-1/2 bg-red-300/70' />
        <div className='absolute top-0 right-0 w-1/2 h-1/2 bg-green-300/70' />
        <div className='absolute bottom-0 left-0 w-1/2 h-1/2 bg-blue-300/70' />
        <div className='absolute bottom-0 right-0 w-1/2 h-1/2 bg-yellow-300/70' />

        <div className='absolute inset-0 grid [grid-template-columns:repeat(15,minmax(0,1fr))] [grid-template-rows:repeat(15,minmax(0,1fr))]'>
          {Array.from({ length: 225 }).map((_, idx) => <div key={idx} className='border border-black/10' />)}
        </div>

        {allTokens.map((token) => {
          const [x, y] = getTokenCoord(token.pos, token.mine);
          return (
            <button
              key={token.key}
              disabled={!token.mine || !myTurn || !game.diceValue}
              onClick={() => token.mine && sendAction({ type: 'move', tokenIndex: token.idx })}
              className={`absolute w-7 h-7 rounded-full border-2 border-white shadow-lg transition ${token.mine ? 'bg-cyan-700 hover:scale-110' : 'bg-rose-700'}`}
              style={{ left: `${x * (100 / 15)}%`, top: `${y * (100 / 15)}%`, transform: 'translate(22%, 22%)' }}
            />
          );
        })}
      </div>

      <div className='flex gap-3'>
        <button disabled={!myTurn || game.diceValue} onClick={() => sendAction({ type: 'roll' })} className='px-6 py-2 bg-emerald-500 rounded-lg font-semibold text-black'>Roll Dice</button>
        <div className='px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg'>Your tokens: {myTokens.join(', ')}</div>
      </div>
    </div>
  );
}

export default function GameLayer() {
  const { pendingInvite, respondInvite, activeGame, dashboard, isDashboardVisible, forfeitGame, closeGame } = useGameStore();
  const me = useAuthStore((s) => s.authUser);

  return (
    <>
      {pendingInvite && (
        <div className='fixed inset-0 z-[120] bg-black/70 flex items-center justify-center'>
          <div className='bg-slate-900 border border-slate-700 p-6 rounded-2xl text-white w-[360px]'>
            <h3 className='text-xl font-bold'>Game Invite</h3>
            <p className='text-slate-300 mt-2'>{pendingInvite.fromUser?.fullname} invited you to play {pendingInvite.gameType.toUpperCase()}.</p>
            <div className='mt-5 flex gap-3 justify-end'>
              <button onClick={() => respondInvite(false)} className='px-4 py-2 bg-slate-700 rounded-lg'>Decline</button>
              <button onClick={() => respondInvite(true)} className='px-4 py-2 bg-emerald-500 text-black rounded-lg'>Accept</button>
            </div>
          </div>
        </div>
      )}

      {activeGame && (
        <div className='fixed inset-0 z-[110] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col'>
          <div className='p-4 border-b border-slate-700 flex justify-between items-center text-white'>
            <div>
              <h2 className='text-2xl font-bold'>{activeGame.gameType.toUpperCase()} Arena</h2>
              <p className='text-slate-400 text-sm'>Real-time multiplayer for this chat only</p>
            </div>
            <div className='flex gap-2'>
              <button onClick={forfeitGame} className='px-3 py-2 bg-rose-600 rounded-lg'>Forfeit</button>
              <button onClick={closeGame} className='px-3 py-2 bg-slate-700 rounded-lg'>Close</button>
            </div>
          </div>

          {activeGame.gameType === 'whot' ? <WhotView game={activeGame} /> : <LudoView game={activeGame} />}

          {activeGame.winnerId && (
            <div className='p-4 border-t border-slate-700 text-center text-white'>
              Winner: {activeGame.winnerId === me?._id ? 'You 🎉' : 'Opponent'}
            </div>
          )}
        </div>
      )}

      {dashboard && isDashboardVisible && (
        <div className='fixed right-4 bottom-4 z-[105] bg-slate-900/95 border border-slate-700 rounded-xl p-4 text-white w-72'>
          <h4 className='font-bold mb-2'>Game Dashboard</h4>
          <p className='text-sm text-slate-300'>Total: {dashboard.totalWon}/{dashboard.totalPlayed} wins</p>
          <p className='text-sm text-slate-300'>Whot: {dashboard.whot?.won}/{dashboard.whot?.played}</p>
          <p className='text-sm text-slate-300'>Ludo: {dashboard.ludo?.won}/{dashboard.ludo?.played}</p>
        </div>
      )}
    </>
  );
}
