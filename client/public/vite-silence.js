// Ultimate Vite error silencer - loaded before everything
(function() {
  'use strict';

  // Store original methods
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalDebug = console.debug;

  // Override addEventListener to completely block unhandledrejection
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (type === 'unhandledrejection') {
      // Block ALL unhandledrejection listeners except our silencer
      return;
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  // Add our ultimate silencer FIRST
  window.addEventListener('unhandledrejection', function(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { passive: false, capture: true });

  // Override fetch globally
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = String(args[0] || '');
    if (url.includes('ping') || url.includes('__vite') || url.includes('hot-update')) {
      return new Promise((resolve, reject) => {
        // Silent rejection
        setTimeout(() => reject(new Error('SILENCED_VITE')), 1);
      });
    }
    return originalFetch.apply(this, args);
  };

  // Override ALL Promise rejections at source
  const OriginalPromise = window.Promise;
  window.Promise = class extends OriginalPromise {
    constructor(executor) {
      super((resolve, reject) => {
        executor(resolve, (reason) => {
          const reasonStr = String(reason);
          if (reasonStr.includes('fetch') || 
              reasonStr.includes('ping') || 
              reasonStr.includes('SILENCED')) {
            // Silent rejection
            return;
          }
          reject(reason);
        });
      });
    }
  };

  // Copy static methods
  Object.setPrototypeOf(window.Promise, OriginalPromise);
  Object.getOwnPropertyNames(OriginalPromise).forEach(name => {
    if (name !== 'prototype' && name !== 'name' && name !== 'length') {
      window.Promise[name] = OriginalPromise[name];
    }
  });

  // Function to check for all Vite-related error messages
  function isViteOrFetchError(message) {
    const str = String(message).toLowerCase();
    return str.includes('failed to fetch') || 
           str.includes('vite') || 
           str.includes('websocket') || 
           str.includes('ping') ||
           str.includes('hot-update') ||
           str.includes('hmr') ||
           str.includes('@vite/client') ||
           str.includes('eruda.js') ||
           str.includes('injected.js');
  }

  // Override console methods to block all Vite-related messages
  console.error = function(...args) {
    if (args.some(arg => isViteOrFetchError(arg))) return;
    originalError.apply(console, args);
  };

  console.warn = function(...args) {
    if (args.some(arg => isViteOrFetchError(arg))) return;
    originalWarn.apply(console, args);
  };

  console.log = function(...args) {
    if (args.some(arg => isViteOrFetchError(arg))) return;
    originalLog.apply(console, args);
  };

  console.info = function(...args) {
    if (args.some(arg => isViteOrFetchError(arg))) return;
    originalInfo.apply(console, args);
  };

  console.debug = function(...args) {
    if (args.some(arg => isViteOrFetchError(arg))) return;
    originalDebug.apply(console, args);
  };
})();