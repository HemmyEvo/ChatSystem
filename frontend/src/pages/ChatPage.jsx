import ProfileHeader from '../components/ProfileHeader.jsx';
import ActiveTabSwitch from '../components/ActiveTabSwitch.jsx';
import { useChatStore } from '../store/useChatStore.js';
import ChatsList from '../components/ChatsList.jsx';
import ContactList from '../components/ContactList.jsx';
import ChatContainer from '../components/ChatContainer.jsx';
import NoConversationPlacehoder from '../components/NoConversationPlacehoder.jsx';
import GameLayer from '../components/GameLayer.jsx';
import StatusPanel from '../components/StatusPanel.jsx';
function ChatPage() {
  const { activeTab, selectedUser } = useChatStore();
 
  return (
    <main className="chat-page" style={{ height: "var(--app-height, 100dvh)" }}>
      <GameLayer />
      <div className={`chat-workspace ${selectedUser ? 'chat-workspace--conversation' : ''}`}>
        <aside className={`chat-sidebar ${selectedUser ? 'chat-sidebar--hidden' : ''}`}>
          <ProfileHeader />
          <ActiveTabSwitch />
          <div className="chat-sidebar-content">
            {activeTab === 'chats' ? <ChatsList /> : activeTab === 'updates' ? <StatusPanel /> : <ContactList />}
          </div>
        </aside>
        <section className={`chat-main ${selectedUser ? '' : 'chat-main--empty'}`}>
          {selectedUser ? <ChatContainer /> : <NoConversationPlacehoder />}
        </section>
      </div>
    </main>
  )
}

export default ChatPage
