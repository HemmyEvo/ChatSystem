import { useEffect, useRef, useState } from "react";
import { Settings, LogOutIcon, Volume2Icon, VolumeOffIcon, ChevronDown, Download, Pencil, Check } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const receiveSoundPreview = new Audio("/sounds/notification.mp3");
const sendSoundPreview = new Audio("/sounds/send.mp3");

function ProfileHeader() {
  const { logout, authUser, updateProfile } = useAuthStore();
  const { soundSettings, setSoundSetting, ringtoneName, setRingtone } = useChatStore();
  const [selectedImg, setSelectedImg] = useState(null);
  const [openMenu, setOpenMenu] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isInstalled, setIsInstalled] = useState(window.matchMedia?.('(display-mode: standalone)').matches || false);
  const [bioDraft, setBioDraft] = useState(authUser?.bio || '');
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);
  const ringtoneInputRef = useRef(null);

  useEffect(() => {
    setBioDraft(authUser?.bio || '');
  }, [authUser?.bio]);

  useEffect(() => {
    if (!openMenu) return undefined;
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenu(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [openMenu]);

  useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result;
      setSelectedImg(base64Image);
      await updateProfile({ profilePic: base64Image });
    };
    reader.readAsDataURL(file);
  };

  const handleInstallApp = async () => {
    if (!installPromptEvent) return;
    await installPromptEvent.prompt();
    await installPromptEvent.userChoice.catch(() => null);
    setInstallPromptEvent(null);
  };

  const handleRingtoneUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setRingtone({ dataUrl: reader.result, name: file.name });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const toggleSound = (type) => {
    setSoundSetting(type);
    const isTurningOn = !soundSettings[type];
    if (isTurningOn) {
      const audioToPlay = type === "send" ? sendSoundPreview : receiveSoundPreview;
      audioToPlay.currentTime = 0;
      audioToPlay.play().catch(() => {});
    }
  };

  const saveBio = async () => {
    setIsSavingBio(true);
    try {
      await updateProfile({ bio: bioDraft.trim() });
      setEditingBio(false);
    } finally {
      setIsSavingBio(false);
    }
  };

  return (
    <div className="border-b border-[#2a3942] bg-[#111b21] px-4 py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="relative">
            <button
              className="h-14 w-14 overflow-hidden rounded-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <img
                src={selectedImg || authUser?.profilePicture || '/avatar.png'}
                alt="User image"
                className="h-full w-full object-cover"
              />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 grid h-6 w-6 place-items-center rounded-full border-2 border-[#111b21] bg-[#00a884] text-white"
            >
              <Pencil size={12} />
            </button>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-base font-medium text-white">@{authUser?.username}</h3>
            {editingBio ? (
              <div className="mt-2 flex items-start gap-2">
                <textarea
                  value={bioDraft}
                  onChange={(event) => setBioDraft(event.target.value.slice(0, 139))}
                  className="min-h-[68px] w-full max-w-[220px] resize-none rounded-xl bg-[#202c33] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-[#25d366]"
                  placeholder="Add your bio"
                />
                <button
                  type="button"
                  onClick={saveBio}
                  disabled={isSavingBio}
                  className="mt-1 grid h-9 w-9 place-items-center rounded-full bg-[#00a884] text-white transition hover:bg-[#01906f] disabled:opacity-60"
                >
                  <Check size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingBio(true)}
                className="mt-1 text-left text-sm text-white/62 transition hover:text-white"
              >
                {authUser?.bio || 'Hey there! I am using Existo app.'}
              </button>
            )}
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            className="flex items-center gap-1 text-slate-400 transition hover:text-slate-200"
            onClick={() => setOpenMenu((prev) => !prev)}
          >
            <Settings className="size-5" />
            <ChevronDown className="size-4" />
          </button>

          {openMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-[#2a3942] bg-[#202c33] p-2 shadow-xl z-20">
              <button
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-200 hover:bg-white/5 rounded-xl transition-colors"
                onClick={() => toggleSound("receive")}
              >
                Receive sound
                {soundSettings.receive ? <Volume2Icon className="size-4 text-emerald-400" /> : <VolumeOffIcon className="size-4 text-slate-500" />}
              </button>

              <button
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-200 hover:bg-white/5 rounded-xl transition-colors"
                onClick={() => toggleSound("send")}
              >
                Send sound
                {soundSettings.send ? <Volume2Icon className="size-4 text-emerald-400" /> : <VolumeOffIcon className="size-4 text-slate-500" />}
              </button>

              <button
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-200 hover:bg-white/5 rounded-xl transition-colors"
                onClick={() => ringtoneInputRef.current?.click()}
              >
                Ringtone
                <span className="max-w-[110px] truncate text-[11px] text-slate-400">{ringtoneName}</span>
              </button>

              {!isInstalled && installPromptEvent && (
                <button
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-cyan-300 hover:bg-white/5 rounded-xl transition-colors"
                  onClick={handleInstallApp}
                >
                  Install app
                  <Download className="size-4" />
                </button>
              )}

              <button
                className="mt-1 w-full flex items-center justify-between border-t border-white/5 px-3 py-2 pt-3 text-sm text-rose-300 hover:bg-white/5 rounded-xl transition-colors"
                onClick={logout}
              >
                Logout
                <LogOutIcon className="size-4" />
              </button>
            </div>
          )}
          <input
            ref={ringtoneInputRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={handleRingtoneUpload}
          />
        </div>
      </div>
    </div>
  );
}

export default ProfileHeader;
