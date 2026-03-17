import React from 'react';
import { useChatStore } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';

function NoChatHistory() {
  const { user } = useAuthStore();
  const { selectedUser } = useChatStore();

  // Icebreaker suggestions
  const suggestions = [
    "👋 Say Hello!",
    "How's your day going?",
    "Let's catch up!",
    "Got any news?"
  ];

  return (
    <div className='flex flex-1 flex-col justify-center items-center p-6 gap-6'>
      
      {/* Overlapping Cards Container */}
      <div className='relative w-64 h-40 flex justify-center items-center mb-4'>
        
        {/* Back Card (Selected User) */}
        <div className='absolute top-2 right-2 w-52 bg-base-200 border border-base-300 shadow-md rounded-2xl p-3 flex items-center gap-3 transform rotate-6 transition-all hover:rotate-12 cursor-default'>
          <div className="avatar">
            <div className="size-10 rounded-full bg-base-300">
              <img src={selectedUser?.profilePicture || "/avatar.png"} alt={selectedUser?.fullname || 'User'} />
            </div>
          </div>
          <div className='flex flex-col overflow-hidden'>
            <span className='text-sm font-semibold truncate'>{selectedUser?.fullname || 'Unknown'}</span>
            <span className='text-xs text-base-content/60'>Ready to chat</span>
          </div>
        </div>

        {/* Front Card (Current User) */}
        <div className='absolute bottom-2 left-2 z-10 w-52 bg-primary text-primary-content shadow-xl rounded-2xl p-3 flex items-center gap-3 transform -rotate-3 transition-all hover:-rotate-6 cursor-default'>
          <div className="avatar">
            <div className="size-10 rounded-full bg-base-100/20">
              <img src={user?.profilePicture || "/avatar.png"} alt={user?.fullname || 'You'} />
            </div>
          </div>
          <div className='flex flex-col overflow-hidden'>
            <span className='text-sm font-semibold truncate'>{user?.fullname || 'You'}</span>
            <span className='text-xs text-primary-content/80'>Start the conversation</span>
          </div>
        </div>

      </div>

      {/* Text & Suggestions */}
      <div className='text-center max-w-sm'>
        <h3 className='text-xl font-bold mb-2'>No messages yet</h3>
        <p className='text-base-content/60 text-sm mb-6'>
          Don't be shy! Start the conversation with {selectedUser?.fullname ? selectedUser.fullname.split(' ')[0] : 'them'}.
        </p>
        
        {/* Suggestion Chips */}
        <div className='flex flex-wrap justify-center gap-2'>
          {suggestions.map((suggestion, index) => (
            <button 
              key={index}
              className='btn btn-sm btn-outline rounded-full transition-colors hover:bg-primary hover:text-primary-content hover:border-primary'
              onClick={() => {
                // TODO: Wire this up to your sendMessage function
                console.log("Suggested message clicked:", suggestion);
              }}
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