import { create } from 'zustand';
import toast from 'react-hot-toast';
import { useAuthStore } from './useAuthStore';

export const useGameStore = create((set, get) => ({
  pendingInvite: null,
  activeGame: null,
  dashboard: null,

  startInvite: (gameType, toUserId) => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.emit('game:invite', { gameType, toUserId });
    toast.success(`${gameType.toUpperCase()} invite sent`);
  },

  respondInvite: (accepted) => {
    const socket = useAuthStore.getState().socket;
    const invite = get().pendingInvite;
    if (!socket || !invite) return;
    socket.emit('game:invite:response', { inviteId: invite.id, accepted });
    set({ pendingInvite: null });
  },

  sendAction: (action) => {
    const socket = useAuthStore.getState().socket;
    const game = get().activeGame;
    if (!socket || !game) return;
    socket.emit('game:action', { sessionId: game.sessionId, action });
  },

  forfeitGame: () => {
    const socket = useAuthStore.getState().socket;
    const game = get().activeGame;
    if (!socket || !game) return;
    socket.emit('game:forfeit', { sessionId: game.sessionId });
  },

  requestDashboard: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) socket.emit('game:dashboard:request');
  },

  closeGame: () => set({ activeGame: null }),

  subscribeGameEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off('game:invite');
    socket.off('game:state');
    socket.off('game:ended');
    socket.off('game:dashboard');
    socket.off('game:error');
    socket.off('game:invite:declined');

    socket.on('game:invite', (invite) => set({ pendingInvite: invite }));
    socket.on('game:state', (state) => set({ activeGame: state }));
    socket.on('game:ended', ({ winnerId }) => {
      const me = useAuthStore.getState().authUser?._id;
      toast.success(winnerId === me ? 'You won 🎉' : 'Game over. Good match!');
      get().requestDashboard();
    });
    socket.on('game:dashboard', (dashboard) => set({ dashboard }));
    socket.on('game:error', ({ message }) => toast.error(message));
    socket.on('game:invite:declined', () => toast('Invite declined'));
  },
}));
