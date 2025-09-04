import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { SecurityDashboard } from "./components/SecurityDashboard";
import { PerformanceDashboard } from "@/components/PerformanceDashboard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Chat from "@/pages/chat";
import Login from "@/pages/login";
import Profile from "@/pages/profile";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="/" component={Login} />
      ) : (
        <>
          <Route path="/" component={Chat} />
          <Route path="/profile" component={Profile} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Handle unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Suppress all Vite HMR and development-related errors
      const reason = event.reason;
      const message = reason?.message || '';
      const stack = reason?.stack || '';
      
      // Filter out Vite HMR, fetch, and development server errors
      if (
        reason?.name === 'TypeError' ||
        message.includes('fetch') ||
        message.includes('Failed to fetch') ||
        message.includes('NetworkError') ||
        stack.includes('vite/client') ||
        stack.includes('@vite/client') ||
        stack.includes('ping') ||
        stack.includes('waitForSuccessfulPing')
      ) {
        event.preventDefault();
        return;
      }
      
      // Only log genuine application errors
      console.warn('Unhandled promise rejection:', event.reason);
      event.preventDefault();
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Disable browser context menu globally
  useEffect(() => {
    const disableContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const disableRightClick = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // Add event listeners
    document.addEventListener('contextmenu', disableContextMenu);
    document.addEventListener('selectstart', disableRightClick);
    document.addEventListener('dragstart', disableRightClick);

    // Cleanup function
    return () => {
      document.removeEventListener('contextmenu', disableContextMenu);
      document.removeEventListener('selectstart', disableRightClick);
      document.removeEventListener('dragstart', disableRightClick);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
      {/* <SecurityDashboard /> */}
      {/* <PerformanceDashboard /> */}
    </QueryClientProvider>
  );
}

export default App;