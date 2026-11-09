import { useState } from 'react';
import { LockKeyhole, Mail, MessageCircle, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { useAuthStore } from '../store/useAuthStore.js';
import ThemeToggle from '../components/ThemeToggle.jsx';

function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const { login, isloggingin } = useAuthStore();

  const handleSubmit = (event) => {
    event.preventDefault();
    login(formData);
  };

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-brand">
          <span className="auth-brand-mark"><MessageCircle size={21} /></span>
          <span>Existo</span>
        </div>
        <div className="auth-story-copy">
          <h1>Good conversations make the day.</h1>
          <p>A calmer space for the people, moments, and little things you want to keep close.</p>
        </div>
        <div className="auth-story-chips">
          <span>Private by design</span>
          <span>Here for your people</span>
          <span>Made for every screen</span>
        </div>
      </section>

      <section className="auth-form">
        <ThemeToggle className="auth-theme-toggle" />
        <Sparkles className="mb-5 text-emerald-700" size={22} />
        <h2>Welcome back</h2>
        <p>Sign in to pick up where you left off.</p>

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="login-email">Email address</label>
            <div className="relative">
              <Mail className="auth-input-icon" />
              <input
                id="login-email"
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
            <label htmlFor="login-password">Password</label>
            <div className="relative">
              <LockKeyhole className="auth-input-icon" />
              <input
                id="login-password"
                type="password"
                name="password"
                value={formData.password}
                onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                required
                autoComplete="current-password"
                className="input"
                placeholder="Enter your password"
              />
            </div>
          </div>
          <button type="submit" className="auth-btn" disabled={isloggingin}>
            {isloggingin ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <Link to="/signup" className="auth-link">
          New to Existo? Create an account
        </Link>
      </section>
    </main>
  );
}

export default LoginPage;
