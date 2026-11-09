import { ArrowRight, MessageCircle } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

function NoChatsFound() {
  const { setActiveTab } = useChatStore();

  return (
    <div className="empty-state">
      <span className="empty-state__icon"><MessageCircle size={23} /></span>
      <h2>No conversations yet</h2>
      <p>Find someone you know and start a conversation.</p>
      <button type="button" className="empty-state__action" onClick={() => setActiveTab('contacts')}>
        Find people <ArrowRight size={15} />
      </button>
    </div>
  );
}

export default NoChatsFound;
