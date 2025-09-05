import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthHeaders } from "./authUtils";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      const text = (await res.text()) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    } catch (error) {
      // Agar text o'qib bo'lmasa, status bilan error qil
      throw new Error(`${res.status}: ${res.statusText || 'Network Error'}`);
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    const headers = {
      ...getAuthHeaders(),
      ...(data ? { "Content-Type": "application/json" } : {}),
    };

    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    // Barcha network xatolarini to'liq silent qil
    if (error instanceof TypeError && 
        (error.message.includes('Failed to fetch') || 
         error.message.includes('failed to fetch') ||
         error.message.includes('fetch') ||
         error.message.includes('NetworkError') ||
         error.message.includes('ERR_NETWORK'))) {
      // Console.log qilmay, silent handle qil
      return Promise.reject(new Error('SILENT_NETWORK_ERROR'));
    }
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error) => {
        // Barcha network errorlarni silent qil
        const message = error?.message || '';
        if (error instanceof TypeError || 
            message.includes('Failed to fetch') ||
            message.includes('failed to fetch') ||
            message.includes('fetch') ||
            message.includes('NetworkError') ||
            message.includes('ERR_NETWORK') ||
            message.includes('SILENT_NETWORK_ERROR')) {
          return false;
        }
        return false;
      },
      onError: (error) => {
        // Barcha fetch va network errorlarni to'liq silent qil
        const message = error?.message || '';
        if (error instanceof TypeError || 
            message.includes('Failed to fetch') ||
            message.includes('failed to fetch') ||
            message.includes('fetch') ||
            message.includes('NetworkError') ||
            message.includes('ERR_NETWORK') ||
            message.includes('SILENT_NETWORK_ERROR')) {
          return; // Completely silent
        }
      },
    },
    mutations: {
      retry: (failureCount, error) => {
        // Mutation uchun ham barcha network errorlarni silent qil
        const message = error?.message || '';
        if (error instanceof TypeError || 
            message.includes('Failed to fetch') ||
            message.includes('failed to fetch') ||
            message.includes('fetch') ||
            message.includes('NetworkError') ||
            message.includes('ERR_NETWORK') ||
            message.includes('SILENT_NETWORK_ERROR')) {
          return false;
        }
        return false;
      },
      onError: (error) => {
        // Mutation errorlarni ham to'liq silent qil
        const message = error?.message || '';
        if (error instanceof TypeError || 
            message.includes('Failed to fetch') ||
            message.includes('failed to fetch') ||
            message.includes('fetch') ||
            message.includes('NetworkError') ||
            message.includes('ERR_NETWORK') ||
            message.includes('SILENT_NETWORK_ERROR')) {
          return; // Completely silent
        }
      },
    },
  },
});
