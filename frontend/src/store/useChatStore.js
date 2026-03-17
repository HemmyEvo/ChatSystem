import { create } from "zustand";
import { api } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

const sortChats = (chats) =>
  [...chats].sort((a, b) => {
    const aPinned = Number(a.pinOrder ?? Infinity);
    const bPinned = Number(b.pinOrder ?? Infinity);
    if (aPinned !== bPinned) return aPinned - bPinned;
    return new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0);
  });

const updateChatWithLastMessage = (chats, message) => {
  const me = useAuthStore.getState().authUser?._id;
  const partnerId = message.senderId === me ? message.receiverId : message.senderId;
  const selectedUserId = useChatStore.getState().selectedUser?._id;

  const chatExists = chats.some(c => c._id === partnerId);
  if (!chatExists) {
    useChatStore.getState().getChats();
    return chats;
  }

  return sortChats(
    chats.map((chat) => {
      if (chat._id !== partnerId) return chat;
      
      const currentUnread = Number(chat.unreadCount || 0);
      const isCurrentlyOpen = selectedUserId === partnerId;
      
      const shouldIncreaseUnread = message.senderId === partnerId && !(message.readBy || []).includes(me) && !isCurrentlyOpen;
      
      return { ...chat, lastMessage: message, unreadCount: shouldIncreaseUnread ? currentUnread + 1 : currentUnread };
    }),
  );
};

