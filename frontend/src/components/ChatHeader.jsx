import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useChatStore } from '../store/useChatStore';
import GoBackButton from './GoBackButton';
import { Ban, Copy, Forward, Reply, Trash2, MoreVertical, X, Image as ImageIcon, PaintBucket, SlidersHorizontal } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

const formatLastSeen = (lastSeen) => {
  if (!lastSeen) return 'recently';
  return new Date(lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

const compressImage = (file, callback) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (event) => {
    const img = new Image();
    img.src = event.target.result;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const MAX_WIDTH = 1080;
      const MAX_HEIGHT = 1080;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      callback(dataUrl);
    };
  };
};

function ChatHeader() {
  const { 
    selectedUser, setSelectedUser, blockUser, deleteChatHistory, selectedMessages, messages, 
    clearSelectedMessages, setReplyTarget, deleteMessageForMe, deleteMessageForEveryone, forwardSelectedMessages,
    chatBackground, setChatBackground, chatBubbleColors, setChatBubbleColors, chatBgOpacity, setChatBgOpacity 
  } = useChatStore();
  
  const { onlineUsers, userLastSeenMap } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  
  // NEW: State for the profile image lightbox
  const [showLightbox, setShowLightbox] = useState(false);
  
  const online = onlineUsers.includes(selectedUser?._id);
  const fileInputRef = useRef(null);

  const selectedItems = useMemo(() => messages.filter((m) => selectedMessages.includes(m._id)), [messages, selectedMessages]);
  const myId = useAuthStore.getState().authUser?._id;
  const canDeleteForEveryone = selectedItems.length === 1 && selectedItems[0]?.senderId === myId;

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        if (showLightbox) setShowLightbox(false); // Close lightbox on Esc
        else if (selectedMessages.length) clearSelectedMessages();
        else setSelectedUser(null);
      }
    };
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [setSelectedUser, selectedMessages.length, clearSelectedMessages, showLightbox]);

  const lastSeen = userLastSeenMap[selectedUser?._id] || selectedUser?.lastSeen;

  const copySelected = async () => {
    const text = selectedItems.map((m) => m.text).filter(Boolean).join('\n');
    if (text) await navigator.clipboard.writeText(text);
    clearSelectedMessages();
  };

  const handleDelete = async () => {
    await Promise.all(selectedItems.map((m) => deleteMessageForMe(m._id)));
    clearSelectedMessages();
  };

  const handleDeleteEveryone = async () => {
    if (!selectedItems[0]) return;
    await deleteMessageForEveryone(selectedItems[0]._id);
    clearSelectedMessages();
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    compressImage(file, (compressedDataUrl) => {
      setChatBackground(compressedDataUrl);
    });
  };

  return (
    <>
      <div className='w-full flex items-center justify-between px-4 py-3 md:px-6 bg-[#202c33] border-b border-[#2f3b43]'>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImageUpload} 
          accept="image/*" 
          className="hidden" 
        />

        {selectedMessages.length ? (
          <>
            <div className='flex items-center gap-4 text-white'>
              <button onClick={clearSelectedMessages}><X size={20} /></button>
              <span>{selectedMessages.length}</span>
            </div>
            <div className='flex items-center gap-5 text-slate-200'>
              <button onClick={copySelected}><Copy size={18} /></button>
              <button onClick={() => { if (selectedItems[0]) setReplyTarget(selectedItems[0]); clearSelectedMessages(); }}><Reply size={18} /></button>
              <button onClick={forwardSelectedMessages}><Forward size={18} /></button>
              <div className='dropdown dropdown-end'>
                <button tabIndex={0}><Trash2 size={18} /></button>
                <ul tabIndex={0} className='dropdown-content menu p-2 shadow bg-[#233138] rounded-box w-44 z-50'>
                  <li><button onClick={handleDelete}>Delete for me</button></li>
                  {canDeleteForEveryone && <li><button onClick={handleDeleteEveryone}>Delete for everyone</button></li>}
                </ul>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className='flex items-center gap-3'>
              <GoBackButton onClick={() => setSelectedUser(null)} />
              
              {/* UPDATED: Avatar is now a button to trigger lightbox */}
              <button 
                className={`avatar ${online ? 'online' : 'offline'} cursor-pointer hover:opacity-80 transition-opacity`}
                onClick={() => setShowLightbox(true)}
              >
                <div className='size-10 rounded-full'>
                  <img src={selectedUser?.profilePicture || '/avatar.png'} alt={selectedUser?.fullname} />
                </div>
              </button>

              <div className='flex flex-col items-start'>
                <h4 className='text-slate-200 font-medium'>{selectedUser?.fullname}</h4>
                <p className='text-xs text-slate-400'>{online ? 'online' : `last seen today at ${formatLastSeen(lastSeen)}`}</p>
              </div>
            </div>

            <div className='relative'>
              <button onClick={() => setShowMenu((s) => !s)} className='text-slate-300'><MoreVertical size={18} /></button>
              {showMenu && (
                <div className='absolute right-0 top-7 bg-[#233138] text-slate-100 rounded-md p-2 w-[260px] z-[60] shadow-xl border border-slate-700'>
                  
                  <div className="pb-3 mb-2 border-b border-slate-600">
                    <p className="text-[11px] text-slate-400 px-3 pb-2 uppercase tracking-wider font-semibold">Customization</p>
                    
                    <button className='w-full text-left px-3 py-2 hover:bg-[#2d3d45] rounded flex items-center gap-2 text-sm transition-colors' onClick={() => fileInputRef.current?.click()}>
                      <ImageIcon size={15} /> Set Wallpaper
                    </button>
                    
                    {chatBackground && (
                       <button className='w-full text-left px-3 py-2 hover:bg-[#2d3d45] rounded flex items-center gap-2 text-sm text-red-400 transition-colors' onClick={() => setChatBackground(null)}>
                         <X size={15} /> Remove Wallpaper
                       </button>
                    )}
                    
                    {chatBackground && (
                      <div className="px-3 py-2 flex flex-col gap-1 mt-1">
                        <span className="text-xs text-slate-300 flex items-center gap-2"><SlidersHorizontal size={13}/> Bg Opacity</span>
                        <input 
                          type="range" 
                          min="0.1" 
                          max="1" 
                          step="0.05" 
                          value={chatBgOpacity} 
                          onChange={(e) => setChatBgOpacity(Number(e.target.value))}
                          className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between px-3 py-2 mt-1 hover:bg-[#2d3d45] rounded transition-colors">
                      <span className="text-sm flex items-center gap-2 text-slate-200"><PaintBucket size={15}/> My Bubbles</span>
                      <input 
                        type="color" 
                        value={chatBubbleColors.own} 
                        onChange={(e) => setChatBubbleColors({...chatBubbleColors, own: e.target.value})}
                        className="w-7 h-7 rounded cursor-pointer border-none bg-transparent"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between px-3 py-2 hover:bg-[#2d3d45] rounded transition-colors">
                      <span className="text-sm flex items-center gap-2 text-slate-200"><PaintBucket size={15}/> Their Bubbles</span>
                      <input 
                        type="color" 
                        value={chatBubbleColors.other} 
                        onChange={(e) => setChatBubbleColors({...chatBubbleColors, other: e.target.value})}
                        className="w-7 h-7 rounded cursor-pointer border-none bg-transparent"
                      />
                    </div>
                  </div>

                  <button className='w-full text-left px-3 py-2 hover:bg-[#2d3d45] rounded flex items-center gap-2 text-sm transition-colors' onClick={() => { blockUser(selectedUser._id); setShowMenu(false); }}><Ban size={15} />Block user</button>
                  <button className='w-full text-left px-3 py-2 hover:bg-[#2d3d45] rounded flex items-center gap-2 text-sm text-red-400 transition-colors' onClick={() => { deleteChatHistory(selectedUser._id); setShowMenu(false); }}><Trash2 size={15} />Delete for me</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* NEW: Profile Image Lightbox */}
      {showLightbox && (
        <div 
          className='fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4' 
          onClick={() => setShowLightbox(false)}
        >
          <button 
            className='absolute top-6 right-6 z-50 p-2 bg-slate-800/50 hover:bg-slate-700 rounded-full text-white transition-colors'
            onClick={() => setShowLightbox(false)}
          >
            <X size={24} />
          </button>
          
          <div className="flex flex-col items-center gap-4">
            <img 
              src={selectedUser?.profilePicture || '/avatar.png'} 
              alt={selectedUser?.fullname} 
              className='max-w-full max-h-[75vh] object-contain rounded-full shadow-2xl' 
              onClick={(e) => e.stopPropagation()} 
            />
            <h2 className="text-white text-2xl font-semibold mt-4">{selectedUser?.fullname}</h2>
            <p className="text-slate-400">{selectedUser?.email}</p>
          </div>
        </div>
      )}
    </>
  );
}

export default ChatHeader;