import React, { useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import UsersLoadingSkeleton from './UsersLoadingSkeleton';
import { Check, Search, UserPlus, X } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

function ContactList() {
  const { people, getPeople, setSelectedUser, isUsersLoading, peopleSearchTerm, setPeopleSearchTerm, sendFriendRequest, respondToFriendRequest } = useChatStore();
  const { onlineUsers } = useAuthStore();

  useEffect(() => { getPeople(); }, [getPeople]);
  useEffect(() => { const timer = setTimeout(() => getPeople(peopleSearchTerm), 250); return () => clearTimeout(timer); }, [peopleSearchTerm, getPeople]);

  if (isUsersLoading) return <UsersLoadingSkeleton />;

  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="relative shrink-0">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input type="text" value={peopleSearchTerm} onChange={(e) => setPeopleSearchTerm(e.target.value)} placeholder="Search people on the app..." className="w-full bg-slate-700/70 text-slate-200 pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
      </div>

      <div className="space-y-2 overflow-y-auto">
        {people.map((person) => {
          const isOnline = onlineUsers.includes(person._id);
          return (
            <div key={person._id} className="bg-slate-800/70 p-3 rounded-xl border border-slate-700">
              <div className="flex items-center gap-3">
                <div className={`avatar ${isOnline ? 'online' : 'offline'}`}>
                  <div className="size-11 rounded-full"><img src={person.profilePicture || '/avatar.png'} alt={person.username} className="object-cover" /></div>
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='text-slate-100 font-medium truncate'>@{person.username}</div>
                  <div className='text-xs text-slate-400 truncate'>{person.email}</div>
                </div>
                {person.isFriend ? (
                  <button onClick={() => setSelectedUser(person)} className='px-3 py-2 rounded-lg bg-emerald-600/20 text-emerald-300 text-xs'>Message</button>
                ) : person.requestReceived ? (
                  <div className='flex gap-2'>
                    <button onClick={() => respondToFriendRequest(person._id, true)} className='p-2 rounded-lg bg-emerald-600/20 text-emerald-300'><Check size={16} /></button>
                    <button onClick={() => respondToFriendRequest(person._id, false)} className='p-2 rounded-lg bg-rose-600/20 text-rose-300'><X size={16} /></button>
                  </div>
                ) : person.requestSent ? (
                  <span className='text-xs text-amber-300'>Request sent</span>
                ) : (
                  <button onClick={() => sendFriendRequest(person._id)} className='p-2 rounded-lg bg-cyan-600/20 text-cyan-300'><UserPlus size={16} /></button>
                )}
              </div>
            </div>
          );
        })}
        {people.length === 0 && <div className='text-center text-slate-400 py-6'>No people found.</div>}
      </div>
    </div>
  );
}

export default ContactList;
