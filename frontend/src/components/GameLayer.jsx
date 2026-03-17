import React from 'react';
import { useGameStore } from '../store/useGameStore';
import { useAuthStore } from '../store/useAuthStore';

const cardStyle = (card, playable) => `rounded-xl p-3 min-w-[74px] text-center border ${playable ? 'border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,.4)]' : 'border-slate-600'} bg-slate-800`;

function WhotView({ game }) {
  const { sendAction } = useGameStore();
  const myTurn = game.currentPlayer === useAuthStore.getState().authUser?._id;
  const isPlayable = (card) => card.suit === 'whot' || card.suit === game.topCard?.suit || card.number === game.topCard?.number;

  return (
    <div className='flex-1 flex flex-col p-6 gap-5'>
      <div className='text-center text-slate-200'>Top card: <b>{game.topCard?.suit} {game.topCard?.number}</b> • Opponent cards: {game.opponentCount}</div>
      <div className='text-center text-cyan-300'>{myTurn ? 'Your turn' : 'Opponent turn'} {game.pendingDraw ? `• Pending draw ${game.pendingDraw}` : ''}</div>
      <div className='flex flex-wrap gap-3 justify-center'>
        {game.myHand.map((card) => (
          <button key={card.id} disabled={!myTurn || !isPlayable(card)} onClick={() => sendAction({ type: 'play', cardId: card.id })} className={cardStyle(card, isPlayable(card))}>
            <div className='text-xs uppercase text-slate-400'>{card.suit}</div>
            <div className='text-xl font-bold text-white'>{card.label}</div>
          </button>
        ))}
      </div>
      <div className='text-center'>
        <button disabled={!myTurn} onClick={() => sendAction({ type: 'draw' })} className='px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold'>Draw Card</button>
      </div>
    </div>
  );
}

function LudoView({ game }) {
  const { sendAction } = useGameStore();
  const me = useAuthStore.getState().authUser?._id;
  const myTurn = game.currentPlayer === me;
  const myTokens = game.tokens?.[me] || [];

  return (
    <div className='flex-1 p-6 flex flex-col gap-5 items-center'>
      <h3 className='text-xl text-white font-bold'>Ludo Duel</h3>
      <p className='text-slate-300'>{myTurn ? 'Your turn' : 'Opponent turn'} {game.diceValue ? `• Dice: ${game.diceValue}` : ''}</p>
      <div className='grid grid-cols-2 gap-3'>
        {myTokens.map((pos, idx) => (
          <button key={idx} disabled={!myTurn || !game.diceValue} onClick={() => sendAction({ type: 'move', tokenIndex: idx })} className='bg-slate-800 border border-slate-600 rounded-xl p-4 text-white min-w-28'>
            Token {idx + 1}<br />
            <span className='text-cyan-300 text-sm'>Position: {pos}</span>
          </button>
        ))}
      </div>
      <button disabled={!myTurn || game.diceValue} onClick={() => sendAction({ type: 'roll' })} className='px-6 py-2 bg-emerald-500 rounded-lg font-semibold text-black'>Roll Dice</button>
    </div>
  );
}

export default function GameLayer() {
  const { pendingInvite, respondInvite, activeGame, dashboard, forfeitGame, closeGame } = useGameStore();
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

      {dashboard && (
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
