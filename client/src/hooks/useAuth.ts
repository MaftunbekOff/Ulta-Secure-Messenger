import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getAuthToken, setAuthToken, removeAuthToken } from "@/lib/authUtils";
import { storePrivateKey, clearPrivateKey } from "@/lib/militaryEncryption";
import type { User, LoginData, RegisterData } from "@shared/schema";

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    enabled: !!getAuthToken(),
    retry: false,
    queryFn: async () => {
      const token = getAuthToken();
      if (!token) return null;
      
      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        removeAuthToken();
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response.json();
    },
    onSuccess: (data: { token: string; user: User }) => {
      setAuthToken(data.token);
      queryClient.setQueryData(["/api/auth/me"], data.user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      return response.json();
    },
    onSuccess: (data: { token: string; user: User; privateKey?: string }) => {
      setAuthToken(data.token);
      // Store military-grade private key for end-to-end encryption
      if (data.privateKey) {
        storePrivateKey(data.privateKey);
      }
      queryClient.setQueryData(["/api/auth/me"], data.user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const token = getAuthToken();
      if (token) {
        await apiRequest("POST", "/api/auth/logout");
      }
    },
    onSettled: () => {
      removeAuthToken();
      // Clear military-grade private key on logout for security
      clearPrivateKey();
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.invalidateQueries();
    },
  });

  const refreshUser = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation,
    register: registerMutation,
    logout: logoutMutation,
    refreshUser,
  };
}