export const useChatStore = create((set, get) => ({
  allContacts: [], chats: [], messages: [], activeTab: "chats", selectedUser: null,
  isUsersLoading: false, isMessagesLoading: false, searchTerm: "",
  selectedMessages: [], replyTarget: null,
  
  isTyping: false, 
  typingUsers: {}, 

  archivedChatIds: JSON.parse(localStorage.getItem("archivedChatIds") || "[]"),
  pinnedChatIds: JSON.parse(localStorage.getItem("pinnedChatIds") || "[]"),
  soundSettings: JSON.parse(localStorage.getItem("soundSettings") || '{"receive":true,"send":true}'),

  chatBackground: localStorage.getItem("chatBackground") || null,
  chatBgOpacity: Number(localStorage.getItem("chatBgOpacity")) || 0.4,
  chatBubbleColors: JSON.parse(localStorage.getItem("chatBubbleColors") || '{"own": "#005c4b", "other": "#202c33"}'),

  setChatBackground: (imageUrl) => {
    try {
      if (imageUrl) {
        localStorage.setItem("chatBackground", imageUrl);
      } else {
        localStorage.removeItem("chatBackground");
      }
      set({ chatBackground: imageUrl });
    } catch (error) {
      console.error("Error saving chat background:", error);
      toast.error("Failed to save background. File might be too large.");
    }
  },

  setChatBgOpacity: (opacity) => {
    localStorage.setItem("chatBgOpacity", opacity);
    set({ chatBgOpacity: opacity });
  },

  setChatBubbleColors: (colors) => {
    localStorage.setItem("chatBubbleColors", JSON.stringify(colors));
    set({ chatBubbleColors: colors });
  },
  
  setSoundSetting: (type) => {
    const currentSettings = get().soundSettings;
    const newSettings = { ...currentSettings, [type]: !currentSettings[type] };
    localStorage.setItem("soundSettings", JSON.stringify(newSettings));
    set({ soundSettings: newSettings });
  },

  setSearchTerm: (value) => set({ searchTerm: value }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setReplyTarget: (msg) => set({ replyTarget: msg }),
  clearSelectedMessages: () => set({ selectedMessages: [] }),
  toggleSelectedMessage: (msgId) => set({ selectedMessages: get().selectedMessages.includes(msgId) ? get().selectedMessages.filter((id) => id !== msgId) : [...get().selectedMessages, msgId] }),
  
  toggleArchiveChat: (chatId) => {
    const current = get().archivedChatIds;
    const updated = current.includes(chatId) ? current.filter(id => id !== chatId) : [...current, chatId];
    localStorage.setItem("archivedChatIds", JSON.stringify(updated));
    set({ archivedChatIds: updated });
  },

  togglePinChat: (chatId) => {
    const current = get().pinnedChatIds;
    const updated = current.includes(chatId) ? current.filter(id => id !== chatId) : [...current, chatId];
    localStorage.setItem("pinnedChatIds", JSON.stringify(updated));
    set({ pinnedChatIds: updated });
  },
  
  setSelectedUser: (user) => {
    if (!user?._id) return set({ selectedUser: user, selectedMessages: [], replyTarget: null });
    set({ selectedUser: user, selectedMessages: [], replyTarget: null, chats: get().chats.map((chat) => (chat._id === user._id ? { ...chat, unreadCount: 0 } : chat)) });
  },

  emitTypingEvent: () => {
    const socket = useAuthStore.getState().socket;
    const selectedUser = get().selectedUser;
    const authUser = useAuthStore.getState().authUser;
    if (socket && selectedUser && authUser) socket.emit('isTyping', { senderId: authUser._id, receiverId: selectedUser._id });
  },

  getAllContacts: async () => {
    set({ isUsersLoading: true });
    try { const res = await api.get("/message/contact"); set({ allContacts: res.data.filteredUsers }); }
    finally { set({ isUsersLoading: false }); }
  },

  getChats: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await api.get('/message/chats');
      const chats = res.data.chatPartners.map((chat) => ({ ...chat, unreadCount: Number(chat.unreadCount || 0) }));
      set({ chats: sortChats(chats) });
    } finally { set({ isUsersLoading: false }); }
  },

  getMessagesByUserId: async (userId) => {
    set({ isMessagesLoading: true, selectedMessages: [] });
    try {
      const res = await api.get(`/message/${userId}`);
      set({ messages: res.data.messages, chats: get().chats.map((chat) => (chat._id === userId ? { ...chat, unreadCount: 0 } : chat)) });
      await api.patch(`/message/read/${userId}`);
      useAuthStore.getState().socket?.emit('chat:opened', { chatUserId: userId });
    } finally { set({ isMessagesLoading: false }); }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages, replyTarget } = get();
    if (!selectedUser) return;
    const me = useAuthStore.getState().authUser;
    const payload = { ...messageData, ...(replyTarget ? { replyTo: replyTarget._id } : {}) };
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = { _id: tempId, senderId: me._id, receiverId: selectedUser._id, ...payload, createdAt: new Date().toISOString(), readBy: [me._id], deliveredTo: [], isOptimistic: true };
    set({ messages: [...messages, optimisticMessage], chats: updateChatWithLastMessage(get().chats, optimisticMessage), replyTarget: null });
    try {
      const res = await api.post(`/message/send/${selectedUser._id}`, payload);
      set({ messages: get().messages.filter((m) => m._id !== tempId).concat(res.data.data), chats: updateChatWithLastMessage(get().chats, res.data.data) });
      return res.data.data;
    } catch (error) { set({ messages }); throw error; }
  },

  reactToMessage: async (messageId, emoji) => {
    const res = await api.post(`/message/react/${messageId}`, { emoji });
    set({ messages: get().messages.map((m) => m._id === messageId ? { ...m, reactions: res.data.reactions } : m) });
  },

  deleteMessageForMe: async (messageId) => {
    await api.delete(`/message/delete-for-me/${messageId}`);
    set({ messages: get().messages.filter((m) => m._id !== messageId), selectedMessages: get().selectedMessages.filter((id) => id !== messageId) });
  },

  deleteMessageForEveryone: async (messageId) => {
    await api.delete(`/message/delete-for-everyone/${messageId}`);
    set({ messages: get().messages.filter((m) => m._id !== messageId), selectedMessages: get().selectedMessages.filter((id) => id !== messageId) });
  },

  forwardSelectedMessages: async () => {
    const selected = get().messages.filter((m) => get().selectedMessages.includes(m._id));
    for (const msg of selected) {
      await get().sendMessage({ text: msg.text, image: msg.image, video: msg.video, audio: msg.audio });
    }
    set({ selectedMessages: [] });
  },

  subscribeToTypingEvents: () => {
    const socket = useAuthStore.getState().socket; if (!socket) return;
    socket.off('typing'); 
    
    socket.on('typing', ({ senderId }) => { 
      set((state) => ({ typingUsers: { ...state.typingUsers, [senderId]: true } }));
      if (get().selectedUser?._id === senderId) set({ isTyping: true }); 
      
      setTimeout(() => { 
        set((state) => ({ typingUsers: { ...state.typingUsers, [senderId]: false } }));
        if (get().selectedUser?._id === senderId) set({ isTyping: false }); 
      }, 3000); 
    });
  },
  
  unsubscribeFromTypingEvents: () => useAuthStore.getState().socket?.off('typing'),

  subscribeToNewMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off('newMessage'); 
    socket.off('message:reaction-updated');
    socket.off('messages:read');
    socket.off('messages:delivered'); // NEW

    socket.on('newMessage', async (message) => {
      const selectedUser = get().selectedUser;
      const myId = useAuthStore.getState().authUser?._id;
      
      const isChatOpen = selectedUser && message.senderId === selectedUser._id;

      if (isChatOpen) {
        const readMessage = { ...message, readBy: [...new Set([...(message.readBy || []), myId])] };
        set({ messages: [...get().messages, readMessage] });

        try {
          await api.patch(`/message/read/${selectedUser._id}`);
        } catch (error) {
          console.error("Failed to mark as read", error);
        }
      } else if (selectedUser && message.receiverId === selectedUser._id) {
        set({ messages: [...get().messages, message] });
      }
      
      set({ chats: updateChatWithLastMessage(get().chats, message) });
      
      if (message.receiverId === myId && get().soundSettings.receive && !isChatOpen) {
        new Audio('/sounds/notification.mp3').play().catch(() => {});
      }
    });

    socket.on('message:reaction-updated', ({ messageId, reactions }) => {
      set({ messages: get().messages.map((m) => m._id === messageId ? { ...m, reactions } : m) });
    });

    socket.on('messages:read', ({ messageIds, readerId, chatUserId }) => {
      set({
        messages: get().messages.map((msg) => messageIds.includes(msg._id) ? { ...msg, readBy: [...new Set([...(msg.readBy || []), readerId])] } : msg),
        chats: get().chats.map((chat) => chat._id === chatUserId ? { ...chat, unreadCount: 0 } : chat),
      });
    });

    // NEW: Handle real-time delivery status updates
    socket.on('messages:delivered', ({ receiverId, messageIds }) => {
      set({
        messages: get().messages.map((msg) => 
          messageIds.includes(msg._id) 
            ? { ...msg, deliveredTo: [...new Set([...(msg.deliveredTo || []), receiverId])] } 
            : msg
        )
      });
    });
  },

  unsubscribeFromNewMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket?.off('newMessage'); 
    socket?.off('message:reaction-updated'); 
    socket?.off('messages:read');
    socket?.off('messages:delivered');
  },

  blockUser: async (userId) => { await api.post(`/message/block/${userId}`); toast.success('User blocked'); },
  deleteChatHistory: async (userId) => { await api.delete(`/message/delete-chat/${userId}`); set({ messages: [], chats: get().chats.map((chat) => (chat._id === userId ? { ...chat, lastMessage: null } : chat)) }); toast.success('Chat deleted for me'); },
}));