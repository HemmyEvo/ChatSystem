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
      className="absolute inset-0 h-full w-full touch-none z-10"
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
    <div className="absolute inset-0 h-full w-full flex flex-col bg-slate-900 overflow-hidden">
      {hasVideo ? (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted={muted} 
          className={`absolute inset-0 w-full h-full object-cover ${mirrored ? 'scale-x-[-1]' : ''}`} 
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,#1e293b,#020617)] p-4">
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full" />
            <img 
              src={fallbackAvatar} 
              alt={title} 
              className="relative h-16 w-16 md:h-24 md:w-24 rounded-full object-cover ring-2 ring-white/10 shadow-2xl" 
            />
          </div>
        </div>
      )}
      {/* Name Tag Overlay */}
      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none z-10">
        <div className="text-xs md:text-sm font-medium text-white shadow-black drop-shadow-md truncate">{title}</div>
        <div className="text-[10px] md:text-xs text-slate-300 drop-shadow-md truncate">{subtitle}</div>
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
    <div className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-2xl flex flex-col justify-between p-6 text-white overflow-hidden h-[100dvh]">
      <audio ref={audioRef} autoPlay playsInline />
      
      {/* Background ambient glow based on avatar */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] opacity-20 blur-[100px] pointer-events-none">
        <img src={avatar} alt="glow" className="w-full h-full object-cover" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center mt-16 md:mt-24 space-y-2">
        <h2 className="text-xs md:text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">{subtitle}</h2>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{title}</h1>
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center">
        <div className="relative group">
           {incomingCall && (
             <>
               <div className="absolute inset-0 rounded-full bg-cyan-500/30 animate-ping" />
               <div className="absolute -inset-4 rounded-full border border-cyan-500/20 animate-pulse" />
             </>
           )}
          <img 
            src={avatar} 
            alt="caller avatar" 
            className="relative z-10 h-40 w-40 md:h-56 md:w-56 rounded-full object-cover shadow-2xl ring-4 ring-slate-800" 
          />
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center pb-12">
        <div className="flex items-center gap-6 md:gap-10">
          {incomingCall ? (
            <>
              <button onClick={declineCall} className="flex flex-col items-center gap-3 group">
                <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20 transition-transform group-hover:scale-110">
                  <PhoneOff size={28} />
                </div>
                <span className="text-xs font-medium text-slate-300">Decline</span>
              </button>
              <button onClick={acceptCall} className="flex flex-col items-center gap-3 group">
                <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 transition-transform group-hover:scale-110 animate-bounce">
                  <Phone size={28} />
                </div>
                <span className="text-xs font-medium text-slate-300">Accept</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={toggleMute} className="flex flex-col items-center gap-3 group">
                <div className={`h-16 w-16 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-rose-500/20 text-rose-500 ring-2 ring-rose-500/50' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                  {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </div>
                <span className="text-xs font-medium text-slate-400">{isMuted ? 'Muted' : 'Mute'}</span>
              </button>
              <button onClick={endCall} className="flex flex-col items-center gap-3 group">
                <div className="h-16 w-16 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20 transition-transform group-hover:scale-110">
                  <PhoneOff size={24} />
                </div>
                <span className="text-xs font-medium text-slate-400">End Call</span>
              </button>
            </>
          )}
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

  // INCOMING VIDEO CALL STATE
  if (incomingCall) {
    return (
      <div className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-2xl flex flex-col justify-between items-center py-20 px-6 h-[100dvh]">
        <div className="text-center space-y-2 mt-10">
          <h2 className="text-sm font-semibold tracking-widest text-cyan-400 uppercase">Incoming Video Call</h2>
          <h1 className="text-4xl md:text-5xl font-bold text-white">{title}</h1>
        </div>
        <div className="relative">
          <div className="absolute inset-0 rounded-[2rem] bg-cyan-500/20 animate-ping" />
          <img src={avatar} alt="caller" className="relative z-10 h-48 w-48 md:h-64 md:w-64 rounded-[2rem] object-cover shadow-2xl ring-4 ring-slate-800" />
        </div>
        <div className="flex gap-8 md:gap-12 pb-10">
          <button type="button" onClick={declineCall} className="group flex flex-col items-center gap-3">
            <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-rose-500 flex items-center justify-center text-white transition group-hover:scale-110 shadow-lg shadow-rose-500/20"><PhoneOff size={28} /></div>
            <span className="text-sm font-medium text-slate-300">Decline</span>
          </button>
          <button type="button" onClick={acceptCall} className="group flex flex-col items-center gap-3">
            <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-emerald-500 flex items-center justify-center text-white transition group-hover:scale-110 shadow-lg shadow-emerald-500/20 animate-bounce"><Video size={28} /></div>
            <span className="text-sm font-medium text-slate-300">Accept</span>
          </button>
        </div>
      </div>
    );
  }

  // CONNECTED VIDEO CALL STATE
  return (
    <div className="fixed inset-0 z-[120] bg-slate-950 text-slate-100 flex flex-col overflow-hidden h-[100dvh]">
      
      {/* Main Layout Flex Container */}
      <div className="flex-1 flex flex-col lg:flex-row p-2 md:p-4 gap-2 md:gap-4 relative pb-20 lg:pb-4">
        
        {/* PRIMARY VIEW: Remote Stream */}
        <div className="flex-1 relative rounded-[1.5rem] lg:rounded-[2rem] overflow-hidden bg-black border border-white/10 shadow-2xl flex flex-col group">
          <div className="absolute inset-0 z-0">
            <VideoSurface
              stream={remoteStream}
              fallbackAvatar={avatar}
              title={``} // Intentionally blank as we use the custom overlay header
              subtitle={``}
            />
          </div>

          <div className="absolute inset-0 z-10 pointer-events-auto">
             <DrawingCanvas
               strokes={collaborativePaths}
               draftStroke={localDrawStroke}
               onPointerDown={(point) => isAnnotating && startStroke(point)}
               onPointerMove={(point) => isAnnotating && extendStroke(point)}
               onPointerUp={() => isAnnotating && finishStroke()}
             />
          </div>

          {/* Floating Caller Info Header */}
          <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-20 flex justify-between items-start pointer-events-none transition-opacity duration-300">
             <div className="pointer-events-auto flex items-center gap-3">
                <img src={avatar} alt="avatar" className="w-10 h-10 md:w-12 md:h-12 rounded-full ring-2 ring-white/20 object-cover shadow-lg" />
                <div className="drop-shadow-md">
                  <h2 className="text-sm md:text-base font-semibold leading-tight">{title}</h2>
                  <p className="text-[10px] md:text-xs text-slate-300">
                    {remoteMediaState.isScreenSharing ? 'Sharing screen' : remoteMediaState.isCameraEnabled ? 'Camera on' : 'Audio only'} • {subtitle}
                  </p>
                </div>
             </div>
             {remoteLocation && (
               <a href={`https://www.google.com/maps?q=${remoteLocation.lat},${remoteLocation.lng}`} target="_blank" rel="noopener noreferrer" 
                  className="pointer-events-auto hidden md:flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-black/60 transition shadow-lg">
                  <MapPin size={14} className="text-amber-400" /> View Map
               </a>
             )}
          </div>
        </div>

        {/* SIDEBAR / MOBILE DOCK: Local Video & Collab Tools */}
        <div className="w-full lg:w-[320px] shrink-0 flex flex-row lg:flex-col gap-2 md:gap-4 z-20 relative">
          
          {/* Local Preview Camera (PiP on mobile, Full block on desktop) */}
          <div className="w-24 md:w-32 lg:w-full aspect-[3/4] lg:aspect-video rounded-xl md:rounded-[1.5rem] overflow-hidden border border-white/10 bg-slate-800 shadow-xl relative shrink-0">
             <VideoSurface
               stream={previewStream}
               fallbackAvatar={authUser?.profilePicture || '/avatar.png'}
               title="You"
               subtitle={isScreenSharing ? 'Sharing screen' : isCameraEnabled ? 'Camera on' : 'Off'}
               muted
               mirrored={!isScreenSharing}
             />
          </div>

          {/* Collaboration Tools (Scrollable Row on Mobile, Grid on Desktop) */}
          <div className="flex-1 lg:flex-none flex flex-row lg:flex-col gap-2 bg-slate-900/60 backdrop-blur-lg rounded-xl md:rounded-[1.5rem] p-2 md:p-4 border border-white/10 overflow-x-auto lg:overflow-visible items-center lg:items-stretch shadow-xl" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
             <div className="hidden lg:block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Collaboration</div>
             
             <div className="flex lg:grid lg:grid-cols-2 gap-2 min-w-max lg:min-w-full">
               <button type="button" onClick={toggleScreenShare} className={`flex flex-col lg:flex-row items-center lg:justify-start gap-1 lg:gap-3 p-3 w-20 lg:w-auto rounded-xl border transition ${isScreenSharing ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}>
                 <MonitorUp size={18} className={isScreenSharing ? 'text-cyan-400' : 'text-slate-300'} />
                 <span className="text-[10px] lg:text-xs font-medium text-slate-200">Share</span>
               </button>
               
               <button type="button" onClick={shareLocationInCall} className="flex flex-col lg:flex-row items-center lg:justify-start gap-1 lg:gap-3 p-3 w-20 lg:w-auto rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition">
                 <MapPin size={18} className="text-amber-400" />
                 <span className="text-[10px] lg:text-xs font-medium text-slate-200">Location</span>
               </button>
               
               <button type="button" onClick={() => setIsAnnotating((val) => !val)} className={`flex flex-col lg:flex-row items-center lg:justify-start gap-1 lg:gap-3 p-3 w-20 lg:w-auto rounded-xl border transition ${isAnnotating ? 'border-cyan-400/50 bg-cyan-400/20' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}>
                 <Video size={18} className={isAnnotating ? 'text-cyan-400' : 'text-slate-300'} />
                 <span className="text-[10px] lg:text-xs font-medium text-slate-200">{isAnnotating ? 'Drawing' : 'Draw'}</span>
               </button>
               
               <button type="button" onClick={clearDrawings} className="flex flex-col lg:flex-row items-center lg:justify-start gap-1 lg:gap-3 p-3 w-20 lg:w-auto rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition">
                 <Eraser size={18} className="text-rose-400" />
                 <span className="text-[10px] lg:text-xs font-medium text-slate-200">Clear</span>
               </button>
             </div>
          </div>
        </div>
      </div>

      {/* FLOATING MAIN CONTROLS */}
      <div className="absolute bottom-4 lg:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-4 bg-slate-800/80 backdrop-blur-2xl px-4 py-3 rounded-full border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-30">
        <button type="button" onClick={toggleMute} className={`p-3 md:p-4 rounded-full transition-all ${isMuted ? 'bg-rose-500/20 text-rose-500' : 'bg-white/10 text-white hover:bg-white/20'}`}>
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        
        <button type="button" onClick={toggleCamera} className={`p-3 md:p-4 rounded-full transition-all ${isCameraEnabled ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-rose-500/20 text-rose-500'}`}>
          {isCameraEnabled ? <Camera size={20} /> : <CameraOff size={20} />}
        </button>
        
        <div className="w-px h-8 bg-white/10 mx-1 md:mx-2" />
        
        <button type="button" onClick={endCall} className="p-3 md:p-4 rounded-full bg-rose-500 text-white hover:bg-rose-600 transition shadow-lg shadow-rose-500/20">
          <PhoneOff size={20} />
        </button>
      </div>
      
    </div>
  );
}

export default CallLayer;