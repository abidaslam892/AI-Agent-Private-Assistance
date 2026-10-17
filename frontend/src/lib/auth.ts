export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
}

export const authStorage = {
  getToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("rag_token");
  },
  setToken: (token: string): void => {
    if (typeof window !== "undefined") {
      localStorage.setItem("rag_token", token);
    }
  },
  getUser: (): UserProfile | null => {
    if (typeof window === "undefined") return null;
    const userStr = localStorage.getItem("rag_user");
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },
  setUser: (user: UserProfile): void => {
    if (typeof window !== "undefined") {
      localStorage.setItem("rag_user", JSON.stringify(user));
    }
  },
  clear: (): void => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("rag_token");
      localStorage.removeItem("rag_user");
    }
  }
};
