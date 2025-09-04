import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Enhanced global error handling
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.message || event.reason || 'Unknown rejection';
  
  // Only log non-network related errors in development
  if (import.meta.env.DEV && 
      !reason.includes('WebSocket') && 
      !reason.includes('fetch') &&
      !reason.includes('NetworkError')) {
    console.warn('Unhandled Promise Rejection:', reason);
  }
  
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  const message = event.error?.message || '';
  
  // Silent handling for expected network and WebSocket errors
  if (message.includes('WebSocket') || 
      message.includes('Failed to construct') ||
      message.includes('fetch') ||
      message.includes('NetworkError') ||
      message.includes('ERR_INTERNET_DISCONNECTED')) {
    event.preventDefault();
    return;
  }
  
  // Log other errors in development only
  if (import.meta.env.DEV) {
    console.error('Global Error:', message);
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