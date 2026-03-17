import React, { useEffect } from 'react'
import { useChatStore } from '../store/useChatStore';
import ChatHeader from './ChatHeader';
import ChatBody from './ChatBody';
import ChatFooter from './ChatFooter';

function ChatContainer() {
  const {getMessagesByUserId,selectedUser} = useChatStore();
  useEffect(() => {
    if(selectedUser){
      getMessagesByUserId(selectedUser._id);
    }
  }, [selectedUser, getMessagesByUserId]);
  return (
    <>
    <ChatHeader />
    <ChatBody />
    <ChatFooter />
    </>
  )
}

export default ChatContainer