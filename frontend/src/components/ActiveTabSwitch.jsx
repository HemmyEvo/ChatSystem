import { useChatStore } from "../store/useChatStore";

function ActiveTabSwitch() {
  const { activeTab, setActiveTab, chats } = useChatStore();
  const unreadTotal = chats.reduce((total, chat) => total + Number(chat.unreadCount || 0), 0);

  return (
    <div className="mx-3 mb-2 flex rounded-2xl bg-[#202c33] p-1">
      <button
        type="button"
        onClick={() => setActiveTab("chats")}
        className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${activeTab === "chats" ? "bg-[#00a884] text-white" : "text-slate-300"}`}
      >
        <span className="inline-flex items-center gap-2">
          Chats
          {unreadTotal > 0 && (
            <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-white/20 px-1 text-[10px] font-bold">
              {unreadTotal > 99 ? "99+" : unreadTotal}
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={() => setActiveTab("updates")}
        className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${activeTab === "updates" ? "bg-[#00a884] text-white" : "text-slate-300"}`}
      >
        Updates
      </button>
      <button
        type="button"
        onClick={() => setActiveTab("contacts")}
        className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${activeTab === "contacts" ? "bg-[#00a884] text-white" : "text-slate-300"}`}
      >
        People
      </button>
    </div>
  );
}
export default ActiveTabSwitch;
