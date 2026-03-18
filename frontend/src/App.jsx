import { Routes, Route, Navigate } from 'react-router';
import ChatPage from './pages/ChatPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import { useAuthStore } from './store/useAuthStore';
import { useGameStore } from './store/useGameStore';
import { useEffect } from 'react';
import PageLoader from './components/PageLoader';
import { Toaster } from 'react-hot-toast';

function App() {
  const { checkAuth, isCheckingAuth, authUser, socket } = useAuthStore();
  const { subscribeGameEvents } = useGameStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const handleVisibility = () => {
      if (!socket?.connected) return;
      if (document.hidden) {
        socket.emit('user:away');
      } else {
        socket.emit('user:active');
      }
    };

    const handleBeforeUnload = () => {
      if (socket?.connected) {
        socket.emit('user:away');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const bindGameEvents = () => {
      subscribeGameEvents();
    };

    if (socket.connected) {
      bindGameEvents();
    }

    socket.on('connect', bindGameEvents);
    return () => {
      socket.off('connect', bindGameEvents);
    };
  }, [socket, subscribeGameEvents]);

  if (isCheckingAuth) return <PageLoader />;

  return (
    <div className='min-h-screen bg-slate-900 relative flex items-center justify-center  overflow-hidden'>
      <div className='absolute inset-0  bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px]' />
      <div className='absolute top-0 -left-4 size-96 bg-pink-500 opacity-20 blur-[100px]' />
      <div className='absolute bottom-0 -right-4 size-96 bg-cyan-500 opacity-20 blur-[100px]' />
      <Routes>
        <Route path='/' element={authUser ? <ChatPage /> : <Navigate to={'/login'} />} />
        <Route path='/login' element={authUser ? <Navigate to={'/'} /> : <LoginPage />} />
        <Route path='/signup' element={authUser ? <Navigate to={'/'} /> : <SignUpPage />} />
      </Routes>
      <Toaster />
    </div>
  );
}

export default App;
