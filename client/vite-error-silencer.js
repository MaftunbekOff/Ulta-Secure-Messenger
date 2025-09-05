// Completely silence Vite client errors
(function() {
  // Override console methods to filter Vite errors
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  console.error = function(...args) {
    const message = args.join(' ');
    if (message.includes('Failed to fetch') || 
        message.includes('ping') ||
        message.includes('vite') ||
        message.includes('connection lost') ||
        message.includes('waitForSuccessfulPing')) {
      return; // Silent
    }
    originalError.apply(console, args);
  };

  console.warn = function(...args) {
    const message = args.join(' ');
    if (message.includes('Failed to fetch') || 
        message.includes('ping') ||
        message.includes('vite') ||
        message.includes('connection lost')) {
      return; // Silent
    }
    originalWarn.apply(console, args);
  };

  // Intercept fetch to handle Vite ping errors
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    return originalFetch.apply(this, args).catch(error => {
      // Silent handling for Vite ping requests
      if (args[0] && args[0].includes('ping')) {
        throw error; // Still throw but handled by unhandledrejection
      }
      throw error;
    });
  };
})();