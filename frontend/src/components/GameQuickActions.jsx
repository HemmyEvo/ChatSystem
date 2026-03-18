import React from 'react';
import { Dice5, Trophy } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { useGameStore } from '../store/useGameStore';

function GameQuickActions() {
  const { selectedUser } = useChatStore();
  const { startInvite } = useGameStore();
  if (!selectedUser) return null;

  return (
    <div className='px-4 md:px-6 py-3 border-b border-slate-800 bg-slate-950/70 flex flex-wrap gap-3'>
      <button type='button' onClick={() => startInvite('whot', selectedUser._id)} className='px-3 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm flex items-center gap-2 hover:bg-slate-700'><Trophy size={16} /> Play Whot</button>
      <button type='button' onClick={() => startInvite('ludo', selectedUser._id)} className='px-3 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm flex items-center gap-2 hover:bg-slate-700'><Dice5 size={16} /> Play Ludo</button>
    </div>
  );
}

export default GameQuickActions;
