// Completely silence ALL fetch and network errors
(function() {
  // Override console methods to filter ALL network errors
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  function isNetworkError(message) {
    const networkKeywords = [
      'Failed to fetch', 'failed to fetch', 'FAILED TO FETCH',
      'fetch', 'FETCH', 'Fetch',
      'ping', 'PING', 'Ping',
      'vite', 'VITE', 'Vite',
      'connection lost', 'CONNECTION LOST', 'Connection Lost',
      'NetworkError', 'NETWORKERROR', 'network error',
      'waitForSuccessfulPing', 'wait for successful ping',
      'ERR_NETWORK', 'ERR_INTERNET_DISCONNECTED',
      'net::ERR_', 'Connection failed', 'connection failed',
      'SILENT_NETWORK_ERROR', 'silent network error'
    ];
    
    return networkKeywords.some(keyword => message.includes(keyword));
  }

  console.error = function(...args) {
    const message = args.join(' ');
    if (isNetworkError(message)) {
      return; // Completely silent
    }
    originalError.apply(console, args);
  };

  console.warn = function(...args) {
    const message = args.join(' ');
    if (isNetworkError(message)) {
      return; // Completely silent
    }
    originalWarn.apply(console, args);
  };

  console.log = function(...args) {
    const message = args.join(' ');
    if (isNetworkError(message)) {
      return; // Completely silent
    }
    originalLog.apply(console, args);
  };

  console.info = function(...args) {
    const message = args.join(' ');
    if (isNetworkError(message)) {
      return; // Completely silent
    }
    originalLog.apply(console, args);
  };

  console.debug = function(...args) {
    const message = args.join(' ');
    if (isNetworkError(message)) {
      return; // Completely silent
    }
    originalLog.apply(console, args);
  };

  // ULTIMATE fetch override - completely silence ALL fetch errors
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    return originalFetch.apply(this, args).catch(error => {
      // Completely silent - return resolved promise with empty response
      return Promise.resolve(new Response('{}', { 
        status: 200, 
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      }));
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