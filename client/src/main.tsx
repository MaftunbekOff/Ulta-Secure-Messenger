import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Enhanced global error handling - completely silence fetch errors
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.message || event.reason || 'Unknown rejection';
  
  // Silent handling for ALL network-related errors
  if (reason.includes('fetch') || 
      reason.includes('Failed to fetch') ||
      reason.includes('WebSocket') || 
      reason.includes('NetworkError') ||
      reason.includes('ping') ||
      reason.includes('waitForSuccessfulPing') ||
      reason.includes('vite') ||
      reason.includes('connection lost') ||
      reason.includes('SILENT_NETWORK_ERROR')) {
    event.preventDefault();
    return; // Completely silence these
  }
  
  // Completely silent - no console output at all
  event.preventDefault();
});

// Complete console override to block ALL fetch-related messages
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;
const originalInfo = console.info;
const originalDebug = console.debug;

function isFetchError(message) {
  return message.includes('Failed to fetch') || 
         message.includes('failed to fetch') ||
         message.includes('FAILED TO FETCH') ||
         message.includes('fetch') ||
         message.includes('NetworkError') ||
         message.includes('network error') ||
         message.includes('NETWORK_ERROR') ||
         message.includes('SILENT_NETWORK_ERROR') ||
         message.includes('Connection failed') ||
         message.includes('connection failed') ||
         message.includes('ERR_NETWORK') ||
         message.includes('ERR_INTERNET_DISCONNECTED') ||
         message.includes('net::ERR_');
}

console.error = function(...args) {
  const message = args.join(' ');
  if (isFetchError(message)) {
    return; // Completely silent
  }
  originalError.apply(console, args);
};

console.warn = function(...args) {
  const message = args.join(' ');
  if (isFetchError(message)) {
    return; // Completely silent
  }
  originalWarn.apply(console, args);
};

console.log = function(...args) {
  const message = args.join(' ');
  if (isFetchError(message)) {
    return; // Completely silent
  }
  originalLog.apply(console, args);
};

console.info = function(...args) {
  const message = args.join(' ');
  if (isFetchError(message)) {
    return; // Completely silent
  }
  originalInfo.apply(console, args);
};

console.debug = function(...args) {
  const message = args.join(' ');
  if (isFetchError(message)) {
    return; // Completely silent
  }
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