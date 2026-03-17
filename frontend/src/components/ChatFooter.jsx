import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import { Paperclip, Send, Mic, Video, User, X, Image as ImageIcon, Trash2, Square } from 'lucide-react';
import toast from 'react-hot-toast';

// 1. Set your audio paths here
const messageSendSound = new Audio("/sounds/send.mp3");
const recordStartSound = new Audio("/sounds/record-start.mp3");
const recordStopSound = new Audio("/sounds/record-stop.mp3");

function ChatFooter() {
  const [text, setText] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  
  
  const [previewMedia, setPreviewMedia] = useState(null); 
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // Pull isSoundEnabled from the store
  const { allContacts, getAllContacts, isUsersLoading,emitTypingEvent, sendMessage, soundSettings, replyTarget, setReplyTarget } = useChatStore();

  // Helper to play sounds safely
  const playSound = (audio) => {
    if (soundSettings.send) {
      audio.currentTime = 0;
      audio.play().catch(e => console.log("Audio play failed:", e));
    }
  };

  useEffect(() => {
    if (showContactModal && !allContacts?.length) getAllContacts();
  }, [showContactModal, getAllContacts, allContacts]);

  useEffect(() => {
    return () => {
      if (previewMedia?.url) URL.revokeObjectURL(previewMedia.url);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [previewMedia, audioUrl]);

  const convertToBase64 = (fileOrBlob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(fileOrBlob);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      // Play start sound
      playSound(recordStartSound);

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      setShowAttachMenu(false);
    } catch (err) {
      console.error(err);
      toast.error("Microphone access denied.");
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

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!text.trim() && !previewMedia && !audioBlob) return;
    
    try {
      let payload = {};
      if (text.trim()) payload.text = text.trim();
      if (previewMedia) {
        payload[previewMedia.type] = await convertToBase64(previewMedia.file);
      }
      if (audioBlob) {
        payload.audio = await convertToBase64(audioBlob);
      }
      setText("");
      setPreviewMedia(null);
      discardAudio();
      playSound(messageSendSound);
      await sendMessage(payload);    
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error(`The selected ${type} exceeds the 5MB limit.`);
      e.target.value = null;
      return;
    }

    setPreviewMedia({ file, url: URL.createObjectURL(file), type });
    setShowAttachMenu(false);
    e.target.value = null; 
  };

  const handleShareContact = async (contact) => {
      await sendMessage({ sharedContactId: contact._id });
      playSound(messageSendSound); // Play sound here too
      setShowContactModal(false);
      setShowAttachMenu(false);

  };

  return (
    <div className='bg-slate-800 p-4 relative'>
      {/* --- MEDIA PREVIEW MODAL --- */}
      {previewMedia && (
        <div className="absolute bottom-full left-0 w-full bg-slate-800 border-t border-slate-700 p-4 shadow-lg z-40 flex flex-col gap-4">
          <div className="flex justify-between items-center text-white mb-2">
            <h3 className="font-semibold capitalize">Send {previewMedia.type}</h3>
            <button onClick={() => setPreviewMedia(null)} className="p-1 hover:bg-slate-700 rounded-full disabled:opacity-50">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 flex items-center justify-center bg-slate-900 rounded-lg overflow-hidden min-h-[200px] max-h-[40vh]">
            {previewMedia.type === 'image' && <img src={previewMedia.url} alt="Preview" className="max-h-full max-w-full object-contain" />}
            {previewMedia.type === 'video' && <video src={previewMedia.url} controls className="max-h-full max-w-full" />}
          </div>
        </div>
      )}


      {replyTarget && (
        <div className='mb-2 bg-slate-700/70 border-l-4 border-emerald-400 rounded-md px-3 py-2 text-sm text-slate-200 flex items-start justify-between'>
          <div>
            <p className='text-emerald-300 text-xs mb-1'>Replying to message</p>
            <p className='line-clamp-1'>{replyTarget.text || 'Media message'}</p>
          </div>
          <button onClick={() => setReplyTarget(null)} type='button'><X size={16} /></button>
        </div>
      )}

      {/* --- MAIN INPUT ROW --- */}
      <form onSubmit={handleSendMessage} className='flex items-center gap-2'>
        <div className='relative'>
          <button type="button" disabled={isRecording ||  audioBlob} onClick={() => setShowAttachMenu(!showAttachMenu)} className='p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-700 disabled:opacity-50'>
            <Paperclip size={20} />
          </button>
          {showAttachMenu && (
            <div className='absolute bottom-12 left-0 bg-slate-700 rounded-lg shadow-xl p-2 flex flex-col gap-2 w-48 z-50'>
              <button type="button" onClick={() => fileInputRef.current?.click()} className='flex items-center gap-3 p-2 hover:bg-slate-600 rounded text-left text-sm text-slate-200'><ImageIcon size={18} className="text-blue-400" /> Image / Gallery</button>
              <button type="button" onClick={() => videoInputRef.current?.click()} className='flex items-center gap-3 p-2 hover:bg-slate-600 rounded text-left text-sm text-slate-200'><Video size={18} className="text-pink-400" /> Video</button>
              <button type="button" onClick={() => setShowContactModal(true)} className='flex items-center gap-3 p-2 hover:bg-slate-600 rounded text-left text-sm text-slate-200'><User size={18} className="text-green-400" /> Share Contact</button>
            </div>
          )}
        </div>

        <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} />
        <input type="file" hidden ref={videoInputRef} accept="video/*" onChange={(e) => handleFileUpload(e, 'video')} />

        {isRecording ? (
          <div className="flex-1 bg-red-500/10 text-red-500 rounded-full px-4 py-2 flex items-center justify-between border border-red-500/30">
            <div className="flex items-center gap-2 animate-pulse"><Mic size={16} /> Recording...</div>
            <span className="font-mono">{formatTime(recordingTime)}</span>
          </div>
        ) : audioBlob ? (
          <div className="flex-1 bg-slate-700 rounded-full px-4 py-2 flex items-center gap-3">
            <button type="button" onClick={discardAudio} className="text-slate-400 hover:text-red-400 disabled:opacity-50"><Trash2 size={18} /></button>
            <audio src={audioUrl} controls className="h-8 w-full invert grayscale opacity-80" />
          </div>
        ) : (
          <input 
            type="text" 
            value={text}
            onChange={(e) => {emitTypingEvent(); setText(e.target.value)}}
          
            placeholder={previewMedia ? "Add a caption..." : "Type a message..."} 
            className='flex-1 bg-slate-700 text-white rounded-full px-4 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder-slate-400 disabled:opacity-50'
          />
        )}

        {isRecording ? (
          <button type="button" onClick={stopRecording} className='p-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors'><Square size={18} /></button>
        ) : text.trim() || previewMedia || audioBlob ? (
          <button type="submit" className='p-3 bg-cyan-500 text-white rounded-full hover:bg-cyan-600 transition-colors'><Send size={18} className="ml-1" /></button>
        ) : (
          <button type="button" onClick={startRecording} className='p-3 bg-slate-700 text-slate-300 rounded-full hover:bg-slate-600 transition-colors'><Mic size={18} /></button>
        )}
      </form>

      {/* --- CONTACT SHARE MODAL --- */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 flex justify-between items-center border-b border-slate-700 text-white">
              <h3 className="font-bold">Share Contact</h3>
              <button onClick={() => setShowContactModal(false)}><X size={20} /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {isUsersLoading ? (
                <p className="text-slate-400 text-center">Loading contacts...</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {allContacts?.map(contact => (
                    <button key={contact._id} onClick={() => handleShareContact(contact)}  className="flex items-center gap-3 p-2 hover:bg-slate-700 rounded-lg cursor-pointer transition-colors w-full text-left disabled:opacity-50">
                      <img src={contact.profilePicture || "/avatar.png"} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
                      <span className="text-white font-medium">{contact.fullname}</span>
                    </button>
                  ))}
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