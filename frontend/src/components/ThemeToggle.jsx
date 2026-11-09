import { Moon, Sun } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useChatStore();
  const nextTheme = theme === 'light' ? 'dark' : 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle ${className}`}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
    </button>
  );
}

export default ThemeToggle;
