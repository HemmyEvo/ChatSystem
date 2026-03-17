import { create } from 'zustand';
import toast from 'react-hot-toast';
import { useAuthStore } from './useAuthStore';

let dashboardTimer = null;

const showDashboardForAWhile = (set) => {
  if (dashboardTimer) clearTimeout(dashboardTimer);
  set({ isDashboardVisible: true });
  dashboardTimer = setTimeout(() => {
    set({ isDashboardVisible: false });
  }, 7000);
};

export const useGameStore = create((set, get) => ({
  pendingInvite: null,
  activeGame: null,
  dashboard: null,
  isDashboardVisible: false,

  startInvite: (gameType, toUserId) => {
    const socket = useAuthStore.getState().socket;
    if (!toUserId) {
      toast.error('Select a chat user first.');
      return;
    }
    if (!socket?.connected) {
      toast.error('Socket not connected yet. Please try again.');
      return;
    }
    socket.emit('game:invite', { gameType, toUserId });
  },

  respondInvite: (accepted) => {
    const socket = useAuthStore.getState().socket;
    const invite = get().pendingInvite;
    if (!socket?.connected || !invite) return;
    socket.emit('game:invite:response', { inviteId: invite.id, accepted });
    set({ pendingInvite: null });
  },

  sendAction: (action) => {
    const socket = useAuthStore.getState().socket;
    const game = get().activeGame;
    if (!socket?.connected || !game) return;
    socket.emit('game:action', { sessionId: game.sessionId, action });
  },

  forfeitGame: () => {
    const socket = useAuthStore.getState().socket;
    const game = get().activeGame;
    if (!socket?.connected || !game) return;
    socket.emit('game:forfeit', { sessionId: game.sessionId });
    set({ activeGame: null });
  },

  requestDashboard: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket?.connected) {
      toast.error('Socket not connected yet.');
      return;
    }
    socket.emit('game:dashboard:request');
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
    socket.off('game:invite:sent');

    socket.on('game:invite', (invite) => set({ pendingInvite: invite }));
    socket.on('game:state', (state) => set({ activeGame: state }));

    socket.on('game:invite:sent', ({ gameType }) => {
      toast.success(`${String(gameType || 'Game').toUpperCase()} invite sent`);
    });

    socket.on('game:ended', ({ winnerId }) => {
      const me = useAuthStore.getState().authUser?._id;
      toast.success(winnerId === me ? 'You won 🎉' : 'Game over. Good match!');
      set({ activeGame: null });
      get().requestDashboard();
    });

    socket.on('game:dashboard', (dashboard) => {
      set({ dashboard });
      showDashboardForAWhile(set);
      if (!dashboard) {
        toast('No game stats yet. Play a match first.');
      }
    });

    socket.on('game:error', ({ message }) => toast.error(message));
    socket.on('game:invite:declined', () => toast('Invite declined'));
  },
}));
