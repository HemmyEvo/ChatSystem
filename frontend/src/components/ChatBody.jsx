import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import NoChatHistory from './NoChatHistory';
import { useAuthStore } from '../store/useAuthStore';
import { X, FileText, Download, User, Loader2, Play, MoreVertical, Trash2 } from 'lucide-react';
import SharedContactCard from './SharedContactCard';



const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function ChatBody() {
  const { authUser } = useAuthStore();
  
  // Pull deleteMessage and isSoundEnabled
  const { messages, selectedUser,subscribeToTypingEvents, unsubscribeFromTypingEvents, isTyping, isMessagesLoading, deleteMessage } = useChatStore();
  
  const [lightboxMedia, setLightboxMedia] = useState(null); 
  
  // State for mobile long-press menu
  const [activeDropdown, setActiveDropdown] = useState(null);
  const touchTimerRef = useRef(null);

  const messagesEndRef = useRef(null);


  // --- 2. RECEIVE SOUND EFFECT ---


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
        // Start listening when the component loads
        subscribeToTypingEvents();
        // Stop listening when we close the chat (cleanup)
        return () => unsubscribeFromTypingEvents();
    }, [subscribeToTypingEvents, unsubscribeFromTypingEvents]);


  // --- 3. MOBILE LONG PRESS LOGIC ---
  const handleTouchStart = (msgId) => {
    touchTimerRef.current = setTimeout(() => {
      setActiveDropdown(activeDropdown === msgId ? null : msgId);
    }, 500); // Trigger after 500ms hold
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };

  // Close dropdown if user clicks elsewhere
  const closeDropdown = () => setActiveDropdown(null);
