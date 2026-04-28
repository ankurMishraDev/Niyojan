import {
  createContext,
  type ReactNode,
  startTransition,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { authApi } from "@/lib/services";
import { firebaseAuth } from "@/lib/firebase";
import {
  setAccessToken,
} from "@/features/auth/authSession";
import type { UserProfile } from "@/types/api";
import type { NgoRegistrationPayload } from "@/types/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: UserProfile | null;
  usingFirebase: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpNgo: (email: string, password: string, payload: NgoRegistrationPayload) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
export type { AuthContextValue };

async function loadProfile() {
  const profile = await authApi.me();
  return profile;
}

async function syncAccessToken(firebaseUser: { getIdToken: (forceRefresh?: boolean) => Promise<string> }) {
  const token = await firebaseUser.getIdToken(true);
  setAccessToken(token);
  return token;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserProfile | null>(null);
  const mounted = useRef(true);
  const registrationInFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;

    const applyProfile = (profile: UserProfile | null) => {
      if (!mounted.current) {
        return;
      }

      startTransition(() => {
        setUser(profile);
        setStatus(profile ? "authenticated" : "unauthenticated");
      });
    };

    if (!firebaseAuth) {
      applyProfile(null);

      return () => {
        mounted.current = false;
      };
    }

    const unsubscribe = onIdTokenChanged(firebaseAuth, async (firebaseUser) => {
      try {
        setStatus("loading");

        if (firebaseUser) {
          await syncAccessToken(firebaseUser);
          if (registrationInFlight.current) {
            return;
          }
          const profile = await loadProfile();
          applyProfile(profile);
          return;
        }

        setAccessToken(null);
        applyProfile(null);
      } catch {
        applyProfile(null);
      }
    });

    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    if (!firebaseAuth) {
      throw new Error("Firebase web config is not configured. Add the VITE_FIREBASE_* values.");
    }

    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      await syncAccessToken(credential.user);
      const profile = await loadProfile();
      setUser(profile);
      setStatus("authenticated");
    } catch (error) {
      setAccessToken(null);
      if (firebaseAuth.currentUser) {
        await firebaseSignOut(firebaseAuth);
      }
      throw error;
    }
  };

  const signUpNgo = async (
    email: string,
    password: string,
    payload: NgoRegistrationPayload,
  ) => {
    if (!firebaseAuth) {
      throw new Error("Firebase web config is not configured. Add the VITE_FIREBASE_* values.");
    }

    try {
      registrationInFlight.current = true;
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      await syncAccessToken(credential.user);
      const profile = await authApi.registerNgo(payload);
      setUser(profile);
      setStatus("authenticated");
    } catch (error) {
      setAccessToken(null);
      if (firebaseAuth.currentUser) {
        await firebaseSignOut(firebaseAuth);
      }
      throw error;
    } finally {
      registrationInFlight.current = false;
    }
  };

  const signOut = async () => {
    setAccessToken(null);

    if (firebaseAuth?.currentUser) {
      await firebaseSignOut(firebaseAuth);
    }

    setUser(null);
    setStatus("unauthenticated");
  };

  const refreshProfile = async () => {
    setStatus("loading");
    const profile = await loadProfile();
    setUser(profile);
    setStatus("authenticated");
  };

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        usingFirebase: Boolean(firebaseAuth),
        signInWithEmail,
        signUpNgo,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};
