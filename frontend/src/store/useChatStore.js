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

  const chatExists = chats.some((c) => c._id === partnerId);
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


const syncChatAfterDeletion = (chats, chatUserId, lastMessage) =>
  sortChats(
    chats.map((chat) => (chat._id === chatUserId ? { ...chat, lastMessage: lastMessage || null, unreadCount: lastMessage ? chat.unreadCount : 0 } : chat)),
  );

const updatePersonRelationship = (people, userId, updates) =>
  people.map((person) => (person._id === userId ? { ...person, ...updates } : person));

let typingTimeout = null;

const clearBrowserSession = async () => {
  try {
    await api.get('/auth/logout');
  } catch (error) {
    console.error('Error clearing auth cookie:', error);
  }

  try {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(';').forEach((cookie) => {
      const [name] = cookie.split('=');
      if (!name) return;
      const trimmedName = name.trim();
      const expiration = 'expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = `${trimmedName}=; ${expiration}; path=/`;
      document.cookie = `${trimmedName}=; ${expiration}; path=/; domain=localhost`;
      document.cookie = `${trimmedName}=; ${expiration}; path=/; domain=.localhost`;
    });
  } catch (error) {
    console.error('Error clearing browser session:', error);
  }
};

export const useChatStore = create((set, get) => ({
  people: [],
  friends: [],
  chats: [],
  messages: [],
  activeTab: "chats",
  statuses: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isStatusesLoading: false,
  searchTerm: "",
  peopleSearchTerm: "",
  shareContactSearchTerm: "",
  selectedMessages: [],
  replyTarget: null,
  isTyping: false,
  typingUsers: {},
  showForwardModal: false,

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
  setChatBgOpacity: (opacity) => { localStorage.setItem("chatBgOpacity", opacity); set({ chatBgOpacity: opacity }); },
  setChatBubbleColors: (colors) => { localStorage.setItem("chatBubbleColors", JSON.stringify(colors)); set({ chatBubbleColors: colors }); },
  setSoundSetting: (type) => {
    const currentSettings = get().soundSettings;
    const newSettings = { ...currentSettings, [type]: !currentSettings[type] };
    localStorage.setItem("soundSettings", JSON.stringify(newSettings));
    set({ soundSettings: newSettings });
  },
  setSearchTerm: (value) => set({ searchTerm: value }),
  setPeopleSearchTerm: (value) => set({ peopleSearchTerm: value }),
  setShareContactSearchTerm: (value) => set({ shareContactSearchTerm: value }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setReplyTarget: (msg) => set({ replyTarget: msg }),
  clearSelectedMessages: () => set({ selectedMessages: [], showForwardModal: false }),
  toggleSelectedMessage: (msgId) => set({ selectedMessages: get().selectedMessages.includes(msgId) ? get().selectedMessages.filter((id) => id !== msgId) : [...get().selectedMessages, msgId] }),
  openForwardModal: () => set({ showForwardModal: true }),
  closeForwardModal: () => set({ showForwardModal: false }),

  toggleArchiveChat: (chatId) => {
    const current = get().archivedChatIds;
    const updated = current.includes(chatId) ? current.filter((id) => id !== chatId) : [...current, chatId];
    localStorage.setItem("archivedChatIds", JSON.stringify(updated));
    set({ archivedChatIds: updated });
  },
  togglePinChat: (chatId) => {
    const current = get().pinnedChatIds;
    const updated = current.includes(chatId) ? current.filter((id) => id !== chatId) : [...current, chatId];
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
    if (!(socket && selectedUser && authUser)) return;
    socket.emit('isTyping', { senderId: authUser._id, receiverId: selectedUser._id });
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit('isTypingStop', { senderId: authUser._id, receiverId: selectedUser._id });
    }, 1000);
  },
  emitStopTypingEvent: () => {
    const socket = useAuthStore.getState().socket;
    const selectedUser = get().selectedUser;
    const authUser = useAuthStore.getState().authUser;
    if (typingTimeout) clearTimeout(typingTimeout);
    if (socket && selectedUser && authUser) socket.emit('isTypingStop', { senderId: authUser._id, receiverId: selectedUser._id });
  },

  getPeople: async (search = get().peopleSearchTerm) => {
    set({ isUsersLoading: true });
    try {
      const res = await api.get('/message/people', { params: { search } });
      set({ people: res.data.people });
    } finally { set({ isUsersLoading: false }); }
  },
  getFriends: async () => {
    const res = await api.get('/message/friends');
    set({ friends: res.data.friends });
    return res.data.friends;
  },
  getStatuses: async () => {
    set({ isStatusesLoading: true });
    try {
      const res = await api.get('/message/statuses');
      set({ statuses: res.data.statuses || [] });
      return res.data.statuses || [];
    } finally {
      set({ isStatusesLoading: false });
    }
  },
  postStatus: async (payload) => {
    const res = await api.post('/message/status', payload);
    const nextStatusUser = res.data.statusUser;
    set((state) => ({
      statuses: [nextStatusUser, ...state.statuses.filter((entry) => entry._id !== nextStatusUser._id)],
      activeTab: 'updates',
    }));
    toast.success('Status posted');
    return nextStatusUser;
  },
  markStatusViewed: async (statusId) => {
    const res = await api.post(`/message/status/${statusId}/view`);
    const updatedUser = res.data.statusUser;
    set((state) => ({
      statuses: state.statuses.map((entry) => (entry._id === updatedUser._id ? updatedUser : entry)),
    }));
    return updatedUser;
  },
  sendFriendRequest: async (userId) => {
    try {
      await api.post(`/message/friend-request/${userId}`);
      set({ people: updatePersonRelationship(get().people, userId, { requestSent: true, requestReceived: false, isFriend: false }) });
      toast.success('Friend request sent');
    } catch (error) {
      if (error.response?.status === 404 && error.response?.data?.message === 'User not found') {
        await clearBrowserSession();
      }
      throw error;
    }
  },
  respondToFriendRequest: async (userId, accept) => {
    try {
      await api.post(`/message/friend-request/${userId}/respond`, { accept });
      const nextPeople = updatePersonRelationship(get().people, userId, {
        requestReceived: false,
        requestSent: false,
        isFriend: Boolean(accept),
      });
      const acceptedUser = nextPeople.find((person) => person._id === userId) || get().people.find((person) => person._id === userId) || null;
      set({ people: nextPeople, activeTab: accept ? 'chats' : get().activeTab, ...(accept ? { selectedUser: acceptedUser } : {}) });
      toast.success(accept ? 'Friend request accepted' : 'Friend request declined');
      await Promise.all([get().getFriends(), get().getChats(), accept ? get().getMessagesByUserId(userId) : Promise.resolve()]);
    } catch (error) {
      if (error.response?.status === 404 && error.response?.data?.message === 'User not found') {
        await clearBrowserSession();
      }
      throw error;
    }
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

  getUserById: async (idOrObject) => {
    if (idOrObject && typeof idOrObject === 'object' && idOrObject._id) return idOrObject;
    const res = await api.get(`/auth/user-info/${idOrObject}`);
    return res.data.data;
  },

  sendMessage: async (messageData, targetUserId = null) => {
    const { selectedUser, messages, replyTarget } = get();
    const targetId = targetUserId || selectedUser?._id;
    if (!targetId) return;
    const me = useAuthStore.getState().authUser;
    const payload = { ...messageData, ...(replyTarget && !targetUserId ? { replyTo: replyTarget._id } : {}) };
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticMessage = { _id: tempId, senderId: me._id, receiverId: targetId, ...payload, createdAt: new Date().toISOString(), readBy: [me._id], deliveredTo: [], isOptimistic: true };

    if (!targetUserId || targetId === selectedUser?._id) {
      set({ messages: [...messages, optimisticMessage], chats: updateChatWithLastMessage(get().chats, optimisticMessage), replyTarget: null });
    }

    try {
      const res = await api.post(`/message/send/${targetId}`, payload);
      if (!targetUserId || targetId === selectedUser?._id) {
        set({ messages: get().messages.filter((m) => m._id !== tempId).concat(res.data.data), chats: updateChatWithLastMessage(get().chats, res.data.data) });
      }
      return res.data.data;
    } catch (error) {
      if (!targetUserId || targetId === selectedUser?._id) set({ messages });
      throw error;
    }
  },
  openViewOnceMessage: async (messageId) => {
    const res = await api.post(`/message/view-once/${messageId}/open`);
    const updatedMessage = res.data.message;
    set((state) => ({
      messages: state.messages.map((message) => (message._id === messageId ? { ...message, ...updatedMessage } : message)),
      chats: updateChatWithLastMessage(
        state.chats.map((chat) =>
          chat.lastMessage?._id === messageId ? { ...chat, lastMessage: updatedMessage } : chat,
        ),
        updatedMessage,
      ),
    }));
    return res.data;
  },

  reactToMessage: async (messageId, emoji) => {
    const res = await api.post(`/message/react/${messageId}`, { emoji });
    set({ messages: get().messages.map((m) => m._id === messageId ? { ...m, reactions: res.data.reactions } : m) });
  },
  deleteMessageForMe: async (messageId) => { const res = await api.delete(`/message/delete-for-me/${messageId}`); set({ messages: get().messages.filter((m) => m._id !== messageId), selectedMessages: get().selectedMessages.filter((id) => id !== messageId), chats: syncChatAfterDeletion(get().chats, res.data.chatUserId, res.data.lastMessage) }); },
  deleteMessageForEveryone: async (messageId) => { const res = await api.delete(`/message/delete-for-everyone/${messageId}`); set({ messages: get().messages.filter((m) => m._id !== messageId), selectedMessages: get().selectedMessages.filter((id) => id !== messageId), chats: syncChatAfterDeletion(get().chats, res.data.chatUserId, res.data.lastMessage) }); },

  forwardSelectedMessages: async (targetUserId) => {
    const selected = get().messages.filter((m) => get().selectedMessages.includes(m._id));
    for (const msg of selected) {
      await get().sendMessage({ text: msg.text, image: msg.image, video: msg.video, audio: msg.audio, document: msg.document, sharedContactId: msg.sharedContactId?._id || msg.sharedContactId, location: msg.location }, targetUserId);
    }
    set({ selectedMessages: [], showForwardModal: false });
    toast.success('Message forwarded');
  },

  subscribeToTypingEvents: () => {
    const socket = useAuthStore.getState().socket; if (!socket) return;
    socket.off('typing');
    socket.off('typing:stop');

    socket.on('typing', ({ senderId }) => {
      set((state) => ({ typingUsers: { ...state.typingUsers, [senderId]: true } }));
      if (get().selectedUser?._id === senderId) set({ isTyping: true });
    });

    socket.on('typing:stop', ({ senderId }) => {
      set((state) => ({ typingUsers: { ...state.typingUsers, [senderId]: false } }));
      if (get().selectedUser?._id === senderId) set({ isTyping: false });
    });
  },
  unsubscribeFromTypingEvents: () => {
    const socket = useAuthStore.getState().socket;
    socket?.off('typing');
    socket?.off('typing:stop');
  },

  subscribeToNewMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off('newMessage');
    socket.off('message:reaction-updated');
    socket.off('messages:read');
    socket.off('messages:delivered');
    socket.off('friend:request:received');
    socket.off('friend:request:responded');
    socket.off('chat:last-message');
    socket.off('message:deleted-everyone');

    socket.on('newMessage', async (message) => {
      const selectedUser = get().selectedUser;
      const myId = useAuthStore.getState().authUser?._id;
      const isChatOpen = selectedUser && message.senderId === selectedUser._id;
      if (isChatOpen) {
        const readMessage = { ...message, readBy: [...new Set([...(message.readBy || []), myId])] };
        set({ messages: [...get().messages, readMessage] });
        try { await api.patch(`/message/read/${selectedUser._id}`); } catch (error) { console.error("Failed to mark as read", error); }
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
      set({ messages: get().messages.map((msg) => messageIds.includes(msg._id) ? { ...msg, readBy: [...new Set([...(msg.readBy || []), readerId])] } : msg), chats: get().chats.map((chat) => chat._id === chatUserId ? { ...chat, unreadCount: 0 } : chat) });
    });
    socket.on('messages:delivered', ({ receiverId, messageIds }) => {
      set({ messages: get().messages.map((msg) => messageIds.includes(msg._id) ? { ...msg, deliveredTo: [...new Set([...(msg.deliveredTo || []), receiverId])] } : msg) });
    });
    socket.on('friend:request:received', async ({ fromUser }) => {
      if (fromUser?._id) {
        set({ people: updatePersonRelationship(get().people, fromUser._id, { requestReceived: true, requestSent: false, isFriend: false }) });
      }
      await get().getPeople();
      toast.success('You received a friend request');
    });
    socket.on('friend:request:responded', async ({ accepted, user }) => {
      const nextPeople = updatePersonRelationship(get().people, user?._id, {
        requestReceived: false,
        requestSent: false,
        isFriend: Boolean(accepted),
      });
      set({ people: nextPeople, activeTab: accepted ? 'chats' : get().activeTab, ...(accepted ? { selectedUser: user || get().selectedUser } : {}) });
      await Promise.all([get().getFriends(), get().getChats(), accepted && user?._id ? get().getMessagesByUserId(user._id) : Promise.resolve()]);
      toast.success(accepted ? `@${user?.username} accepted your friend request` : `@${user?.username} declined your friend request`);
    });
    socket.on('chat:last-message', (message) => {
      set({ chats: updateChatWithLastMessage(get().chats, message) });
    });
    socket.on('message:deleted-everyone', ({ messageId, chatUserId, lastMessage }) => {
      set({
        messages: get().messages.filter((m) => m._id !== messageId),
        selectedMessages: get().selectedMessages.filter((id) => id !== messageId),
        chats: syncChatAfterDeletion(get().chats, chatUserId, lastMessage),
      });
    });
  },
  unsubscribeFromNewMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket?.off('newMessage');
    socket?.off('message:reaction-updated');
    socket?.off('messages:read');
    socket?.off('messages:delivered');
    socket?.off('friend:request:received');
    socket?.off('friend:request:responded');
    socket?.off('chat:last-message');
    socket?.off('message:deleted-everyone');
  },

  blockUser: async (userId) => { await api.post(`/message/block/${userId}`); toast.success('User blocked'); },
  deleteChatHistory: async (userId) => { await api.delete(`/message/delete-chat/${userId}`); set({ messages: [], chats: get().chats.map((chat) => (chat._id === userId ? { ...chat, lastMessage: null } : chat)) }); toast.success('Chat deleted for me'); },
}));
