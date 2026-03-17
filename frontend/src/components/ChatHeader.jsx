import React, { useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import GoBackButton from './GoBackButton';
import { Ban, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

function ChatHeader() {
  const { selectedUser, setSelectedUser, blockUser, deleteChatHistory } = useChatStore();
  const { onlineUsers, userLastSeenMap } = useAuthStore();
  const online = onlineUsers.includes(selectedUser?._id);

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        setSelectedUser(null);
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [setSelectedUser]);

  const handleBlock = async () => {
    if (!selectedUser) return;
    await blockUser(selectedUser._id);
  };

  const handleDeleteAll = async () => {
    if (!selectedUser) return;
    await deleteChatHistory(selectedUser._id);
  };

  const lastSeen = userLastSeenMap[selectedUser?._id] || selectedUser?.lastSeen;

  return (
    <div className='w-full flex items-center justify-between px-4 py-8 md:px-10 bg-slate-800'>
      <div className='flex items-center gap-3'>
        <GoBackButton onClick={() => setSelectedUser(null)} />
        <div className={`avatar ${online ? 'online' : 'offline'}`}>
          <div className='size-10 rounded-full'>
            <img src={selectedUser?.profilePicture || '/avatar.png'} alt={selectedUser?.fullname} />
          </div>
        </div>
        <div className='flex flex-col items-start'>
          <h4 className='text-slate-200 font-medium'>{selectedUser?.fullname}</h4>
          <p className='text-xs'>{online ? 'Online' : `Last seen ${lastSeen ? new Date(lastSeen).toLocaleString() : 'recently'}`}</p>
        </div>
      </div>

      <div className='flex items-center cursor-pointer gap-4 text-slate-300'>
        <button onClick={handleDeleteAll} title='Delete all chat messages'>
          <Trash2 size={18} />
        </button>
        <button onClick={handleBlock} title='Block user'>
          <Ban size={18} />
        </button>
      </div>
    </div>
  );
}

export default ChatHeader;
