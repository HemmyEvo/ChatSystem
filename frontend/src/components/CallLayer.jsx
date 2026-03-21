import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  CircleDot,
  Download,
  Eraser,
  MapPin,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneMissed,
  PhoneOff,
  Video,
} from 'lucide-react';
import { useCallStore } from '../store/useCallStore';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';

const formatDuration = (seconds = 0) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

const formatMissedAt = (value) =>
  new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const getStatusLabel = ({ incomingCall, callStatus, isVideoCall, connectionQuality, remoteMediaState }) => {
  if (incomingCall) return `Incoming ${isVideoCall ? 'video' : 'voice'} call`;
  if (callStatus === 'connected') {
    if (connectionQuality === 'unstable') return 'Poor connection';
    if (isVideoCall && remoteMediaState?.isScreenSharing) return 'Screen sharing';
    return 'Connected';
  }
  if (callStatus === 'calling') return 'Ringing';
  if (callStatus === 'reconnecting') return 'Reconnecting';
  if (callStatus === 'ringing') return `Incoming ${isVideoCall ? 'video' : 'voice'} call`;
  return 'Connecting';
};

const DrawingCanvas = ({ strokes, draftStroke, onPointerDown, onPointerMove, onPointerUp, enabled }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');

    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const drawStroke = (stroke) => {
      if (!stroke?.points?.length) return;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      stroke.points.forEach((point, index) => {
        const x = point.x * rect.width;
        const y = point.y * rect.height;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    strokes.forEach(drawStroke);
    if (draftStroke) drawStroke(draftStroke);
  }, [draftStroke, strokes]);

  const normalizePoint = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const point = 'touches' in event ? event.touches[0] : event;
    return {
      x: Math.min(Math.max((point.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((point.clientY - rect.top) / rect.height, 0), 1),
    };
  };

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 z-20 h-full w-full ${enabled ? 'touch-none' : 'pointer-events-none'}`}
      onMouseDown={(event) => enabled && onPointerDown(normalizePoint(event))}
      onMouseMove={(event) => enabled && onPointerMove(normalizePoint(event))}
      onMouseUp={() => enabled && onPointerUp()}
      onMouseLeave={() => enabled && onPointerUp()}
      onTouchStart={(event) => enabled && onPointerDown(normalizePoint(event))}
      onTouchMove={(event) => {
        if (!enabled) return;
        event.preventDefault();
        onPointerMove(normalizePoint(event));
      }}
      onTouchEnd={() => enabled && onPointerUp()}
    />
  );
};

function VideoSurface({ stream, muted = false, mirrored = false, fallbackAvatar, title, subtitle, rounded = 'rounded-[1.6rem]' }) {
  const videoRef = useRef(null);
  const attachStreamToElement = useCallStore((state) => state.attachStreamToElement);

  useEffect(() => {
    attachStreamToElement(videoRef.current, stream, { muted });
  }, [attachStreamToElement, muted, stream]);

  const hasVideo = Boolean(stream?.getVideoTracks?.().some((track) => track.readyState === 'live'));

  return (
    <div className={`relative h-full w-full overflow-hidden bg-[#111b21] ${rounded}`}>
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`absolute inset-0 h-full w-full object-cover ${mirrored ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top,#27353d,#111b21_70%)] px-4 text-center text-white">
          <img src={fallbackAvatar} alt={title} className="h-24 w-24 rounded-full object-cover shadow-2xl" />
          <div className="mt-4 text-xl font-medium">{title}</div>
          <div className="mt-1 text-sm text-white/70">{subtitle}</div>
        </div>
      )}
    </div>
  );
}

function RemoteAudio({ stream }) {
  const audioRef = useRef(null);
  const attachStreamToElement = useCallStore((state) => state.attachStreamToElement);

  useEffect(() => {
    attachStreamToElement(audioRef.current, stream);
  }, [attachStreamToElement, stream]);

  return <audio ref={audioRef} autoPlay playsInline />;
}

const CallBackdrop = ({ avatar }) => (
  <>
    <div className="absolute inset-0 bg-[#0b141a]" />
    <div
      className="absolute inset-[-10%] bg-cover bg-center opacity-35 blur-2xl saturate-[0.8]"
      style={{ backgroundImage: `url('${avatar}')` }}
    />
    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,20,26,0.48),rgba(11,20,26,0.82)_30%,rgba(11,20,26,0.96))]" />
  </>
);

const RoundControl = ({ onClick, icon, label, tone = 'default', size = 'md' }) => {
  const toneClass =
    tone === 'danger'
      ? 'bg-[#e53935] text-white'
      : tone === 'accept'
        ? 'bg-[#00a884] text-white'
        : tone === 'active'
          ? 'bg-white text-[#111b21]'
          : 'bg-white/16 text-white';

  const sizeClass = size === 'lg' ? 'h-16 w-16' : 'h-14 w-14';

  return (
    <button type="button" onClick={onClick} className="flex min-w-[70px] flex-col items-center gap-2 text-white">
      <span className={`flex ${sizeClass} items-center justify-center rounded-full shadow-lg backdrop-blur-md transition hover:scale-[1.03] ${toneClass}`}>
        {icon}
      </span>
      <span className="text-[11px] font-medium text-white/88">{label}</span>
    </button>
  );
};

const UtilityChip = ({ children }) => (
  <div className="inline-flex items-center gap-2 rounded-full bg-black/32 px-3 py-1.5 text-xs text-white/88 backdrop-blur-md">
    {children}
  </div>
);

function MissedCallsPanel({ missedCalls, clearMissedCalls }) {
  if (!missedCalls.length) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[121] w-[calc(100%-2rem)] max-w-sm rounded-[1.3rem] bg-[#202c33] p-4 text-white shadow-2xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[#ff6b6b]">
          <PhoneMissed size={18} />
          <h4 className="font-medium">Missed calls</h4>
        </div>
        <button type="button" onClick={clearMissedCalls} className="text-xs text-white/60 transition hover:text-white">
          Clear
        </button>
      </div>
      <div className="max-h-64 space-y-2 overflow-auto pr-1">
        {missedCalls.map((call) => (
          <div key={call.id} className="rounded-2xl bg-white/5 p-3">
            <div className="flex items-center gap-3">
              <img
                src={call.fromUser?.profilePicture || '/avatar.png'}
                alt={call.fromUser?.username || 'User'}
                className="h-11 w-11 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">@{call.fromUser?.username || 'user'}</div>
                <div className="text-xs text-white/65">
                  {call.media?.video ? 'Video call' : 'Voice call'} • {formatMissedAt(call.createdAt)}
                </div>
              </div>
              <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/70">
                {call.reason}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IncomingCallView({ incomingCall, acceptCall, declineCall }) {
  const avatar = incomingCall?.fromUser?.profilePicture || '/avatar.png';
  const username = incomingCall?.fromUser?.username || 'user';
  const isVideoCall = Boolean(incomingCall?.media?.video);

  return (
    <div className="fixed inset-0 z-[120] min-h-[100dvh] overflow-hidden text-white">
      <CallBackdrop avatar={avatar} />
      <div className="relative flex min-h-[100dvh] flex-col items-center justify-between px-6 pb-10 pt-12 text-center">
        <div className="w-full">
          <div className="text-sm font-medium text-white/72">Incoming {isVideoCall ? 'video' : 'voice'} call</div>
        </div>

        <div className="flex flex-col items-center">
          <img src={avatar} alt={username} className="h-32 w-32 rounded-full object-cover shadow-2xl ring-1 ring-white/10" />
          <h2 className="mt-6 text-[2.2rem] font-normal leading-none">{username}</h2>
          <p className="mt-3 text-sm text-white/72">{isVideoCall ? 'Video call' : 'Voice call'}</p>
        </div>

        <div className="flex items-end justify-center gap-10">
          <RoundControl onClick={declineCall} icon={<PhoneOff size={22} />} label="Decline" tone="danger" />
          <RoundControl
            onClick={acceptCall}
            icon={isVideoCall ? <Video size={22} /> : <Phone size={22} />}
            label="Accept"
            tone="accept"
          />
        </div>
      </div>
    </div>
  );
}

function VoiceCallView({ activeCallUser, remoteStream, callStatus, isMuted, acceptCall, declineCall, endCall, toggleMute, incomingCall, onMinimize }) {
  const avatar = incomingCall?.fromUser?.profilePicture || activeCallUser?.profilePicture || '/avatar.png';
  const username = incomingCall?.fromUser?.username || activeCallUser?.username || 'user';
  const status = getStatusLabel({
    incomingCall,
    callStatus,
    isVideoCall: false,
    connectionQuality: 'connected',
    remoteMediaState: {},
  });

  return (
    <div className="fixed inset-0 z-[120] min-h-[100dvh] overflow-hidden text-white">
      <RemoteAudio stream={remoteStream} />
      <CallBackdrop avatar={avatar} />
      <div className="relative flex min-h-[100dvh] flex-col items-center justify-between px-6 pb-10 pt-12 text-center">
        <div className="w-full">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm font-medium text-white/72">End-to-end encrypted</div>
            {!incomingCall && onMinimize && (
              <button
                type="button"
                onClick={onMinimize}
                className="rounded-full bg-white/10 px-4 py-2 text-xs text-white/88 transition hover:bg-white/15"
              >
                Back to chat
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center">
          <img src={avatar} alt={username} className="h-36 w-36 rounded-full object-cover shadow-2xl ring-1 ring-white/10" />
          <h2 className="mt-7 text-[2.45rem] font-normal leading-none">{username}</h2>
          <p className="mt-3 text-base text-white/72">{status}</p>
        </div>

        {incomingCall ? (
          <div className="flex items-end justify-center gap-10">
            <RoundControl onClick={declineCall} icon={<PhoneOff size={22} />} label="Decline" tone="danger" />
            <RoundControl onClick={acceptCall} icon={<Phone size={22} />} label="Accept" tone="accept" />
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-center gap-10">
            <RoundControl
              onClick={toggleMute}
              icon={isMuted ? <MicOff size={22} /> : <Mic size={22} />}
              label={isMuted ? 'Unmute' : 'Mute'}
              tone={isMuted ? 'active' : 'default'}
            />
            <RoundControl onClick={endCall} icon={<PhoneOff size={24} />} label="End" tone="danger" size="lg" />
          </div>
        )}
      </div>
    </div>
  );
}

function CompactVoiceCallWidget({ activeCallUser, remoteStream, callStatus, isMuted, toggleMute, endCall, onExpand }) {
  const avatar = activeCallUser?.profilePicture || '/avatar.png';
  const username = activeCallUser?.username || 'user';
  const status = getStatusLabel({
    incomingCall: null,
    callStatus,
    isVideoCall: false,
    connectionQuality: 'connected',
    remoteMediaState: {},
  });

  return (
    <div className="fixed right-4 top-4 z-[95] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#111b21]/95 text-white shadow-2xl backdrop-blur-xl">
      <RemoteAudio stream={remoteStream} />
      <button type="button" onClick={onExpand} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/5">
        <img src={avatar} alt={username} className="h-11 w-11 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{username}</div>
          <div className="text-xs text-white/62">{status}</div>
        </div>
        <span className="text-[11px] text-[#7ae582]">Open</span>
      </button>
      <div className="flex items-center justify-end gap-2 border-t border-white/10 px-3 py-3">
        <button
          type="button"
          onClick={toggleMute}
          className={`rounded-full px-3 py-2 text-xs transition ${isMuted ? 'bg-white text-[#111b21]' : 'bg-white/10 text-white'}`}
        >
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button
          type="button"
          onClick={endCall}
          className="rounded-full bg-[#e53935] px-4 py-2 text-xs text-white transition hover:bg-[#d32f2f]"
        >
          End
        </button>
      </div>
    </div>
  );
}

function VideoCallView({
  incomingCall,
  activeCallUser,
  remoteStream,
  previewStream,
  callStatus,
  isMuted,
  isCameraEnabled,
  isScreenSharing,
  isRecording,
  recordingSeconds,
  recordingUrl,
  remoteMediaState,
  remoteLocation,
  collaborativePaths,
  localDrawStroke,
  acceptCall,
  declineCall,
  endCall,
  toggleMute,
  toggleCamera,
  toggleScreenShare,
  toggleRecording,
  shareLocationInCall,
  startStroke,
  extendStroke,
  finishStroke,
  clearDrawings,
  isAnnotating,
  setIsAnnotating,
  onMinimize,
}) {
  const authUser = useAuthStore((state) => state.authUser);
  const peerUser = incomingCall?.fromUser || activeCallUser;
  const avatar = peerUser?.profilePicture || '/avatar.png';
  const username = peerUser?.username || 'user';
  const status = getStatusLabel({
    incomingCall,
    callStatus,
    isVideoCall: true,
    connectionQuality: remoteMediaState?.connectionQuality,
    remoteMediaState,
  });

  return (
    <div className="fixed inset-0 z-[120] min-h-[100dvh] overflow-hidden bg-black text-white">
      <RemoteAudio stream={remoteStream} />

      <div className="absolute inset-0">
        <VideoSurface
          stream={remoteStream}
          fallbackAvatar={avatar}
          title={username}
          subtitle={status}
          rounded="rounded-none"
        />
      </div>

      <DrawingCanvas
        strokes={collaborativePaths}
        draftStroke={localDrawStroke}
        enabled={isAnnotating}
        onPointerDown={startStroke}
        onPointerMove={extendStroke}
        onPointerUp={finishStroke}
      />

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.45),transparent_18%,transparent_72%,rgba(0,0,0,0.7))]" />

      <div className="relative flex min-h-[100dvh] flex-col justify-between px-4 pb-7 pt-4 sm:px-6 sm:pb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-[70%]">
            <div className="text-[1.65rem] font-normal leading-none drop-shadow-lg sm:text-[1.9rem]">{username}</div>
            <div className="mt-2 text-sm text-white/74">{status}</div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {onMinimize && (
              <button
                type="button"
                onClick={onMinimize}
                className="rounded-full bg-black/32 px-4 py-2 text-xs text-white/88 backdrop-blur-md transition hover:bg-black/45"
              >
                Back to chat
              </button>
            )}
            <div className="h-32 w-24 overflow-hidden rounded-[1.1rem] border border-white/15 bg-[#111b21] shadow-2xl sm:h-40 sm:w-28">
              <VideoSurface
                stream={previewStream}
                fallbackAvatar={authUser?.profilePicture || '/avatar.png'}
                title="You"
                subtitle={isScreenSharing ? 'Sharing screen' : 'You'}
                muted
                mirrored={!isScreenSharing}
                rounded="rounded-none"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {isRecording && (
              <UtilityChip>
                <CircleDot size={12} /> Recording {formatDuration(recordingSeconds)}
              </UtilityChip>
            )}
            {remoteMediaState.isRecording && (
              <UtilityChip>
                <CircleDot size={12} /> They are recording
              </UtilityChip>
            )}
            {recordingUrl && (
              <a
                href={recordingUrl}
                download="call-recording.webm"
                className="inline-flex items-center gap-2 rounded-full bg-black/32 px-3 py-1.5 text-xs text-white/88 backdrop-blur-md"
              >
                <Download size={12} /> Download
              </a>
            )}
            {remoteLocation && (
              <a
                href={`https://www.google.com/maps?q=${remoteLocation.lat},${remoteLocation.lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-black/32 px-3 py-1.5 text-xs text-white/88 backdrop-blur-md"
              >
                <MapPin size={12} /> Location
              </a>
            )}
          </div>

          {incomingCall ? (
            <div className="flex items-end justify-center gap-10">
              <RoundControl onClick={declineCall} icon={<PhoneOff size={22} />} label="Decline" tone="danger" />
              <RoundControl onClick={acceptCall} icon={<Video size={22} />} label="Accept" tone="accept" />
            </div>
          ) : (
            <div className="w-full max-w-3xl space-y-3">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={toggleScreenShare}
                  className={`rounded-full px-3 py-1.5 text-xs transition ${isScreenSharing ? 'bg-white text-[#111b21]' : 'bg-black/32 text-white/85 backdrop-blur-md'}`}
                >
                  <span className="inline-flex items-center gap-1.5"><MonitorUp size={12} /> Screen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAnnotating((value) => !value)}
                  className={`rounded-full px-3 py-1.5 text-xs transition ${isAnnotating ? 'bg-white text-[#111b21]' : 'bg-black/32 text-white/85 backdrop-blur-md'}`}
                >
                  <span className="inline-flex items-center gap-1.5"><Eraser size={12} /> Draw</span>
                </button>
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`rounded-full px-3 py-1.5 text-xs transition ${isRecording ? 'bg-white text-[#111b21]' : 'bg-black/32 text-white/85 backdrop-blur-md'}`}
                >
                  <span className="inline-flex items-center gap-1.5"><CircleDot size={12} /> Record</span>
                </button>
                <button
                  type="button"
                  onClick={shareLocationInCall}
                  className="rounded-full bg-black/32 px-3 py-1.5 text-xs text-white/85 backdrop-blur-md"
                >
                  <span className="inline-flex items-center gap-1.5"><MapPin size={12} /> Location</span>
                </button>
                <button
                  type="button"
                  onClick={clearDrawings}
                  className="rounded-full bg-black/32 px-3 py-1.5 text-xs text-white/85 backdrop-blur-md"
                >
                  <span className="inline-flex items-center gap-1.5"><Eraser size={12} /> Clear</span>
                </button>
              </div>

              <div className="mx-auto flex max-w-xl items-start justify-center gap-8 rounded-[1.8rem] bg-black/28 px-5 py-4 backdrop-blur-xl">
                <RoundControl
                  onClick={toggleCamera}
                  icon={isCameraEnabled ? <Camera size={22} /> : <CameraOff size={22} />}
                  label={isCameraEnabled ? 'Camera' : 'Camera off'}
                  tone={!isCameraEnabled ? 'active' : 'default'}
                />
                <RoundControl
                  onClick={endCall}
                  icon={<PhoneOff size={24} />}
                  label="End"
                  tone="danger"
                  size="lg"
                />
                <RoundControl
                  onClick={toggleMute}
                  icon={isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                  label={isMuted ? 'Unmute' : 'Mute'}
                  tone={isMuted ? 'active' : 'default'}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CompactVideoCallWidget({
  activeCallUser,
  remoteStream,
  previewStream,
  callStatus,
  isMuted,
  isCameraEnabled,
  endCall,
  toggleMute,
  onExpand,
}) {
  const authUser = useAuthStore((state) => state.authUser);
  const username = activeCallUser?.username || 'user';
  const status = getStatusLabel({
    incomingCall: null,
    callStatus,
    isVideoCall: true,
    connectionQuality: 'connected',
    remoteMediaState: {},
  });

  return (
    <div className="fixed bottom-4 right-4 z-[95] w-[170px] overflow-hidden rounded-[1.3rem] border border-white/10 bg-[#111b21] text-white shadow-2xl">
      <RemoteAudio stream={remoteStream} />
      <button type="button" onClick={onExpand} className="relative block h-[220px] w-full text-left">
        <VideoSurface
          stream={remoteStream}
          fallbackAvatar={activeCallUser?.profilePicture || '/avatar.png'}
          title={username}
          subtitle={status}
          rounded="rounded-none"
        />
        <div className="absolute right-2 top-2 h-12 w-9 overflow-hidden rounded-[0.7rem] border border-white/20 bg-black/30 shadow-lg">
          <VideoSurface
            stream={previewStream}
            fallbackAvatar={authUser?.profilePicture || '/avatar.png'}
            title="You"
            subtitle=""
            muted
            mirrored={isCameraEnabled}
            rounded="rounded-none"
          />
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-3 pt-8">
          <div className="truncate text-sm font-medium">{username}</div>
          <div className="truncate text-[11px] text-white/68">{status}</div>
        </div>
      </button>
      <div className="flex items-center justify-between gap-2 border-t border-white/10 px-2 py-2">
        <button
          type="button"
          onClick={toggleMute}
          className={`rounded-full px-3 py-1.5 text-[11px] transition ${isMuted ? 'bg-white text-[#111b21]' : 'bg-white/10 text-white'}`}
        >
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button
          type="button"
          onClick={endCall}
          className="rounded-full bg-[#e53935] px-3 py-1.5 text-[11px] text-white transition hover:bg-[#d32f2f]"
        >
          End
        </button>
      </div>
    </div>
  );
}

function CallLayer() {
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    incomingCall,
    activeCallUser,
    remoteStream,
    previewStream,
    callStatus,
    callMode,
    isMuted,
    isCameraEnabled,
    isScreenSharing,
    isRecording,
    recordingSeconds,
    recordingUrl,
    remoteMediaState,
    remoteLocation,
    collaborativePaths,
    localDrawStroke,
    missedCalls,
    connectionQuality,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    toggleRecording,
    shareLocationInCall,
    startStroke,
    extendStroke,
    finishStroke,
    clearDrawings,
    clearMissedCalls,
  } = useCallStore();
  const ringtone = useChatStore((state) => state.ringtone);

  useEffect(() => {
    if (!incomingCall) return undefined;
    const ringAudio = new Audio(ringtone || '/sounds/notification.mp3');
    ringAudio.loop = true;
    ringAudio.play().catch(() => {});
    return () => {
      ringAudio.pause();
      ringAudio.currentTime = 0;
    };
  }, [incomingCall, ringtone]);

  useEffect(() => {
    if (incomingCall) {
      setIsExpanded(true);
      return;
    }
    if (activeCallUser?._id) {
      setIsExpanded(false);
      return;
    }
    setIsExpanded(false);
  }, [activeCallUser?._id, incomingCall]);

  const effectiveMode = incomingCall?.media?.video ? 'video' : activeCallUser ? callMode : 'voice';
  const isVideoCall = effectiveMode === 'video';

  const mergedRemoteState = useMemo(
    () => ({ ...remoteMediaState, connectionQuality }),
    [connectionQuality, remoteMediaState],
  );

  if (!incomingCall && !activeCallUser) {
    return <MissedCallsPanel missedCalls={missedCalls} clearMissedCalls={clearMissedCalls} />;
  }

  if (incomingCall && !isVideoCall) {
    return (
      <>
        <VoiceCallView
          incomingCall={incomingCall}
          activeCallUser={activeCallUser}
          remoteStream={remoteStream}
          callStatus={callStatus}
          isMuted={isMuted}
          acceptCall={acceptCall}
          declineCall={declineCall}
          endCall={endCall}
          toggleMute={toggleMute}
        />
        <MissedCallsPanel missedCalls={missedCalls} clearMissedCalls={clearMissedCalls} />
      </>
    );
  }

  if (incomingCall && isVideoCall) {
    return (
      <>
        <IncomingCallView incomingCall={incomingCall} acceptCall={acceptCall} declineCall={declineCall} />
        <MissedCallsPanel missedCalls={missedCalls} clearMissedCalls={clearMissedCalls} />
      </>
    );
  }

  if (!isVideoCall) {
    if (!isExpanded) {
      return (
        <>
          <CompactVoiceCallWidget
            activeCallUser={activeCallUser}
            remoteStream={remoteStream}
            callStatus={callStatus}
            isMuted={isMuted}
            toggleMute={toggleMute}
            endCall={endCall}
            onExpand={() => setIsExpanded(true)}
          />
          <MissedCallsPanel missedCalls={missedCalls} clearMissedCalls={clearMissedCalls} />
        </>
      );
    }
    return (
      <>
        <VoiceCallView
          incomingCall={incomingCall}
          activeCallUser={activeCallUser}
          remoteStream={remoteStream}
          callStatus={callStatus}
          isMuted={isMuted}
          acceptCall={acceptCall}
          declineCall={declineCall}
          endCall={endCall}
          toggleMute={toggleMute}
          onMinimize={() => setIsExpanded(false)}
        />
        <MissedCallsPanel missedCalls={missedCalls} clearMissedCalls={clearMissedCalls} />
      </>
    );
  }

  return (
    <>
      {isExpanded ? (
        <VideoCallView
          incomingCall={incomingCall}
          activeCallUser={activeCallUser}
          remoteStream={remoteStream}
          previewStream={previewStream}
          callStatus={callStatus}
          isMuted={isMuted}
          isCameraEnabled={isCameraEnabled}
          isScreenSharing={isScreenSharing}
          isRecording={isRecording}
          recordingSeconds={recordingSeconds}
          recordingUrl={recordingUrl}
          remoteMediaState={mergedRemoteState}
          remoteLocation={remoteLocation}
          collaborativePaths={collaborativePaths}
          localDrawStroke={localDrawStroke}
          acceptCall={acceptCall}
          declineCall={declineCall}
          endCall={endCall}
          toggleMute={toggleMute}
          toggleCamera={toggleCamera}
          toggleScreenShare={toggleScreenShare}
          toggleRecording={toggleRecording}
          shareLocationInCall={shareLocationInCall}
          startStroke={startStroke}
          extendStroke={extendStroke}
          finishStroke={finishStroke}
          clearDrawings={clearDrawings}
          isAnnotating={isAnnotating}
          setIsAnnotating={setIsAnnotating}
          onMinimize={() => setIsExpanded(false)}
        />
      ) : (
        <CompactVideoCallWidget
          activeCallUser={activeCallUser}
          remoteStream={remoteStream}
          previewStream={previewStream}
          callStatus={callStatus}
          isMuted={isMuted}
          isCameraEnabled={isCameraEnabled}
          endCall={endCall}
          toggleMute={toggleMute}
          onExpand={() => setIsExpanded(true)}
        />
      )}
      <MissedCallsPanel missedCalls={missedCalls} clearMissedCalls={clearMissedCalls} />
    </>
  );
}

export default CallLayer;
