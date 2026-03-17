import { create } from "zustand";
import { api } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

const updateChatWithLastMessage = (chats, message) => {
  const me = useAuthStore.getState().authUser?._id;
  const partnerId = message.senderId === me ? message.receiverId : message.senderId;
  return chats
    .map((chat) => (chat._id === partnerId ? { ...chat, lastMessage: message } : chat))
    .sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
};

export const useChatStore = create((set, get) => ({
  allContacts: [], chats: [], messages: [], activeTab: "chats", selectedUser: null,
  isUsersLoading: false, isMessagesLoading: false, isTyping: false,
  isSoundEnabled: JSON.parse(localStorage.getItem("isSoundEnabled")) === true,

  toggleSound: () => {
    localStorage.setItem("isSoundEnabled", !get().isSoundEnabled);
    set({ isSoundEnabled: !get().isSoundEnabled });
  },
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedUser: (user) => set({ selectedUser: user }),

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
    try { const res = await api.get('/message/chats'); set({ chats: res.data.chatPartners }); }
    finally { set({ isUsersLoading: false }); }
  },

  getMessagesByUserId: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await api.get(`/message/${userId}`);
      set({ messages: res.data.messages });
      await api.patch(`/message/read/${userId}`);
      useAuthStore.getState().socket?.emit('chat:opened', { chatUserId: userId });
    } finally { set({ isMessagesLoading: false }); }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    if (!selectedUser) return;
    const me = useAuthStore.getState().authUser;
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = { _id: tempId, senderId: me._id, receiverId: selectedUser._id, ...messageData, createdAt: new Date().toISOString(), readBy: [me._id], isOptimistic: true };
    set({ messages: [...messages, optimisticMessage], chats: updateChatWithLastMessage(get().chats, optimisticMessage) });
    try {
      const res = await api.post(`/message/send/${selectedUser._id}`, messageData);
      set({ messages: get().messages.filter((m) => m._id !== tempId).concat(res.data.data), chats: updateChatWithLastMessage(get().chats, res.data.data) });
      return res.data.data;
    } catch (error) { set({ messages }); throw error; }
  },

  subscribeToTypingEvents: () => {
    const socket = useAuthStore.getState().socket; if (!socket) return;
    socket.on('typing', ({ senderId }) => { if (get().selectedUser?._id === senderId) { set({ isTyping: true }); setTimeout(() => set({ isTyping: false }), 3000); } });
  },
  unsubscribeFromTypingEvents: () => useAuthStore.getState().socket?.off('typing'),

  subscribeToNewMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on('newMessage', (message) => {
      const selectedUser = get().selectedUser;
      if (selectedUser && (message.senderId === selectedUser._id || message.receiverId === selectedUser._id)) {
        set({ messages: [...get().messages, message] });
      }
      set({ chats: updateChatWithLastMessage(get().chats, message) });
    });

    socket.on('chat:last-message', (message) => set({ chats: updateChatWithLastMessage(get().chats, message) }));

    socket.on('messages:read', ({ messageIds, readerId }) => {
      set({
        messages: get().messages.map((msg) => messageIds.includes(msg._id) ? { ...msg, readBy: [...new Set([...(msg.readBy || []), readerId])] } : msg),
        chats: get().chats.map((chat) => !chat.lastMessage || !messageIds.includes(chat.lastMessage._id) ? chat : ({ ...chat, lastMessage: { ...chat.lastMessage, readBy: [...new Set([...(chat.lastMessage.readBy || []), readerId])] } })),
      });
    });

    socket.on('chat:messages-cleared', ({ byUserId }) => {
      if (get().selectedUser?._id === byUserId) set({ messages: [] });
      set({ chats: get().chats.map((chat) => (chat._id === byUserId ? { ...chat, lastMessage: null } : chat)) });
    });

    socket.on('chat:blocked', ({ byUserId }) => {
      if (get().selectedUser?._id === byUserId) toast.error('You were blocked by this user');
    });
  },

  unsubscribeFromNewMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket?.off('newMessage'); socket?.off('chat:last-message'); socket?.off('messages:read'); socket?.off('chat:messages-cleared'); socket?.off('chat:blocked');
  },

  blockUser: async (userId) => { await api.post(`/message/block/${userId}`); toast.success('User blocked'); },
  deleteChatHistory: async (userId) => { await api.delete(`/message/delete-chat/${userId}`); set({ messages: [], chats: get().chats.map((chat) => (chat._id === userId ? { ...chat, lastMessage: null } : chat)) }); toast.success('Chat history deleted'); },

  deleteMessage: async (messageId) => {
    const { messages } = get();
    try { set({ messages: messages.filter((msg) => msg._id !== messageId) }); await api.delete(`/message/delete/${messageId}`); toast.success('Message deleted'); }
    catch { toast.error('Failed to delete message'); get().getMessagesByUserId(get().selectedUser._id); }
  },
}));
