import { useChatStore } from "../store/useChatStore";

function ActiveTabSwitch() {
  const { activeTab, setActiveTab } = useChatStore();

  return (
    <div className="mx-3 mb-2 flex rounded-2xl bg-[#202c33] p-1">
      <button
        onClick={() => setActiveTab("chats")}
        className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${activeTab === "chats" ? "bg-[#00a884] text-white" : "text-slate-300"}`}
      >
        Chats
      </button>
      <button
        onClick={() => setActiveTab("updates")}
        className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${activeTab === "updates" ? "bg-[#00a884] text-white" : "text-slate-300"}`}
      >
        Updates
      </button>
      <button
        onClick={() => setActiveTab("contacts")}
        className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${activeTab === "contacts" ? "bg-[#00a884] text-white" : "text-slate-300"}`}
      >
        People
      </button>
    </div>
  );
}
export default ActiveTabSwitch;
