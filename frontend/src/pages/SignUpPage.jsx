import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore.js';
import BorderAnimated from '../components/BorderAnimated';
import { LoaderIcon, LockIcon, Mail, MessageCircle, UserIcon } from 'lucide-react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';

function SignUpPage() {
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [usernameSuggestions, setUsernameSuggestions] = useState([]);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const { signup, isSigningup, fetchUsernameSuggestions } = useAuthStore();

  useEffect(() => {
    const value = formData.username.trim();
    if (value.length < 3) return undefined;

    const timer = setTimeout(async () => {
      try {
        const result = await fetchUsernameSuggestions(value);
        setUsernameAvailable(result.available);
        setUsernameSuggestions(result.available ? [] : result.suggestions || []);
      } catch {
        setUsernameAvailable(null);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [formData.username, fetchUsernameSuggestions]);

  const handleUsernameChange = (value) => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9._]/g, '');
    setFormData((prev) => ({ ...prev, username: normalized }));
    if (normalized.trim().length < 3) {
      setUsernameSuggestions([]);
      setUsernameAvailable(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signup(formData);
    } catch (error) {
      if (error.response?.status === 409) {
        const suggestions = error.response?.data?.suggestions || [];
        setUsernameSuggestions(suggestions);
        setUsernameAvailable(false);
        toast.error('That username is already taken. Pick one of the suggestions.');
      }
    }
  };

  return (
    <div className='w-full flex items-center justify-center p-4 bg-slate-900'>
      <div className="relative w-full max-w-6xl md:h-[800px] h-[650px]">
        <BorderAnimated>
          <div className="flex w-full flex-col md:flex-row">
            <div className="md:w-1/2 p-8 flex items-center justify-center md:border-r border-slate-600/30">
              <div className="w-full max-w-md">
                <div className="text-center mb-8">
                  <MessageCircle className="size-12 mx-auto text-slate-400 mb-4" />
                  <h2 className="text-2xl font-bold text-center mb-2 text-slate-200">Create an Account</h2>
                  <p className="text-slate-400 text-sm text-center mb-6">Join our community and start connecting with others today.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className='auth-input-label'>Username</label>
                    <div className="relative">
                      <UserIcon className='auth-input-icon'/>
                      <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        required
                        className='input'
                        placeholder='Choose a unique username'
                      />
                    </div>
                    <div className='mt-2 min-h-5 text-xs'>
                      {usernameAvailable === true && <span className='text-emerald-400'>This username is available.</span>}
                      {usernameAvailable === false && <span className='text-amber-400'>That username is already taken.</span>}
                    </div>
                    {usernameSuggestions.length > 0 && (
                      <div className='mt-2 flex flex-wrap gap-2'>
                        {usernameSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type='button'
                            className='px-3 py-1 rounded-full text-xs bg-slate-800 text-cyan-300 border border-cyan-700 hover:bg-slate-700'
                            onClick={() => setFormData((prev) => ({ ...prev, username: suggestion }))}
                          >
                            @{suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className='auth-input-label'>Email</label>
                    <div className="relative">
                      <Mail className='auth-input-icon'/>
                      <input type="email" name="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required className='input' placeholder='Enter your email' />
                    </div>
                  </div>

                  <div>
                    <label className='auth-input-label'>Password</label>
                    <div className="relative">
                      <LockIcon className='auth-input-icon'/>
                      <input type="password" name="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required className='input' placeholder='Enter your password' />
                    </div>
                  </div>

                  <button type="submit" className='auth-btn' disabled={isSigningup}>{isSigningup ? <LoaderIcon className="h-5 w-full text-center animate-spin" /> : 'Create Account'}</button>
                </form>
                <div className="mt-6 text-center">
                  <Link to="/login" className="auth-link">Already have an account? Log in</Link>
                </div>
              </div>
            </div>

            <div className="hidden md:w-1/2 md:flex items-center justify-center p-6 bg-gradient-to-bl from-slate-800/20 to-transparent">
              <div>
                <img src="/signup.png" alt="People using mobile devices" className="w-full h-auto object-contain" />
                <div className="mt-6 text-center">
                  <h3 className="text-xl font-medium text-cyan-400">Start Your Journey Today</h3>
                  <div className="mt-4 flex justify-center gap-4">
                    <span className="auth-badge">Free</span>
                    <span className="auth-badge">Easy Setup</span>
                    <span className="auth-badge">Private</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </BorderAnimated>
      </div>
    </div>
  );
}

export default SignUpPage;
