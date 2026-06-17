import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";
import { authApi } from "../../lib/services";
import { firebaseAuth } from "../../lib/firebase";
import { AuthContext } from "./auth-context";
import { setAccessToken, saveUserProfile, loadCachedProfile, clearUserProfile } from "./authSession";
import type { UserProfile } from "../../types/api";
import { useAppStore } from "../../store/appStore";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

async function loadProfile() {
  const profile = await authApi.me();
  return profile;
}

async function syncAccessToken(firebaseUser: { getIdToken: (forceRefresh?: boolean) => Promise<string> }) {
  // Use forceRefresh=false first — returns the cached token instantly, no network needed.
  // The cached token is valid for ~1 hour. If it has expired, Firebase will auto-refresh it
  // when connectivity is restored. Forcing a refresh here breaks offline auth.
  const token = await firebaseUser.getIdToken(false);
  await setAccessToken(token);
  return token;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserProfile | null>(null);
  const mounted = useRef(true);
  
  // AppStore sync
  const setGlobalUser = useAppStore((state) => state.setUser);

  const applySignedOutState = () => {
    setAccessToken(null);
    if (!mounted.current) return;
    setUser(null);
    setGlobalUser(null);
    setStatus("unauthenticated");
  };

  useEffect(() => {
    mounted.current = true;

    const applyProfile = (profile: UserProfile | null) => {
      if (!mounted.current) return;
      setUser(profile);
      // Map to global app store format
      if (profile) {
        setGlobalUser({
          id: profile.id,
          role: profile.role === 'volunteer' ? 'volunteer' : 'ngo',
          name: profile.name,
          email: profile.email
        });
      } else {
        setGlobalUser(null);
      }
      setStatus(profile ? "authenticated" : "unauthenticated");
    };

    const auth = firebaseAuth;
    if (!auth) {
      applyProfile(null);
      return () => { mounted.current = false; };
    }

    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        setStatus("loading");

        if (firebaseUser) {
          await syncAccessToken(firebaseUser);
          try {
            // Fetch live profile from backend
            const profile = await loadProfile();
            // Cache it for offline use
            await saveUserProfile(profile);
            applyProfile(profile);
          } catch (networkErr) {
            // Network/server unreachable — fall back to cached profile
            console.warn('[AUTH] Profile fetch failed, trying cached profile:', networkErr);
            const cached = await loadCachedProfile<UserProfile>();
            if (cached) {
              console.log('[AUTH] Restored profile from cache (offline mode)');
              applyProfile(cached);
            } else {
              // No cache — can't authenticate without profile
              applyProfile(null);
            }
          }
          return;
        }

        applySignedOutState();
      } catch (e) {
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
      console.error("[AUTH] Firebase config missing");
      throw new Error("Firebase config missing");
    }

    try {
      console.log(`[AUTH] Attempting to sign in with email: ${email}`);
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      await credential.user.reload();
      const firebaseUser = firebaseAuth.currentUser ?? credential.user;
      
      console.log(`[AUTH] Firebase sign in successful for UID: ${firebaseUser.uid}`);

      console.log(`[AUTH] Syncing access token...`);
      await syncAccessToken(firebaseUser);
      
      console.log(`[AUTH] Loading profile from backend...`);
      const profile = await loadProfile();
      console.log(`[AUTH] Profile loaded successfully:`, profile);
      
      // Cache profile for offline sessions
      await saveUserProfile(profile);
      
      setUser(profile);
      setGlobalUser({
        id: profile.id,
        role: profile.role === 'volunteer' ? 'volunteer' : 'ngo',
        name: profile.name,
        email: profile.email
      });
      setStatus("authenticated");
    } catch (error) {
      console.error(`[AUTH] Sign in failed:`, error);
      applySignedOutState();
      if (firebaseAuth.currentUser) {
        await firebaseSignOut(firebaseAuth);
      }
      throw error;
    }
  };

  const signOut = async () => {
    applySignedOutState();
    await clearUserProfile();
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
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}