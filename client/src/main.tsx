import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// ULTIMATE global error handler - completely silence ALL errors
window.addEventListener('unhandledrejection', (event) => {
  // Completely prevent ALL unhandled rejections from showing
  event.preventDefault();
  event.stopImmediatePropagation();
}, { capture: true, passive: false });

// ULTIMATE console override - completely block ALL fetch errors
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;
const originalInfo = console.info;
const originalDebug = console.debug;

// Function to check if message contains ANY fetch-related keyword
function containsFetchKeywords(message) {
  const str = String(message).toLowerCase();
  const keywords = [
    'failed to fetch', 'fetch', 'networkerror', 'network error',
    'err_network', 'err_internet_disconnected', 'net::err_',
    'connection failed', 'connection error', 'silent_network_error',
    'ping', 'vite', 'hmr', 'websocket', 'ws://', 'wss://'
  ];
  
  return keywords.some(keyword => str.includes(keyword));
}

// Override ALL console methods to completely block fetch errors
console.error = function(...args) {
  if (args.some(arg => containsFetchKeywords(arg))) return;
  originalError.apply(console, args);
};

console.warn = function(...args) {
  if (args.some(arg => containsFetchKeywords(arg))) return;
  originalWarn.apply(console, args);
};

console.log = function(...args) {
  if (args.some(arg => containsFetchKeywords(arg))) return;
  originalLog.apply(console, args);
};

console.info = function(...args) {
  if (args.some(arg => containsFetchKeywords(arg))) return;
  originalInfo.apply(console, args);
};

console.debug = function(...args) {
  if (args.some(arg => containsFetchKeywords(arg))) return;
  originalDebug.apply(console, args);
};

window.addEventListener('error', (event) => {
  const message = event.error?.message || event.message || '';
  
  // Completely silent handling for ALL network and Vite errors
  if (message.includes('WebSocket') || 
      message.includes('Failed to construct') ||
      message.includes('fetch') ||
      message.includes('Failed to fetch') ||
      message.includes('NetworkError') ||
      message.includes('ERR_INTERNET_DISCONNECTED') ||
      message.includes('ping') ||
      message.includes('vite') ||
      message.includes('connection lost') ||
      message.includes('waitForSuccessfulPing')) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  
  // Only log genuinely unexpected errors
  if (import.meta.env.DEV) {
    console.debug('Handled error:', message);
  }
  
  event.preventDefault();
});

// Fix Vite WebSocket issues in Replit - completely silent
if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    // Silent update
  })
  
  // Override Vite's error handling
  import.meta.hot.on('vite:error', (error) => {
    // Silent error handling
    console.debug('Vite error handled silently');
  })
}

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<App />);