import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import NoChatHistory from './NoChatHistory';
import { useAuthStore } from '../store/useAuthStore';
import { Check, CheckCheck, Download, Play, Pause, Smile, Reply, Mic, MapPin, ExternalLink, EyeOff } from 'lucide-react';
import SharedContactCard from './SharedContactCard';
import toast from 'react-hot-toast';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

const isSameDay = (date1, date2) => {
  if (!date1 || !date2) return false;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

const formatDateDivider = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  yesterday.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === yesterday.getTime()) return 'Yesterday';
  if (diffDays < 7 && diffDays > 0) {
    return date.toLocaleDateString('en-US', { weekday: 'long' }); 
  }
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const MessageSkeleton = () => {
  const skeletonMessages = [
    { id: 1, isOwn: false, width: 'w-48', height: 'h-10' },
    { id: 2, isOwn: true, width: 'w-64', height: 'h-10' },
    { id: 3, isOwn: false, width: 'w-56', height: 'h-14' },
    { id: 4, isOwn: true, width: 'w-40', height: 'h-10' },
    { id: 5, isOwn: false, width: 'w-72', height: 'h-24' },
    { id: 6, isOwn: true, width: 'w-32', height: 'h-10' },
  ];

  return (
    <div className='flex-1 p-4 md:px-8 bg-[#0b141a] overflow-y-hidden flex flex-col gap-4'>
      {skeletonMessages.map((msg) => (
        <div key={msg.id} className={`flex w-full ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
          <div 
            className={`animate-pulse rounded-lg ${msg.width} ${msg.height} ${msg.isOwn ? 'bg-[#005c4b]/50' : 'bg-[#202c33]/70'}`}
            style={{ borderTopRightRadius: msg.isOwn ? '0px' : '8px', borderTopLeftRadius: !msg.isOwn ? '0px' : '8px' }}
          />
        </div>
      ))}
    </div>
  );
};


const LocationCard = ({ location, isOwnMessage }) => {
  if (!location?.lat || !location?.lng) return null;
  const mapUrl = `https://www.google.com/maps?q=${location.lat},${location.lng}`;

  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`mb-1 block overflow-hidden rounded-2xl border ${isOwnMessage ? 'border-white/10 bg-black/20' : 'border-black/20 bg-black/20'}`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="relative h-36 w-full overflow-hidden bg-[radial-gradient(circle_at_top,#22d3ee55,transparent_50%),linear-gradient(135deg,#0f172a,#020617)]">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,#ffffff18_1px,transparent_1px),linear-gradient(to_bottom,#ffffff18_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/20 ring-8 ring-rose-500/10">
            <MapPin size={28} className="text-rose-400" />
          </div>
        </div>
        <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-xs text-white">
          <MapPin size={14} /> Shared location
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-slate-100">
        <div>
          <div className="font-medium">{location.label || 'Open in Maps'}</div>
          <div className="text-xs text-slate-300">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</div>
        </div>
        <ExternalLink size={16} className="text-slate-300" />
      </div>
    </a>
  );
};

const VoiceNotePlayer = ({ audioUrl, isOwnMessage, selectedUser }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState('0:00');
  const [currentTime, setCurrentTime] = useState('0:00');
  const audioRef = useRef(null);
  
  const [waveform] = useState(() => Array.from({ length: 28 }, () => Math.random() * 60 + 30));

  const togglePlay = (e) => {
    e.stopPropagation();
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatDuration = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return '0:00';
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const handleTimeUpdate = () => {
    const current = audioRef.current.currentTime;
    const total = audioRef.current.duration;
    setProgress((current / total) * 100 || 0);
    setCurrentTime(formatDuration(current));
  };

  const handleLoadedMetadata = () => {
    setDuration(formatDuration(audioRef.current.duration));
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newProgress = clickX / rect.width;
    audioRef.current.currentTime = newProgress * audioRef.current.duration;
  };

  return (
    <div className={`flex flex-col gap-1 min-w-[220px] max-w-[280px] p-1.5 mb-1 rounded-lg ${isOwnMessage ? 'bg-black/10' : 'bg-black/20'}`} onClick={e => e.stopPropagation()}>
      <audio 
        ref={audioRef} 
        src={audioUrl} 
        onTimeUpdate={handleTimeUpdate} 
        onLoadedMetadata={handleLoadedMetadata} 
        onEnded={() => { setIsPlaying(false); setProgress(0); setCurrentTime('0:00'); }} 
        className="hidden"
      />
      
      <div className="flex items-center gap-3">
        <button 
          onClick={togglePlay} 
          className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-slate-800/40 hover:bg-slate-700/50 transition-colors rounded-full"
        >
          {isPlaying ? <Pause size={18} fill="currentColor" className="text-slate-200" /> : <Play size={18} fill="currentColor" className="text-slate-200 ml-1" />}
        </button>

        <div className="flex-1 flex items-center gap-[2px] h-8 cursor-pointer relative" onClick={handleSeek}>
          {waveform.map((h, i) => (
            <div 
              key={i} 
              className={`flex-1 rounded-full transition-colors duration-75 ${
                progress > (i / 28) * 100 
                  ? (isOwnMessage ? 'bg-[#53bdeb]' : 'bg-emerald-400') 
                  : 'bg-slate-500/40'
              }`} 
              style={{ height: `${h}%` }} 
            />
          ))}
        </div>

        <div className="flex-shrink-0 relative">
           {isOwnMessage ? (
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Mic size={18} className="text-emerald-400" />
              </div>
           ) : (
             <img src={selectedUser?.profilePicture || '/avatar.png'} alt="Profile" className="w-10 h-10 rounded-full object-cover" />
           )}
        </div>
      </div>
      
      <div className="flex justify-between items-center px-1">
        <span className="text-[11px] font-medium text-slate-300 opacity-80 tracking-wide">
          {isPlaying || progress > 0 ? currentTime : duration}
        </span>
      </div>
    </div>
  );
};

const ViewOnceCard = ({ message, isOwnMessage, onOpen }) => (
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      if (message.canOpenViewOnce) onOpen(message);
    }}
    className={`mb-1 flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left ${
      isOwnMessage
        ? 'border-white/10 bg-black/20 text-white'
        : 'border-black/20 bg-black/20 text-slate-100'
    }`}
  >
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
      <EyeOff size={20} />
    </div>
    <div className="min-w-0 flex-1">
      <div className="font-medium">
        {message.viewOnceOpened || message.viewOnceOpenedByPeer
          ? 'Opened view once media'
          : `View once ${message.video ? 'video' : 'photo'}`}
      </div>
      <div className="text-xs text-white/65">
        {message.viewOnceOpened
          ? 'You already opened this media'
          : message.viewOnceOpenedByPeer
            ? 'Recipient opened this media'
            : isOwnMessage
              ? 'Recipient can open this media only one time'
              : 'Tap to open'}
      </div>
    </div>
  </button>
);

const MessageBubble = ({
  message,
  isOwnMessage,
  selected,
  myReaction,
  reactionOpenFor,
  setReactionOpenFor,
  setReplyTarget,
  toggleSelectedMessage,
  reactToMessage,
  setLightboxMedia,
  onOpenViewOnce,
  selectedUser,
  chatBubbleColors,
  selectedMessages,
  onlineUsers // NEW
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef(0);
  const longPressRef = useRef(null);

  const isReacting = reactionOpenFor === message._id;

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    setIsDragging(true);
    longPressRef.current = setTimeout(() => {
      setReactionOpenFor(message._id);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 450);
  };

  const handleTouchMove = (e) => {
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX.current;
    if (Math.abs(diff) > 10) clearTimeout(longPressRef.current);
    if (diff > 0 && diff < 80) setSwipeOffset(diff);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressRef.current);
    setIsDragging(false);
    if (swipeOffset > 55) {
      setReplyTarget(message);
      if (navigator.vibrate) navigator.vibrate(50);
    }
    setSwipeOffset(0);
  };

  const handleMouseDown = (e) => {
    touchStartX.current = e.clientX;
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const diff = e.clientX - touchStartX.current;
    if (diff > 0 && diff < 80) setSwipeOffset(diff);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (swipeOffset > 55) setReplyTarget(message);
    setSwipeOffset(0);
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      setSwipeOffset(0);
    }
  };

  // Determine read/delivery status for this specific message
  const isRead = (message.readBy || []).includes(selectedUser?._id);
  const isDelivered = (message.deliveredTo || []).includes(selectedUser?._id) || isRead || onlineUsers.includes(selectedUser?._id);

  return (
    <div
      className={`relative w-full py-1 transition-colors duration-200 ${selected ? 'bg-[#005c4b]/30' : ''} ${isReacting ? 'z-50' : 'z-10'}`}
      onClick={() => {
        if (selectedMessages?.length > 0) toggleSelectedMessage(message._id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        toggleSelectedMessage(message._id); 
      }}
    >
      <div
        className={`chat relative flex items-center px-4 md:px-8 w-full ${isOwnMessage ? 'chat-end justify-end' : 'chat-start justify-start'}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={(e) => { 
          e.preventDefault(); 
          setReactionOpenFor(message._id); 
        }}
      >
        <div
          className={`absolute left-4 transition-all duration-200 z-0 ${swipeOffset > 20 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
          style={{ transform: `translateX(${Math.min(swipeOffset - 40, 0)}px)` }}
        >
          <div className="bg-[#202c33] rounded-full p-2 shadow-lg">
            <Reply size={16} className="text-slate-300" />
          </div>
        </div>

        <div
          className={`relative z-10 transition-transform flex w-full ${isOwnMessage ? 'justify-end' : 'justify-start'} ${!isDragging ? 'duration-200 ease-out' : 'duration-0'}`}
        >
          <div 
            className={`chat-bubble relative group/bubble flex flex-col gap-1 rounded-lg w-fit max-w-[85%] sm:max-w-[75%] md:max-w-[65%] lg:max-w-[50%] ${isOwnMessage ? 'text-white' : 'text-slate-100'}`} 
            style={{ 
              backgroundColor: isOwnMessage ? chatBubbleColors.own : chatBubbleColors.other,
              transform: `translateX(${swipeOffset}px)`,
              userSelect: 'none', 
              wordBreak: 'break-word', 
              overflowWrap: 'anywhere' 
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setReactionOpenFor(message._id); }}
              className={`hidden md:flex absolute top-1 ${isOwnMessage ? '-left-8' : '-right-8'} opacity-0 group-hover/bubble:opacity-100 p-1.5 bg-[#202c33] border border-[#2a3942] rounded-full text-slate-300 hover:text-white hover:bg-[#2a3942] transition-all z-20 shadow-md items-center justify-center cursor-pointer`}
              title="React"
            >
              <Smile size={15} />
            </button>

            {message.replyTo && <div className='bg-black/25 rounded px-2 py-1 mb-1 text-xs border-l-2 border-emerald-400 opacity-90 line-clamp-3 whitespace-pre-wrap'>{message.replyTo.text || (message.replyTo.location ? 'Shared location' : 'Media message')}</div>}

            {message.viewOnce ? (
              <ViewOnceCard message={message} isOwnMessage={isOwnMessage} onOpen={onOpenViewOnce} />
            ) : (
              <>
                {message.image && <img src={message.image} alt='Attachment' onClick={(e) => { e.stopPropagation(); setLightboxMedia({ url: message.image, type: 'image' }); }} className='rounded cursor-pointer max-h-60 w-full object-cover mb-1' />}
                {message.video && <div className='relative cursor-pointer mb-1' onClick={(e) => { e.stopPropagation(); setLightboxMedia({ url: message.video, type: 'video' }); }}><video className='rounded max-h-60 w-full bg-black object-cover'><source src={message.video} type='video/mp4' /></video><div className='absolute inset-0 flex items-center justify-center'><Play size={24} /></div></div>}
              </>
            )}
            
            {message.audio && <VoiceNotePlayer audioUrl={message.audio} isOwnMessage={isOwnMessage} selectedUser={selectedUser} />}
            
            {message.sharedContactId && <div className='bg-black/20 p-2 rounded-lg mb-1'><SharedContactCard contactIdOrObject={message.sharedContactId} isOwnMessage={isOwnMessage} /></div>}
            {message.location && <LocationCard location={message.location} isOwnMessage={isOwnMessage} />}
            
            {message.text && <span className='leading-relaxed text-[15px] whitespace-pre-wrap'>{message.text}</span>}

            <div className={`flex items-center gap-1 text-[11px] opacity-70 mt-1 ${isOwnMessage ? 'justify-end' : 'justify-end'}`}>
              <span>{formatTime(message.createdAt)}</span>
              
              {/* UPDATED: Accurate Read/Delivered Ticks */}
              {isOwnMessage && (
                isRead 
                  ? <CheckCheck size={14} className='text-[#53bdeb]' /> 
                  : isDelivered
                    ? <CheckCheck size={14} className='text-slate-300' />
                    : <Check size={14} className='text-slate-300' />
              )}
            </div>
          </div>

          {isReacting && (
            <div className={`absolute top-full mt-2 ${isOwnMessage ? 'right-0' : 'left-0'} bg-[#233138] rounded-full px-3 py-2 flex gap-3 shadow-2xl border border-slate-700 z-[60]`}>
              {REACTIONS.map((emoji) => (
                <button 
                  key={emoji} 
                  className={`text-2xl hover:scale-125 transition-transform ${myReaction?.emoji === emoji ? 'bg-emerald-500/30 rounded-full' : ''}`}
                  onClick={(e) => { 
                    e.stopPropagation();
                    reactToMessage(message._id, myReaction?.emoji === emoji ? null : emoji); 
                    setReactionOpenFor(null); 
                  }}>
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div className={`absolute -bottom-3 ${isOwnMessage ? 'right-2' : 'left-2'} flex items-center gap-1 z-20`}>
            {(message.reactions || []).length > 0 && (
              <div 
                className='text-xs bg-[#1f2c33] border border-[#0b141a] rounded-full px-2 py-[2px] cursor-pointer shadow-sm'
                onClick={(e) => { e.stopPropagation(); setReactionOpenFor(isReacting ? null : message._id); }}
              >
                {[...new Set((message.reactions || []).map((r) => r.emoji))].join(' ')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function ChatBody() {
  const { authUser, onlineUsers } = useAuthStore();
  const { 
    messages, selectedUser, subscribeToTypingEvents, unsubscribeFromTypingEvents, 
    isTyping, isMessagesLoading, toggleSelectedMessage, selectedMessages, 
    setReplyTarget, reactToMessage, chatBackground, chatBubbleColors, chatBgOpacity, openViewOnceMessage 
  } = useChatStore();
  
  const [lightboxMedia, setLightboxMedia] = useState(null);
  const [reactionOpenFor, setReactionOpenFor] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!isMessagesLoading) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      }, 100);
    }
  }, [isMessagesLoading, selectedUser?._id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  useEffect(() => { subscribeToTypingEvents(); return () => unsubscribeFromTypingEvents(); }, [subscribeToTypingEvents, unsubscribeFromTypingEvents]);

  const handleOpenViewOnce = async (message) => {
    try {
      const result = await openViewOnceMessage(message._id);
      if (!result?.mediaUrl || !result?.mediaType) return;
      setLightboxMedia({
        url: result.mediaUrl,
        type: result.mediaType,
        viewOnce: true,
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not open view once media');
    }
  };

  if (isMessagesLoading) return <MessageSkeleton />;

  return (
    <>
      {messages.length === 0 ? <NoChatHistory /> : (
        <div className='flex-1 relative min-h-0 bg-[#0b141a] overflow-hidden'>
          
          {chatBackground && (
            <div 
              className="absolute inset-0 z-0 pointer-events-none"
              style={{
                backgroundImage: `url(${chatBackground})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: chatBgOpacity
              }}
            />
          )}

          <div className='absolute inset-0 z-10 overflow-x-hidden overflow-y-auto py-4'>
            
            {reactionOpenFor && (
              <div 
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200"
                onClick={() => setReactionOpenFor(null)}
                onContextMenu={(e) => { e.preventDefault(); setReactionOpenFor(null); }}
              />
            )}

            {messages.map((message, index) => {
              const isOwnMessage = message.senderId === authUser?._id;
              const selected = selectedMessages.includes(message._id);
              const myReaction = (message.reactions || []).find((r) => r.userId === authUser?._id || r.userId?._id === authUser?._id);
              
              const showDateDivider = index === 0 || !isSameDay(messages[index - 1].createdAt, message.createdAt);

              return (
                <React.Fragment key={message._id}>
                  {showDateDivider && (
                    <div className="flex justify-center my-4 z-10 pointer-events-none">
                      <span className="bg-[#182229] text-slate-300 text-[12px] font-medium px-3 py-1 rounded-lg shadow-sm">
                        {formatDateDivider(message.createdAt)}
                      </span>
                    </div>
                  )}
                  
                  <MessageBubble
                    message={message}
                    isOwnMessage={isOwnMessage}
                    selected={selected}
                    myReaction={myReaction}
                    reactionOpenFor={reactionOpenFor}
                    setReactionOpenFor={setReactionOpenFor}
                    setReplyTarget={setReplyTarget}
                    toggleSelectedMessage={toggleSelectedMessage}
                    reactToMessage={reactToMessage}
                    setLightboxMedia={setLightboxMedia}
                    onOpenViewOnce={handleOpenViewOnce}
                    selectedUser={selectedUser}
                    chatBubbleColors={chatBubbleColors}
                    selectedMessages={selectedMessages}
                    onlineUsers={onlineUsers} // NEW
                  />
                </React.Fragment>
              );
            })}

            {/* UPDATED: DaisyUI dots typing indicator */}
            {isTyping && (
              <div className='chat chat-start mb-10 px-4 md:px-8'>
                <div className='chat-bubble bg-[#202c33] text-slate-400 w-16 h-10 flex items-center justify-center'>
                  <span className="loading loading-dots loading-sm"></span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>
      )}

      {lightboxMedia && (
        <div className='fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center p-4' onClick={() => setLightboxMedia(null)}>
          <div className='absolute top-6 right-6 z-50'><a href={lightboxMedia.url} download target='_blank' rel='noopener noreferrer' className='p-2 bg-slate-800/50 hover:bg-slate-700 rounded-full text-white transition-colors' onClick={(e) => e.stopPropagation()}><Download size={24} /></a></div>
          {lightboxMedia.viewOnce && <div className="absolute top-6 left-6 z-50 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">View once</div>}
          {lightboxMedia.type === 'image' ? <img src={lightboxMedia.url} alt='Expanded view' className='max-w-full max-h-[85vh] object-contain rounded-md' /> : <video src={lightboxMedia.url} controls autoPlay className='max-w-full max-h-[85vh] rounded-md bg-black outline-none' onClick={(e) => e.stopPropagation()} />}
        </div>
      )}
    </>
  );
}

export default ChatBody;
