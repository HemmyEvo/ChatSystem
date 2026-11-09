import { useState } from 'react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const EMPTY_TEAM = [];

function FootballMatch({ game, me, sendAction }) {
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [actionMode, setActionMode] = useState('move');
  const myId = me?._id;
  const myTeam = game.teams?.[myId] || EMPTY_TEAM;
  const opponentId = game.players.find((playerId) => playerId !== myId);
  const opponentTeam = game.teams?.[opponentId] || [];
  const isMyTurn = game.turn?.currentPlayer === myId;
  const selectedPlayer = myTeam.find((player) => player.id === selectedPlayerId)
    || myTeam.find((player) => player.id === game.ball?.controlledBy)
    || myTeam[0]
    || null;
  const hasBall = selectedPlayer?.id === game.ball?.controlledBy;

  const sendMove = (event) => {
    if (!isMyTurn || !selectedPlayer) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const targetX = clamp(((event.clientX - rect.left) / rect.width) * 105, 0, 105);
    const targetY = clamp(((event.clientY - rect.top) / rect.height) * 68, 0, 68);
    sendAction({ type: 'move', footballerId: selectedPlayer.id, targetX, targetY });
  };

  const handlePlayerClick = (event, player, isOpponent) => {
    event.stopPropagation();
    if (!isMyTurn) return;
    if (!isOpponent) {
      if (actionMode === 'pass' && selectedPlayer && hasBall) {
        sendAction({ type: 'pass', footballerId: selectedPlayer.id, targetPlayerId: player.id });
      } else {
        setSelectedPlayerId(player.id);
        setActionMode('move');
      }
      return;
    }
    if (actionMode === 'tackle' && selectedPlayer) {
      sendAction({ type: 'tackle', footballerId: selectedPlayer.id, targetId: player.id });
    }
  };

  const goalDirection = game.players[0] === myId ? 'right' : 'left';

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-3 text-white sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-emerald-500/15 px-3 py-1 font-bold text-emerald-200">YOU {game.match?.score?.[myId] || 0}</span>
          <span className="text-xs text-slate-400">vs</span>
          <span className="rounded-lg bg-rose-500/15 px-3 py-1 font-bold text-rose-200">{game.match?.score?.[opponentId] || 0} FRIEND</span>
        </div>
        <div className="text-sm font-semibold text-amber-200">
          {game.match?.state === 'full_time' ? 'Full time' : `Minute ${game.match?.minute || 0}`}
          <span className="ml-3 text-slate-300">{isMyTurn ? `Your turn · ${game.turn?.actionPoints ?? 0} actions` : 'Opponent’s turn'}</span>
        </div>
      </div>

      <div className="relative aspect-[105/68] w-full overflow-hidden rounded-2xl border-4 border-white/80 bg-[linear-gradient(90deg,#15803d_0%,#166534_50%,#15803d_50%,#166534_100%)] shadow-2xl">
        <div className="pointer-events-none absolute inset-[3%] border-2 border-white/70" />
        <div className="pointer-events-none absolute inset-y-[3%] left-1/2 border-l-2 border-white/70" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[28%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/70" />
        <div className={`pointer-events-none absolute top-[27%] h-[46%] w-[15%] border-2 border-white/70 ${goalDirection === 'right' ? 'right-[3%] border-r-0' : 'left-[3%] border-l-0'}`} />
        <button
          type="button"
          onClick={actionMode === 'move' ? sendMove : undefined}
          aria-label="Football pitch"
          className={`absolute inset-0 ${actionMode === 'move' && isMyTurn ? 'cursor-crosshair' : 'cursor-default'}`}
        />
        {[...myTeam.map((player) => ({ player, isOpponent: false })), ...opponentTeam.map((player) => ({ player, isOpponent: true }))].map(({ player, isOpponent }) => {
          const ownsBall = game.ball?.controlledBy === player.id;
          const canSelect = !isOpponent || actionMode === 'tackle';
          return (
            <button
              key={player.id}
              type="button"
              onClick={(event) => handlePlayerClick(event, player, isOpponent)}
              disabled={!isMyTurn || !canSelect}
              title={`${player.role} · pace ${player.pace}`}
              className={`absolute z-10 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 text-[9px] font-black shadow-lg transition sm:h-9 sm:w-9 sm:text-xs ${
                isOpponent ? 'border-rose-100 bg-rose-500' : 'border-emerald-100 bg-emerald-500'
              } ${player.id === selectedPlayerId ? 'ring-4 ring-amber-300' : ''} ${player.cards === 2 ? 'opacity-40 grayscale' : ''}`}
              style={{ left: `${(player.x / 105) * 100}%`, top: `${(player.y / 68) * 100}%` }}
            >
              {ownsBall && <span className="absolute -right-2 -top-2 h-3 w-3 rounded-full border border-slate-900 bg-white" />}
              {player.role === 'GK' ? 'GK' : player.role.slice(0, 1)}
            </button>
          );
        })}
        <span
          className="pointer-events-none absolute z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black bg-white shadow-lg"
          style={{ left: `${((game.ball?.x || 0) / 105) * 100}%`, top: `${((game.ball?.y || 0) / 68) * 100}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {[
          ['move', 'Move'],
          ['pass', 'Pass'],
          ['tackle', 'Tackle'],
        ].map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setActionMode(mode)}
            disabled={!isMyTurn || (mode === 'pass' && !hasBall)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-40 ${actionMode === mode ? 'bg-amber-300 text-slate-950' : 'bg-white/10 hover:bg-white/15'}`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => hasBall && selectedPlayer && sendAction({
            type: 'shoot',
            footballerId: selectedPlayer.id,
            targetY: 34,
          })}
          disabled={!isMyTurn || !hasBall}
          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:opacity-40"
        >
          Shoot
        </button>
        <button
          type="button"
          onClick={() => sendAction({ type: 'end_turn' })}
          disabled={!isMyTurn}
          className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-600 disabled:opacity-40"
        >
          End turn
        </button>
      </div>
      <p className="text-center text-xs text-slate-400">
        {actionMode === 'move' ? 'Select a teammate, then choose a spot on the pitch.' : actionMode === 'pass' ? 'Choose a teammate to receive the ball.' : 'Select an opponent with the ball to attempt a tackle.'}
      </p>
      <ol className="max-h-24 overflow-y-auto rounded-xl bg-black/20 px-4 py-2 text-xs text-slate-300">
        {(game.turn?.logs || []).slice(-5).reverse().map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}
      </ol>
    </div>
  );
}

export default FootballMatch;