if (isMessagesLoading) {
    return (
      <div className='flex-1 p-4 md:p-10 bg-slate-900 overflow-y-auto'>
        {/* Generate 4 alternating skeleton chat bubbles */}
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`chat mb-4 animate-pulse ${i % 2 === 0 ? 'chat-start' : 'chat-end'}`}>
            <div className="chat-image avatar">
              <div className="size-10 rounded-full bg-slate-700/40"></div>
            </div>
            <div className={`chat-bubble bg-slate-700/30 ${i % 2 === 0 ? 'w-48 h-16' : 'w-32 h-12'}`}></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <> 
      {messages.length === 0 ? (
        <NoChatHistory />
      ) : (
        <div className='flex-1 p-4 md:p-10 bg-slate-900 overflow-y-auto relative' onClick={closeDropdown}>
          {messages.map((message) => {
            const isOwnMessage = message.senderId === authUser?._id;

            return (
              // Added relative & group classes for hover logic, and touch events for mobile
              <div 
                key={message._id} 
                className={`chat mb-4 relative group ${isOwnMessage ? 'chat-end' : 'chat-start'}`}
                onTouchStart={() => handleTouchStart(message._id)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchEnd} // Cancel if user scrolls instead of holding
              >
                
                <div className="chat-image avatar">
                  <div className="size-10 rounded-full border border-slate-700">  
                    <img src={isOwnMessage ? (authUser?.data?.profilePicture || "/avatar.png") : (selectedUser?.profilePicture || "/avatar.png")} alt="Avatar" />
                  </div>
                </div>

                {/* --- HEADER WITH DELETE BUTTON --- */}
                <div className="chat-header flex items-center gap-1 mb-1 relative">
                  <span className="opacity-50 text-xs hidden md:inline-block">
                    {isOwnMessage ? "You" : selectedUser?.fullname}
                  </span>
                  
                  {/* Delete Menu (Hover on Desktop, Long Press on Mobile) */}
                  {isOwnMessage && (
                    <div className={`dropdown ${isOwnMessage ? 'dropdown-left' : 'dropdown-right'} 
                      ${activeDropdown === message._id ? 'dropdown-open' : 'opacity-0 group-hover:opacity-100 hidden md:inline-block'}`}
                    >
                      <div tabIndex={0} role="button" className="p-1 text-slate-400 hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); setActiveDropdown(message._id); }}>
                        <MoreVertical size={14} />
                      </div>
                      <ul tabIndex={0} className="dropdown-content z-50 menu p-2 shadow bg-slate-800 rounded-box w-32 border border-slate-700">
                        <li>
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteMessage(message._id); }} 
                            className="text-red-500 hover:bg-red-500/10 hover:text-red-400 flex items-center gap-2"
                          >
                            <Trash2 size={16}/> Delete
                          </button>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>

                {/* --- CHAT BUBBLE --- */}
                <div className={`chat-bubble flex flex-col gap-2 ${isOwnMessage ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                  
                  {/* Image Renderer */}
                  {message.image && (
                    <div className="relative group/media inline-block -mx-2 -mt-2 mb-1">
                      <img src={message.image} alt="Attachment" onClick={(e) => { e.stopPropagation(); setLightboxMedia({ url: message.image, type: 'image' }); }} className="rounded-t-2xl cursor-pointer hover:opacity-90 transition-opacity object-cover max-h-60 w-full" />
                      <a href={message.image} download target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover/media:opacity-100 transition-opacity"><Download size={16} /></a>
                    </div>
                  )}

                  {/* Video Renderer */}
                  {message.video && (
                    <div className="relative group/media inline-block w-full -mx-2 -mt-2 mb-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); setLightboxMedia({ url: message.video, type: 'video' }); }}>
                      <video className="rounded-t-2xl max-h-60 w-full bg-black object-cover"><source src={message.video} type="video/mp4" /></video>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover/media:bg-black/40 transition-colors rounded-t-2xl"><div className="p-3 bg-white/20 backdrop-blur-sm rounded-full text-white"><Play size={24} className="ml-1" fill="currentColor" /></div></div>
                      <a href={message.video} download target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover/media:opacity-100 transition-opacity z-10"><Download size={16} /></a>
                    </div>
                  )}

                  {/* Audio Renderer */}
                  {message.audio && (
                    <audio controls className={`max-w-full h-10 ${isOwnMessage ? 'filter invert hue-rotate-180' : ''}`}><source src={message.audio} type="audio/mpeg" /></audio>
                  )}

                  {/* Document Renderer */}
                  {message.document && (
                    <div className="flex items-center gap-3 bg-black/20 p-2 rounded-lg"><div className="p-2 bg-white/10 rounded"><FileText size={20} className="text-white" /></div><div className="flex flex-col"><span className="text-sm font-medium">Document</span><a href={message.document} target="_blank" rel="noopener noreferrer" download onClick={(e) => e.stopPropagation()} className="text-white/80 hover:text-white text-xs flex items-center gap-1 mt-1 transition-colors"><Download size={12} /> Click to download</a></div></div>
                  )}

                  {/* Contact Renderer */}
                  {message.sharedContactId && (
                    <div className="bg-black/20 p-2 rounded-lg -mx-1"><SharedContactCard contactIdOrObject={message.sharedContactId} isOwnMessage={isOwnMessage} /></div>
                  )}

                  {/* Text Renderer */}
                  {message.text && (<span className="break-words leading-relaxed text-sm">{message.text}</span>)}
                </div>

                <div className="chat-footer opacity-50 text-xs mt-1">{formatTime(message.createdAt)} {isOwnMessage ? ((message.readBy || []).includes(selectedUser?._id) ? '✓✓' : '✓') : ''}</div>
              </div>
            );
          })}
         {isTyping && (
            <div className="chat chat-start mb-4">
              <div className="chat-image avatar">
                <div className="size-10 rounded-full border border-slate-700">
                  <img src={selectedUser?.profilePicture || "/avatar.png"} alt="Avatar" />
                </div>
              </div>
              <div className="chat-header flex items-center gap-1 mb-1 relative">
                <span className="opacity-50 text-xs hidden md:inline-block">
                  {selectedUser?.fullname}
                </span>
              </div>
              {/* Animated 3 dots */}
              <div className="chat-bubble bg-slate-700 text-slate-200 flex items-center justify-center gap-1.5 w-16 h-10">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}

          {/* This empty div is used to auto-scroll to the bottom */}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* --- LIGHTBOX OVERLAY --- */}
      {lightboxMedia && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4">
          <div className="absolute top-6 right-6 flex items-center gap-4 z-50">
            <a href={lightboxMedia.url} download target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-800/50 hover:bg-slate-700 rounded-full text-white transition-colors"><Download size={24} /></a>
            <button onClick={() => setLightboxMedia(null)} className="p-2 bg-slate-800/50 hover:bg-slate-700 rounded-full text-white transition-colors"><X size={24} /></button>
          </div>
          {lightboxMedia.type === 'image' ? (
            <img src={lightboxMedia.url} alt="Expanded view" className="max-w-full max-h-[85vh] object-contain rounded-md" />
          ) : (
            <video src={lightboxMedia.url} controls autoPlay className="max-w-full max-h-[85vh] rounded-md bg-black outline-none" />
          )}
        </div>
      )}
    </>
  );
}

export default ChatBody;