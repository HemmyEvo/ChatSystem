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
  return sortChats(
    chats.map((chat) => {
      if (chat._id !== partnerId) return chat;
      const currentUnread = Number(chat.unreadCount || 0);
      const shouldIncreaseUnread = message.senderId === partnerId && !(message.readBy || []).includes(me);
      return { ...chat, lastMessage: message, unreadCount: shouldIncreaseUnread ? currentUnread + 1 : currentUnread };
    }),
  );
};

export const useChatStore = create((set, get) => ({
  allContacts: [], chats: [], messages: [], activeTab: "chats", selectedUser: null,
  isUsersLoading: false, isMessagesLoading: false, isTyping: false, searchTerm: "",
  selectedMessages: [], replyTarget: null,
  archivedChatIds: JSON.parse(localStorage.getItem("archivedChatIds") || "[]"),
  pinnedChatIds: JSON.parse(localStorage.getItem("pinnedChatIds") || "[]"),
  soundSettings: JSON.parse(localStorage.getItem("soundSettings") || '{"receive":true,"send":true}'),

  setSearchTerm: (value) => set({ searchTerm: value }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setReplyTarget: (msg) => set({ replyTarget: msg }),
  clearSelectedMessages: () => set({ selectedMessages: [] }),
  toggleSelectedMessage: (msgId) => set({ selectedMessages: get().selectedMessages.includes(msgId) ? get().selectedMessages.filter((id) => id !== msgId) : [...get().selectedMessages, msgId] }),

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
    const optimisticMessage = { _id: tempId, senderId: me._id, receiverId: selectedUser._id, ...payload, createdAt: new Date().toISOString(), readBy: [me._id], isOptimistic: true };
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
    socket.on('typing', ({ senderId }) => { if (get().selectedUser?._id === senderId) { set({ isTyping: true }); setTimeout(() => set({ isTyping: false }), 3000); } });
  },
  unsubscribeFromTypingEvents: () => useAuthStore.getState().socket?.off('typing'),

  subscribeToNewMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on('newMessage', (message) => {
      const selectedUser = get().selectedUser;
      const myId = useAuthStore.getState().authUser?._id;
      if (selectedUser && (message.senderId === selectedUser._id || message.receiverId === selectedUser._id)) {
        set({ messages: [...get().messages, message] });
      }
      set({ chats: updateChatWithLastMessage(get().chats, message) });
      if (message.receiverId === myId && get().soundSettings.receive) new Audio('/sounds/mouse-click.mp3').play().catch(() => {});
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
  },

  unsubscribeFromNewMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket?.off('newMessage'); socket?.off('message:reaction-updated'); socket?.off('messages:read');
  },

  blockUser: async (userId) => { await api.post(`/message/block/${userId}`); toast.success('User blocked'); },
  deleteChatHistory: async (userId) => { await api.delete(`/message/delete-chat/${userId}`); set({ messages: [], chats: get().chats.map((chat) => (chat._id === userId ? { ...chat, lastMessage: null } : chat)) }); toast.success('Chat deleted for me'); },
}));
