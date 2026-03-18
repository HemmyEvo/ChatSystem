import { useEffect, useRef } from 'react';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { useCallStore } from '../store/useCallStore';

function CallLayer() {
  const audioRef = useRef(null);
  const {
    incomingCall,
    activeCallUser,
    remoteStream,
    callStatus,
    isMuted,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
  } = useCallStore();

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = remoteStream || null;
    }
  }, [remoteStream]);

  if (!incomingCall && !activeCallUser) {
    return <audio ref={audioRef} autoPlay playsInline />;
  }

  const title = incomingCall
    ? `@${incomingCall.fromUser?.username || 'user'} is calling`
    : `Voice call with @${activeCallUser?.username || 'user'}`;

  const subtitle = incomingCall
    ? 'Incoming voice call'
    : callStatus === 'connected'
      ? 'Connected in real time'
      : callStatus === 'calling'
        ? 'Calling...'
        : 'Connecting audio...';

  const avatar = incomingCall?.fromUser?.profilePicture || activeCallUser?.profilePicture || '/avatar.png';

  return (
    <>
      <audio ref={audioRef} autoPlay playsInline />
      <div className="fixed inset-x-4 top-4 z-[120] mx-auto max-w-sm rounded-3xl border border-emerald-400/30 bg-slate-950/95 p-5 text-white shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <img src={avatar} alt="caller avatar" className="h-16 w-16 rounded-full object-cover ring-2 ring-emerald-400/40" />
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">{title}</div>
            <div className="text-sm text-slate-300">{subtitle}</div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          {incomingCall ? (
            <>
              <button type="button" onClick={declineCall} className="rounded-full bg-red-500 p-4 text-white transition hover:bg-red-600">
                <PhoneOff size={20} />
              </button>
              <button type="button" onClick={acceptCall} className="rounded-full bg-emerald-500 p-4 text-white transition hover:bg-emerald-600">
                <Phone size={20} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleMute}
                className="rounded-full bg-slate-800 p-4 text-white transition hover:bg-slate-700"
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button type="button" onClick={endCall} className="rounded-full bg-red-500 p-4 text-white transition hover:bg-red-600">
                <PhoneOff size={20} />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default CallLayer;
