// Completely silence ALL fetch and network errors
(function() {
  // Override console methods to filter ALL network errors
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  console.error = function(...args) {
    const message = args.join(' ');
    if (message.includes('Failed to fetch') || 
        message.includes('fetch') ||
        message.includes('ping') ||
        message.includes('vite') ||
        message.includes('connection lost') ||
        message.includes('NetworkError') ||
        message.includes('waitForSuccessfulPing')) {
      return; // Completely silent
    }
    originalError.apply(console, args);
  };

  console.warn = function(...args) {
    const message = args.join(' ');
    if (message.includes('Failed to fetch') || 
        message.includes('fetch') ||
        message.includes('ping') ||
        message.includes('vite') ||
        message.includes('NetworkError') ||
        message.includes('connection lost')) {
      return; // Completely silent
    }
    originalWarn.apply(console, args);
  };

  console.log = function(...args) {
    const message = args.join(' ');
    if (message.includes('Failed to fetch') || 
        message.includes('fetch') ||
        message.includes('NetworkError')) {
      return; // Completely silent
    }
    originalLog.apply(console, args);
  };

  // Intercept ALL fetch requests for silent error handling
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    return originalFetch.apply(this, args).catch(error => {
      // Completely silent - no console output
      if (error.message && error.message.includes('Failed to fetch')) {
        // Return a rejected promise but silently
        return Promise.reject(new Error('SILENT_NETWORK_ERROR'));
      }
      return Promise.reject(error);
    });
  };

  // Silence all unhandled promise rejections related to fetch
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || event.reason || '';
    if (reason.includes('fetch') || 
        reason.includes('Failed to fetch') ||
        reason.includes('NetworkError') ||
        reason.includes('SILENT_NETWORK_ERROR')) {
      event.preventDefault();
      return;
    }
  });
})();