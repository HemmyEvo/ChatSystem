import { create } from 'zustand';
import toast from 'react-hot-toast';
import { useAuthStore } from './useAuthStore';

const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

export const useCallStore = create((set, get) => ({
  localStream: null,
  remoteStream: null,
  activeCallUser: null,
  incomingCall: null,
  callStatus: 'idle',
  isMuted: false,
  peerConnection: null,

  cleanupCall: ({ keepIncoming = false } = {}) => {
    const { peerConnection, localStream, remoteStream } = get();
    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.close();
    }
    localStream?.getTracks().forEach((track) => track.stop());
    remoteStream?.getTracks().forEach((track) => track.stop());
    set({
      peerConnection: null,
      localStream: null,
      remoteStream: null,
      activeCallUser: null,
      incomingCall: keepIncoming ? get().incomingCall : null,
      callStatus: 'idle',
      isMuted: false,
    });
  },

  ensureLocalStream: async () => {
    const existing = get().localStream;
    if (existing) return existing;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    set({ localStream: stream, isMuted: false });
    return stream;
  },

  createPeerConnection: async (targetUserId) => {
    const socket = useAuthStore.getState().socket;
    const stream = await get().ensureLocalStream();
    const peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit('call:signal', { toUserId: targetUserId, candidate: event.candidate });
      }
    };

    peerConnection.ontrack = (event) => {
      const [streamTrack] = event.streams;
      if (streamTrack) {
        set({ remoteStream: streamTrack });
      }
    };

    set({ peerConnection });
    return peerConnection;
  },

  startCall: async (user) => {
    const socket = useAuthStore.getState().socket;
    if (!socket?.connected || !user?._id) return;
    try {
      await get().ensureLocalStream();
      set({ activeCallUser: user, incomingCall: null, callStatus: 'calling' });
      socket.emit('call:start', { toUserId: user._id });
    } catch (error) {
      console.error('Failed to start call:', error);
      toast.error('Microphone access is required for calling.');
      get().cleanupCall();
    }
  },

  acceptCall: async () => {
    const socket = useAuthStore.getState().socket;
    const incomingCall = get().incomingCall;
    if (!socket?.connected || !incomingCall?.fromUser?._id) return;
    try {
      await get().ensureLocalStream();
      set({ activeCallUser: incomingCall.fromUser, incomingCall: null, callStatus: 'connecting' });
      socket.emit('call:accept', { toUserId: incomingCall.fromUser._id });
    } catch (error) {
      console.error('Failed to accept call:', error);
      toast.error('Microphone access is required for calling.');
      get().declineCall();
    }
  },

  declineCall: () => {
    const socket = useAuthStore.getState().socket;
    const incomingCall = get().incomingCall;
    if (incomingCall?.fromUser?._id) {
      socket?.emit('call:decline', { toUserId: incomingCall.fromUser._id });
    }
    set({ incomingCall: null });
    get().cleanupCall();
  },

  endCall: () => {
    const socket = useAuthStore.getState().socket;
    const activeCallUser = get().activeCallUser;
    if (activeCallUser?._id) {
      socket?.emit('call:end', { toUserId: activeCallUser._id });
    }
    get().cleanupCall();
  },

  toggleMute: () => {
    const localStream = get().localStream;
    const nextMuted = !get().isMuted;
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    set({ isMuted: nextMuted });
  },

  subscribeToCallEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off('call:incoming');
    socket.off('call:accepted');
    socket.off('call:declined');
    socket.off('call:ended');
    socket.off('call:signal');
    socket.off('call:unavailable');

    socket.on('call:incoming', ({ fromUserId, fromUser }) => {
      if (get().activeCallUser?._id || get().incomingCall?.fromUserId) {
        socket.emit('call:decline', { toUserId: fromUserId });
        return;
      }
      set({ incomingCall: { fromUserId, fromUser }, callStatus: 'ringing' });
      toast(`Incoming voice call from @${fromUser?.username || 'user'}`);
    });

    socket.on('call:accepted', async ({ fromUserId }) => {
      const activeCallUser = get().activeCallUser;
      if (!activeCallUser || activeCallUser._id !== fromUserId) return;
      try {
        const peerConnection = await get().createPeerConnection(fromUserId);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('call:signal', { toUserId: fromUserId, description: peerConnection.localDescription });
        set({ callStatus: 'connecting' });
      } catch (error) {
        console.error('Error creating offer:', error);
        toast.error('Could not connect voice call.');
        get().endCall();
      }
    });

    socket.on('call:signal', async ({ fromUserId, description, candidate }) => {
      try {
        let peerConnection = get().peerConnection;
        if (!peerConnection) {
          peerConnection = await get().createPeerConnection(fromUserId);
        }

        if (description) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(description));

          if (description.type === 'offer') {
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('call:signal', { toUserId: fromUserId, description: peerConnection.localDescription });
          }

          set({ callStatus: 'connected' });
        }

        if (candidate) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (error) {
        console.error('Error handling call signal:', error);
        toast.error('Voice call connection was interrupted.');
        get().cleanupCall();
      }
    });

    socket.on('call:declined', () => {
      toast.error('Voice call declined.');
      get().cleanupCall();
    });

    socket.on('call:ended', () => {
      toast('Voice call ended.');
      get().cleanupCall();
    });

    socket.on('call:unavailable', () => {
      toast.error('This user is offline or unavailable for voice calling.');
      get().cleanupCall();
    });
  },

  unsubscribeFromCallEvents: () => {
    const socket = useAuthStore.getState().socket;
    socket?.off('call:incoming');
    socket?.off('call:accepted');
    socket?.off('call:declined');
    socket?.off('call:ended');
    socket?.off('call:signal');
    socket?.off('call:unavailable');
  },
}));
