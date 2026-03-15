import React from 'react'
import { useAuthStore } from '../store/useAuthStore.js';

function ChatPage() {
  const { logout } = useAuthStore();
  const handleLogout = () => {
    logout();
  }
  return (
    <div>

    <button onClick={handleLogout} className='bg-blue-500 text-white px-4 py-2 rounded'>
      Log out
    </button>

    </div>
  )
}

export default ChatPage