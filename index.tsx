import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

/**
 * Platinium Research
 * Advanced AI-Powered Academic Workspace
 * 
 * Entry Point: index.tsx
 */

const container = document.getElementById('root');

if (!container) {
  throw new Error("Fatal Error: Root element '#root' not found in document. Unable to mount Platinium Research.");
}

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Performance / Global Error Catching
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Research Logic Error:', event.reason);
});
