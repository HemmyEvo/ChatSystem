import { useState, useEffect } from "react";
import { Check, CheckCheck, Mic, Image as ImageIcon, Video, Archive, ArchiveRestore, Pin, Search, ArrowLeft } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import NoChatsFound from "./NoChatsFound";
import { useAuthStore } from "../store/useAuthStore.js";

const getLastMessagePreview = (message) => {
  if (!message) return "No messages yet";
  if (message.text) return message.text;
  if (message.audio) return "Voice message";
  if (message.image) return "Photo";
  if (message.video) return "Video";
  if (message.document) return "Document";
  return "Media message";
};
const getLastMessageIcon = (message) => {
  if (!message) return null;
  if (message.audio) return <Mic size={13} className="text-slate-400" />;
  if (message.image) return <ImageIcon size={13} className="text-slate-400" />;
  if (message.video) return <Video size={13} className="text-slate-400" />;
  return null;
};

function ChatsList() {
  const { getChats, chats, isUsersLoading, setSelectedUser, searchTerm, setSearchTerm, archivedChatIds, toggleArchiveChat, togglePinChat, pinnedChatIds, typingUsers, subscribeToNewMessages, subscribeToTypingEvents } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();
  const [showArchivedView, setShowArchivedView] = useState(false);
  const filteredChats = chats.filter((chat) => chat.username.toLowerCase().includes(searchTerm.toLowerCase()));
  const visibleChats = filteredChats.filter((chat) => !archivedChatIds.includes(chat._id)).sort((a, b) => { const aPinned = pinnedChatIds.includes(a._id); const bPinned = pinnedChatIds.includes(b._id); if (aPinned && !bPinned) return -1; if (!aPinned && bPinned) return 1; return 0; });
  const archivedChats = filteredChats.filter((chat) => archivedChatIds.includes(chat._id));

  useEffect(() => { getChats(); subscribeToNewMessages(); subscribeToTypingEvents(); }, [getChats, subscribeToNewMessages, subscribeToTypingEvents]);
  if (isUsersLoading) return <UsersLoadingSkeleton />;
  if (chats.length === 0) return <NoChatsFound />;

  const renderRow = (chat) => {
    const isOnline = onlineUsers.includes(chat._id);
    const lastMessage = chat.lastMessage;
    const isMyLastMessage = lastMessage?.senderId === authUser?._id;
    const isRead = isMyLastMessage && (lastMessage?.readBy || []).includes(chat._id);
    const isUserTyping = typingUsers[chat._id];
    return (
      <div key={chat._id} className="p-3 rounded-xl cursor-pointer hover:bg-slate-700/60 transition-colors border border-transparent hover:border-slate-600" onClick={() => setSelectedUser(chat)}>
        <div className="flex items-start gap-3">
          <div className={`avatar ${isOnline ? "online" : "offline"}`}><div className="size-10 rounded-full"><img src={chat.profilePicture || "/avatar.png"} alt={chat.username} /></div></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between"><h4 className="text-slate-100 font-medium truncate">@{chat.username}</h4><span className="text-[11px] text-slate-400">{lastMessage?.createdAt && new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
            <div className="flex items-center justify-between gap-2 mt-1">
              <p className="text-slate-400 text-sm truncate flex items-center gap-1">{isUserTyping ? <span className="text-emerald-400 italic font-medium">@{chat.username} is typing...</span> : <>{isMyLastMessage ? (isRead ? <CheckCheck size={14} className="text-sky-400" /> : <Check size={14} className="text-slate-400" />) : null}{getLastMessageIcon(lastMessage)}{getLastMessagePreview(lastMessage)}</>}</p>
              <div className="flex items-center gap-2 shrink-0">
                {chat.unreadCount > 0 && !isUserTyping && <span className="min-w-5 h-5 px-1 rounded-full bg-emerald-500 text-[10px] text-white grid place-items-center font-semibold">{chat.unreadCount > 99 ? "99+" : chat.unreadCount}</span>}
                <button type="button" className={`p-1 rounded hover:bg-slate-600 ${pinnedChatIds.includes(chat._id) ? "text-amber-400" : "text-slate-500"}`} onClick={(e) => { e.stopPropagation(); togglePinChat(chat._id); }} title="Pin chat"><Pin size={14} /></button>
                <button type="button" className="p-1 rounded hover:bg-slate-600 text-slate-500" onClick={(e) => { e.stopPropagation(); toggleArchiveChat(chat._id); if (showArchivedView && archivedChats.length === 1 && archivedChatIds.includes(chat._id)) { setShowArchivedView(false); } }} title="Archive chat">{archivedChatIds.includes(chat._id) ? <ArchiveRestore size={14} /> : <Archive size={14} />}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return <div className="space-y-3">{showArchivedView ? <div className="flex flex-col h-full animate-in slide-in-from-right-2 duration-200"><div className="flex items-center gap-3 p-2 mb-2 text-slate-200 border-b border-slate-700/60 pb-3"><button onClick={() => setShowArchivedView(false)} className="p-2 hover:bg-slate-700 rounded-full transition-colors"><ArrowLeft size={20} /></button><h3 className="font-semibold text-lg">Archived</h3></div><div className="space-y-1 overflow-y-auto">{archivedChats.map(renderRow)}</div></div> : <><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search chats" className="w-full bg-slate-700/70 text-slate-200 pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" /></div><div className="space-y-1">{archivedChats.length > 0 && <div onClick={() => setShowArchivedView(true)} className="flex items-center gap-4 p-3 rounded-xl cursor-pointer hover:bg-slate-700/60 transition-colors border border-transparent mb-1"><div className="size-10 rounded-full bg-slate-800 flex items-center justify-center"><Archive size={18} className="text-emerald-500" /></div><div className="flex-1 font-medium text-slate-200">Archived</div><span className="text-xs text-emerald-500 font-medium">{archivedChats.length}</span></div>}{visibleChats.map(renderRow)}</div></>}</div>;
}

export default ChatsList;
