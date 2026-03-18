import React from 'react';
import { useChatStore } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';

function NoChatHistory() {
  const { authUser } = useAuthStore();
  const { selectedUser, sendMessage } = useChatStore();

  const suggestions = [
    '👋 Say hello!',
    'How is your day going?',
    'Want to play a game later?',
    'What are you up to today?'
  ];

  return (
    <div className='flex flex-1 flex-col justify-center items-center p-6 gap-6'>
      <div className='relative w-64 h-40 flex justify-center items-center mb-4'>
        <div className='absolute top-2 right-2 w-52 bg-base-200 border border-base-300 shadow-md rounded-2xl p-3 flex items-center gap-3 transform rotate-6 transition-all hover:rotate-12 cursor-default'>
          <div className="avatar"><div className="size-10 rounded-full bg-base-300"><img src={selectedUser?.profilePicture || "/avatar.png"} alt={selectedUser?.username || 'User'} /></div></div>
          <div className='flex flex-col overflow-hidden'><span className='text-sm font-semibold truncate'>@{selectedUser?.username || 'unknown'}</span><span className='text-xs text-base-content/60'>Ready to chat</span></div>
        </div>
        <div className='absolute bottom-2 left-2 z-10 w-52 bg-primary text-primary-content shadow-xl rounded-2xl p-3 flex items-center gap-3 transform -rotate-3 transition-all hover:-rotate-6 cursor-default'>
          <div className="avatar"><div className="size-10 rounded-full bg-base-100/20"><img src={authUser?.profilePicture || "/avatar.png"} alt={authUser?.username || 'You'} /></div></div>
          <div className='flex flex-col overflow-hidden'><span className='text-sm font-semibold truncate'>@{authUser?.username || 'you'}</span><span className='text-xs text-primary-content/80'>Start the conversation</span></div>
        </div>
      </div>

      <div className='text-center max-w-sm'>
        <h3 className='text-xl font-bold mb-2'>No messages yet</h3>
        <p className='text-base-content/60 text-sm mb-6'>Start the conversation with @{selectedUser?.username || 'them'}.</p>
        <div className='flex flex-wrap justify-center gap-2'>
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              className='btn btn-sm btn-outline rounded-full transition-colors hover:bg-primary hover:text-primary-content hover:border-primary'
              onClick={() => sendMessage({ text: suggestion })}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default NoChatHistory;
