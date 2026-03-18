import React, { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

function ForwardMessageModal() {
  const { showForwardModal, closeForwardModal, friends, getFriends, forwardSelectedMessages } = useChatStore();
  const [search, setSearch] = useState('');

  useEffect(() => { if (showForwardModal) getFriends(); }, [showForwardModal, getFriends]);
  const filteredFriends = useMemo(() => friends.filter((friend) => friend.username.toLowerCase().includes(search.toLowerCase())), [friends, search]);
  if (!showForwardModal) return null;

  return (
    <div className='fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4'>
      <div className='w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden'>
        <div className='p-4 border-b border-slate-700 flex items-center justify-between text-white'><h3 className='font-semibold'>Forward message</h3><button onClick={closeForwardModal}><X size={18} /></button></div>
        <div className='p-4 border-b border-slate-700'><div className='relative'><Search size={16} className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-500' /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Search friends...' className='w-full bg-slate-800 text-slate-200 pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500' /></div></div>
        <div className='p-4 max-h-[55vh] overflow-y-auto space-y-2'>{filteredFriends.map((friend) => <button key={friend._id} onClick={() => forwardSelectedMessages(friend._id)} className='w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-xl flex items-center gap-3 text-left'><img src={friend.profilePicture || '/avatar.png'} alt={friend.username} className='w-10 h-10 rounded-full object-cover' /><div className='text-white font-medium'>@{friend.username}</div></button>)}{filteredFriends.length === 0 && <div className='text-center text-slate-400 py-8'>No friends found to forward to.</div>}</div>
      </div>
    </div>
  );
}

export default ForwardMessageModal;
