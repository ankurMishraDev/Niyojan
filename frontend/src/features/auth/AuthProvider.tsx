import {
  type ReactNode,
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { authApi } from "@/lib/services";
import { firebaseAuth } from "@/lib/firebase";
import { AuthContext } from "@/features/auth/auth-context";
import {
  setAccessToken,
} from "@/features/auth/authSession";
import type { NgoRegistrationPayload, UserProfile, VolunteerRegistrationPayload } from "@/types/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

const EMAIL_VERIFICATION_REQUIRED_MESSAGE =
  "Your email is not verified. Check your inbox for the verification link, then sign in again.";

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

  const applySignedOutState = () => {
    setAccessToken(null);
    if (!mounted.current) {
      return;
    }

    startTransition(() => {
      setUser(null);
      setStatus("unauthenticated");
    });
  };

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

    const auth = firebaseAuth;
    if (!auth) {
      applyProfile(null);

      return () => {
        mounted.current = false;
      };
    }

    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      try {
        setStatus("loading");

        if (firebaseUser) {
          if (registrationInFlight.current) {
            return;
          }

          if (!firebaseUser.emailVerified) {
            applySignedOutState();
            await firebaseSignOut(auth);
            return;
          }

          await syncAccessToken(firebaseUser);

          const profile = await loadProfile();
          applyProfile(profile);
          return;
        }

        applySignedOutState();
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
      await credential.user.reload();
      const firebaseUser = firebaseAuth.currentUser ?? credential.user;

      if (!firebaseUser.emailVerified) {
        await sendEmailVerification(firebaseUser);
        applySignedOutState();
        await firebaseSignOut(firebaseAuth);
        throw new Error(EMAIL_VERIFICATION_REQUIRED_MESSAGE);
      }

      await syncAccessToken(firebaseUser);
      const profile = await loadProfile();
      setUser(profile);
      setStatus("authenticated");
    } catch (error) {
      applySignedOutState();
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
      await authApi.registerNgo(payload);
      await sendEmailVerification(credential.user);
      applySignedOutState();
      await firebaseSignOut(firebaseAuth);
    } catch (error) {
      applySignedOutState();
      if (firebaseAuth.currentUser) {
        await firebaseSignOut(firebaseAuth);
      }
      throw error;
    } finally {
      registrationInFlight.current = false;
    }
  };

  const signUpVolunteer = async (
    email: string,
    password: string,
    payload: VolunteerRegistrationPayload,
  ) => {
    if (!firebaseAuth) {
      throw new Error("Firebase web config is not configured. Add the VITE_FIREBASE_* values.");
    }

    try {
      registrationInFlight.current = true;
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      await syncAccessToken(credential.user);
      await authApi.registerVolunteer(payload);
      await sendEmailVerification(credential.user);
      applySignedOutState();
      await firebaseSignOut(firebaseAuth);
    } catch (error) {
      applySignedOutState();
      if (firebaseAuth.currentUser) {
        await firebaseSignOut(firebaseAuth);
      }
      throw error;
    } finally {
      registrationInFlight.current = false;
    }
  };

  const signOut = async () => {
    applySignedOutState();

    if (firebaseAuth?.currentUser) {
      await firebaseSignOut(firebaseAuth);
    }
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
        signUpVolunteer,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
