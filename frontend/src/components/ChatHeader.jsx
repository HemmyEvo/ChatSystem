import React, { useEffect } from 'react'
import { useChatStore } from '../store/useChatStore';
import GoBackButton from './GoBackButton';
import { MoreVerticalIcon } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

function ChatHeader() {
    const {selectedUser, setSelectedUser} = useChatStore();
      const { onlineUsers } = useAuthStore();
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
    }, [selectedUser]);
  return (
    <div className='w-full flex items-center justify-between px-4 py-8 md:px-10 bg-slate-800'>
        {/* Left side (Go back button, avatar, name, online status) */}
        <div className="flex items-center gap-3">
            <GoBackButton onClick={() => setSelectedUser(null)} />
            <div className={`avatar ${online ? "online" : "offline"}`}>
              <div className="size-10 rounded-full">  
                <img src={selectedUser?.profilePicture || "/avatar.png"} alt={selectedUser?.fullname} />
              </div>
            </div>
            <div className="flex flex-col items-start">
             <h4 className="text-slate-200 font-medium">{selectedUser?.fullname}</h4>
              <p className='text-xs'>{online ? 'Online' : 'Last seen recently'}</p>
            </div>
        </div>

        {/* Right side (Action buttons) */}
        <div className="flex items-center cursor-pointer gap-4">
            <MoreVerticalIcon size={20} />
        </div>
    </div>
  )
}

export default ChatHeader