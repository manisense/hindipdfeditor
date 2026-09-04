import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';

import App from './App';
import './home.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/*
     * attribute="class" → next-themes sets class="dark" on <html>.
     * defaultTheme="system" → respects OS dark/light preference on first visit.
     * storageKey="hpe-theme" → persists choice in localStorage.
     */}
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="hpe-theme">
      <App />
    </ThemeProvider>
  </StrictMode>,
);

