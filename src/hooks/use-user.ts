"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "terapeut_user_id";

interface User {
  id: string;
  displayName: string | null;
  isAnonymous: boolean;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initUser();
  }, []);

  async function initUser() {
    setIsLoading(true);
    try {
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
      }
    } catch (error) {
      console.error("Failed to init user:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const resetUser = useCallback(async () => {
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
    }

    setIsLoading(false);
  }, []);

  return { user, isLoading, resetUser };
}
