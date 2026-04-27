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
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { authApi } from "@/lib/services";
import { env } from "@/lib/env";
import { firebaseAuth } from "@/lib/firebase";
import {
  clearDevMockSession,
  defaultMockSession,
  getDevMockSession,
  setAccessToken,
  setDevMockSession,
  type DevMockSession,
} from "@/features/auth/authSession";
import type { UserProfile } from "@/types/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: UserProfile | null;
  usingFirebase: boolean;
  devMockEnabled: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithDevMock: (session?: Partial<DevMockSession>) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
export type { AuthContextValue };

async function loadProfile() {
  const profile = await authApi.me();
  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserProfile | null>(null);
  const mounted = useRef(true);

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

    const bootstrapDevMock = async () => {
      if (!env.enableDevMockAuth) {
        applyProfile(null);
        return;
      }

      const session = getDevMockSession();
      if (!session) {
        applyProfile(null);
        return;
      }

      try {
        setAccessToken(null);
        const profile = await loadProfile();
        applyProfile(profile);
      } catch {
        clearDevMockSession();
        applyProfile(null);
      }
    };

    if (!firebaseAuth) {
      void bootstrapDevMock();

      return () => {
        mounted.current = false;
      };
    }

    const unsubscribe = onIdTokenChanged(firebaseAuth, async (firebaseUser) => {
      try {
        setStatus("loading");

        if (firebaseUser) {
          clearDevMockSession();
          setAccessToken(await firebaseUser.getIdToken());
          const profile = await loadProfile();
          applyProfile(profile);
          return;
        }

        setAccessToken(null);
        await bootstrapDevMock();
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
      throw new Error("Firebase auth is not configured.");
    }

    await signInWithEmailAndPassword(firebaseAuth, email, password);
  };

  const signInWithDevMock = async (partial?: Partial<DevMockSession>) => {
    if (!env.enableDevMockAuth) {
      throw new Error("Development mock auth is disabled.");
    }

    if (firebaseAuth?.currentUser) {
      await firebaseSignOut(firebaseAuth);
    }

    const session = {
      ...defaultMockSession(),
      ...partial,
    };
    setDevMockSession(session);
    setAccessToken(null);
    setStatus("loading");
    const profile = await loadProfile();
    setUser(profile);
    setStatus("authenticated");
  };

  const signOut = async () => {
    clearDevMockSession();
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
        devMockEnabled: env.enableDevMockAuth,
        signInWithEmail,
        signInWithDevMock,
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
