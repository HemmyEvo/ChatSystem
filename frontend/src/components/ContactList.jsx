import React, { useEffect, useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import UsersLoadingSkeleton from './UsersLoadingSkeleton';
import { Contact, Search } from 'lucide-react'; // Added Search icon
import NoChatsFound from './NoChatsFound';
import { useAuthStore } from '../store/useAuthStore';

function ContactList() {
  const { allContacts, getAllContacts, setSelectedUser, isUsersLoading } = useChatStore();
  const { onlineUsers } = useAuthStore();
  
  // NEW: State for the search query
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    getAllContacts();
  }, [getAllContacts]);

  if (isUsersLoading) return <UsersLoadingSkeleton />;
  if (allContacts.length === 0) return <NoChatsFound />;

  // NEW: Filter contacts based on the search query
  const filteredContacts = allContacts.filter((contact) =>
    contact.fullname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* NEW: Search Bar Input */}
      <div className="relative shrink-0">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search contacts..."
          className="w-full bg-slate-700/70 text-slate-200 pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      </div>

      {/* Contact List */}
      <div className="space-y-1 overflow-y-auto">
        {filteredContacts.length > 0 ? (
          filteredContacts.map((contact) => (
            <div
              key={contact._id}
              className="bg-cyan-500/10 p-3 rounded-lg cursor-pointer hover:bg-cyan-500/20 transition-colors"
              onClick={() => setSelectedUser(contact)}
            >
              <div className="flex items-center gap-3">
                <div className={`avatar ${onlineUsers.includes(contact._id) ? "online" : "offline"}`}>
                  <div className="size-10 rounded-full">  
                    <img src={contact.profilePicture || "/avatar.png"} alt={contact.fullname} className="object-cover" />
                  </div>
                </div>
                <h4 className="text-slate-200 font-medium truncate">{contact.fullname}</h4>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-slate-400 text-sm">
            No contacts found matching "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}

export default ContactList;