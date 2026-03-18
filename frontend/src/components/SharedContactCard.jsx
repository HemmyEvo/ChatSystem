import React, { useEffect, useState } from 'react';
import { User, Loader2 } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

export default function SharedContactCard({ contactIdOrObject, isOwnMessage }) {
  const [contactDetails, setContactDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { getUserById, setSelectedUser } = useChatStore();

  useEffect(() => {
    const fetchContactInfo = async () => {
      try {
        if (contactIdOrObject) setContactDetails(await getUserById(contactIdOrObject));
      } catch (error) {
        console.error('Could not load contact details', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchContactInfo();
  }, [contactIdOrObject, getUserById]);

  if (isLoading) return <div className={`flex items-center justify-center p-3 rounded-lg w-48 h-24 shadow-sm ${isOwnMessage ? 'bg-cyan-600' : 'bg-slate-700'}`}><Loader2 size={20} className="text-white animate-spin" /></div>;
  if (!contactDetails) return null;

  return (
    <div className={`flex flex-col p-3 rounded-lg w-48 shadow-sm ${isOwnMessage ? 'bg-cyan-600' : 'bg-slate-700'}`}>
      <div className="flex items-center gap-3 border-b border-white/20 pb-2 mb-2">
        <img src={contactDetails.profilePicture || '/avatar.png'} alt="Contact" className="w-10 h-10 rounded-full object-cover bg-slate-800" />
        <span className="text-white font-medium truncate">@{contactDetails.username || 'unknown'}</span>
      </div>
      <button onClick={() => setSelectedUser(contactDetails)} className="text-xs text-white/90 hover:text-white flex items-center justify-center gap-1 w-full bg-white/10 py-1.5 rounded transition-colors"><User size={14} /> Message</button>
    </div>
  );
}
