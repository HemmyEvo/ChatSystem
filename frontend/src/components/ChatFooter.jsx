import React, { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import {
  Clock3,
  EyeOff,
  Image as ImageIcon,
  MapPin,
  Mic,
  Paperclip,
  Search,
  Send,
  Square,
  Star,
  Sticker,
  Trash2,
  Upload,
  User,
  Video,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

const messageSendSound = new Audio('/sounds/send.mp3');
const recordStartSound = new Audio('/sounds/record-start.mp3');
const recordStopSound = new Audio('/sounds/record-stop.mp3');

const DEFAULT_STICKERS = [
  '\u{1F600}',
  '\u{1F525}',
  '\u2764\uFE0F',
  '\u{1F602}',
  '\u{1F60E}',
  '\u{1F389}',
  '\u{1F973}',
  '\u{1F60D}',
  '\u{1F91D}',
  '\u{1F44D}',
  '\u{1F4AF}',
  '\u{1F680}',
];

const STICKER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'recent', label: 'Recent' },
  { id: 'custom', label: 'Created' },
];

const buildEmojiSticker = (emoji) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="100%" height="100%" rx="80" fill="#202c33"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="220">${emoji}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
};

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
  const [stickerTab, setStickerTab] = useState('all');

  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const stickerUploadRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const textareaRef = useRef(null);
  const attachMenuRef = useRef(null);
  const stickerMenuRef = useRef(null);

  const {
    friends,
    getFriends,
    shareContactSearchTerm,
    setShareContactSearchTerm,
    isUsersLoading,
    emitTypingEvent,
    emitStopTypingEvent,
    sendMessage,
    soundSettings,
    replyTarget,
    setReplyTarget,
    favoriteStickers,
    recentStickers,
    customStickers,
    toggleFavoriteSticker,
    addRecentSticker,
    saveCustomSticker,
  } = useChatStore();

  const playSound = (audio) => {
    if (soundSettings.send) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  };

  useEffect(() => {
    if (showContactModal) getFriends();
  }, [showContactModal, getFriends]);

  useEffect(
    () => () => {
      if (previewMedia?.url) URL.revokeObjectURL(previewMedia.url);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [previewMedia, audioUrl],
  );

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

  const convertToBase64 = (fileOrBlob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(fileOrBlob);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };
      playSound(recordStartSound);
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
      setShowAttachMenu(false);
    } catch {
      toast.error('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      playSound(recordStopSound);
      clearInterval(timerRef.current);
    }
  };

  const discardAudio = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
  };

  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  const handleSendMessage = async (event) => {
    event?.preventDefault();
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
      setPreviewMedia(null);
      setViewOnce(false);
      discardAudio();
      playSound(messageSendSound);
      await sendMessage(payload);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(error.response?.data?.message || 'Failed to send message');
    }
  };

  const handleTextChange = (event) => {
    setText(event.target.value);
    if (event.target.value.trim()) emitTypingEvent();
    else emitStopTypingEvent();

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleFileUpload = (event, type) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(`The selected ${type} exceeds the 5MB limit.`);
      event.target.value = null;
      return;
    }
    setPreviewMedia({ file, url: URL.createObjectURL(file), type });
    setViewOnce(false);
    setShowAttachMenu(false);
    event.target.value = null;
  };

  const handleStickerUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image to create a sticker.');
      event.target.value = null;
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('Sticker image must be under 3MB.');
      event.target.value = null;
      return;
    }

    try {
      const dataUrl = await convertToBase64(file);
      saveCustomSticker(dataUrl);
      toggleFavoriteSticker(dataUrl);
      setStickerTab('custom');
      toast.success('Sticker added');
    } catch (error) {
      console.error('Error creating sticker:', error);
      toast.error('Failed to create sticker');
    } finally {
      event.target.value = null;
    }
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
            text: '\u{1F4CD} Shared a live location pin',
            location: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              label: `Accuracy +/-${Math.round(position.coords.accuracy)}m`,
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

  const handleShareContact = async (contact) => {
    await sendMessage({ sharedContactId: contact._id });
    playSound(messageSendSound);
    setShowContactModal(false);
    setShowAttachMenu(false);
    setShareContactSearchTerm('');
  };

  const sendStickerPayload = async (stickerValue) => {
    await sendMessage({ sticker: stickerValue });
    addRecentSticker(stickerValue);
    playSound(messageSendSound);
    setShowStickerMenu(false);
  };

  const handleSendEmojiSticker = async (emoji) => {
    await sendStickerPayload(buildEmojiSticker(emoji));
  };

  const handleSendSavedSticker = async (stickerValue) => {
    await sendStickerPayload(stickerValue);
  };

  const currentStickerSet =
    stickerTab === 'favorites'
      ? favoriteStickers
      : stickerTab === 'recent'
        ? recentStickers
        : stickerTab === 'custom'
          ? customStickers
          : [...DEFAULT_STICKERS.map((emoji) => buildEmojiSticker(emoji)), ...customStickers];

  const renderStickerButton = (stickerValue, index) => {
    const isFavorite = favoriteStickers.includes(stickerValue);
    const isEmojiSticker = stickerValue.startsWith('data:image/svg+xml');

    return (
      <div key={`${stickerValue.slice(0, 24)}-${index}`} className="relative">
        <button
          type="button"
          onClick={() => (isEmojiSticker ? handleSendSavedSticker(stickerValue) : handleSendSavedSticker(stickerValue))}
          className="flex h-16 w-full items-center justify-center rounded-2xl bg-slate-700/60 p-2 transition hover:bg-slate-600"
        >
          <img src={stickerValue} alt="Sticker" className="h-full w-full object-contain" />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggleFavoriteSticker(stickerValue);
          }}
          className={`absolute right-1 top-1 rounded-full p-1 ${isFavorite ? 'bg-amber-400 text-slate-900' : 'bg-black/40 text-white/80'}`}
        >
          <Star size={11} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>
    );
  };

  return (
    <div className="relative w-full box-border bg-slate-800 p-3 sm:p-4">
      {previewMedia && (
        <div className="absolute bottom-full left-0 z-40 flex w-full flex-col gap-4 border-t border-[#2a3942] bg-[#111b21] p-4 shadow-lg">
          <div className="mb-2 flex items-center justify-between text-white">
            <h3 className="font-semibold capitalize">Send {previewMedia.type}</h3>
            <button onClick={() => { setPreviewMedia(null); setViewOnce(false); }} className="rounded-full p-1 hover:bg-white/10">
              <X size={20} />
            </button>
          </div>

          <div className="flex min-h-[200px] max-h-[40vh] flex-1 items-center justify-center overflow-hidden rounded-[1.2rem] bg-black">
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

      {replyTarget && (
        <div className="mb-2 flex w-full items-start justify-between overflow-hidden rounded-md border-l-4 border-emerald-400 bg-slate-700/70 px-3 py-2 box-border">
          <div className="flex min-w-0 flex-1 flex-col pr-2">
            <span className="mb-1 truncate text-xs font-semibold text-emerald-300">Replying to message</span>
            <span className="line-clamp-3 break-words text-[13px] text-slate-200 opacity-90" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
              {replyTarget.text || (replyTarget.location ? 'Shared location' : 'Media message')}
            </span>
          </div>
          <button onClick={() => setReplyTarget(null)} type="button" className="mt-0.5 flex-shrink-0 rounded-full p-1 transition-colors hover:bg-slate-600">
            <X size={16} />
          </button>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex w-full items-end gap-2 box-border">
        <div className="relative flex-shrink-0 pb-[6px]" ref={attachMenuRef}>
          <button type="button" disabled={isRecording || audioBlob} onClick={() => setShowAttachMenu(!showAttachMenu)} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-50">
            <Paperclip size={20} />
          </button>
          <div className={`absolute bottom-12 left-0 z-50 flex w-48 origin-bottom-left flex-col gap-2 rounded-lg bg-slate-700 p-2 shadow-xl transition-all duration-200 ${showAttachMenu ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'}`}>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 rounded p-2 text-left text-sm text-slate-200 hover:bg-slate-600"><ImageIcon size={18} className="text-blue-400" /> Image / Gallery</button>
            <button type="button" onClick={() => videoInputRef.current?.click()} className="flex items-center gap-3 rounded p-2 text-left text-sm text-slate-200 hover:bg-slate-600"><Video size={18} className="text-pink-400" /> Video</button>
            <button type="button" onClick={() => { setShowStickerMenu(true); setShowAttachMenu(false); }} className="flex items-center gap-3 rounded p-2 text-left text-sm text-slate-200 hover:bg-slate-600"><Sticker size={18} className="text-yellow-400" /> Stickers</button>
            <button type="button" onClick={() => setShowContactModal(true)} className="flex items-center gap-3 rounded p-2 text-left text-sm text-slate-200 hover:bg-slate-600"><User size={18} className="text-green-400" /> Share Friend</button>
            <button type="button" onClick={handleShareLocation} disabled={isSharingLocation} className="flex items-center gap-3 rounded p-2 text-left text-sm text-slate-200 hover:bg-slate-600 disabled:opacity-60"><MapPin size={18} className="text-amber-400" /> {isSharingLocation ? 'Sharing...' : 'Share Location'}</button>
          </div>
        </div>

        <div className="relative flex-shrink-0 pb-[6px]" ref={stickerMenuRef}>
          <button type="button" onClick={() => setShowStickerMenu((value) => !value)} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white">
            <Sticker size={20} />
          </button>

          <div className={`absolute bottom-12 left-0 z-50 w-[320px] rounded-[1.4rem] bg-[#233138] p-3 shadow-xl transition-all duration-200 sm:w-[360px] ${showStickerMenu ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'}`}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Stickers</div>
                <div className="text-xs text-slate-400">Send, favorite, or create stickers</div>
              </div>
              <button type="button" onClick={() => stickerUploadRef.current?.click()} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs text-white/90 transition hover:bg-white/15">
                <Upload size={14} /> Create
              </button>
            </div>

            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {STICKER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStickerTab(tab.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${stickerTab === tab.id ? 'bg-[#25d366] text-[#111b21]' : 'bg-white/8 text-white/75 hover:bg-white/12 hover:text-white'}`}
                >
                  {tab.id === 'favorites' && <Star size={12} className="mr-1 inline" />}
                  {tab.id === 'recent' && <Clock3 size={12} className="mr-1 inline" />}
                  {tab.label}
                </button>
              ))}
            </div>

            {stickerTab === 'all' && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {DEFAULT_STICKERS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSendEmojiSticker(emoji)}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-700/60 text-2xl transition hover:bg-slate-600"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {currentStickerSet.length ? (
              <div className="grid max-h-[280px] grid-cols-4 gap-2 overflow-y-auto pr-1">
                {currentStickerSet.map((stickerValue, index) => renderStickerButton(stickerValue, index))}
              </div>
            ) : (
              <div className="rounded-2xl bg-white/5 px-4 py-6 text-center text-sm text-white/60">
                {stickerTab === 'favorites' ? 'No favorite stickers yet.' : stickerTab === 'recent' ? 'No recent stickers yet.' : 'Create a sticker from an image to see it here.'}
              </div>
            )}
          </div>
        </div>

        <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={(event) => handleFileUpload(event, 'image')} />
        <input type="file" hidden ref={videoInputRef} accept="video/*" onChange={(event) => handleFileUpload(event, 'video')} />
        <input type="file" hidden ref={stickerUploadRef} accept="image/png,image/webp,image/jpeg" onChange={handleStickerUpload} />

        {isRecording ? (
          <div className="mb-[2px] flex min-w-0 flex-1 items-center justify-between rounded-full border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-500">
            <div className="flex items-center gap-2 animate-pulse"><Mic size={16} /> Recording...</div>
            <span className="font-mono">{formatTime(recordingTime)}</span>
          </div>
        ) : audioBlob ? (
          <div className="mb-[2px] flex min-w-0 flex-1 items-center gap-3 rounded-full bg-slate-700 px-4 py-2">
            <button type="button" onClick={discardAudio} className="text-slate-400 hover:text-red-400"><Trash2 size={18} /></button>
            <audio src={audioUrl} controls className="h-8 w-full invert grayscale opacity-80" />
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onBlur={emitStopTypingEvent}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSendMessage(event);
              }
            }}
            placeholder={previewMedia ? 'Add a caption...' : 'Type a message...'}
            rows={1}
            className="flex-1 w-full min-w-0 resize-none overflow-y-auto rounded-2xl bg-slate-700 px-4 py-2.5 leading-relaxed text-white placeholder-slate-400 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            style={{ minHeight: '44px' }}
          />
        )}

        <div className="flex-shrink-0 pb-[4px]">
          {isRecording ? (
            <button type="button" onClick={stopRecording} className="rounded-full bg-red-500 p-2.5 text-white transition-colors hover:bg-red-600">
              <Square size={18} />
            </button>
          ) : text.trim() || previewMedia || audioBlob ? (
            <button type="submit" className="rounded-full bg-cyan-500 p-2.5 text-white transition-colors hover:bg-cyan-600">
              <Send size={18} className="ml-1" />
            </button>
          ) : (
            <button type="button" onClick={startRecording} className="rounded-full bg-slate-700 p-2.5 text-slate-300 transition-colors hover:bg-slate-600">
              <Mic size={18} />
            </button>
          )}
        </div>
      </form>

      {showContactModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-xl bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-700 p-4 text-white">
              <h3 className="font-bold">Share friend</h3>
              <button onClick={() => setShowContactModal(false)}><X size={20} /></button>
            </div>
            <div className="border-b border-slate-700 p-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={shareContactSearchTerm} onChange={(event) => setShareContactSearchTerm(event.target.value)} placeholder="Search friends..." className="w-full rounded-lg bg-slate-700/70 py-2 pl-9 pr-3 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {isUsersLoading ? (
                <p className="text-center text-slate-400">Loading friends...</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredFriends.map((contact) => (
                    <button key={contact._id} onClick={() => handleShareContact(contact)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-slate-700">
                      <img src={contact.profilePicture || '/avatar.png'} alt="avatar" className="h-10 w-10 rounded-full object-cover" />
                      <span className="font-medium text-white">@{contact.username}</span>
                    </button>
                  ))}
                  {filteredFriends.length === 0 && <p className="text-center text-slate-400">No friends found.</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatFooter;
