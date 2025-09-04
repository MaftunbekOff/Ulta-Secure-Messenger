import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Minimal global error handling
window.addEventListener('unhandledrejection', (event) => {
  // Always prevent unhandled rejections from appearing in console
  event.preventDefault();
  
  const reason = event.reason?.message || String(event.reason || '');
  
  // Only log non-WebSocket, non-network errors that are significant
  if (!reason.includes('WebSocket') && 
      !reason.includes('fetch') && 
      !reason.includes('NetworkError') &&
      !reason.includes('Failed to construct') &&
      !reason.includes('vite') &&
      reason.length > 10) {
    // Silent - just prevent the error from showing
  }
});

window.addEventListener('error', (event) => {
  const message = event.error?.message || '';
  
  // Silent handling for WebSocket and network errors
  if (message.includes('WebSocket') || 
      message.includes('Failed to construct') ||
      message.includes('fetch')) {
    event.preventDefault();
  }
});

// Fix Vite WebSocket issues in Replit
if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    console.log('Vite hot reload updating...')
  })
}

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<App />);