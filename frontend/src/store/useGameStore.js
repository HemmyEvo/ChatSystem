import { create } from 'zustand';
import toast from 'react-hot-toast';
import { useAuthStore } from './useAuthStore';

export const useGameStore = create((set, get) => ({
  pendingInvite: null,
  activeGame: null,
  dashboard: null,
  isDashboardVisible: false,
  missedGameCalls: [],
  roomRecovery: false,

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
    localStorage.removeItem('activeGameSessionId');
    set({ activeGame: null, roomRecovery: false });
  },

  closeGame: () => set({ activeGame: null, roomRecovery: false }),
  dismissRoomRecovery: () => set({ roomRecovery: false }),

  subscribeGameEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off('game:invite');
    socket.off('game:state');
    socket.off('game:ended');
    socket.off('game:error');
    socket.off('game:invite:declined');
    socket.off('game:invite:sent');
    socket.off('game:invite:missed');
    socket.off('game:resume-required');

    socket.on('game:invite', (invite) => set({ pendingInvite: invite }));
    socket.on('game:state', (state) => {
      if (state?.sessionId) {
        localStorage.setItem('activeGameSessionId', state.sessionId);
      }
      set({ activeGame: state });
    });

    socket.on('game:invite:sent', ({ gameType }) => {
      toast.success(`${String(gameType || 'Game').toUpperCase()} invite sent`);
    });

    socket.on('game:resume-required', (state) => {
      if (state?.sessionId) {
        localStorage.setItem('activeGameSessionId', state.sessionId);
      }
      set({ activeGame: state, roomRecovery: true });
    });

    socket.on('game:invite:missed', (payload) => {
      set((state) => ({
        missedGameCalls: [{
          id: payload.id || `${Date.now()}`,
          gameType: payload.gameType,
          fromUserId: payload.fromUserId,
          fromName: payload.fromName || 'Player',
          createdAt: payload.createdAt || Date.now(),
        }, ...state.missedGameCalls].slice(0, 20),
      }));
      toast(`Missed ${String(payload.gameType || 'game').toUpperCase()} call from ${payload.fromName || 'Player'}`);
    });

    socket.on('game:ended', ({ winnerId }) => {
      const me = useAuthStore.getState().authUser?._id;
      toast.success(winnerId === me ? 'You won 🎉' : 'Game over. Good match!');
      localStorage.removeItem('activeGameSessionId');
      set({ activeGame: null, roomRecovery: false });
    });

    socket.on('game:error', ({ message }) => toast.error(message));
    socket.on('game:invite:declined', () => toast('Invite declined'));
  },
}));
