import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import './ThemeToggle.css';

type Size = 'sm' | 'md';

interface Props {
  size?: Size;
  /** Extra CSS classes for the button wrapper. */
  className?: string;
}

/**
 * A pill button that toggles between light and dark theme via next-themes.
 * Uses Sun / Moon Lucide icons — never emojis per design system rule §2.
 *
 * Renders nothing until mounted to avoid the hydration mismatch that would
 * occur if the server guess differs from the stored user preference.
 */
export function ThemeToggle({ size = 'md', className = '' }: Props) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid flash of wrong icon during SSR / first paint
  if (!mounted) return null;

  const isDark = theme === 'dark';
  const toggle = () => setTheme(isDark ? 'light' : 'dark');

  const iconSize = size === 'sm' ? 13 : 15;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={[
        'theme-toggle',
        size === 'sm' ? 'theme-toggle--sm' : '',
        isDark ? 'theme-toggle--dark' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {isDark ? (
        <Sun size={iconSize} strokeWidth={2.2} aria-hidden="true" />
      ) : (
        <Moon size={iconSize} strokeWidth={2.2} aria-hidden="true" />
      )}
    </button>
  );
}
