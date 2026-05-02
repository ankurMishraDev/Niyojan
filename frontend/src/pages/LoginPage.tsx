import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Button, Input, Panel } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";

export function LoginPage() {
  const location = useLocation();
  const { status, user, signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated" && user) {
    return (
      <Navigate
        to={
          user.status === "active"
            ? (location.state as { from?: string } | null)?.from ?? (user.role === "volunteer" ? "/assignments" : "/dashboard")
            : "/account-status"
        }
        replace
      />
    );
  }

  const onFirebaseSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await signInWithEmail(email, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Firebase sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface px-4 py-5">
      <div className="mx-auto grid min-h-[calc(100vh-40px)] max-w-6xl gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <Panel className="flex flex-col justify-between overflow-hidden bg-black/25">
          <div className="space-y-5">
            <div>
              <p className="text-4xl font-black text-white">NIYOJAN</p>
              <p className="mt-3 max-w-md text-sm leading-6 text-on-surface-variant">
                Secure access for administrators, NGO operators, and volunteers.
              </p>
            </div>
            {/* <div className="rounded-md border border-outline-variant bg-surface-container-low p-4">
              <p className="label-caps text-primary">System Status</p>
              <h2 className="mt-2 text-2xl font-black text-white">Firebase-first access control</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-outline-variant bg-surface-container p-4">
                  <p className="text-sm font-bold text-white">Backend contract preserved</p>
                  <p className="mt-2 text-xs leading-5 text-on-surface-variant">
                    All workflows remain aligned to the existing `/api` routes and response envelope.
                  </p>
                </div>
                <div className="rounded-md border border-outline-variant bg-surface-container p-4">
                  <p className="text-sm font-bold text-white">NGO, volunteer, and admin accounts</p>
                  <p className="mt-2 text-xs leading-5 text-on-surface-variant">
                    Firebase creates credentials, and the backend resolves the active application profile.
                  </p>
                </div>
              </div>
            </div> */}
          </div>
          <div className="flex flex-wrap gap-4 rounded-full border border-outline-variant bg-surface-container-low px-5 py-3 text-xs uppercase tracking-[0.16em] text-on-surface-variant">
            <span>Operations Console</span>
            <span>Global Access</span>
            <span>Secure Sessions</span>
          </div>
        </Panel>

        <Panel className="space-y-5">
          <div>
            <p className="label-caps text-primary">Command Access</p>
            <h1 className="mt-2 text-3xl font-black text-white">Authorize NIYOJAN session</h1>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Sign in with Niyojan using your NGO or volunteer account.
            </p>
          </div>

          {/* <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            {usingFirebase
              ? "Firebase web config is present. Use email/password sign-in for live auth."
              : "Firebase web config is not fully configured yet. Add the VITE_FIREBASE_* values to enable sign-in and NGO registration."}
          </div> */}

          <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            New accounts must verify their email from the email verification link before the session can complete. If you don't receive the email within a few minutes, please check your spam folder or contact your administrator.
          </div>

          {error ? (
            <div className="rounded-md border border-danger/60 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={onFirebaseSubmit}>
            <p className="label-caps">Sign-In</p>
            <Input
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button className="w-full" disabled={submitting} type="submit">
              {submitting ? "Signing In..." : "Initiate Authorization"}
            </Button>
            <p className="text-sm text-on-surface-variant">
              New NGO?{" "}
              <Link className="text-white underline-offset-4 hover:underline" to="/signup">
                Register organization
              </Link>
            </p>
            <p className="text-sm text-on-surface-variant">
              New Volunteer?{" "}
              <Link className="text-white underline-offset-4 hover:underline" to="/volunteer-signup">
                Join volunteer network
              </Link>
            </p>
          </form>
        </Panel>
      </div>
    </div>
  );
}
