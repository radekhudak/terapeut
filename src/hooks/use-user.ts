"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "terapeut_user_id";
const SESSION_KEY_PREFIX = "terapeut_session_id_";

interface User {
  id: string;
  displayName: string | null;
  username?: string | null;
  isAnonymous: boolean;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initUser();
  }, []);

  async function initUser() {
    setIsLoading(true);
    setError(null);
    try {
      await refreshUsers();
      const storedId = localStorage.getItem(STORAGE_KEY);

      if (storedId) {
        const res = await fetch(`/api/users?id=${storedId}`);
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          setIsLoading(false);
          return;
        }
        // User not found in DB, create new one
        localStorage.removeItem(`${SESSION_KEY_PREFIX}${storedId}`);
        localStorage.removeItem(STORAGE_KEY);
      }

      // Create new anonymous user
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(STORAGE_KEY, data.id);
        setUser(data);
        await refreshUsers();
      }
    } catch (error) {
      console.error("Failed to init user:", error);
      setError("Nepodařilo se inicializovat uživatele.");
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshUsers() {
    try {
      const res = await fetch("/api/users?list=1");
      if (!res.ok) return;
      const data = (await res.json()) as User[];
      setUsers(data);
    } catch {
      // ignore
    }
  }

  const login = useCallback(
    async (username: string, password: string) => {
      setError(null);
      const res = await fetch("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Přihlášení selhalo.");
        return null;
      }

      localStorage.setItem(STORAGE_KEY, data.id);
      setUser(data);
      await refreshUsers();
      return data;
    },
    []
  );

  const createUser = useCallback(
    async (username: string, password: string, displayName?: string) => {
      setError(null);
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, displayName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Vytvoření uživatele selhalo.");
        return null;
      }

      localStorage.setItem(STORAGE_KEY, data.id);
      setUser(data);
      await refreshUsers();
      return data;
    },
    []
  );

  const resetUser = useCallback(async () => {
    const currentUserId = localStorage.getItem(STORAGE_KEY);
    if (currentUserId) {
      localStorage.removeItem(`${SESSION_KEY_PREFIX}${currentUserId}`);
    }
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setIsLoading(true);

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem(STORAGE_KEY, data.id);
      setUser(data);
      await refreshUsers();
    }

    setIsLoading(false);
  }, []);

  return {
    user,
    users,
    error,
    isLoading,
    resetUser,
    login,
    createUser,
    refreshUsers,
    clearError: () => setError(null),
  };
}
