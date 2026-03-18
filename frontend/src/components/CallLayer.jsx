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
  Radio,
  Video,
} from 'lucide-react';
import { useCallStore } from '../store/useCallStore';
import { useAuthStore } from '../store/useAuthStore';

const formatDuration = (seconds = 0) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

const formatMissedAt = (value) => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const useIsMobileViewport = () => {
  const getMatches = () => (typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [isMobileViewport, setIsMobileViewport] = useState(getMatches);

  useEffect(() => {
    const handleResize = () => setIsMobileViewport(getMatches());
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobileViewport;
};

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
    return { x: Math.min(Math.max((point.clientX - rect.left) / rect.width, 0), 1), y: Math.min(Math.max((point.clientY - rect.top) / rect.height, 0), 1) };
  };

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-10 h-full w-full touch-none"
      onMouseDown={(event) => onPointerDown(normalizePoint(event))}
      onMouseMove={(event) => onPointerMove(normalizePoint(event))}
      onMouseUp={onPointerUp}
      onMouseLeave={onPointerUp}
      onTouchStart={(event) => onPointerDown(normalizePoint(event))}
      onTouchMove={(event) => { event.preventDefault(); onPointerMove(normalizePoint(event)); }}
      onTouchEnd={onPointerUp}
    />
  );
};

function VideoSurface({ stream, muted = false, mirrored = false, fallbackAvatar, title, subtitle }) {
  const videoRef = useRef(null);
  const attachStreamToElement = useCallStore((state) => state.attachStreamToElement);
  useEffect(() => {
    attachStreamToElement(videoRef.current, stream, { muted });
  }, [attachStreamToElement, muted, stream]);
  const hasVideo = Boolean(stream?.getVideoTracks?.().some((track) => track.readyState === 'live'));

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.5rem] bg-slate-900">
      {hasVideo ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} className={`absolute inset-0 h-full w-full object-cover ${mirrored ? 'scale-x-[-1]' : ''}`} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top,#1e293b,#020617)] px-4 text-center">
          <img src={fallbackAvatar} alt={title} className="h-20 w-20 rounded-full border border-white/10 object-cover shadow-2xl md:h-24 md:w-24" />
          <div className="mt-4 text-lg font-semibold text-white">{title}</div>
          <div className="text-sm text-slate-300">{subtitle}</div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-slate-300">{subtitle}</div>
      </div>
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

