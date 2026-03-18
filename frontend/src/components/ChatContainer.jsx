import React, { useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import ChatHeader from './ChatHeader';
import ChatBody from './ChatBody';
import ChatFooter from './ChatFooter';
import GameQuickActions from './GameQuickActions';
import ForwardMessageModal from './ForwardMessageModal';

function ChatContainer() {
  const { getMessagesByUserId, selectedUser, subscribeToNewMessages, unsubscribeFromNewMessages } = useChatStore();
  useEffect(() => {
    if (selectedUser) getMessagesByUserId(selectedUser._id);
    subscribeToNewMessages();
    return () => unsubscribeFromNewMessages();
  }, [selectedUser, getMessagesByUserId, subscribeToNewMessages, unsubscribeFromNewMessages]);

  return <><ChatHeader /><GameQuickActions /><ChatBody /><ChatFooter /><ForwardMessageModal /></>;
}

export default ChatContainer;
