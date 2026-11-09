import { ArrowUpRight, MessageCircle } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

const suggestions = [
  '👋 Say hello!',
  'How is your day going?',
  'What are you up to today?',
];

function NoChatHistory() {
  const { selectedUser, sendMessage } = useChatStore();

  return (
    <div className="empty-chat">
      <div className="empty-chat__art">
        <span className="empty-chat__avatar">{selectedUser?.username?.slice(0, 1).toUpperCase() || <MessageCircle size={23} />}</span>
        <span className="empty-chat__spark">✳</span>
        <span className="empty-chat__arrow"><ArrowUpRight size={17} /></span>
      </div>
      <h2>Make the first move</h2>
      <p>Say hello to @{selectedUser?.username || 'your friend'} and get the conversation started.</p>
      <div className="empty-chat__suggestions">
        {suggestions.map((suggestion) => (
          <button key={suggestion} type="button" onClick={() => sendMessage({ text: suggestion })}>
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

export default NoChatHistory;
