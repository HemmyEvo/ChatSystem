import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import NoChatHistory from './NoChatHistory';
import { useAuthStore } from '../store/useAuthStore';
import { Check, CheckCheck, Download, Play, Smile } from 'lucide-react';
import SharedContactCard from './SharedContactCard';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

function ChatBody() {
  const { authUser } = useAuthStore();
  const { messages, selectedUser, subscribeToTypingEvents, unsubscribeFromTypingEvents, isTyping, isMessagesLoading, toggleSelectedMessage, selectedMessages, setReplyTarget, reactToMessage } = useChatStore();
  const [lightboxMedia, setLightboxMedia] = useState(null);
  const [reactionOpenFor, setReactionOpenFor] = useState(null);
  const [touchStartX, setTouchStartX] = useState(0);
  const longPressRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { subscribeToTypingEvents(); return () => unsubscribeFromTypingEvents(); }, [subscribeToTypingEvents, unsubscribeFromTypingEvents]);

  if (isMessagesLoading) return <div className='flex-1 p-4 bg-[#0b141a] overflow-y-auto' />;

  return (
    <>
      {messages.length === 0 ? <NoChatHistory /> : (
        <div className='flex-1 p-4 md:px-8 bg-[#0b141a] overflow-y-auto relative'>
          {messages.map((message) => {
            const isOwnMessage = message.senderId === authUser?._id;
            const selected = selectedMessages.includes(message._id);
            const myReaction = (message.reactions || []).find((r) => r.userId === authUser?._id || r.userId?._id === authUser?._id);

            return (
              <div
                key={message._id}
                className={`chat mb-3 relative ${isOwnMessage ? 'chat-end' : 'chat-start'}`}
                onMouseDown={(e) => setTouchStartX(e.clientX)}
                onMouseUp={(e) => { if (e.clientX - touchStartX > 60) setReplyTarget(message); }}
                onTouchStart={(e) => {
                  setTouchStartX(e.touches[0].clientX);
                  longPressRef.current = setTimeout(() => toggleSelectedMessage(message._id), 450);
                }}
                onTouchMove={(e) => { if (e.touches[0].clientX - touchStartX > 60) setReplyTarget(message); clearTimeout(longPressRef.current); }}
                onTouchEnd={() => clearTimeout(longPressRef.current)}
                onContextMenu={(e) => { e.preventDefault(); toggleSelectedMessage(message._id); }}
              >
                <div className={`chat-bubble flex flex-col gap-2 rounded-lg ${isOwnMessage ? 'bg-[#005c4b] text-white' : 'bg-[#202c33] text-slate-100'} ${selected ? 'ring-2 ring-emerald-400' : ''}`} style={{ userSelect: 'none' }}>
                  {message.replyTo && <div className='bg-black/25 rounded px-2 py-1 text-xs border-l-2 border-emerald-300'>{message.replyTo.text || 'Media message'}</div>}

                  {message.image && <img src={message.image} alt='Attachment' onClick={() => setLightboxMedia({ url: message.image, type: 'image' })} className='rounded cursor-pointer max-h-60 w-full object-cover' />}
                  {message.video && <div className='relative cursor-pointer' onClick={() => setLightboxMedia({ url: message.video, type: 'video' })}><video className='rounded max-h-60 w-full bg-black object-cover'><source src={message.video} type='video/mp4' /></video><div className='absolute inset-0 flex items-center justify-center'><Play size={24} /></div></div>}
                  {message.audio && <audio controls className='max-w-full h-10'><source src={message.audio} type='audio/mpeg' /></audio>}
                  {message.sharedContactId && <div className='bg-black/20 p-2 rounded-lg'><SharedContactCard contactIdOrObject={message.sharedContactId} isOwnMessage={isOwnMessage} /></div>}
                  {message.text && <span className='break-words leading-relaxed text-sm'>{message.text}</span>}

                  <div className='flex items-center justify-end gap-1 text-[11px] opacity-80'>
                    <span>{formatTime(message.createdAt)}</span>
                    {isOwnMessage && ((message.readBy || []).includes(selectedUser?._id) ? <CheckCheck size={14} className='text-[#53bdeb]' /> : <Check size={14} />)}
                  </div>
                </div>

                <div className='absolute -bottom-5 right-2 flex items-center gap-1'>
                  {(message.reactions || []).length > 0 && <div className='text-xs bg-[#1f2c33] rounded-full px-2 py-[2px]'>{[...new Set((message.reactions || []).map((r) => r.emoji))].join(' ')}</div>}
                  <button onClick={() => setReactionOpenFor(reactionOpenFor === message._id ? null : message._id)} className='opacity-70 hover:opacity-100'><Smile size={14} /></button>
                </div>
                {reactionOpenFor === message._id && (
                  <div className='absolute -top-8 bg-[#233138] rounded-full px-2 py-1 flex gap-1 z-20'>
                    {REACTIONS.map((emoji) => (
                      <button key={emoji} onClick={() => { reactToMessage(message._id, myReaction?.emoji === emoji ? null : emoji); setReactionOpenFor(null); }}>{emoji}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {isTyping && <div className='chat chat-start mb-4'><div className='chat-bubble bg-[#202c33] text-slate-200 w-16'>...</div></div>}
          <div ref={messagesEndRef} />
        </div>
      )}

      {lightboxMedia && (
        <div className='fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4' onClick={() => setLightboxMedia(null)}>
          <div className='absolute top-6 right-6 z-50'><a href={lightboxMedia.url} download target='_blank' rel='noopener noreferrer' className='p-2 bg-slate-800/50 hover:bg-slate-700 rounded-full text-white transition-colors'><Download size={24} /></a></div>
          {lightboxMedia.type === 'image' ? <img src={lightboxMedia.url} alt='Expanded view' className='max-w-full max-h-[85vh] object-contain rounded-md' /> : <video src={lightboxMedia.url} controls autoPlay className='max-w-full max-h-[85vh] rounded-md bg-black outline-none' />}
        </div>
      )}
    </>
  );
}

export default ChatBody;
