import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import NoChatsFound from "./NoChatsFound";
import { useAuthStore } from "../store/useAuthStore.js";

function ChatsList() {
  const { getChats, chats, isUsersLoading, setSelectedUser } = useChatStore();
  const { onlineUsers, authUser, userLastSeenMap } = useAuthStore();

  useEffect(() => {
    getChats();
  }, [getChats]);

  if (isUsersLoading) return <UsersLoadingSkeleton />;
  if (chats.length === 0) return <NoChatsFound />;

  return (
    <>
      {chats.map((chat) => {
        const isOnline = onlineUsers.includes(chat._id);
        const lastMessage = chat.lastMessage;
        const isMyLastMessage = lastMessage?.senderId === authUser?._id;
        const isRead = isMyLastMessage && (lastMessage?.readBy || []).includes(chat._id);

        return (
          <div
            key={chat._id}
            className="bg-cyan-500/10 p-4 rounded-lg cursor-pointer hover:bg-cyan-500/20 transition-colors"
            onClick={() => setSelectedUser(chat)}
          >
            <div className="flex items-start gap-3">
              <div className={`avatar ${isOnline ? "online" : "offline"}`}>
                <div className="size-8 rounded-full">
                  <img src={chat.profilePicture || "/avatar.png"} alt={chat.fullname} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-slate-200 font-medium truncate">{chat.fullname}</h4>
                <p className="text-slate-400 text-sm truncate">
                  {isMyLastMessage ? (isRead ? '✓✓ ' : '✓ ') : ''}
                  {lastMessage?.text || 'Media message'}
                </p>
                {!isOnline && (chat.lastSeen || userLastSeenMap[chat._id]) && (
                  <p className="text-xs text-slate-500 truncate">
                    last seen {new Date(userLastSeenMap[chat._id] || chat.lastSeen).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="text-xs text-slate-400">
                {lastMessage?.createdAt &&
                  new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

export default ChatsList;
