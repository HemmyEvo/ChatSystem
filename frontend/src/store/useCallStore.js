import { create } from 'zustand';
import toast from 'react-hot-toast';
import { useAuthStore } from './useAuthStore';

const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const DRAW_HISTORY_LIMIT = 250;

const makeEmptyStroke = ({ color = '#22d3ee', width = 3 } = {}) => ({
  id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  color,
  width,
  points: [],
});

const getTrackByKind = (stream, kind) => stream?.getTracks().find((track) => track.kind === kind) || null;

export const useCallStore = create((set, get) => ({
  localStream: null,
  remoteStream: null,
  previewStream: null,
  activeCallUser: null,
  incomingCall: null,
  callStatus: 'idle',
  isMuted: false,
  isCameraEnabled: true,
  isVideoCall: true,
  isScreenSharing: false,
  peerConnection: null,
  dataChannel: null,
  remoteMediaState: { isMuted: false, isCameraEnabled: true, isScreenSharing: false },
  remoteLocation: null,
  collaborativePaths: [],
  remotePointer: null,
  drawingColor: '#22d3ee',
  drawingWidth: 3,
  isDrawingEnabled: true,
  localDrawStroke: null,

  notifyPeer: (payload) => {
    const dataChannel = get().dataChannel;
    if (dataChannel?.readyState === 'open') {
      dataChannel.send(JSON.stringify(payload));
    }
  },

  syncMediaState: () => {
    get().notifyPeer({
      type: 'media-state',
      payload: {
        isMuted: get().isMuted,
        isCameraEnabled: get().isCameraEnabled,
        isScreenSharing: get().isScreenSharing,
      },
    });
  },

  cleanupCall: ({ keepIncoming = false } = {}) => {
    const { peerConnection, localStream, remoteStream, previewStream, dataChannel } = get();
    if (dataChannel) {
      dataChannel.onopen = null;
      dataChannel.onclose = null;
      dataChannel.onmessage = null;
      try { dataChannel.close(); } catch (error) { console.debug('Data channel close ignored:', error); }
    }
    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.ondatachannel = null;
      peerConnection.close();
    }
    [localStream, remoteStream, previewStream].forEach((stream) => stream?.getTracks().forEach((track) => track.stop()));
    set({
      peerConnection: null,
      dataChannel: null,
      localStream: null,
      remoteStream: null,
      previewStream: null,
      activeCallUser: null,
      incomingCall: keepIncoming ? get().incomingCall : null,
      callStatus: 'idle',
      isMuted: false,
      isCameraEnabled: true,
      isVideoCall: true,
      isScreenSharing: false,
      remoteMediaState: { isMuted: false, isCameraEnabled: true, isScreenSharing: false },
      remoteLocation: null,
      collaborativePaths: [],
      remotePointer: null,
      localDrawStroke: null,
    });
  },

  ensureLocalStream: async ({ audio = true, video = true } = {}) => {
    const existing = get().localStream;
    const hasAudio = Boolean(getTrackByKind(existing, 'audio'));
    const hasVideo = Boolean(getTrackByKind(existing, 'video'));
    if (existing && (!audio || hasAudio) && (!video || hasVideo)) return existing;

    const stream = await navigator.mediaDevices.getUserMedia({ audio, video });
    const nextAudioTrack = getTrackByKind(stream, 'audio');
    const nextVideoTrack = getTrackByKind(stream, 'video');
    const prevStream = get().localStream;

    if (prevStream) {
      prevStream.getTracks().forEach((track) => track.stop());
    }

    set({
      localStream: stream,
      previewStream: stream,
      isMuted: nextAudioTrack ? !nextAudioTrack.enabled : false,
      isCameraEnabled: nextVideoTrack ? nextVideoTrack.enabled : false,
    });
    return stream;
  },

  attachRemoteDataChannel: (channel) => {
    if (!channel) return;
    channel.onopen = () => get().syncMediaState();
    channel.onclose = () => set({ dataChannel: null });
    channel.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'media-state') {
          set({ remoteMediaState: { ...get().remoteMediaState, ...parsed.payload } });
        }
        if (parsed.type === 'location') {
          set({ remoteLocation: parsed.payload });
        }
        if (parsed.type === 'drawing:stroke') {
          set((state) => ({ collaborativePaths: [...state.collaborativePaths, parsed.payload].slice(-DRAW_HISTORY_LIMIT) }));
        }
        if (parsed.type === 'drawing:clear') {
          set({ collaborativePaths: [] });
        }
        if (parsed.type === 'pointer') {
          set({ remotePointer: parsed.payload });
        }
      } catch (error) {
        console.error('Failed to parse call collaboration message:', error);
      }
    };
    set({ dataChannel: channel });
  },

  createPeerConnection: async (targetUserId, { shouldCreateDataChannel = false } = {}) => {
    const socket = useAuthStore.getState().socket;
    const stream = await get().ensureLocalStream({ audio: true, video: get().isVideoCall });
    const peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

    if (shouldCreateDataChannel) {
      const channel = peerConnection.createDataChannel('collab-sync');
      get().attachRemoteDataChannel(channel);
    }

    peerConnection.ondatachannel = (event) => get().attachRemoteDataChannel(event.channel);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit('call:signal', { toUserId: targetUserId, candidate: event.candidate });
      }
    };

    peerConnection.ontrack = (event) => {
      const [streamTrack] = event.streams;
      if (streamTrack) set({ remoteStream: streamTrack });
    };

    set({ peerConnection });
    return peerConnection;
  },

  startCall: async (user, options = {}) => {
    const socket = useAuthStore.getState().socket;
    if (!socket?.connected || !user?._id) return;
    try {
      const wantsVideo = options.video !== false;
      set({ isVideoCall: wantsVideo });
      await get().ensureLocalStream({ audio: true, video: wantsVideo });
      set({ activeCallUser: user, incomingCall: null, callStatus: 'calling' });
      socket.emit('call:start', { toUserId: user._id, media: { video: wantsVideo } });
    } catch (error) {
      console.error('Failed to start call:', error);
      toast.error('Camera and microphone access are required for calling.');
      get().cleanupCall();
    }
  },

  acceptCall: async () => {
    const socket = useAuthStore.getState().socket;
    const incomingCall = get().incomingCall;
    if (!socket?.connected || !incomingCall?.fromUser?._id) return;
    try {
      const wantsVideo = incomingCall.media?.video !== false;
      set({ isVideoCall: wantsVideo });
      await get().ensureLocalStream({ audio: true, video: wantsVideo });
      set({ activeCallUser: incomingCall.fromUser, incomingCall: null, callStatus: 'connecting' });
      socket.emit('call:accept', { toUserId: incomingCall.fromUser._id, media: { video: wantsVideo } });
    } catch (error) {
      console.error('Failed to accept call:', error);
      toast.error('Camera and microphone access are required for calling.');
      get().declineCall();
    }
  },

  declineCall: () => {
    const socket = useAuthStore.getState().socket;
    const incomingCall = get().incomingCall;
    if (incomingCall?.fromUser?._id) socket?.emit('call:decline', { toUserId: incomingCall.fromUser._id });
    set({ incomingCall: null });
    get().cleanupCall();
  },

  endCall: () => {
    const socket = useAuthStore.getState().socket;
    const activeCallUser = get().activeCallUser;
    if (activeCallUser?._id) socket?.emit('call:end', { toUserId: activeCallUser._id });
    get().cleanupCall();
  },

  toggleMute: () => {
    const localStream = get().localStream;
    const nextMuted = !get().isMuted;
    localStream?.getAudioTracks().forEach((track) => { track.enabled = !nextMuted; });
    set({ isMuted: nextMuted });
    get().syncMediaState();
  },

  toggleCamera: () => {
    const localStream = get().localStream;
    const videoTracks = localStream?.getVideoTracks() || [];
    if (!videoTracks.length) return;
    const nextCameraEnabled = !get().isCameraEnabled;
    videoTracks.forEach((track) => { track.enabled = nextCameraEnabled; });
    set({ isCameraEnabled: nextCameraEnabled });
    get().syncMediaState();
  },

  replaceVideoTrack: async (newTrack, { isScreenSharing = false } = {}) => {
    const { peerConnection, localStream } = get();
    const sender = peerConnection?.getSenders().find((item) => item.track?.kind === 'video');
    if (sender) await sender.replaceTrack(newTrack);

    if (localStream) {
      localStream.getVideoTracks().forEach((track) => localStream.removeTrack(track));
      localStream.addTrack(newTrack);
    }

    const nextStream = new MediaStream([...(localStream?.getAudioTracks() || []), newTrack]);
    set({ localStream: nextStream, previewStream: nextStream, isScreenSharing, isCameraEnabled: !isScreenSharing || newTrack.enabled });
    get().syncMediaState();
  },

  toggleScreenShare: async () => {
    try {
      if (!get().isScreenSharing) {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const displayTrack = displayStream.getVideoTracks()[0];
        if (!displayTrack) return;
        displayTrack.onended = () => {
          if (get().isScreenSharing) get().toggleScreenShare();
        };
        await get().replaceVideoTrack(displayTrack, { isScreenSharing: true });
        set({ previewStream: displayStream });
      } else {
        const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const cameraTrack = cameraStream.getVideoTracks()[0];
        if (!cameraTrack) return;
        await get().replaceVideoTrack(cameraTrack, { isScreenSharing: false });
      }
    } catch (error) {
      console.error('Screen share failed:', error);
      toast.error('Unable to share your screen right now.');
    }
  },

  shareLocationInCall: () => {
    if (!navigator.geolocation) {
      toast.error('Location sharing is not supported in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const payload = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          sharedAt: new Date().toISOString(),
        };
        get().notifyPeer({ type: 'location', payload });
        toast.success('Location shared in call.');
      },
      () => toast.error('Location access was denied.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  },

  startStroke: ({ x, y }) => {
    if (!get().isDrawingEnabled) return;
    const stroke = makeEmptyStroke({ color: get().drawingColor, width: get().drawingWidth });
    stroke.points.push({ x, y });
    set({ localDrawStroke: stroke, remotePointer: null });
  },

  extendStroke: ({ x, y }) => {
    const localDrawStroke = get().localDrawStroke;
    if (!localDrawStroke) {
      get().notifyPeer({ type: 'pointer', payload: { x, y, updatedAt: Date.now() } });
      return;
    }
    set({ localDrawStroke: { ...localDrawStroke, points: [...localDrawStroke.points, { x, y }] } });
  },

  finishStroke: () => {
    const stroke = get().localDrawStroke;
    if (!stroke || stroke.points.length < 2) {
      set({ localDrawStroke: null });
      return;
    }
    set((state) => ({ collaborativePaths: [...state.collaborativePaths, stroke].slice(-DRAW_HISTORY_LIMIT), localDrawStroke: null }));
    get().notifyPeer({ type: 'drawing:stroke', payload: stroke });
  },

  clearDrawings: () => {
    set({ collaborativePaths: [], localDrawStroke: null });
    get().notifyPeer({ type: 'drawing:clear' });
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

    socket.on('call:incoming', ({ fromUserId, fromUser, media }) => {
      if (get().activeCallUser?._id || get().incomingCall?.fromUserId) {
        socket.emit('call:decline', { toUserId: fromUserId });
        return;
      }
      set({ incomingCall: { fromUserId, fromUser, media }, callStatus: 'ringing', isVideoCall: media?.video !== false });
      toast(`Incoming ${media?.video === false ? 'voice' : 'video'} call from @${fromUser?.username || 'user'}`);
    });

    socket.on('call:accepted', async ({ fromUserId, media }) => {
      const activeCallUser = get().activeCallUser;
      if (!activeCallUser || activeCallUser._id !== fromUserId) return;
      try {
        set({ isVideoCall: media?.video !== false });
        const peerConnection = await get().createPeerConnection(fromUserId, { shouldCreateDataChannel: true });
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('call:signal', { toUserId: fromUserId, description: peerConnection.localDescription });
        set({ callStatus: 'connecting' });
      } catch (error) {
        console.error('Error creating offer:', error);
        toast.error('Could not connect call.');
        get().endCall();
      }
    });

    socket.on('call:signal', async ({ fromUserId, description, candidate }) => {
      try {
        let peerConnection = get().peerConnection;
        if (!peerConnection) peerConnection = await get().createPeerConnection(fromUserId);

        if (description) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
          if (description.type === 'offer') {
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('call:signal', { toUserId: fromUserId, description: peerConnection.localDescription });
          }
          set({ callStatus: 'connected' });
          get().syncMediaState();
        }

        if (candidate) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (error) {
        console.error('Error handling call signal:', error);
        toast.error('Call connection was interrupted.');
        get().cleanupCall();
      }
    });

    socket.on('call:declined', () => {
      toast.error('Call declined.');
      get().cleanupCall();
    });

    socket.on('call:ended', () => {
      toast('Call ended.');
      get().cleanupCall();
    });

    socket.on('call:unavailable', () => {
      toast.error('This user is offline or unavailable right now.');
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
