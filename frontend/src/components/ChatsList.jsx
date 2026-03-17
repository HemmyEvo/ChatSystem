import { useEffect } from "react";
import { Check, CheckCheck, Mic, Image as ImageIcon, Video, Archive, ArchiveRestore, Pin, Search } from "lucide-react";
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
  const {
    getChats,
    chats,
    isUsersLoading,
    setSelectedUser,
    searchTerm,
    setSearchTerm,
    archivedChatIds,
    toggleArchiveChat,
    togglePinChat,
    pinnedChatIds,
  } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();

  useEffect(() => {
    getChats();
  }, [getChats]);

  if (isUsersLoading) return <UsersLoadingSkeleton />;
  if (chats.length === 0) return <NoChatsFound />;

  const filteredChats = chats.filter((chat) => chat.fullname.toLowerCase().includes(searchTerm.toLowerCase()));
  const visibleChats = filteredChats.filter((chat) => !archivedChatIds.includes(chat._id));
  const archivedChats = filteredChats.filter((chat) => archivedChatIds.includes(chat._id));

  const renderRow = (chat) => {
    const isOnline = onlineUsers.includes(chat._id);
    const lastMessage = chat.lastMessage;
    const isMyLastMessage = lastMessage?.senderId === authUser?._id;
    const isRead = isMyLastMessage && (lastMessage?.readBy || []).includes(chat._id);

    return (
      <div
        key={chat._id}
        className="p-3 rounded-xl cursor-pointer hover:bg-slate-700/60 transition-colors border border-transparent hover:border-slate-600"
        onClick={() => setSelectedUser(chat)}
      >
        <div className="flex items-start gap-3">
          <div className={`avatar ${isOnline ? "online" : "offline"}`}>
            <div className="size-10 rounded-full">
              <img src={chat.profilePicture || "/avatar.png"} alt={chat.fullname} />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-slate-100 font-medium truncate">{chat.fullname}</h4>
              <span className="text-[11px] text-slate-400">
                {lastMessage?.createdAt &&
                  new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 mt-1">
              <p className="text-slate-400 text-sm truncate flex items-center gap-1">
                {isMyLastMessage ? (
                  isRead ? <CheckCheck size={14} className="text-sky-400" /> : <Check size={14} className="text-slate-400" />
                ) : isOnline ? (
                  <span className="text-[11px] text-emerald-400">online</span>
                ) : null}
                {getLastMessageIcon(lastMessage)}
                {getLastMessagePreview(lastMessage)}
              </p>

              <div className="flex items-center gap-2 shrink-0">
                {chat.unreadCount > 0 && (
                  <span className="min-w-5 h-5 px-1 rounded-full bg-emerald-500 text-[10px] text-white grid place-items-center font-semibold">
                    {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                  </span>
                )}

                <button
                  type="button"
                  className={`p-1 rounded hover:bg-slate-600 ${pinnedChatIds.includes(chat._id) ? "text-amber-400" : "text-slate-500"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePinChat(chat._id);
                  }}
                  title="Pin chat"
                >
                  <Pin size={14} />
                </button>

                <button
                  type="button"
                  className="p-1 rounded hover:bg-slate-600 text-slate-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleArchiveChat(chat._id);
                  }}
                  title="Archive chat"
                >
                  {archivedChatIds.includes(chat._id) ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search or start new chat"
          className="w-full bg-slate-700/70 text-slate-200 pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      </div>

      <div className="space-y-1">{visibleChats.map(renderRow)}</div>

      {archivedChats.length > 0 && (
        <div className="pt-2 border-t border-slate-700/60">
          <p className="text-xs uppercase text-slate-500 tracking-wider mb-1">Archived</p>
          <div className="space-y-1">{archivedChats.map(renderRow)}</div>
        </div>
      )}
    </div>
  );
}

export default ChatsList;
