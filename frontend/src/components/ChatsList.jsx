import { useEffect, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Check,
  CheckCheck,
  Image as ImageIcon,
  Mic,
  Pin,
  Search,
  Video,
  ArrowLeft,
} from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import UsersLoadingSkeleton from './UsersLoadingSkeleton';
import NoChatsFound from './NoChatsFound';
import { useAuthStore } from '../store/useAuthStore.js';

const getLastMessagePreview = (message) => {
  if (!message) return 'Start a conversation';
  if (message.viewOnce) {
    if (message.viewOnceOpened || message.viewOnceOpenedByPeer) return 'Opened view-once media';
    return message.image ? 'View-once photo' : message.video ? 'View-once video' : 'View-once media';
  }
  if (message.sticker) return 'Sent a sticker';
  if (message.text) return message.text;
  if (message.audio) return 'Voice message';
  if (message.image) return 'Photo';
  if (message.video) return 'Video';
  if (message.document) return 'Document';
  if (message.sharedContactId) return 'Shared a contact';
  return 'Shared a message';
};

const getLastMessageIcon = (message) => {
  if (message?.audio) return <Mic size={14} />;
  if (message?.image) return <ImageIcon size={14} />;
  if (message?.video) return <Video size={14} />;
  return null;
};

const getLastSeenLabel = (lastSeen) => {
  if (!lastSeen) return 'Start a conversation';
  const date = new Date(lastSeen);
  if (Number.isNaN(date.getTime())) return 'Start a conversation';
  if (date.toDateString() === new Date().toDateString()) {
    return `Last seen ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return `Last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
};

function ChatsList() {
  const {
    getChats,
    chats,
    isUsersLoading,
    setSelectedUser,
    selectedUser,
    searchTerm,
    setSearchTerm,
    archivedChatIds,
    toggleArchiveChat,
    togglePinChat,
    pinnedChatIds,
    typingUsers,
    subscribeToNewMessages,
    subscribeToTypingEvents,
  } = useChatStore();
  const { onlineUsers, authUser, userLastSeenMap } = useAuthStore();
  const [showArchivedView, setShowArchivedView] = useState(false);

  useEffect(() => {
    getChats();
    subscribeToNewMessages();
    subscribeToTypingEvents();
  }, [getChats, subscribeToNewMessages, subscribeToTypingEvents]);

  const filteredChats = chats.filter((chat) => chat.username.toLowerCase().includes(searchTerm.toLowerCase()));
  const visibleChats = filteredChats.filter((chat) => !archivedChatIds.includes(chat._id)).sort((a, b) => {
    const aPinned = pinnedChatIds.includes(a._id);
    const bPinned = pinnedChatIds.includes(b._id);
    return Number(bPinned) - Number(aPinned);
  });
  const archivedChats = filteredChats.filter((chat) => archivedChatIds.includes(chat._id));

  if (isUsersLoading) return <UsersLoadingSkeleton />;
  if (chats.length === 0) return <NoChatsFound />;

  const renderRow = (chat) => {
    const isOnline = onlineUsers.includes(chat._id);
    const lastMessage = chat.lastMessage;
    const isMyLastMessage = lastMessage?.senderId?.toString() === authUser?._id?.toString();
    const isRead = isMyLastMessage && (lastMessage?.readBy || []).some((id) => id?.toString() === chat._id);
    const isDelivered = isMyLastMessage && ((lastMessage?.deliveredTo || []).some((id) => id?.toString() === chat._id) || isRead);
    const preview = typingUsers[chat._id]
      ? 'Typing…'
      : lastMessage
        ? getLastMessagePreview(lastMessage)
        : isOnline
          ? 'Online now'
          : getLastSeenLabel(userLastSeenMap[chat._id] || chat.lastSeen);
    const date = lastMessage?.createdAt ? new Date(lastMessage.createdAt) : null;
    const isSelected = selectedUser?._id === chat._id;

    return (
      <div
        key={chat._id}
        className={`conversation-row ${isSelected ? 'conversation-row--selected' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => setSelectedUser(chat)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setSelectedUser(chat);
          }
        }}
        aria-current={isSelected ? 'true' : undefined}
      >
        <span className="relative shrink-0">
          <img className="conversation-avatar" src={chat.profilePicture || '/avatar.png'} alt="" />
          {isOnline && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[var(--panel)] bg-[var(--accent)]" />}
        </span>
        <span className="conversation-copy">
          <span className="conversation-titleline">
            <span className="conversation-title">@{chat.username}</span>
            <span className="conversation-time">
              {date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </span>
          <span className="conversation-previewline">
            <span className={`conversation-preview ${typingUsers[chat._id] ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>
              {isMyLastMessage && (isRead
                ? <CheckCheck className="mr-1 inline text-emerald-600" size={14} />
                : isDelivered
                  ? <CheckCheck className="mr-1 inline" size={14} />
                  : <Check className="mr-1 inline" size={14} />)}
              {getLastMessageIcon(lastMessage)}
              {preview}
            </span>
            <span className="conversation-tools">
              {chat.unreadCount > 0 && (
                <span className="unread-badge" aria-label={`${chat.unreadCount} unread messages`}>
                  {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                </span>
              )}
              <button
                type="button"
                className="conversation-tool"
                onClick={(event) => {
                  event.stopPropagation();
                  togglePinChat(chat._id);
                }}
                aria-label={pinnedChatIds.includes(chat._id) ? 'Unpin chat' : 'Pin chat'}
                title={pinnedChatIds.includes(chat._id) ? 'Unpin chat' : 'Pin chat'}
              >
                <Pin size={14} className={pinnedChatIds.includes(chat._id) ? 'text-emerald-700' : ''} />
              </button>
              <button
                type="button"
                className="conversation-tool"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleArchiveChat(chat._id);
                }}
                aria-label="Archive chat"
                title="Archive chat"
              >
                <Archive size={14} />
              </button>
            </span>
          </span>
        </span>
      </div>
    );
  };

  return (
    <section aria-label="Conversations">
      {showArchivedView ? (
        <>
          <button type="button" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)]" onClick={() => setShowArchivedView(false)}>
            <ArrowLeft size={17} /> Archived chats
          </button>
          <div className="conversation-list">{archivedChats.map(renderRow)}</div>
        </>
      ) : (
        <>
          <label className="relative block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search conversations"
              className="chat-search py-3 pl-10 pr-3 text-sm focus:outline-none"
              aria-label="Search conversations"
            />
          </label>
          {archivedChats.length > 0 && (
            <button type="button" className="conversation-row mt-3" onClick={() => setShowArchivedView(true)}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]"><ArchiveRestore size={18} /></span>
              <span className="conversation-copy">
                <span className="conversation-title">Archived</span>
                <span className="conversation-preview">{archivedChats.length} conversations</span>
              </span>
            </button>
          )}
          <div className="conversation-list">{visibleChats.map(renderRow)}</div>
          {visibleChats.length === 0 && <p className="px-3 py-8 text-center text-sm text-[var(--muted)]">No conversations match your search.</p>}
        </>
      )}
    </section>
  );
}

export default ChatsList;
