import { useEffect, useState } from 'react';
import { LockKeyhole, Mail, MessageCircle, UserRound } from 'lucide-react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { useAuthStore } from '../store/useAuthStore.js';

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
    setFormData((previous) => ({ ...previous, username: normalized }));
    if (normalized.trim().length < 3) {
      setUsernameSuggestions([]);
      setUsernameAvailable(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await signup(formData);
    } catch (error) {
      if (error.response?.status === 409) {
        setUsernameSuggestions(error.response?.data?.suggestions || []);
        setUsernameAvailable(false);
        toast.error('That username is already taken. Pick one of the suggestions.');
      }
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-brand">
          <span className="auth-brand-mark"><MessageCircle size={21} /></span>
          <span>Existo</span>
        </div>
        <div className="auth-story-copy">
          <h1>Make room for more meaningful moments.</h1>
          <p>Bring your favorite people together in a thoughtful space made for everyday conversation.</p>
        </div>
        <div className="auth-story-chips">
          <span>Messages</span>
          <span>Voice & video</span>
          <span>Games with friends</span>
        </div>
      </section>

      <section className="auth-form">
        <ThemeToggle className="auth-theme-toggle" />
        <h2>Create your account</h2>
        <p>It only takes a moment to get started.</p>

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="signup-username">Username</label>
            <div className="relative">
              <UserRound className="auth-input-icon" />
              <input
                id="signup-username"
                type="text"
                name="username"
                value={formData.username}
                onChange={(event) => handleUsernameChange(event.target.value)}
                required
                autoComplete="username"
                className="input"
                placeholder="Choose a username"
              />
            </div>
            <div className="mt-2 min-h-5 text-xs">
              {usernameAvailable === true && <span className="text-emerald-700">This username is available.</span>}
              {usernameAvailable === false && <span className="text-amber-700">That username is already taken.</span>}
            </div>
            {usernameSuggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {usernameSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="rounded-full border border-emerald-800/20 bg-emerald-800/10 px-3 py-1 text-xs text-emerald-800"
                    onClick={() => setFormData((previous) => ({ ...previous, username: suggestion }))}
                  >
                    @{suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="signup-email">Email address</label>
            <div className="relative">
              <Mail className="auth-input-icon" />
              <input
                id="signup-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                required
                autoComplete="email"
                className="input"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="signup-password">Password</label>
            <div className="relative">
              <LockKeyhole className="auth-input-icon" />
              <input
                id="signup-password"
                type="password"
                name="password"
                value={formData.password}
                onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                required
                autoComplete="new-password"
                className="input"
                placeholder="Create a password"
              />
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={isSigningup}>
            {isSigningup ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <Link to="/login" className="auth-link">
          Already have an account? Sign in
        </Link>
      </section>
    </main>
  );
}

export default SignUpPage;
