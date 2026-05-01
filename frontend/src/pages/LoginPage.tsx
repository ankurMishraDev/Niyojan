import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Button, Input, Panel, StatusBadge } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";

export function LoginPage() {
  const location = useLocation();
  const { status, user, usingFirebase, signInWithEmail } = useAuth();
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
      setError(caught instanceof Error ? caught.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-container px-4 py-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          backgroundImage: `
            radial-gradient(circle at 18% 22%, rgba(26,107,60,0.14) 0, rgba(26,107,60,0.14) 2px, transparent 2px),
            radial-gradient(circle at 78% 30%, rgba(26,107,60,0.12) 0, rgba(26,107,60,0.12) 1.5px, transparent 1.5px),
            radial-gradient(circle at 62% 78%, rgba(26,107,60,0.1) 0, rgba(26,107,60,0.1) 2px, transparent 2px),
            linear-gradient(135deg, rgba(26,107,60,0.08) 0%, rgba(26,107,60,0.03) 28%, transparent 28%),
            linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(244,243,240,0.72) 100%)
          `,
          backgroundSize: "140px 140px, 180px 180px, 220px 220px, 100% 100%, 100% 100%",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-[220px]"
        style={{
          background: "linear-gradient(180deg, transparent 0%, rgba(26,107,60,0.06) 100%)",
          clipPath: "ellipse(90% 70% at 50% 100%)",
        }}
      />
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-48px)] max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-between rounded-[28px] border border-outline-variant bg-surface px-8 py-8 shadow-panel">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="label-caps text-primary">Secure access</p>
              <div>
                <p className="text-4xl font-semibold tracking-[-0.04em] text-on-surface">NIYOJAN</p>
                <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight text-on-surface md:text-5xl">
                  Sign in to continue your field operations workspace.
                </h1>
                <p className="mt-4 max-w-xl text-base leading-8 text-on-surface-variant">
                  Access templates, case workflows, assignments, and feedback in one coordinated workspace built for NGO teams and volunteers.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FeatureCard
                title="Coordinators"
                description="Manage templates, review active cases, and keep field teams moving."
              />
              <FeatureCard
                title="Field teams"
                description="Open assigned work quickly and keep intake and follow-up consistent."
              />
              <FeatureCard
                title="Volunteers"
                description="Review tasks, submit updates, and stay aligned with current needs."
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-8">
            <StatusBadge tone={usingFirebase ? "success" : "warning"}>
              {usingFirebase ? "Sign-in available" : "Setup needed"}
            </StatusBadge>
            <p className="text-sm text-on-surface-variant">
              {usingFirebase
                ? "Use your email and password to enter the workspace."
                : "Complete Firebase web configuration to enable live sign-in."}
            </p>
          </div>
        </div>

        <Panel className="flex flex-col justify-center space-y-6 rounded-[28px] border-outline-variant bg-surface px-8 py-8">
          <div className="space-y-3">
            <p className="label-caps text-primary">Account sign-in</p>
            <h2 className="text-3xl font-semibold leading-tight text-on-surface">Welcome back</h2>
            <p className="text-sm leading-7 text-on-surface-variant">
              Sign in with your email and password to continue where you left off.
            </p>
          </div>

          {error ? (
            <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <form className="space-y-5" onSubmit={onFirebaseSubmit}>
            <div className="space-y-2">
              <label className="label-caps" htmlFor="login-email">
                Email
              </label>
              <Input
                id="login-email"
                placeholder="name@organization.org"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="label-caps" htmlFor="login-password">
                Password
              </label>
              <Input
                id="login-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <Button className="w-full justify-center" disabled={submitting || !usingFirebase} type="submit">
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="grid gap-3 pt-2">
            <Link
              className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-4 text-sm text-on-surface transition hover:border-outline hover:bg-surface-container"
              to="/signup"
            >
              <span className="block font-semibold text-on-surface">Register organization</span>
              <span className="mt-1 block text-on-surface-variant">Create an NGO account and set up your workspace.</span>
            </Link>
            <Link
              className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-4 text-sm text-on-surface transition hover:border-outline hover:bg-surface-container"
              to="/volunteer-signup"
            >
              <span className="block font-semibold text-on-surface">Join as a volunteer</span>
              <span className="mt-1 block text-on-surface-variant">Create a volunteer profile and connect to active operations.</span>
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-low px-5 py-5">
      <p className="text-sm font-semibold text-on-surface">{title}</p>
      <p className="mt-2 text-sm leading-7 text-on-surface-variant">{description}</p>
    </div>
  );
}
