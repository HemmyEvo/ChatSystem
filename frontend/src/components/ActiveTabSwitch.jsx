import { MessageCircle, Radio, Users } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

function ActiveTabSwitch() {
  const { activeTab, setActiveTab, chats } = useChatStore();
  const unreadTotal = chats.reduce((total, chat) => total + Number(chat.unreadCount || 0), 0);

  return (
    <div className="primary-tabs">
      <button
        type="button"
        onClick={() => setActiveTab("chats")}
        className={`primary-tab ${activeTab === "chats" ? "primary-tab--active" : ""}`}
      >
        <MessageCircle size={15} />
        Chats
        {unreadTotal > 0 && <span className="primary-tab__count">{unreadTotal > 99 ? "99+" : unreadTotal}</span>}
      </button>
      <button
        type="button"
        onClick={() => setActiveTab("updates")}
        className={`primary-tab ${activeTab === "updates" ? "primary-tab--active" : ""}`}
      >
        <Radio size={15} />
        Updates
      </button>
      <button
        type="button"
        onClick={() => setActiveTab("contacts")}
        className={`primary-tab ${activeTab === "contacts" ? "primary-tab--active" : ""}`}
      >
        <Users size={15} />
        People
      </button>
    </div>
  );
}
export default ActiveTabSwitch;
