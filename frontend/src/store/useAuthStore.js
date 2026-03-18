import { create } from 'zustand';
import { api } from '../lib/axios.js';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';

const Base_URL = import.meta.env.MODE === 'production' ? '/' : 'http://localhost:3000';

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: true,
  isSigningup: false,
  isloggingin: false,
  socket: null,
  onlineUsers: [],
  userLastSeenMap: {},

  checkAuth: async () => {
    try {
      const res = await api.get('/auth/check-auth');
      set({ authUser: res.data.data, isCheckingAuth: false });
      get().connectSocket();
    } catch (error) {
      console.error('Error checking auth:', error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  login: async (data) => {
    set({ isloggingin: true });
    try {
      const res = await api.post('/auth/login', data);
      set({ authUser: res.data.data });
      useAuthStore.getState().checkAuth();
      toast.success('Login successful!');
      get().connectSocket();
    } catch (error) {
      console.error('Error logging in:', error);
      toast.error(error.response?.data?.message || 'Failed to log in');
      throw error;
    } finally {
      set({ isloggingin: false });
    }
  },

  signup: async (data) => {
    set({ isSigningup: true });
    try {
      const res = await api.post('/auth/register', data);
      set({ authUser: res.data.data });
      useAuthStore.getState().checkAuth();
      toast.success('Account created successfully!');
      get().connectSocket();
      return res.data;
    } catch (error) {
      console.error('Error signing up:', error);
      if (error.response?.status !== 409) {
        toast.error(error.response?.data?.message || 'Failed to sign up');
      }
      throw error;
    } finally {
      set({ isSigningup: false });
    }
  },

  logout: async () => {
    try {
      const socket = get().socket;
      if (socket?.connected) {
        socket.emit('auth:signout');
      }
      await api.get('/auth/logout');
      set({ authUser: null });
      toast.success('Logged out successfully!');
      get().disconnectSocket();
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Failed to log out');
    }
  },

  updateProfile: async (data) => {
    try {
      const res = await api.put('/auth/update-profile', data);
      set({ authUser: res.data.data });
      toast.success('Profile updated successfully');
    } catch (error) {
      console.log('Error in update profile:', error);
      toast.error(error.response?.data?.message || 'Failed to update profile');
    }
  },

  fetchUsernameSuggestions: async (username) => {
    const res = await api.get('/auth/username-suggestions', { params: { username } });
    return res.data;
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser || get().socket?.connected) return;
    const socket = io(Base_URL, { withCredentials: true });
    socket.connect();

    socket.on('presence:update', ({ onlineUsers }) => {
      set({ onlineUsers });
    });

    socket.on('user:last-seen', ({ userId, lastSeen, isOnline }) => {
      set((state) => ({
        userLastSeenMap: { ...state.userLastSeenMap, [userId]: lastSeen },
        onlineUsers: isOnline
          ? Array.from(new Set([...state.onlineUsers, userId]))
          : state.onlineUsers.filter((id) => id !== userId),
      }));
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket?.connected) socket.disconnect();
    set({ socket: null, onlineUsers: [] });
  },
}));
