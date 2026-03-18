import { create } from 'zustand';
import toast from 'react-hot-toast';
import { useAuthStore } from './useAuthStore';

const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const DRAW_HISTORY_LIMIT = 250;
const MISSED_CALL_LIMIT = 20;

const makeEmptyStroke = ({ color = '#22d3ee', width = 3 } = {}) => ({
  id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  color,
  width,
  points: [],
});

const getTrackByKind = (stream, kind) => stream?.getTracks().find((track) => track.kind === kind) || null;
const buildMissedCall = (payload = {}) => ({
  id: payload.id || payload.sessionId || `missed-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  sessionId: payload.sessionId || null,
  media: payload.media || { video: false },
  reason: payload.reason || 'missed',
  createdAt: payload.createdAt || Date.now(),
  fromUser: payload.fromUser || null,
});

export const useCallStore = create((set, get) => ({
  localStream: null,
  remoteStream: null,
  previewStream: null,
  activeCallUser: null,
  incomingCall: null,
  callStatus: 'idle',
  callMode: 'voice',
  sessionId: null,
  isMuted: false,
  isCameraEnabled: true,
  isScreenSharing: false,
  isRecording: false,
  recordingSeconds: 0,
  recordingUrl: null,
  recordingError: '',
  recorder: null,
  recordingTimer: null,
  peerConnection: null,
  dataChannel: null,
  remoteMediaState: { isMuted: false, isCameraEnabled: true, isScreenSharing: false, isRecording: false },
  remoteLocation: null,
  collaborativePaths: [],
  remotePointer: null,
  drawingColor: '#22d3ee',
  drawingWidth: 3,
  localDrawStroke: null,
  missedCalls: [],

  pushMissedCall: (payload) => {
    const missedCall = buildMissedCall(payload);
    set((state) => ({ missedCalls: [missedCall, ...state.missedCalls].slice(0, MISSED_CALL_LIMIT) }));
    if (missedCall.fromUser?.username) {
      toast(`Missed ${missedCall.media?.video ? 'video' : 'voice'} call from @${missedCall.fromUser.username}`);
    }
  },
  clearMissedCalls: () => set({ missedCalls: [] }),

  notifyPeer: (payload) => {
    const dataChannel = get().dataChannel;
    if (get().callMode !== 'video') return;
    if (dataChannel?.readyState === 'open') dataChannel.send(JSON.stringify(payload));
  },

  syncMediaState: () => {
    get().notifyPeer({
      type: 'media-state',
      payload: {
        isMuted: get().isMuted,
        isCameraEnabled: get().isCameraEnabled,
        isScreenSharing: get().isScreenSharing,
        isRecording: get().isRecording,
      },
    });
  },

  stopRecording: ({ keepRecording = false } = {}) => {
    const { recorder, recordingTimer, recordingUrl } = get();
    if (recordingTimer) window.clearInterval(recordingTimer);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    if (!keepRecording && recordingUrl) URL.revokeObjectURL(recordingUrl);
    set({
      recorder: null,
      recordingTimer: null,
      isRecording: false,
      recordingSeconds: keepRecording ? get().recordingSeconds : 0,
      recordingUrl: keepRecording ? recordingUrl : null,
      recordingError: '',
    });
    get().syncMediaState();
  },

  teardownPeerOnly: () => {
    const { peerConnection, dataChannel, remoteStream, previewStream, localStream, isScreenSharing } = get();
    if (dataChannel) {
      dataChannel.onopen = null;
      dataChannel.onclose = null;
      dataChannel.onmessage = null;
      try { dataChannel.close(); } catch (error) { console.debug('Ignoring data channel close failure', error); }
    }
    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.ondatachannel = null;
      try { peerConnection.close(); } catch (error) { console.debug('Ignoring peer close failure', error); }
    }
    remoteStream?.getTracks().forEach((track) => track.stop());
    if (previewStream && previewStream !== localStream && isScreenSharing) previewStream.getTracks().forEach((track) => track.stop());
    set({
      peerConnection: null,
      dataChannel: null,
      remoteStream: null,
      previewStream: localStream || null,
      remoteMediaState: { isMuted: false, isCameraEnabled: true, isScreenSharing: false, isRecording: false },
      remoteLocation: null,
      collaborativePaths: [],
      remotePointer: null,
      localDrawStroke: null,
    });
  },

  cleanupCall: () => {
    const { localStream, recordingUrl } = get();
    get().stopRecording();
    get().teardownPeerOnly();
    localStream?.getTracks().forEach((track) => track.stop());
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    set({
      localStream: null,
      previewStream: null,
      activeCallUser: null,
      incomingCall: null,
      callStatus: 'idle',
      callMode: 'voice',
      sessionId: null,
      isMuted: false,
      isCameraEnabled: true,
      isScreenSharing: false,
      isRecording: false,
      recordingSeconds: 0,
      recordingUrl: null,
      recordingError: '',
    });
  },

  ensureLocalStream: async ({ audio = true, video = false } = {}) => {
    const existing = get().localStream;
    const hasAudio = Boolean(getTrackByKind(existing, 'audio'));
    const hasVideo = Boolean(getTrackByKind(existing, 'video'));
    if (existing && (!audio || hasAudio) && (!video || hasVideo)) {
      set({ previewStream: get().isScreenSharing ? get().previewStream : existing });
      return existing;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio, video });
    existing?.getTracks().forEach((track) => track.stop());
    set({
      localStream: stream,
      previewStream: stream,
      isMuted: false,
      isCameraEnabled: video ? Boolean(getTrackByKind(stream, 'video')?.enabled) : false,
      isScreenSharing: false,
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
        if (parsed.type === 'media-state') set({ remoteMediaState: { ...get().remoteMediaState, ...parsed.payload } });
        if (parsed.type === 'location') set({ remoteLocation: parsed.payload });
        if (parsed.type === 'drawing:stroke') set((state) => ({ collaborativePaths: [...state.collaborativePaths, parsed.payload].slice(-DRAW_HISTORY_LIMIT) }));
        if (parsed.type === 'drawing:clear') set({ collaborativePaths: [] });
        if (parsed.type === 'pointer') set({ remotePointer: parsed.payload });
      } catch (error) {
        console.error('Failed to parse call collaboration message:', error);
      }
    };
    set({ dataChannel: channel });
  },

  createPeerConnection: async (targetUserId, { createDataChannel = false } = {}) => {
    const socket = useAuthStore.getState().socket;
    const stream = await get().ensureLocalStream({ audio: true, video: get().callMode === 'video' });
    const peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const inboundStream = new MediaStream();

    stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
    set({ remoteStream: inboundStream });

    if (get().callMode === 'video' && createDataChannel) get().attachRemoteDataChannel(peerConnection.createDataChannel('collaboration'));

    peerConnection.ondatachannel = (event) => get().attachRemoteDataChannel(event.channel);
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) socket?.emit('call:signal', { toUserId: targetUserId, candidate: event.candidate });
    };
    peerConnection.ontrack = (event) => {
      const nextRemoteStream = get().remoteStream || new MediaStream();
      nextRemoteStream.addTrack(event.track);
      set({ remoteStream: nextRemoteStream });
    };

    set({ peerConnection });
    return peerConnection;
  },

  createOfferFor: async (targetUserId) => {
    if (!targetUserId) return;
    const socket = useAuthStore.getState().socket;
    get().teardownPeerOnly();
    const peerConnection = await get().createPeerConnection(targetUserId, { createDataChannel: get().callMode === 'video' });
    const offer = await peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: get().callMode === 'video' });
    await peerConnection.setLocalDescription(offer);
    socket?.emit('call:signal', { toUserId: targetUserId, description: peerConnection.localDescription });
    set({ callStatus: get().callStatus === 'connected' ? 'reconnecting' : 'connecting' });
  },

  restoreActiveCall: async ({ sessionId, otherUser, media }) => {
    if (!otherUser?._id) return;
    const callMode = media?.video ? 'video' : 'voice';
    try {
      await get().ensureLocalStream({ audio: true, video: callMode === 'video' });
      set({ activeCallUser: otherUser, incomingCall: null, callStatus: 'reconnecting', callMode, sessionId });
      useAuthStore.getState().socket?.emit('call:rejoin', { sessionId });
    } catch (error) {
      console.error('Failed to restore call:', error);
      toast.error(callMode === 'video' ? 'Camera and microphone access are required to resume the video call.' : 'Microphone access is required to resume the voice call.');
    }
  },

  startCall: async (user, options = {}) => {
    const socket = useAuthStore.getState().socket;
    if (!socket?.connected || !user?._id) return;
    const callMode = options.video ? 'video' : 'voice';
    try {
      await get().ensureLocalStream({ audio: true, video: callMode === 'video' });
      set({ activeCallUser: user, incomingCall: null, callStatus: 'calling', callMode, sessionId: null });
      socket.emit('call:start', { toUserId: user._id, media: { video: callMode === 'video' } });
    } catch (error) {
      console.error('Failed to start call:', error);
      toast.error(callMode === 'video' ? 'Camera and microphone access are required for video calling.' : 'Microphone access is required for calling.');
      get().cleanupCall();
    }
  },

  acceptCall: async () => {
    const socket = useAuthStore.getState().socket;
    const incomingCall = get().incomingCall;
    if (!socket?.connected || !incomingCall?.fromUser?._id) return;
    const callMode = incomingCall.media?.video ? 'video' : 'voice';
    try {
      await get().ensureLocalStream({ audio: true, video: callMode === 'video' });
      set({ activeCallUser: incomingCall.fromUser, incomingCall: null, callStatus: 'connecting', callMode, sessionId: incomingCall.sessionId || null });
      socket.emit('call:accept', { toUserId: incomingCall.fromUser._id, media: { video: callMode === 'video' }, sessionId: incomingCall.sessionId || null });
    } catch (error) {
      console.error('Failed to accept call:', error);
      toast.error(callMode === 'video' ? 'Camera and microphone access are required for video calling.' : 'Microphone access is required for calling.');
      get().declineCall();
    }
  },

  declineCall: () => {
    const socket = useAuthStore.getState().socket;
    const incomingCall = get().incomingCall;
    if (incomingCall?.fromUser?._id) socket?.emit('call:decline', { toUserId: incomingCall.fromUser._id, sessionId: incomingCall.sessionId || null });
    get().cleanupCall();
  },

  endCall: () => {
    const socket = useAuthStore.getState().socket;
    const activeCallUser = get().activeCallUser;
    if (activeCallUser?._id) socket?.emit('call:end', { toUserId: activeCallUser._id, sessionId: get().sessionId || null });
    get().cleanupCall();
  },

  toggleMute: () => {
    const nextMuted = !get().isMuted;
    get().localStream?.getAudioTracks().forEach((track) => { track.enabled = !nextMuted; });
    set({ isMuted: nextMuted });
    get().syncMediaState();
  },

  toggleCamera: () => {
    if (get().callMode !== 'video') return;
    const videoTracks = get().localStream?.getVideoTracks() || [];
    if (!videoTracks.length) return;
    const nextEnabled = !get().isCameraEnabled;
    videoTracks.forEach((track) => { track.enabled = nextEnabled; });
    set({ isCameraEnabled: nextEnabled });
    get().syncMediaState();
  },

  toggleRecording: async () => {
    if (!get().localStream) return;
    if (get().isRecording) {
      get().stopRecording({ keepRecording: true });
      toast.success('Call recording saved locally for this session.');
      return;
    }
    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';
      const chunks = [];
      const recorder = new MediaRecorder(get().callMode === 'video' ? get().localStream : new MediaStream(get().localStream.getAudioTracks()), { mimeType });
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const nextUrl = URL.createObjectURL(blob);
        const previousUrl = get().recordingUrl;
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        set({ recordingUrl: nextUrl, recorder: null });
      };
      recorder.start(1000);
      const recordingTimer = window.setInterval(() => set((state) => ({ recordingSeconds: state.recordingSeconds + 1 })), 1000);
      set({ isRecording: true, recordingSeconds: 0, recorder, recordingTimer, recordingError: '' });
      get().syncMediaState();
    } catch (error) {
      console.error('Recording failed:', error);
      set({ recordingError: 'Recording is not supported on this device/browser.' });
      toast.error('Recording is not supported on this device/browser.');
    }
  },

  replaceVideoTrack: async (newTrack, { isScreenSharing = false } = {}) => {
    const { peerConnection, localStream } = get();
    const sender = peerConnection?.getSenders().find((item) => item.track?.kind === 'video');
    if (!sender) return;
    await sender.replaceTrack(newTrack);

    const nextStream = new MediaStream([...(localStream?.getAudioTracks() || []), newTrack]);
    set({ localStream: nextStream, previewStream: isScreenSharing ? new MediaStream([newTrack]) : nextStream, isScreenSharing, isCameraEnabled: newTrack.enabled });
    get().syncMediaState();
  },

  toggleScreenShare: async () => {
    if (get().callMode !== 'video') return;
    try {
      if (!get().isScreenSharing) {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const displayTrack = displayStream.getVideoTracks()[0];
        if (!displayTrack) return;
        displayTrack.onended = () => { if (get().isScreenSharing) get().toggleScreenShare(); };
        await get().replaceVideoTrack(displayTrack, { isScreenSharing: true });
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
    if (get().callMode !== 'video') return;
    if (!navigator.geolocation) {
      toast.error('Location sharing is not supported in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        get().notifyPeer({ type: 'location', payload: { lat: position.coords.latitude, lng: position.coords.longitude, sharedAt: new Date().toISOString() } });
        toast.success('Location shared in call.');
      },
      () => toast.error('Location access was denied.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  },

  startStroke: ({ x, y }) => {
    if (get().callMode !== 'video') return;
    const stroke = makeEmptyStroke({ color: get().drawingColor, width: get().drawingWidth });
    stroke.points.push({ x, y });
    set({ localDrawStroke: stroke });
  },
  extendStroke: ({ x, y }) => {
    if (get().callMode !== 'video') return;
    const stroke = get().localDrawStroke;
    if (!stroke) return;
    set({ localDrawStroke: { ...stroke, points: [...stroke.points, { x, y }] } });
  },
  finishStroke: () => {
    if (get().callMode !== 'video') return;
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
    ['call:incoming', 'call:accepted', 'call:declined', 'call:ended', 'call:signal', 'call:unavailable', 'call:resume', 'call:renegotiate', 'call:missed'].forEach((event) => socket.off(event));

    socket.on('call:incoming', ({ fromUserId, fromUser, media, sessionId }) => {
      if (get().activeCallUser?._id || get().incomingCall?.fromUserId) {
        socket.emit('call:decline', { toUserId: fromUserId, sessionId });
        return;
      }
      set({ incomingCall: { fromUserId, fromUser, media, sessionId }, callStatus: 'ringing', callMode: media?.video ? 'video' : 'voice', sessionId: sessionId || null });
      toast(`Incoming ${media?.video ? 'video' : 'voice'} call from @${fromUser?.username || 'user'}`);
    });

    socket.on('call:accepted', async ({ fromUserId, media, sessionId }) => {
      const activeCallUser = get().activeCallUser;
      if (!activeCallUser || activeCallUser._id !== fromUserId) return;
      set({ callMode: media?.video ? 'video' : 'voice', sessionId: sessionId || get().sessionId });
      try {
        await get().createOfferFor(fromUserId);
      } catch (error) {
        console.error('Error creating offer:', error);
        toast.error(media?.video ? 'Could not connect the video call.' : 'Could not connect the voice call.');
        get().endCall();
      }
    });

    socket.on('call:signal', async ({ fromUserId, description, candidate }) => {
      try {
        let peerConnection = get().peerConnection;
        if (!peerConnection) peerConnection = await get().createPeerConnection(fromUserId, { createDataChannel: false });
        if (description) {
          if (!peerConnection.currentRemoteDescription || peerConnection.currentRemoteDescription.type !== description.type) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
          }
          if (description.type === 'offer') {
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('call:signal', { toUserId: fromUserId, description: peerConnection.localDescription });
          }
          set({ callStatus: 'connected' });
          get().syncMediaState();
        }
        if (candidate) await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error handling call signal:', error);
        toast.error(get().callMode === 'video' ? 'Video call connection was interrupted.' : 'Voice call connection was interrupted.');
        get().cleanupCall();
      }
    });

    socket.on('call:resume', async ({ sessionId, otherUser, media, status, shouldRing }) => {
      if (!sessionId || !otherUser?._id) return;
      if (shouldRing) {
        set({ incomingCall: { fromUserId: otherUser._id, fromUser: otherUser, media, sessionId }, callStatus: 'ringing', callMode: media?.video ? 'video' : 'voice', sessionId });
        return;
      }
      if (status === 'active') await get().restoreActiveCall({ sessionId, otherUser, media });
    });

    socket.on('call:renegotiate', async ({ toUserId, media, sessionId }) => {
      if (get().activeCallUser?._id !== toUserId && get().activeCallUser?._id) return;
      set({ callMode: media?.video ? 'video' : 'voice', sessionId: sessionId || get().sessionId });
      try { await get().createOfferFor(toUserId); } catch (error) { console.error('Error renegotiating call:', error); }
    });

    socket.on('call:declined', () => {
      toast.error(get().callMode === 'video' ? 'Video call declined.' : 'Voice call declined.');
      get().cleanupCall();
    });
    socket.on('call:ended', () => {
      toast(get().callMode === 'video' ? 'Video call ended.' : 'Voice call ended.');
      get().cleanupCall();
    });
    socket.on('call:unavailable', () => {
      toast.error(get().callMode === 'video' ? 'This user is offline or unavailable for video calling.' : 'This user is offline or unavailable for voice calling.');
      get().cleanupCall();
    });
    socket.on('call:missed', (payload) => get().pushMissedCall(payload));

    socket.emit('call:resume:request');
  },

  unsubscribeFromCallEvents: () => {
    const socket = useAuthStore.getState().socket;
    ['call:incoming', 'call:accepted', 'call:declined', 'call:ended', 'call:signal', 'call:unavailable', 'call:resume', 'call:renegotiate', 'call:missed'].forEach((event) => socket?.off(event));
  },
}));
