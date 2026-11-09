import React from 'react';
import { Dice5, Goal, Trophy, Grid2X2, CircleDot } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { useGameStore } from '../store/useGameStore';

function GameQuickActions() {
  const { selectedUser } = useChatStore();
  const { startInvite } = useGameStore();
  if (!selectedUser) return null;
  const disabled = selectedUser.isBlockedByMe || selectedUser.isBlockedByThem;

  return (
    <div className='px-4 md:px-6 py-3 border-b border-slate-800 bg-slate-950/70 flex flex-wrap gap-3'>
      <button type='button' disabled={disabled} onClick={() => startInvite('whot', selectedUser._id)} className='px-3 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm flex items-center gap-2 hover:bg-slate-700 disabled:opacity-40'><Trophy size={16} /> Whot</button>
      <button type='button' disabled={disabled} onClick={() => startInvite('ludo', selectedUser._id)} className='px-3 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm flex items-center gap-2 hover:bg-slate-700 disabled:opacity-40'><Dice5 size={16} /> Ludo</button>
      <button type='button' disabled={disabled} onClick={() => startInvite('football', selectedUser._id)} className='px-3 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm flex items-center gap-2 hover:bg-slate-700 disabled:opacity-40'><Goal size={16} /> Football</button>
      <button type='button' disabled={disabled} onClick={() => startInvite('tictactoe', selectedUser._id)} className='px-3 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm flex items-center gap-2 hover:bg-slate-700 disabled:opacity-40'><Grid2X2 size={16} /> Tic-Tac-Toe</button>
      <button type='button' disabled={disabled} onClick={() => startInvite('connect4', selectedUser._id)} className='px-3 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm flex items-center gap-2 hover:bg-slate-700 disabled:opacity-40'><CircleDot size={16} /> Connect Four</button>
    </div>
  );
}

export default GameQuickActions;