const ActionButton = ({ active, danger, onClick, icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex min-w-[72px] flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-xs font-medium transition sm:min-w-[82px] ${danger ? 'border-rose-500/30 bg-rose-500 text-white hover:bg-rose-600' : active ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-100 hover:bg-white/10'}`}
  >
    <span>{icon}</span>
    <span>{label}</span>
  </button>
);

function MissedCallsPanel({ missedCalls, clearMissedCalls }) {
  if (!missedCalls.length) return null;
  return (
    <div className="fixed bottom-4 left-4 z-[121] w-[calc(100%-2rem)] max-w-sm rounded-3xl border border-amber-500/30 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur-xl sm:w-96">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-amber-300">
          <PhoneMissed size={18} />
          <h4 className="font-semibold">Missed calls</h4>
        </div>
        <button type="button" onClick={clearMissedCalls} className="text-xs text-slate-400 transition hover:text-white">Clear</button>
      </div>
      <div className="max-h-64 space-y-2 overflow-auto pr-1">
        {missedCalls.map((call) => (
          <div key={call.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-3">
              <img src={call.fromUser?.profilePicture || '/avatar.png'} alt={call.fromUser?.username || 'User'} className="h-11 w-11 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">@{call.fromUser?.username || 'user'}</div>
                <div className="text-xs text-slate-300">{call.media?.video ? 'Video call' : 'Voice call'} • {formatMissedAt(call.createdAt)}</div>
              </div>
              <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">{call.reason}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IncomingCallView({ incomingCall, acceptCall, declineCall }) {
  const avatar = incomingCall?.fromUser?.profilePicture || '/avatar.png';
  return (
    <div className="fixed inset-0 z-[120] flex min-h-[100dvh] items-center justify-center bg-slate-950/95 p-4 text-white backdrop-blur-2xl">
      <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-cyan-200">
            <Radio size={14} /> Incoming {incomingCall?.media?.video ? 'video' : 'voice'} call
          </div>
          <img src={avatar} alt={incomingCall?.fromUser?.username} className="mx-auto mt-5 h-24 w-24 rounded-full object-cover ring-4 ring-white/10 sm:h-28 sm:w-28" />
          <h2 className="mt-4 text-3xl font-bold">@{incomingCall?.fromUser?.username || 'user'}</h2>
          <p className="mt-2 text-sm text-slate-300">Answer to start a crystal-clear {incomingCall?.media?.video ? 'video' : 'voice'} call.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ActionButton danger onClick={declineCall} icon={<PhoneOff size={20} />} label="Decline" />
          <ActionButton active onClick={acceptCall} icon={incomingCall?.media?.video ? <Video size={20} /> : <Phone size={20} />} label="Accept" />
        </div>
      </div>
    </div>
  );
}

function VoiceCallView({ activeCallUser, remoteStream, callStatus, isMuted, acceptCall, declineCall, endCall, toggleMute, incomingCall }) {
  const audioRef = useRef(null);
  const attachStreamToElement = useCallStore((state) => state.attachStreamToElement);
  useEffect(() => {
    attachStreamToElement(audioRef.current, remoteStream);
  }, [attachStreamToElement, remoteStream]);
  const subtitle = useMemo(() => {
    if (incomingCall) return 'Incoming voice call';
    if (callStatus === 'connected') return 'Connected';
    if (callStatus === 'reconnecting') return 'Reconnecting';
    if (callStatus === 'calling') return 'Calling';
    return 'Connecting';
  }, [callStatus, incomingCall]);
  const avatar = incomingCall?.fromUser?.profilePicture || activeCallUser?.profilePicture || '/avatar.png';
  const username = incomingCall?.fromUser?.username || activeCallUser?.username || 'user';
  return (
    <div className="fixed inset-0 z-[120] flex min-h-[100dvh] items-center justify-center bg-slate-950/95 p-4 text-white backdrop-blur-2xl">
      <audio ref={audioRef} autoPlay playsInline />
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.95))] p-6 shadow-2xl">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-300">{subtitle}</div>
          <img src={avatar} alt={username} className="mx-auto mt-6 h-24 w-24 rounded-full object-cover ring-4 ring-white/10" />
          <h2 className="mt-4 text-3xl font-bold">@{username}</h2>
          <p className="mt-2 text-sm text-slate-300">Voice-first layout with reliable microphone controls.</p>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {incomingCall ? (
            <>
              <ActionButton danger onClick={declineCall} icon={<PhoneOff size={20} />} label="Decline" />
              <ActionButton active onClick={acceptCall} icon={<Phone size={20} />} label="Accept" />
            </>
          ) : (
            <>
              <ActionButton active={isMuted} onClick={toggleMute} icon={isMuted ? <MicOff size={20} /> : <Mic size={20} />} label={isMuted ? 'Unmute' : 'Mute'} />
              <ActionButton danger onClick={endCall} icon={<PhoneOff size={20} />} label="End call" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CallLayer() {
  const [isAnnotating, setIsAnnotating] = useState(false);
  const isMobileViewport = useIsMobileViewport();
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
    getConnectionLabel,
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
  const authUser = useAuthStore((state) => state.authUser);

  const effectiveMode = incomingCall?.media?.video ? 'video' : activeCallUser ? callMode : 'voice';
  const isVideoCall = effectiveMode === 'video';
  const peerUser = incomingCall?.fromUser || activeCallUser;
  const avatar = peerUser?.profilePicture || '/avatar.png';
  const title = `@${peerUser?.username || 'user'}`;
  const connectionLabel = getConnectionLabel();
  const remoteSubtitle = useMemo(() => {
    if (callStatus === 'connected') {
      if (connectionQuality === 'unstable') return 'Unstable connection';
      return remoteMediaState.isScreenSharing ? 'Sharing screen' : remoteMediaState.isCameraEnabled ? 'Live camera' : 'Audio only';
    }
    if (callStatus === 'calling') return 'Ringing';
    if (callStatus === 'reconnecting') return 'Reconnecting';
    return 'Preparing media';
  }, [callStatus, connectionQuality, remoteMediaState.isCameraEnabled, remoteMediaState.isScreenSharing]);

  if (!incomingCall && !activeCallUser) return <MissedCallsPanel missedCalls={missedCalls} clearMissedCalls={clearMissedCalls} />;
  if (incomingCall && isVideoCall) return <><IncomingCallView incomingCall={incomingCall} acceptCall={acceptCall} declineCall={declineCall} /><MissedCallsPanel missedCalls={missedCalls} clearMissedCalls={clearMissedCalls} /></>;
  if (!isVideoCall) return <><VoiceCallView incomingCall={incomingCall} activeCallUser={activeCallUser} remoteStream={remoteStream} callStatus={callStatus} isMuted={isMuted} acceptCall={acceptCall} declineCall={declineCall} endCall={endCall} toggleMute={toggleMute} /><MissedCallsPanel missedCalls={missedCalls} clearMissedCalls={clearMissedCalls} /></>;

  const renderToolButtons = (compact = false) => (
    <>
      <ActionButton active={isMuted} onClick={toggleMute} icon={isMuted ? <MicOff size={20} /> : <Mic size={20} />} label={isMuted ? 'Unmute' : 'Mute'} />
      <ActionButton active={!isCameraEnabled} onClick={toggleCamera} icon={isCameraEnabled ? <Camera size={20} /> : <CameraOff size={20} />} label={isCameraEnabled ? 'Camera on' : 'Camera off'} />
      <ActionButton active={isScreenSharing} onClick={toggleScreenShare} icon={<MonitorUp size={20} />} label={compact ? 'Screen' : 'Share screen'} />
      <ActionButton active={isAnnotating} onClick={() => setIsAnnotating((value) => !value)} icon={<Video size={20} />} label={isAnnotating ? 'Drawing on' : 'Draw'} />
      <ActionButton active={isRecording} onClick={toggleRecording} icon={<CircleDot size={20} />} label={isRecording ? 'Stop rec' : 'Record'} />
      <ActionButton onClick={shareLocationInCall} icon={<MapPin size={20} />} label={compact ? 'Pin' : 'Send pin'} />
      <ActionButton onClick={clearDrawings} icon={<Eraser size={20} />} label={compact ? 'Clear' : 'Clear draw'} />
      <ActionButton danger onClick={endCall} icon={<PhoneOff size={20} />} label="End call" />
    </>
  );

  return (
    <>
      <div className="fixed inset-0 z-[120] min-h-[100dvh] overflow-x-hidden overflow-y-auto bg-slate-950 text-white">
        <RemoteAudio stream={remoteStream} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#0f172a,#020617_70%)]" />
        <div className="relative min-h-[100dvh]">
          {isMobileViewport ? (
            <div className="flex h-full flex-col px-3 pb-4 pt-3">
              <section className="relative min-h-0 flex-1 overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl">
                <VideoSurface stream={remoteStream} fallbackAvatar={avatar} title={title} subtitle={remoteSubtitle} />
                <DrawingCanvas
                  strokes={collaborativePaths}
                  draftStroke={localDrawStroke}
                  onPointerDown={(point) => isAnnotating && startStroke(point)}
                  onPointerMove={(point) => isAnnotating && extendStroke(point)}
                  onPointerUp={() => isAnnotating && finishStroke()}
                />
                <div className="absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-3">
                  <div className="max-w-[70%] rounded-3xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-md">
                    <div className="text-base font-semibold">{title}</div>
                    <div className="text-xs text-slate-300">{connectionLabel}</div>
                  </div>
                  <div className="aspect-[3/4] w-24 overflow-hidden rounded-[1.4rem] border border-white/10 bg-slate-900 shadow-xl">
                    <VideoSurface stream={previewStream} fallbackAvatar={authUser?.profilePicture || '/avatar.png'} title="You" subtitle={isScreenSharing ? 'Screen' : 'Preview'} muted mirrored={!isScreenSharing} />
                  </div>
                </div>
                <div className="absolute inset-x-3 bottom-3 z-20 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-slate-100 backdrop-blur-md">{connectionLabel}</div>
                    {isRecording && <div className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"><CircleDot size={14} /> {formatDuration(recordingSeconds)}</div>}
                    {remoteMediaState.isRecording && <div className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-slate-950"><CircleDot size={14} /> Recording</div>}
                    {remoteLocation && <a href={`https://www.google.com/maps?q=${remoteLocation.lat},${remoteLocation.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-slate-100 backdrop-blur-md"><MapPin size={14} /> Location</a>}
                    {recordingUrl && <a href={recordingUrl} download="call-recording.webm" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-slate-100 backdrop-blur-md"><Download size={14} /> Download</a>}
                  </div>
                  <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-3 backdrop-blur-xl">
                    <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                      <div className="rounded-2xl bg-white/5 px-3 py-2">You: {isMuted ? 'Muted' : 'Mic on'} • {isCameraEnabled ? 'Camera on' : 'Camera off'}</div>
                      <div className="rounded-2xl bg-white/5 px-3 py-2">{title}: {remoteMediaState.isMuted ? 'Muted' : 'Mic on'} • {remoteMediaState.isCameraEnabled ? 'Camera on' : 'Camera off'}</div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {renderToolButtons(true)}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="flex h-full flex-col p-4 lg:p-6">
              <div className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <section className="relative min-h-[42vh] overflow-hidden rounded-[2.2rem] border border-white/10 bg-black shadow-2xl xl:min-h-0">
                  <VideoSurface stream={remoteStream} fallbackAvatar={avatar} title={title} subtitle={remoteSubtitle} />
                  <DrawingCanvas
                    strokes={collaborativePaths}
                    draftStroke={localDrawStroke}
                    onPointerDown={(point) => isAnnotating && startStroke(point)}
                    onPointerMove={(point) => isAnnotating && extendStroke(point)}
                    onPointerUp={() => isAnnotating && finishStroke()}
                  />
                  <div className="absolute left-5 right-5 top-5 z-20 flex items-start justify-between gap-4">
                    <div className="rounded-[1.8rem] border border-white/10 bg-black/35 px-5 py-4 backdrop-blur-md">
                      <div className="text-xl font-semibold">{title}</div>
                      <div className="text-sm text-slate-300">{connectionLabel}</div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {isRecording && <div className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em]"><CircleDot size={14} /> Recording {formatDuration(recordingSeconds)}</div>}
                      {remoteMediaState.isRecording && <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950"><CircleDot size={14} /> They&apos;re recording</div>}
                      {remoteLocation && <a href={`https://www.google.com/maps?q=${remoteLocation.lat},${remoteLocation.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs text-slate-100 backdrop-blur-md"><MapPin size={14} /> Open shared location</a>}
                    </div>
                  </div>
                </section>

                <aside className="grid gap-4 xl:grid-rows-[auto_auto_1fr]">
                  <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">Your preview</div>
                        <div className="text-xs text-slate-400">{isScreenSharing ? 'Sharing your screen' : isCameraEnabled ? 'Camera ready' : 'Camera off'}</div>
                      </div>
                      {recordingUrl && <a href={recordingUrl} download="call-recording.webm" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10"><Download size={14} /> Download</a>}
                    </div>
                    <div className="aspect-[4/3] overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-900">
                      <VideoSurface stream={previewStream} fallbackAvatar={authUser?.profilePicture || '/avatar.png'} title="You" subtitle={isRecording ? `Recording ${formatDuration(recordingSeconds)}` : 'Local preview'} muted mirrored={!isScreenSharing} />
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">Call tools</div>
                        <div className="text-xs text-slate-400">Desktop command center for video calling.</div>
                      </div>
                      <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">{connectionLabel}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {renderToolButtons(false)}
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                    <div className="mb-3 text-sm font-semibold">Live status</div>
                    <div className="grid gap-2 text-sm text-slate-200">
                      <div className="flex items-center justify-between rounded-2xl bg-black/20 px-3 py-2"><span>You</span><span>{isMuted ? 'Muted' : 'Mic on'} • {isCameraEnabled ? 'Camera on' : 'Camera off'}</span></div>
                      <div className="flex items-center justify-between rounded-2xl bg-black/20 px-3 py-2"><span>{title}</span><span>{remoteMediaState.isMuted ? 'Muted' : 'Mic on'} • {remoteMediaState.isCameraEnabled ? 'Camera on' : 'Camera off'}</span></div>
                      <div className="rounded-2xl bg-black/20 px-3 py-2 text-xs text-slate-300">Desktop keeps tools, preview, and live status in dedicated side panels while mobile switches to an overlay-first interface for thumb-friendly controls.</div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          )}
        </div>
      </div>
      <MissedCallsPanel missedCalls={missedCalls} clearMissedCalls={clearMissedCalls} />
    </>
  );
}

export default CallLayer;
