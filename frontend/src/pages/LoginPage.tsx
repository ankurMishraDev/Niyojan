import { FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Button, Input, Panel, Select } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";

export function LoginPage() {
  const location = useLocation();
  const { status, user, devMockEnabled, usingFirebase, signInWithDevMock, signInWithEmail } =
    useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mockRole, setMockRole] = useState("ngo_admin");
  const [mockName, setMockName] = useState("Mock Operator");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated" && user) {
    return <Navigate to={(location.state as { from?: string } | null)?.from ?? "/dashboard"} replace />;
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

  const onMockSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await signInWithDevMock({
        role: mockRole,
        name: mockName,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Mock sign-in failed.");
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
                Secure access for administrators, field coordinators, and volunteers.
              </p>
            </div>
            <div className="rounded-md border border-outline-variant bg-surface-container-low p-4">
              <p className="label-caps text-primary">System Status</p>
              <h2 className="mt-2 text-2xl font-black text-white">Secure resource operations</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-outline-variant bg-surface-container p-4">
                  <p className="text-sm font-bold text-white">Backend contract preserved</p>
                  <p className="mt-2 text-xs leading-5 text-on-surface-variant">
                    All workflows remain aligned to the existing `/api` routes and response envelope.
                  </p>
                </div>
                <div className="rounded-md border border-outline-variant bg-surface-container p-4">
                  <p className="text-sm font-bold text-white">Dual-path authentication</p>
                  <p className="mt-2 text-xs leading-5 text-on-surface-variant">
                    Firebase is primary. Mock headers remain available for local backend integration.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 rounded-full border border-outline-variant bg-surface-container-low px-5 py-3 text-xs uppercase tracking-[0.16em] text-on-surface-variant">
            <span>Encryption: AES-256</span>
            <span>Ops Console Active</span>
            <span>Global Access</span>
          </div>
        </Panel>

        <Panel className="space-y-5">
          <div>
            <p className="label-caps text-primary">Command Access</p>
            <h1 className="mt-2 text-3xl font-black text-white">Authorize NIYOJAN session</h1>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Sign in with Firebase or use local mock access during backend development.
            </p>
          </div>

          {error ? (
            <div className="rounded-md border border-danger/60 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={onFirebaseSubmit}>
            <p className="label-caps">Firebase Sign-In</p>
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
            <Button className="w-full" disabled={!usingFirebase || submitting} type="submit">
              {usingFirebase ? "Initiate Authorization" : "Firebase Not Configured"}
            </Button>
          </form>

          {devMockEnabled ? (
            <form className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-low p-5" onSubmit={onMockSubmit}>
              <div>
                <p className="label-caps text-primary">Development Mock Access</p>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Uses the backend's existing `x-mock-*` headers for local integration and seeded demo flows.
                </p>
              </div>
              <Input
                placeholder="Display name"
                value={mockName}
                onChange={(event) => setMockName(event.target.value)}
              />
              <Select value={mockRole} onChange={(event) => setMockRole(event.target.value)}>
                <option value="superadmin">superadmin</option>
                <option value="ngo_admin">ngo_admin</option>
                <option value="field_worker">field_worker</option>
                <option value="volunteer">volunteer</option>
              </Select>
              <Button className="w-full" disabled={submitting} type="submit" variant="secondary">
                Use Mock Session
              </Button>
            </form>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
