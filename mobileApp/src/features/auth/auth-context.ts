import { createContext } from "react";
import type { UserProfile } from "../../types/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextType {
  status: AuthStatus;
  user: UserProfile | null;
  usingFirebase: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  status: "loading",
  user: null,
  usingFirebase: false,
  signInWithEmail: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});
