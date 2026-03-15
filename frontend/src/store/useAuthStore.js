import {create} from 'zustand';
import { api } from '../lib/axios.js';
import toast from 'react-hot-toast';

export const useAuthStore = create((set) => ({
    authUser: null,
    isCheckingAuth: true,
    isSigningup: false,
    isloggingin: false,
    checkAuth: async () => {
        try {
            const res = await api.get('/auth/check-auth');
            set({ authUser: res.data, isCheckingAuth: false });
        }
        catch (error) {
            console.error('Error checking auth:', error);
            set({ authUser: null });
        } finally {
            set({ isCheckingAuth: false });
        }
    },

    login : async (data) => {
    set({ isloggingin: true });
    try {
        const res = await api.post('/auth/login', data);
        set({ authUser: res.data });
        toast.success("Login successful!");
    }
    catch (error) {
        console.error('Error logging in:', error);
        toast.error(error.response?.data?.message || 'Failed to log in');
        throw error; // Rethrow to handle in component
    } finally {
        set({ isloggingin: false });
    }
    },

    signup : async (data) => {
        set({ isSigningup: true });
        try {
            const res = await api.post('/auth/register', data);
            set({ authUser: res.data });
            toast.success("Account created successfully!");
        }
        catch (error) {
            console.error('Error signing up:', error);
            toast.error(error.response?.data?.message || 'Failed to sign up');
            throw error; // Rethrow to handle in component
        } finally {
            set({ isSigningup: false });
        }
    },
    logout: async () => {
        try {
            await api.post('/auth/logout');
            set({ authUser: null });
            toast.success("Logged out successfully!");
        }
        catch (error) {
            console.error('Error logging out:', error);
            toast.error('Failed to log out');
        }
    }
}));