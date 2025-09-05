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
    // Network xatolarini better handle qil
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Network connection failed. Please check your internet connection.');
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
        // Network errors uchun retry qil, boshqalar uchun yo'q
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          return failureCount < 3;
        }
        return false;
      },
    },
    mutations: {
      retry: (failureCount, error) => {
        // Mutation uchun ham network errors'da retry
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          return failureCount < 2;
        }
        return false;
      },
    },
  },
});
