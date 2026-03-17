import BorderAnimated from '../components/BorderAnimated.jsx';
import ProfileHeader from '../components/ProfileHeader.jsx';
import ActiveTabSwitch from '../components/ActiveTabSwitch.jsx';
import { useChatStore } from '../store/useChatStore.js';
import ChatsList from '../components/ChatsList.jsx';
import ContactList from '../components/ContactList.jsx';
import ChatContainer from '../components/ChatContainer.jsx';
import NoConversationPlacehoder from '../components/NoConversationPlacehoder.jsx';
import GameLayer from '../components/GameLayer.jsx';
function ChatPage() {
  // const { logout } = useAuthStore();
  const {activeTab,selectedUser} = useChatStore();
 
  return (
    <div className="relative w-full max-w-6xl h-[800px]">
      <GameLayer />
      <BorderAnimated>
      {/* Left side - contacts list */}
      <div className={` ${selectedUser ? 'hidden md:flex' : 'block'} w-full md:w-80  bg-slate-800/50 backdrop-blur-sm flex flex-col`}>
        <ProfileHeader />
        <ActiveTabSwitch />
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {activeTab === 'chats' ? <ChatsList /> : <ContactList />}
        </div>
      </div>

      {/* Right side - chat area */}
      <div className={`md:flex-1 flex flex-col bg-slate-900/50 backdrop-blur-sm ${selectedUser ? 'flex-1' : ''}`}>
        {selectedUser ? <ChatContainer /> : <NoConversationPlacehoder />}
      </div>
      </BorderAnimated>
    </div>
  )
}

export default ChatPage