import { create } from "zustand";
import { api } from "../lib/axios";
import toast from "react-hot-toast";

export const useChatStore = create((set,get) => ({
    allContacts: [],
    chats: [],
    messages: [],
    activeTab: "chats",
    selectedUser: null,
    isUsersLoading: false,
    isMessagesLoading: false,
    isSoundEnabled: JSON.parse(localStorage.getItem("isSoundEnabled")) === "true" ? true : false,

    toggleSound: () => {
        localStorage.setItem("isSoundEnabled", !get().isSoundEnabled );
        set({ isSoundEnabled: !get().isSoundEnabled });
    },

    setActiveTab : (tab) => set({ activeTab: tab }),

    setSelectedUser: (user) => set({ selectedUser: user }),

    getAllContacts: async () => {
    set({ isUsersLoading: true });
    try{
        const res = await api.get("/message/contact");
        set({ allContacts: res.data });
    }catch (error) {
        console.error('Error signing up:', error);
        toast.error(error.response?.data?.message || 'Failed to sign up');
        throw error; // Rethrow to handle in component
    } finally {
        set({ isUsersLoading: false });
    }
    },
    
    getChats: async () => {
        set({ isUsersLoading: true });
        try{
            const res = await api.get("/message/chats");
            set({ chats: res.data });
        }catch (error) {
            console.error('Error signing up:', error);
            toast.error(error.response?.data?.message || 'Failed to sign up');
            throw error; // Rethrow to handle in component
        } finally {
            set({ isUsersLoading: false });
        }
    }
}))