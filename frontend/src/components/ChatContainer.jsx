import React, { useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import ChatHeader from './ChatHeader';
import ChatBody from './ChatBody';
import ChatFooter from './ChatFooter';
import GameQuickActions from './GameQuickActions';
import ForwardMessageModal from './ForwardMessageModal';
import StatusPanel from './StatusPanel';

function ChatContainer() {
  const { getMessagesByUserId, selectedUser, setSelectedUser, subscribeToNewMessages, unsubscribeFromNewMessages } = useChatStore();
  useEffect(() => {
    if (selectedUser) getMessagesByUserId(selectedUser._id);
    subscribeToNewMessages();
    return () => unsubscribeFromNewMessages();
  }, [selectedUser, getMessagesByUserId, subscribeToNewMessages, unsubscribeFromNewMessages]);

  return (
    <>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatHeader />
          <GameQuickActions />
          <ChatBody />
          <ChatFooter />
        </div>
        <aside className="hidden w-[320px] border-l border-[#2f3b43] bg-[#0f171d] xl:block">
          <div className="h-full overflow-y-auto p-4">
            <StatusPanel compact onOpenChatWithUser={(user) => setSelectedUser(user)} />
          </div>
        </aside>
      </div>
      <ForwardMessageModal />
    </>
  );
}

export default ChatContainer;
