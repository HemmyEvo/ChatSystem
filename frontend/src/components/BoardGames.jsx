import { useState } from 'react';

const gameLabels = {
  tictactoe: 'Tic-Tac-Toe',
  connect4: 'Connect Four',
};

function BoardGames({ game, me, sendAction }) {
  const isConnectFour = game.gameType === 'connect4';
  const isMyTurn = game.currentPlayer === me?._id;
  const [lastMove, setLastMove] = useState(null);
  const opponentId = game.players.find((playerId) => playerId !== me?._id);
  const markFor = (playerId) => (playerId === me?._id ? 'X' : 'O');

  const place = (action) => {
    if (!isMyTurn) return;
    setLastMove(action);
    sendAction(action);
  };

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 p-5 text-white sm:p-8">
      <header className="text-center">
        <h3 className="text-2xl font-bold">{gameLabels[game.gameType]}</h3>
        <p className="mt-2 text-sm text-slate-300">
          {game.winnerId
            ? game.winnerId === me?._id ? 'You won!' : 'Your friend won.'
            : game.isDraw ? 'It is a draw.' : isMyTurn ? 'Your turn' : 'Waiting for your friend'}
        </p>
        <div className="mt-2 flex items-center justify-center gap-4 text-xs text-slate-400">
          <span><b className="text-cyan-300">X</b> You</span>
          <span><b className="text-rose-300">O</b> {opponentId === me?._id ? 'You' : 'Opponent'}</span>
        </div>
      </header>

      {isConnectFour ? (
        <div className="grid w-full max-w-lg grid-cols-7 gap-1 rounded-2xl border border-blue-300/20 bg-blue-800 p-2 shadow-2xl sm:gap-2 sm:p-4">
          {game.board.flatMap((row, rowIndex) => row.map((playerId, columnIndex) => (
            <button
              key={`${rowIndex}-${columnIndex}`}
              type="button"
              onClick={() => place({ type: 'drop', column: columnIndex })}
              disabled={!isMyTurn || Boolean(playerId) || game.winnerId || game.isDraw}
              aria-label={`Drop into column ${columnIndex + 1}`}
              className="aspect-square rounded-full bg-slate-950/85 transition hover:bg-slate-900 disabled:cursor-not-allowed"
            >
              {playerId && (
                <span className={`mx-auto block h-[78%] w-[78%] rounded-full shadow-inner ${playerId === me?._id ? 'bg-amber-300' : 'bg-rose-400'}`} />
              )}
            </button>
          )))}
        </div>
      ) : (
        <div className="grid w-full max-w-sm grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
          {game.board.map((playerId, index) => (
            <button
              key={index}
              type="button"
              onClick={() => place({ type: 'place', index })}
              disabled={!isMyTurn || Boolean(playerId) || game.winnerId || game.isDraw}
              className="grid aspect-square place-items-center rounded-xl bg-slate-950/70 text-5xl font-black transition hover:bg-slate-800 disabled:cursor-not-allowed"
            >
              {playerId && <span className={playerId === me?._id ? 'text-cyan-300' : 'text-rose-300'}>{markFor(playerId)}</span>}
            </button>
          ))}
        </div>
      )}

      {lastMove && isMyTurn && !game.winnerId && !game.isDraw && (
        <p className="text-xs text-slate-500">Move sent. Waiting for the game server…</p>
      )}
    </section>
  );
}

export default BoardGames;
