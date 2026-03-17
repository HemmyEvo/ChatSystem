import React, { useEffect, useMemo, useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import GoBackButton from './GoBackButton';
import { Ban, Copy, Forward, Reply, Trash2, MoreVertical, X } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

const formatLastSeen = (lastSeen) => {
  if (!lastSeen) return 'recently';
  return new Date(lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

function ChatHeader() {
  const { selectedUser, setSelectedUser, blockUser, deleteChatHistory, selectedMessages, messages, clearSelectedMessages, setReplyTarget, deleteMessageForMe, deleteMessageForEveryone, forwardSelectedMessages } = useChatStore();
  const { onlineUsers, userLastSeenMap } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const online = onlineUsers.includes(selectedUser?._id);

  const selectedItems = useMemo(() => messages.filter((m) => selectedMessages.includes(m._id)), [messages, selectedMessages]);
  const myId = useAuthStore.getState().authUser?._id;
  const canDeleteForEveryone = selectedItems.length === 1 && selectedItems[0]?.senderId === myId;

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        if (selectedMessages.length) clearSelectedMessages();
        else setSelectedUser(null);
      }
    };
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [setSelectedUser, selectedMessages.length, clearSelectedMessages]);

  const lastSeen = userLastSeenMap[selectedUser?._id] || selectedUser?.lastSeen;

  const copySelected = async () => {
    const text = selectedItems.map((m) => m.text).filter(Boolean).join('\n');
    if (text) await navigator.clipboard.writeText(text);
    clearSelectedMessages();
  };

  const handleDelete = async () => {
    await Promise.all(selectedItems.map((m) => deleteMessageForMe(m._id)));
    clearSelectedMessages();
  };

  const handleDeleteEveryone = async () => {
    if (!selectedItems[0]) return;
    await deleteMessageForEveryone(selectedItems[0]._id);
    clearSelectedMessages();
  };

  return (
    <div className='w-full flex items-center justify-between px-4 py-3 md:px-6 bg-[#202c33] border-b border-[#2f3b43]'>
      {selectedMessages.length ? (
        <>
          <div className='flex items-center gap-4 text-white'>
            <button onClick={clearSelectedMessages}><X size={20} /></button>
            <span>{selectedMessages.length}</span>
          </div>
          <div className='flex items-center gap-5 text-slate-200'>
            <button onClick={copySelected}><Copy size={18} /></button>
            <button onClick={() => { if (selectedItems[0]) setReplyTarget(selectedItems[0]); clearSelectedMessages(); }}><Reply size={18} /></button>
            <button onClick={forwardSelectedMessages}><Forward size={18} /></button>
            <div className='dropdown dropdown-end'>
              <button tabIndex={0}><Trash2 size={18} /></button>
              <ul tabIndex={0} className='dropdown-content menu p-2 shadow bg-[#233138] rounded-box w-44 z-50'>
                <li><button onClick={handleDelete}>Delete for me</button></li>
                {canDeleteForEveryone && <li><button onClick={handleDeleteEveryone}>Delete for everyone</button></li>}
              </ul>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className='flex items-center gap-3'>
            <GoBackButton onClick={() => setSelectedUser(null)} />
            <div className={`avatar ${online ? 'online' : 'offline'}`}>
              <div className='size-10 rounded-full'>
                <img src={selectedUser?.profilePicture || '/avatar.png'} alt={selectedUser?.fullname} />
              </div>
            </div>
            <div className='flex flex-col items-start'>
              <h4 className='text-slate-200 font-medium'>{selectedUser?.fullname}</h4>
              <p className='text-xs text-slate-400'>{online ? 'online' : `last seen today at ${formatLastSeen(lastSeen)}`}</p>
            </div>
          </div>

          <div className='relative'>
            <button onClick={() => setShowMenu((s) => !s)} className='text-slate-300'><MoreVertical size={18} /></button>
            {showMenu && (
              <div className='absolute right-0 top-7 bg-[#233138] text-slate-100 rounded-md p-1 w-44 z-50 shadow-lg'>
                <button className='w-full text-left px-3 py-2 hover:bg-[#2d3d45] rounded flex items-center gap-2' onClick={() => { blockUser(selectedUser._id); setShowMenu(false); }}><Ban size={14} />Block user</button>
                <button className='w-full text-left px-3 py-2 hover:bg-[#2d3d45] rounded flex items-center gap-2' onClick={() => { deleteChatHistory(selectedUser._id); setShowMenu(false); }}><Trash2 size={14} />Delete for me</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ChatHeader;
