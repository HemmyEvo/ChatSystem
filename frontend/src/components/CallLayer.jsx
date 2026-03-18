import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Eraser,
  MapPin,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
} from 'lucide-react';
import { useCallStore } from '../store/useCallStore';
import { useAuthStore } from '../store/useAuthStore';

const DrawingCanvas = ({ strokes, draftStroke, onPointerDown, onPointerMove, onPointerUp }) => {
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
  }, [strokes, draftStroke]);

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
      className="absolute inset-0 h-full w-full touch-none"
      onMouseDown={(event) => onPointerDown(normalizePoint(event))}
      onMouseMove={(event) => onPointerMove(normalizePoint(event))}
      onMouseUp={onPointerUp}
      onMouseLeave={onPointerUp}
      onTouchStart={(event) => onPointerDown(normalizePoint(event))}
      onTouchMove={(event) => {
        event.preventDefault();
        onPointerMove(normalizePoint(event));
      }}
      onTouchEnd={onPointerUp}
    />
  );
};

function VideoSurface({ stream, muted = false, mirrored = false, fallbackAvatar, title, subtitle }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null;
  }, [stream]);

  const hasVideo = Boolean(stream?.getVideoTracks?.().some((track) => track.readyState === 'live' && track.enabled));

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 shadow-2xl">
      {hasVideo ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} className={`h-full min-h-[240px] w-full object-cover ${mirrored ? 'scale-x-[-1]' : ''}`} />
      ) : (
        <div className="flex min-h-[240px] h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,#22d3ee22,transparent_50%),linear-gradient(135deg,#0f172a,#020617)] p-6 text-center">
          <img src={fallbackAvatar} alt={title} className="mb-4 h-24 w-24 rounded-full object-cover ring-4 ring-white/10" />
          <div className="text-lg font-semibold text-white">{title}</div>
          <div className="mt-1 text-sm text-slate-300">{subtitle}</div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="text-xs text-slate-300">{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

function VoiceCallCard({ incomingCall, activeCallUser, remoteStream, callStatus, isMuted, acceptCall, declineCall, endCall, toggleMute }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = remoteStream || null;
  }, [remoteStream]);

  const subtitle = useMemo(() => {
    if (incomingCall) return incomingCall.media?.video === false ? 'Incoming voice call' : 'Incoming video call';
    if (callStatus === 'connected') return 'Connected in real time';
    if (callStatus === 'reconnecting') return 'Reconnecting voice call...';
    if (callStatus === 'calling') return 'Calling...';
    if (callStatus === 'connecting') return 'Connecting secure media...';
    return 'Preparing your call...';
  }, [callStatus, incomingCall]);

  if (!incomingCall && !activeCallUser) return <audio ref={audioRef} autoPlay playsInline />;

  const avatar = incomingCall?.fromUser?.profilePicture || activeCallUser?.profilePicture || '/avatar.png';
  const title = incomingCall ? `@${incomingCall.fromUser?.username || 'user'}` : `@${activeCallUser?.username || 'user'}`;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/85 p-3 text-white backdrop-blur-xl md:p-6">
      <audio ref={audioRef} autoPlay playsInline />
      <div className="mx-auto flex h-full max-w-4xl flex-col gap-4 rounded-[32px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_0_80px_rgba(34,211,238,0.12)] md:p-6">
        <div className="flex items-center gap-4">
          <img src={avatar} alt="caller avatar" className="h-14 w-14 rounded-full object-cover ring-2 ring-cyan-400/30" />
          <div>
            <div className="text-xl font-semibold">{title}</div>
            <div className="text-sm text-slate-300">{subtitle}</div>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-8 rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,#22d3ee18,transparent_45%),linear-gradient(160deg,#020617,#0f172a)] p-8 text-center">
          <img src={avatar} alt="caller" className="h-28 w-28 rounded-full object-cover ring-4 ring-cyan-400/20" />
          <div>
            <div className="text-3xl font-semibold">{incomingCall ? `${title} is calling` : title}</div>
            <div className="mt-2 text-slate-300">{subtitle}</div>
          </div>

          <div className="flex items-center gap-4">
            {incomingCall ? (
              <>
                <button type="button" onClick={declineCall} className="rounded-full bg-red-500 p-5 text-white transition hover:bg-red-600"><PhoneOff size={24} /></button>
                <button type="button" onClick={acceptCall} className="rounded-full bg-emerald-500 p-5 text-white transition hover:bg-emerald-600"><Phone size={24} /></button>
              </>
            ) : (
              <>
                <button type="button" onClick={toggleMute} className="rounded-full bg-slate-800 p-5 text-white transition hover:bg-slate-700">
                  {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
                <button type="button" onClick={endCall} className="rounded-full bg-red-500 p-5 text-white transition hover:bg-red-600"><PhoneOff size={24} /></button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CallLayer() {
  const [isAnnotating, setIsAnnotating] = useState(false);
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
    shareLocationInCall,
    startStroke,
    extendStroke,
    finishStroke,
    clearDrawings,
  } = useCallStore();
  const authUser = useAuthStore((state) => state.authUser);

  const effectiveMode = incomingCall?.media?.video ? 'video' : activeCallUser ? callMode : 'voice';
  const isVideoCall = effectiveMode === 'video';

  const subtitle = useMemo(() => {
    if (incomingCall) return 'Incoming video call';
    if (callStatus === 'connected') return isScreenSharing ? 'Connected with screen sharing' : 'Connected in real time';
    if (callStatus === 'reconnecting') return 'Reconnecting your video call...';
    if (callStatus === 'calling') return 'Calling...';
    return 'Connecting media...';
  }, [callStatus, incomingCall, isScreenSharing]);

  if (!incomingCall && !activeCallUser) return null;

  if (!isVideoCall) {
    return (
      <VoiceCallCard
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
    );
  }

  const avatar = incomingCall?.fromUser?.profilePicture || activeCallUser?.profilePicture || '/avatar.png';
  const title = incomingCall ? `@${incomingCall.fromUser?.username || 'user'}` : `@${activeCallUser?.username || 'user'}`;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/90 p-3 text-white backdrop-blur-xl md:p-6">
      <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 rounded-[32px] border border-white/10 bg-slate-900/80 p-4 shadow-[0_0_80px_rgba(34,211,238,0.12)] md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src={avatar} alt="caller avatar" className="h-14 w-14 rounded-full object-cover ring-2 ring-cyan-400/30" />
            <div>
              <div className="text-xl font-semibold">{title}</div>
              <div className="text-sm text-slate-300">{subtitle}</div>
            </div>
          </div>
          {remoteLocation && (
            <a href={`https://www.google.com/maps?q=${remoteLocation.lat},${remoteLocation.lng}`} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-400/20 md:inline-flex">
              <MapPin size={16} /> {remoteLocation.lat.toFixed(3)}, {remoteLocation.lng.toFixed(3)}
            </a>
          )}
        </div>

        {incomingCall ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,#22d3ee18,transparent_45%),linear-gradient(160deg,#020617,#0f172a)] p-8 text-center">
            <img src={avatar} alt="incoming caller" className="h-28 w-28 rounded-full object-cover ring-4 ring-cyan-400/20" />
            <div>
              <div className="text-3xl font-semibold">{title} is calling</div>
              <div className="mt-2 text-slate-300">Incoming video call</div>
            </div>
            <div className="flex items-center gap-4">
              <button type="button" onClick={declineCall} className="rounded-full bg-red-500 p-5 text-white transition hover:bg-red-600"><PhoneOff size={24} /></button>
              <button type="button" onClick={acceptCall} className="rounded-full bg-emerald-500 p-5 text-white transition hover:bg-emerald-600"><Phone size={24} /></button>
            </div>
          </div>
        ) : (
          <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
              <div className="relative min-h-[320px] overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/60">
                <VideoSurface
                  stream={remoteStream}
                  fallbackAvatar={avatar}
                  title={`@${activeCallUser?.username || 'user'}`}
                  subtitle={remoteMediaState.isScreenSharing ? 'Sharing screen' : remoteMediaState.isCameraEnabled ? 'Camera on' : 'Audio only'}
                />
                <DrawingCanvas
                  strokes={collaborativePaths}
                  draftStroke={localDrawStroke}
                  onPointerDown={(point) => isAnnotating && startStroke(point)}
                  onPointerMove={(point) => isAnnotating && extendStroke(point)}
                  onPointerUp={() => isAnnotating && finishStroke()}
                />
              </div>

              <div className="grid gap-4">
                <VideoSurface
                  stream={previewStream}
                  fallbackAvatar={authUser?.profilePicture || '/avatar.png'}
                  title="You"
                  subtitle={isScreenSharing ? 'Sharing your screen' : isCameraEnabled ? 'Camera on' : 'Camera off'}
                  muted
                  mirrored={!isScreenSharing}
                />

                <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-4">
                  <div className="mb-3 text-sm font-semibold text-slate-100">Collaboration tools</div>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={toggleScreenShare} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10"><MonitorUp size={18} className="mb-2 text-cyan-300" /><div className="text-sm font-medium">{isScreenSharing ? 'Stop sharing' : 'Share screen'}</div></button>
                    <button type="button" onClick={shareLocationInCall} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10"><MapPin size={18} className="mb-2 text-amber-300" /><div className="text-sm font-medium">Share location</div></button>
                    <button type="button" onClick={() => setIsAnnotating((value) => !value)} className={`rounded-2xl border p-3 text-left transition ${isAnnotating ? 'border-cyan-400/40 bg-cyan-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}><Video size={18} className="mb-2 text-cyan-300" /><div className="text-sm font-medium">{isAnnotating ? 'Drawing on' : 'Draw together'}</div></button>
                    <button type="button" onClick={clearDrawings} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10"><Eraser size={18} className="mb-2 text-rose-300" /><div className="text-sm font-medium">Clear canvas</div></button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-[28px] border border-white/10 bg-slate-950/60 p-5">
              <div>
                <div className="text-sm uppercase tracking-[0.3em] text-slate-400">Video call</div>
                <div className="mt-2 text-2xl font-semibold">Realtime studio</div>
                <p className="mt-2 text-sm text-slate-300">Video calling now uses a separate workspace while voice calling keeps the original lightweight popup.</p>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button type="button" onClick={toggleMute} className="rounded-full bg-slate-800 p-4 text-white transition hover:bg-slate-700">{isMuted ? <MicOff size={20} /> : <Mic size={20} />}</button>
                <button type="button" onClick={toggleCamera} className="rounded-full bg-slate-800 p-4 text-white transition hover:bg-slate-700">{isCameraEnabled ? <Camera size={20} /> : <CameraOff size={20} />}</button>
                <button type="button" onClick={toggleScreenShare} className="rounded-full bg-slate-800 p-4 text-white transition hover:bg-slate-700"><MonitorUp size={20} /></button>
                <button type="button" onClick={endCall} className="rounded-full bg-red-500 p-4 text-white transition hover:bg-red-600"><PhoneOff size={20} /></button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CallLayer;
