import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import { Paperclip, Send, Mic, Video, User, X, Image as ImageIcon, Trash2, Square, Search, MapPin, EyeOff, Sticker } from 'lucide-react';
import toast from 'react-hot-toast';

const messageSendSound = new Audio('/sounds/send.mp3');
const recordStartSound = new Audio('/sounds/record-start.mp3');
const recordStopSound = new Audio('/sounds/record-stop.mp3');
const STICKERS = ['😀', '🔥', '❤️', '😂', '😎', '🎉', '🥳', '😍', '🤝', '👍', '💯', '🚀'];

function ChatFooter() {
  const [text, setText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [previewMedia, setPreviewMedia] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [viewOnce, setViewOnce] = useState(false);
  const [showStickerMenu, setShowStickerMenu] = useState(false);

  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const textareaRef = useRef(null);
  const attachMenuRef = useRef(null);
  const stickerMenuRef = useRef(null);

  const { friends, getFriends, shareContactSearchTerm, setShareContactSearchTerm, isUsersLoading, emitTypingEvent, emitStopTypingEvent, sendMessage, soundSettings, replyTarget, setReplyTarget } = useChatStore();

  const playSound = (audio) => { if (soundSettings.send) { audio.currentTime = 0; audio.play().catch(() => {}); } };

  useEffect(() => { if (showContactModal) getFriends(); }, [showContactModal, getFriends]);
  useEffect(() => () => { if (previewMedia?.url) URL.revokeObjectURL(previewMedia.url); if (audioUrl) URL.revokeObjectURL(audioUrl); }, [previewMedia, audioUrl]);
  useEffect(() => {
    const handlePointerDown = (event) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target)) {
        setShowAttachMenu(false);
      }
      if (stickerMenuRef.current && !stickerMenuRef.current.contains(event.target)) {
        setShowStickerMenu(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  const convertToBase64 = (fileOrBlob) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(fileOrBlob); reader.onload = () => resolve(reader.result); reader.onerror = reject; });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => { const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); setAudioBlob(blob); setAudioUrl(URL.createObjectURL(blob)); stream.getTracks().forEach((track) => track.stop()); };
      playSound(recordStartSound);
      mediaRecorder.start(); setIsRecording(true); setRecordingTime(0); timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000); setShowAttachMenu(false);
    } catch { toast.error('Microphone access denied.'); }
  };
  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); playSound(recordStopSound); clearInterval(timerRef.current); } };
  const discardAudio = () => { setAudioBlob(null); setAudioUrl(null); setRecordingTime(0); };
  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!text.trim() && !previewMedia && !audioBlob) return;
    try {
      const payload = {};
      if (text.trim()) payload.text = text.trim();
      if (previewMedia) payload[previewMedia.type] = await convertToBase64(previewMedia.file);
      if (previewMedia && viewOnce && ['image', 'video'].includes(previewMedia.type)) payload.viewOnce = true;
      if (audioBlob) payload.audio = await convertToBase64(audioBlob);
      setText('');
      emitStopTypingEvent();
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      setPreviewMedia(null); setViewOnce(false); discardAudio(); playSound(messageSendSound); await sendMessage(payload);
    } catch (error) { console.error('Error sending message:', error); toast.error(error.response?.data?.message || 'Failed to send message'); }
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    if (e.target.value.trim()) emitTypingEvent(); else emitStopTypingEvent();
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`; }
  };

  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(`The selected ${type} exceeds the 5MB limit.`); e.target.value = null; return; }
    setPreviewMedia({ file, url: URL.createObjectURL(file), type }); setViewOnce(false); setShowAttachMenu(false); e.target.value = null;
  };

  const handleShareLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Location sharing is not available in this browser.');
      return;
    }
    setIsSharingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await sendMessage({
            text: '📍 Shared a live location pin',
            location: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              label: `Accuracy ±${Math.round(position.coords.accuracy)}m`,
            },
          });
          playSound(messageSendSound);
          setShowAttachMenu(false);
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to share location');
        } finally {
          setIsSharingLocation(false);
        }
      },
      () => {
        toast.error('Location access denied.');
        setIsSharingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const filteredFriends = friends.filter((friend) => friend.username.toLowerCase().includes(shareContactSearchTerm.toLowerCase()));
  const handleShareContact = async (contact) => { await sendMessage({ sharedContactId: contact._id }); playSound(messageSendSound); setShowContactModal(false); setShowAttachMenu(false); setShareContactSearchTerm(''); };
  const handleSendSticker = async (emoji) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="100%" height="100%" rx="80" fill="#202c33"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="220">${emoji}</text></svg>`;
    const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    await sendMessage({ sticker: dataUrl });
    playSound(messageSendSound);
    setShowStickerMenu(false);
  };

  return (
    <div className='bg-slate-800 p-3 sm:p-4 relative w-full box-border'>
      {previewMedia && (
        <div className="absolute bottom-full left-0 w-full border-t border-[#2a3942] bg-[#111b21] p-4 shadow-lg z-40 flex flex-col gap-4">
          <div className="mb-2 flex items-center justify-between text-white">
            <h3 className="font-semibold capitalize">Send {previewMedia.type}</h3>
            <button onClick={() => { setPreviewMedia(null); setViewOnce(false); }} className="rounded-full p-1 hover:bg-white/10">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center overflow-hidden rounded-[1.2rem] bg-black min-h-[200px] max-h-[40vh]">
            {previewMedia.type === 'image' && <img src={previewMedia.url} alt="Preview" className="max-h-full max-w-full object-contain" />}
            {previewMedia.type === 'video' && <video src={previewMedia.url} controls className="max-h-full max-w-full" />}
          </div>

          {['image', 'video'].includes(previewMedia.type) && (
            <div className="flex items-center justify-between rounded-[1rem] bg-[#202c33] px-4 py-3 text-white">
              <div>
                <div className="text-sm font-medium">View once</div>
                <div className="text-xs text-white/55">Recipient can open this media only one time</div>
              </div>
              <button
                type="button"
                onClick={() => setViewOnce((value) => !value)}
                className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${viewOnce ? 'border-[#25d366] bg-[#25d366] text-[#111b21]' : 'border-white/10 bg-white/5 text-white/80'}`}
              >
                <EyeOff size={18} />
              </button>
            </div>
          )}
        </div>
      )}

      {replyTarget && <div className='mb-2 w-full flex items-start justify-between bg-slate-700/70 border-l-4 border-emerald-400 rounded-md px-3 py-2 box-border overflow-hidden'><div className='flex-1 min-w-0 flex flex-col pr-2'><span className='text-emerald-300 text-xs mb-1 font-semibold truncate'>Replying to message</span><span className='text-slate-200 text-[13px] opacity-90 line-clamp-3 break-words' style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{replyTarget.text || (replyTarget.location ? 'Shared location' : 'Media message')}</span></div><button onClick={() => setReplyTarget(null)} type='button' className='flex-shrink-0 mt-0.5 p-1 hover:bg-slate-600 rounded-full transition-colors'><X size={16} /></button></div>}

      <form onSubmit={handleSendMessage} className='flex items-end gap-2 w-full box-border'>
        <div className='relative pb-[6px] flex-shrink-0' ref={attachMenuRef}>
          <button type="button" disabled={isRecording || audioBlob} onClick={() => setShowAttachMenu(!showAttachMenu)} className='p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-700 disabled:opacity-50'><Paperclip size={20} /></button>
          <div className={`absolute bottom-12 left-0 bg-slate-700 rounded-lg shadow-xl p-2 flex flex-col gap-2 w-48 z-50 transition-all duration-200 origin-bottom-left ${showAttachMenu ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
            <button type="button" onClick={() => fileInputRef.current?.click()} className='flex items-center gap-3 p-2 hover:bg-slate-600 rounded text-left text-sm text-slate-200'><ImageIcon size={18} className="text-blue-400" /> Image / Gallery</button>
            <button type="button" onClick={() => videoInputRef.current?.click()} className='flex items-center gap-3 p-2 hover:bg-slate-600 rounded text-left text-sm text-slate-200'><Video size={18} className="text-pink-400" /> Video</button>
            <button type="button" onClick={() => { setShowStickerMenu(true); setShowAttachMenu(false); }} className='flex items-center gap-3 p-2 hover:bg-slate-600 rounded text-left text-sm text-slate-200'><Sticker size={18} className="text-yellow-400" /> Stickers</button>
            <button type="button" onClick={() => setShowContactModal(true)} className='flex items-center gap-3 p-2 hover:bg-slate-600 rounded text-left text-sm text-slate-200'><User size={18} className="text-green-400" /> Share Friend</button>
            <button type="button" onClick={handleShareLocation} disabled={isSharingLocation} className='flex items-center gap-3 p-2 hover:bg-slate-600 rounded text-left text-sm text-slate-200 disabled:opacity-60'><MapPin size={18} className="text-amber-400" /> {isSharingLocation ? 'Sharing...' : 'Share Location'}</button>
          </div>
        </div>
        <div className='relative pb-[6px] flex-shrink-0' ref={stickerMenuRef}>
          <button type="button" onClick={() => setShowStickerMenu((value) => !value)} className='p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-700'>
            <Sticker size={20} />
          </button>
          <div className={`absolute bottom-12 left-0 w-64 rounded-2xl bg-[#233138] p-3 shadow-xl z-50 transition-all duration-200 ${showStickerMenu ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
            <div className='mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400'>Stickers</div>
            <div className='grid grid-cols-4 gap-2'>
              {STICKERS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => handleSendSticker(emoji)} className='flex h-12 items-center justify-center rounded-xl bg-slate-700/60 text-3xl transition hover:bg-slate-600'>
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
        <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} />
        <input type="file" hidden ref={videoInputRef} accept="video/*" onChange={(e) => handleFileUpload(e, 'video')} />
        {isRecording ? <div className="flex-1 min-w-0 bg-red-500/10 text-red-500 rounded-full px-4 py-3 flex items-center justify-between border border-red-500/30 mb-[2px]"><div className="flex items-center gap-2 animate-pulse"><Mic size={16} /> Recording...</div><span className="font-mono">{formatTime(recordingTime)}</span></div> : audioBlob ? <div className="flex-1 min-w-0 bg-slate-700 rounded-full px-4 py-2 flex items-center gap-3 mb-[2px]"><button type="button" onClick={discardAudio} className="text-slate-400 hover:text-red-400"><Trash2 size={18} /></button><audio src={audioUrl} controls className="h-8 w-full invert grayscale opacity-80" /></div> : <textarea ref={textareaRef} value={text} onChange={handleTextChange} onBlur={emitStopTypingEvent} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }} placeholder={previewMedia ? 'Add a caption...' : 'Type a message...'} rows={1} className='flex-1 w-full min-w-0 bg-slate-700 text-white rounded-2xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder-slate-400 resize-none overflow-y-auto leading-relaxed scrollbar-thin scrollbar-thumb-slate-500 scrollbar-track-transparent' style={{ minHeight: '44px' }} />}
        <div className="pb-[4px] flex-shrink-0">{isRecording ? <button type="button" onClick={stopRecording} className='p-2.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors'><Square size={18} /></button> : text.trim() || previewMedia || audioBlob ? <button type="submit" className='p-2.5 bg-cyan-500 text-white rounded-full hover:bg-cyan-600 transition-colors'><Send size={18} className="ml-1" /></button> : <button type="button" onClick={startRecording} className='p-2.5 bg-slate-700 text-slate-300 rounded-full hover:bg-slate-600 transition-colors'><Mic size={18} /></button>}</div>
      </form>

      {showContactModal && <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4"><div className="bg-slate-800 rounded-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]"><div className="p-4 flex justify-between items-center border-b border-slate-700 text-white"><h3 className="font-bold">Share friend</h3><button onClick={() => setShowContactModal(false)}><X size={20} /></button></div><div className='p-4 border-b border-slate-700'><div className='relative'><Search size={16} className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-500' /><input value={shareContactSearchTerm} onChange={(e) => setShareContactSearchTerm(e.target.value)} placeholder='Search friends...' className='w-full bg-slate-700/70 text-slate-200 pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500' /></div></div><div className="p-4 overflow-y-auto flex-1">{isUsersLoading ? <p className="text-slate-400 text-center">Loading friends...</p> : <div className="flex flex-col gap-2">{filteredFriends.map((contact) => <button key={contact._id} onClick={() => handleShareContact(contact)} className="flex items-center gap-3 p-2 hover:bg-slate-700 rounded-lg cursor-pointer transition-colors w-full text-left"><img src={contact.profilePicture || '/avatar.png'} alt='avatar' className="w-10 h-10 rounded-full object-cover" /><span className="text-white font-medium">@{contact.username}</span></button>)}{filteredFriends.length === 0 && <p className='text-center text-slate-400'>No friends found.</p>}</div>}</div></div></div>}
    </div>
  );
}

export default ChatFooter;
