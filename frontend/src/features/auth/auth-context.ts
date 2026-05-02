import { createContext } from "react";
import type { NgoRegistrationPayload, UserProfile, VolunteerRegistrationPayload } from "@/types/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthContextValue = {
  status: AuthStatus;
  user: UserProfile | null;
  usingFirebase: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpNgo: (email: string, password: string, payload: NgoRegistrationPayload) => Promise<void>;
  signUpVolunteer: (email: string, password: string, payload: VolunteerRegistrationPayload) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
