import React, { useEffect } from 'react'
import { useChatStore } from '../store/useChatStore';
import UsersLoadingSkeleton from './UsersLoadingSkeleton';
import { Contact } from 'lucide-react';
import NoChatsFound from './NoChatsFound';

function ContactList() {
  const { allContacts,getAllContacts,setSelectedUser, isUsersLoading } = useChatStore();
  
  useEffect(() => {
    getAllContacts();
  }, [getAllContacts]);
  
  if (isUsersLoading) return <UsersLoadingSkeleton />;
  if (allContacts.length === 0) return <NoChatsFound />;
  return (
       <>
      {allContacts.map((contact) => (
        <div
          key={contact._id}
          className="bg-cyan-500/10 p-4 rounded-lg cursor-pointer hover:bg-cyan-500/20 transition-colors"
          onClick={() => setSelectedUser(contact  )}
        >
          <div className="flex items-start gap-3">
            <div className={`avatar online}`}>
              <div className="size-8 rounded-full">  
                <img src={contact.profilePicture || "/avatar.png"} alt={contact.fullname} />
              </div>
            </div>
            <h4 className="text-slate-200 font-medium truncate">{contact.fullname}</h4>
            
          </div>
        </div>
      ))}
    </>
  )
}

export default ContactList