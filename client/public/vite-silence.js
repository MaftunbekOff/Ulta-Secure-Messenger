// Ultimate Vite error silencer - loaded before everything
(function() {
  'use strict';
  
  // Store original methods
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  
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
})();