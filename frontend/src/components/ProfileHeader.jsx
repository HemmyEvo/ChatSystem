import { useState, useRef } from "react";
import { Settings, LogOutIcon, Volume2Icon, VolumeOffIcon, ChevronDown } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const mouseClickSound = new Audio("/sounds/mouse-click.mp3");

function ProfileHeader() {
  const { logout, authUser, updateProfile } = useAuthStore();
  const { soundSettings, setSoundSetting } = useChatStore();
  const [selectedImg, setSelectedImg] = useState(null);
  const [openMenu, setOpenMenu] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onloadend = async () => {
      const base64Image = reader.result;
      setSelectedImg(base64Image);
      await updateProfile({ profilePic: base64Image });
    };
  };

  const toggleSound = (type) => {
    mouseClickSound.currentTime = 0;
    mouseClickSound.play().catch(() => {});
    setSoundSetting(type);
  };

  return (
    <div className="p-6 border-b border-slate-700/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="avatar online">
            <button
              className="size-14 rounded-full overflow-hidden relative group"
              onClick={() => fileInputRef.current.click()}
            >
              <img
                src={selectedImg || authUser?.data?.profilePicture || "/avatar.png"}
                alt="User image"
                className="size-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-white text-xs">Change</span>
              </div>
            </button>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          <div>
            <h3 className="text-slate-200 font-medium text-base max-w-[180px] truncate">{authUser?.data?.fullname}</h3>
            <p className="text-slate-400 text-xs">Online</p>
          </div>
        </div>

        <div className="relative">
          <button
            className="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
            onClick={() => setOpenMenu((prev) => !prev)}
          >
            <Settings className="size-5" />
            <ChevronDown className="size-4" />
          </button>

          {openMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2 z-20">
              <button
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded"
                onClick={() => toggleSound("receive")}
              >
                Receive sound
                {soundSettings.receive ? <Volume2Icon className="size-4 text-emerald-400" /> : <VolumeOffIcon className="size-4 text-slate-500" />}
              </button>

              <button
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded"
                onClick={() => toggleSound("send")}
              >
                Send sound
                {soundSettings.send ? <Volume2Icon className="size-4 text-emerald-400" /> : <VolumeOffIcon className="size-4 text-slate-500" />}
              </button>

              <button
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-rose-300 hover:bg-slate-700 rounded"
                onClick={logout}
              >
                Logout
                <LogOutIcon className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default ProfileHeader;
