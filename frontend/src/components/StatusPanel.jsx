import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronUp, Eye, Image as ImageIcon, MessageCircle, Pencil, Plus, Smile, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useChatStore } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';

const TEXT_BACKGROUNDS = ['#0b141a', '#202c33', '#103629', '#4a2040', '#40220f', '#1b3c59'];
const STATUS_REACTIONS = ['\u2764\uFE0F', '\u{1F602}', '\u{1F60D}', '\u{1F525}', '\u{1F62E}', '\u{1F622}'];

const getRelativeLabel = (dateString) => {
  if (!dateString) return 'Just now';
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return 'Yesterday';
};

const getReactionForUser = (status, userId) =>
  (status?.reactions || []).find((reaction) => String(reaction.userId) === String(userId))?.emoji || null;

const StatusRing = ({ seen, children }) => (
  <div className={`rounded-full p-[3px] ${seen ? 'bg-[#374248]' : 'bg-[linear-gradient(180deg,#25d366,#00a884)]'}`}>
    <div className="rounded-full bg-[#111b21] p-[2px]">{children}</div>
  </div>
);

function StatusComposer({ onClose }) {
  const { postStatus } = useChatStore();
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [backgroundColor, setBackgroundColor] = useState(TEXT_BACKGROUNDS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const convertToBase64 = (fileOrBlob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(fileOrBlob);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });

  const handlePickFile = (file) => {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!text.trim() && !selectedFile) {
      toast.error('Add text, photo, or video to your status');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        text: text.trim(),
        backgroundColor,
        textColor: '#ffffff',
      };

      if (selectedFile) {
        const base64 = await convertToBase64(selectedFile);
        if (selectedFile.type.startsWith('video/')) payload.video = base64;
        else payload.image = base64;
      }

      await postStatus(payload);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to post status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-[1.8rem] bg-[#111b21] text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h3 className="text-lg font-medium">New status</h3>
            <p className="text-sm text-white/60">Share a moment on Existo app</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div
            className="flex min-h-[260px] items-center justify-center rounded-[1.5rem] p-6 text-center"
            style={{ background: selectedFile ? '#0b141a' : backgroundColor }}
          >
            {selectedFile ? (
              selectedFile.type.startsWith('video/') ? (
                <video src={previewUrl} controls className="max-h-[320px] w-full rounded-[1rem] bg-black object-contain" />
              ) : (
                <img src={previewUrl} alt="Status preview" className="max-h-[320px] w-full rounded-[1rem] object-contain" />
              )
            ) : (
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Type a status"
                className="min-h-[180px] w-full resize-none bg-transparent text-center text-3xl font-medium leading-relaxed text-white placeholder:text-white/45 focus:outline-none"
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {TEXT_BACKGROUNDS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setBackgroundColor(color)}
                className={`h-9 w-9 rounded-full border-2 ${backgroundColor === color ? 'border-white' : 'border-transparent'}`}
                style={{ background: color }}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/90 transition hover:bg-white/15"
            >
              <ImageIcon size={16} /> Photo
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/90 transition hover:bg-white/15"
            >
              <Camera size={16} /> Video
            </button>
            {selectedFile && (
              <button
                type="button"
                onClick={() => {
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setSelectedFile(null);
                  setPreviewUrl('');
                }}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/90 transition hover:bg-white/15"
              >
                <X size={16} /> Remove media
              </button>
            )}
          </div>

          {selectedFile && (
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Add a caption..."
              className="min-h-[90px] w-full rounded-[1rem] bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[#25d366]"
            />
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-full bg-[#00a884] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#01906f] disabled:opacity-60"
            >
              {isSubmitting ? 'Posting...' : 'Post status'}
            </button>
          </div>
        </div>

        <input hidden ref={fileInputRef} type="file" accept="image/*" onChange={(event) => handlePickFile(event.target.files?.[0])} />
        <input hidden ref={videoInputRef} type="file" accept="video/*" onChange={(event) => handlePickFile(event.target.files?.[0])} />
      </div>
    </div>
  );
}

function StatusViewer({ groups, activeGroupIndex, activeStatusIndex, onClose, onNext, onPrev }) {
  const { markStatusViewed, reactToStatus } = useChatStore();
  const authUser = useAuthStore((state) => state.authUser);
  const [showViewerSheet, setShowViewerSheet] = useState(false);
  const activeGroup = groups[activeGroupIndex];
  const activeStatus = activeGroup?.statuses?.[activeStatusIndex];
  const isOwnStatus = activeGroup?._id === authUser?._id;
  const activeReaction = getReactionForUser(activeStatus, authUser?._id);

  useEffect(() => {
    if (!activeStatus || !activeGroup) return undefined;
    if (activeGroup._id !== authUser?._id && !activeStatus.seen) {
      markStatusViewed(activeStatus._id).catch(() => {});
    }

    const timer = window.setTimeout(onNext, 5000);
    return () => window.clearTimeout(timer);
  }, [activeGroup, activeStatus, authUser?._id, markStatusViewed, onNext]);

  if (!activeGroup || !activeStatus) return null;

  return (
    <div className="fixed inset-0 z-[140] bg-black text-white">
      <div className="absolute inset-0">
        {activeStatus.type === 'text' ? (
          <div
            className="flex h-full w-full items-center justify-center px-8 text-center"
            style={{ background: activeStatus.backgroundColor, color: activeStatus.textColor || '#ffffff' }}
          >
            <div className="max-w-2xl text-4xl font-medium leading-tight">{activeStatus.text}</div>
          </div>
        ) : activeStatus.type === 'video' ? (
          <video src={activeStatus.mediaUrl} autoPlay playsInline className="h-full w-full object-contain" />
        ) : (
          <img src={activeStatus.mediaUrl} alt={activeGroup.username} className="h-full w-full object-contain" />
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/75 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/35 to-transparent sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/35 to-transparent sm:w-24" />

      <div className="relative flex h-full flex-col justify-between p-4 sm:p-6">
        <div>
          <div className="mb-4 flex gap-1.5">
            {activeGroup.statuses.map((status, index) => (
              <span
                key={status._id}
                className={`h-1 flex-1 rounded-full ${index < activeStatusIndex ? 'bg-white' : index === activeStatusIndex ? 'bg-white/90' : 'bg-white/25'}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={activeGroup.profilePicture || '/avatar.png'} alt={activeGroup.username} className="h-10 w-10 rounded-full object-cover" />
              <div>
                <div className="font-medium">{isOwnStatus ? 'My status' : activeGroup.username}</div>
                <div className="text-sm text-white/65">{getRelativeLabel(activeStatus.createdAt)}</div>
              </div>
            </div>
            <button onClick={onClose} className="rounded-full bg-black/30 p-2 text-white/80 backdrop-blur-md transition hover:bg-black/45 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="grid h-full grid-cols-2">
          <button aria-label="Previous status" type="button" className="h-full w-full" onClick={onPrev} />
          <button aria-label="Next status" type="button" className="h-full w-full" onClick={onNext} />
        </div>

        <div className="relative z-10 flex items-end gap-3">
          {isOwnStatus ? (
            <button
              type="button"
              onClick={() => setShowViewerSheet((value) => !value)}
              className="inline-flex items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-sm text-white backdrop-blur-md"
            >
              <Eye size={16} /> {activeStatus.viewersCount} viewers <ChevronUp size={16} />
            </button>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-black/40 px-2 py-2 backdrop-blur-md sm:max-w-[34rem]">
              {STATUS_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => reactToStatus(activeStatus._id, emoji)}
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[1.35rem] transition ${activeReaction === emoji ? 'bg-white/20 ring-1 ring-white/45' : 'hover:bg-white/10'}`}
                >
                  {emoji}
                </button>
              ))}
              <button
                type="button"
                onClick={() => reactToStatus(activeStatus._id, null)}
                className="ml-auto inline-flex min-w-0 items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/90 transition hover:bg-white/15"
              >
                <Smile size={16} />
                <span className="truncate">{activeReaction ? `Reacted ${activeReaction}` : 'Tap to react'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {isOwnStatus && showViewerSheet && (
        <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-[1.8rem] bg-[#111b21] p-5 shadow-2xl sm:left-1/2 sm:max-w-xl sm:-translate-x-1/2">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20" />
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-base font-medium">Status activity</div>
              <div className="text-sm text-white/55">{activeStatus.viewersCount} viewers</div>
            </div>
            <button onClick={() => setShowViewerSheet(false)} className="rounded-full p-2 text-white/75 hover:bg-white/10 hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div className="mb-4">
            <div className="mb-2 text-xs uppercase tracking-[0.2em] text-white/40">Reactions</div>
            <div className="flex flex-wrap gap-2">
              {(activeStatus.reactions || []).length ? (
                activeStatus.reactions.map((reaction, index) => (
                  <div key={`${reaction.userId}-${index}`} className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1.5 text-sm">
                    <span>{reaction.emoji}</span>
                    <span>{reaction.username || 'user'}</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-white/50">No reactions yet</div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.2em] text-white/40">Viewers</div>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {(activeStatus.viewers || []).length ? (
                activeStatus.viewers.map((viewer) => (
                  <div key={viewer._id} className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2.5">
                    <img src={viewer.profilePicture || '/avatar.png'} alt={viewer.username} className="h-10 w-10 rounded-full object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{viewer.username || 'user'}</div>
                      <div className="text-sm text-white/50">Viewed your status</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-white/50">No viewers yet</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPanel({ compact = false, onOpenChatWithUser = null }) {
  const { statuses, getStatuses, isStatusesLoading } = useChatStore();
  const authUser = useAuthStore((state) => state.authUser);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [viewerState, setViewerState] = useState(null);

  useEffect(() => {
    getStatuses();
  }, [getStatuses]);

  const ownGroup = useMemo(
    () => statuses.find((entry) => entry._id === authUser?._id) || {
      _id: authUser?._id,
      username: authUser?.username,
      profilePicture: authUser?.profilePicture,
      bio: authUser?.bio,
      statuses: [],
      hasUnseen: false,
    },
    [authUser?._id, authUser?.bio, authUser?.profilePicture, authUser?.username, statuses],
  );

  const contactGroups = useMemo(
    () => statuses.filter((entry) => entry._id !== authUser?._id),
    [authUser?._id, statuses],
  );

  const openViewer = (groupIndex, statusIndex = 0) => {
    setViewerState({ groupIndex, statusIndex });
  };

  const allGroups = useMemo(() => [ownGroup, ...contactGroups].filter((entry) => entry?._id), [contactGroups, ownGroup]);

  const stepViewer = (direction) => {
    setViewerState((current) => {
      if (!current) return current;
      const group = allGroups[current.groupIndex];
      const nextStatusIndex = current.statusIndex + direction;

      if (nextStatusIndex >= 0 && nextStatusIndex < (group?.statuses?.length || 0)) {
        return { ...current, statusIndex: nextStatusIndex };
      }

      const nextGroupIndex = current.groupIndex + direction;
      if (nextGroupIndex >= 0 && nextGroupIndex < allGroups.length) {
        const nextGroup = allGroups[nextGroupIndex];
        return {
          groupIndex: nextGroupIndex,
          statusIndex: direction > 0 ? 0 : Math.max((nextGroup?.statuses?.length || 1) - 1, 0),
        };
      }

      return null;
    });
  };

  return (
    <>
      <div className="space-y-4">
        {!compact && (
          <div className="px-2">
            <h2 className="text-[1.7rem] font-semibold text-white">Status</h2>
          </div>
        )}

        <div className="rounded-[1.4rem] bg-[#111b21] p-4 text-white shadow-sm">
          <button
            type="button"
            onClick={() => (ownGroup.statuses.length ? openViewer(0, 0) : setIsComposerOpen(true))}
            className="flex w-full items-center gap-3 text-left"
          >
            <div className="relative">
              <StatusRing seen={!ownGroup.hasUnseen && ownGroup.statuses.length > 0}>
                <img
                  src={authUser?.profilePicture || '/avatar.png'}
                  alt={authUser?.username}
                  className="h-14 w-14 rounded-full object-cover"
                />
              </StatusRing>
              <span className="absolute bottom-0 right-0 grid h-6 w-6 place-items-center rounded-full border-2 border-[#111b21] bg-[#25d366] text-[#111b21]">
                <Plus size={14} />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium">My status</div>
              <div className="truncate text-sm text-white/60">
                {ownGroup.statuses.length ? `Tap to view your ${ownGroup.statuses.length} update${ownGroup.statuses.length > 1 ? 's' : ''}` : 'Tap to add status update'}
              </div>
            </div>
          </button>

          {!compact && (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setIsComposerOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/90 transition hover:bg-white/15"
              >
                <Pencil size={16} /> Text
              </button>
              <button
                type="button"
                onClick={() => setIsComposerOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/90 transition hover:bg-white/15"
              >
                <Camera size={16} /> Photo or video
              </button>
            </div>
          )}
        </div>

        <div className="rounded-[1.4rem] bg-[#111b21] p-4 text-white shadow-sm">
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-white/45">{compact ? 'Recent' : 'Recent updates'}</div>

          {isStatusesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="h-14 w-14 animate-pulse rounded-full bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
                    <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : contactGroups.length ? (
            <div className="space-y-2">
              {contactGroups.map((group, index) => (
                <div key={group._id} className="flex items-center gap-2 rounded-[1rem] px-2 py-2 transition hover:bg-white/5">
                  <button
                    type="button"
                    onClick={() => openViewer(index + 1, 0)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <StatusRing seen={!group.hasUnseen}>
                      <img src={group.profilePicture || '/avatar.png'} alt={group.username} className="h-14 w-14 rounded-full object-cover" />
                    </StatusRing>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{group.username}</div>
                      <div className="truncate text-sm text-white/58">
                        {group.statuses[0] ? getRelativeLabel(group.statuses[group.statuses.length - 1].createdAt) : 'No updates'}
                      </div>
                    </div>
                  </button>
                  {compact && onOpenChatWithUser && (
                    <button
                      type="button"
                      onClick={() => onOpenChatWithUser(group)}
                      className="rounded-full bg-white/8 p-2 text-white/75 transition hover:bg-white/12 hover:text-white"
                    >
                      <MessageCircle size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[1rem] bg-white/5 px-4 py-5 text-sm text-white/60">
              No recent status updates from your contacts yet.
            </div>
          )}
        </div>
      </div>

      {isComposerOpen && <StatusComposer onClose={() => setIsComposerOpen(false)} />}

      {viewerState && (
        <StatusViewer
          groups={allGroups}
          activeGroupIndex={viewerState.groupIndex}
          activeStatusIndex={viewerState.statusIndex}
          onClose={() => setViewerState(null)}
          onNext={() => stepViewer(1)}
          onPrev={() => stepViewer(-1)}
        />
      )}
    </>
  );
}

export default StatusPanel;
