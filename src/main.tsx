import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import './index.css';

// Ensure harmless dev-mode HMR WebSocket disconnects in iframe proxy do not bubble up
if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (e) => {
      const msg = e.message || '';
      const file = e.filename || '';
      if (
        msg.includes('createWebSocketModuleRunnerTransport') ||
        file.includes('@vite/client') ||
        msg.includes('WebSocket')
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (e) => {
      const reason = e.reason;
      const str = typeof reason === 'string' ? reason : (reason?.message || reason?.stack || '');
      if (
        str.includes('createWebSocketModuleRunnerTransport') ||
        str.includes('@vite/client') ||
        str.includes('WebSocket')
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );
}

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
