import { create } from "zustand";
import { api } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";


export const useChatStore = create((set, get) => ({
    allContacts: [],
    chats: [],
    messages: [],
    activeTab: "chats",
    selectedUser: null,
    isUsersLoading: false,
    isMessagesLoading: false,
    isTyping: false,
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

        if (socket && selectedUser) {
            socket.emit('isTyping', { senderId: authUser._id, receiverId: selectedUser._id });
        }
    },
    getAllContacts: async () => {
        set({ isUsersLoading: true });
        try {
            const res = await api.get("/message/contact");
            set({ allContacts: res.data.filteredUsers });
        } catch (error) {
            console.error('Error fetching contacts:', error);
            toast.error(error.response?.data?.message || 'Failed to fetch contacts');
            throw error;
        } finally {
            set({ isUsersLoading: false });
        }
    },
    
    getChats: async () => {
        set({ isUsersLoading: true });
        try {
            const res = await api.get("/message/chats");
            set({ chats: res.data.chatPartners });
        } catch (error) {
            console.error('Error fetching chats:', error);
            toast.error(error.response?.data?.message || 'Failed to fetch chats');
            throw error;
        } finally {
            set({ isUsersLoading: false });
        }
    },

    getMessagesByUserId: async (userId) => {
        set({ isMessagesLoading: true });
        try {
            const res = await api.get(`/message/${userId}`);
            set({ messages: res.data.messages });
        } catch (error) {
            console.error('Error fetching messages:', error);
            toast.error(error.response?.data?.message || 'Failed to fetch messages');
            throw error;
        } finally {
            set({ isMessagesLoading: false });
        }
    },

    getUserById: async (userId) => {
        try {
            const res = await api.get(`/auth/user-info/${userId}`);
            return res.data.data;
        } catch (error) {
            console.error('Error fetching user info:', error);
            toast.error(error.response?.data?.message || 'Failed to fetch user info');
            throw error;
        }
    },

    sendMessage: async (messageData) => {
        const { selectedUser, messages } = get();

        if (!selectedUser) {
            toast.error("No user selected.");
            return;
        }
        const {authUser} = useAuthStore.getState();
        const tempId = `temp-${Date.now()}`;  
        const optimisticMessage = {
            _id: tempId,
            senderId: authUser.data._id,
            receiverId: selectedUser._id,
            document: messageData.document,
            image: messageData.image,
            text: messageData.text,
            video: messageData.video,
            audio: messageData.audio,
            sharedContactId: messageData.sharedContactId,
            createdAt: new Date().toISOString(),
            isOptimistic: true, // Flag to identify optimistic messages
        };
        set({ messages: [...messages, optimisticMessage] });

        try {
            const res = await api.post(`/message/send/${selectedUser._id}`, messageData);
            set({ messages: [...messages, res.data.data] });
            return res.data.data;
        } catch (error) {
            console.error('Error sending message:', error);
            set({messages: messages})
            if (error.response?.status === 413) {
                toast.error("File is too large to send.");
            } else {
                toast.error(error.response?.data?.message || 'Failed to send message');
            }
            throw error;
        }
    },
    subscribeToTypingEvents: () => {
        const socket = useAuthStore.getState().socket;

        socket.on('typing', ({ senderId }) => {
            const selectedUser = get().selectedUser;
            if (selectedUser && selectedUser._id === senderId) {
                set({ isTyping: true });

                setTimeout(() => set({ isTyping: false }), 3000); // Reset after 3 seconds
            }
        });
    },
    unsubscribeFromTypingEvents: () => {
        const socket = useAuthStore.getState().socket;
        socket.off('typing');
    },
    subscribeToNewMessages: () => {
        const { selectedUser, isSoundEnabled } = get();
        if (!selectedUser) return;
        const socket = useAuthStore.getState().socket;
        socket.on("newMessage", (message) => {
                const isMessageForCurrentChat = message.senderId === selectedUser._id ;
                if(!isMessageForCurrentChat) return;

                const currentMessages = get().messages;
                set({ messages: [...currentMessages, message] });
                if (isSoundEnabled) {
                                        
                    const NotificationSound = new Audio("/sounds/notification.mp3");
                    NotificationSound.currentTime = 0;
                    NotificationSound.play().catch((error) => console.error("Error playing notification sound:", error));
                }
        });
    },
    unsubscribeFromNewMessages: () => {
        const socket = useAuthStore.getState().socket;
        socket.off("newMessage");
    },
    deleteMessage: async (messageId) => {
        const { messages } = get();
        try {
            // Optimistically update UI immediately for a snappy feel
            set({ messages: messages.filter((msg) => msg._id !== messageId) });
            
            // Send request to backend
            await api.delete(`/message/delete/${messageId}`);
            toast.success("Message deleted");
        } catch (error) {
            console.error('Error deleting message:', error);
            toast.error("Failed to delete message");
            // Revert optimistic update if it fails by refetching
            get().getMessagesByUserId(get().selectedUser._id);
        }
    }
}));