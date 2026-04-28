import { Link } from "react-router-dom";
import { Button, Panel, StatusBadge } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";

const operationalAreas = [
  "Dashboard",
  "Pipeline",
  "AI Review",
  "Form Builder",
  "Matching",
  "Assignments",
  "Feedback",
];

export function LandingPage() {
  const { user, status } = useAuth();
  const destination = user ? (user.status === "active" ? "/dashboard" : "/account-status") : "/login";

  return (
    <main className="min-h-screen bg-surface px-4 py-5 text-on-surface">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-7xl flex-col">
        <header className="flex items-center justify-between border-b border-outline-variant pb-4">
          <div>
            <p className="text-3xl font-black text-white">NIYOJAN</p>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-on-surface-variant">
              Humanitarian resource allocation
            </p>
          </div>
          <div className="flex gap-3">
            {status === "authenticated" ? (
              <Link className="action-button-secondary" to="/dashboard">
                Open Console
              </Link>
            ) : (
              <Link className="action-button-primary" to="/login">
                Access Console
              </Link>
            )}
          </div>
        </header>

        <section className="grid flex-1 items-center gap-5 py-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <div className="space-y-3">
              <StatusBadge tone="success">Operational</StatusBadge>
              <h1 className="max-w-3xl text-3xl font-black leading-tight text-white md:text-4xl">
                Coordinate needs, volunteers, documents, and field closure from one control surface.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-on-surface-variant">
                NIYOJAN connects the existing backend flows into a dense operations console for NGO teams.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link to={destination}>
                <Button>{user ? "Open Dashboard" : "Start Session"}</Button>
              </Link>
              {!user ? (
                <Link className="action-button-secondary" to="/signup">
                  Register NGO
                </Link>
              ) : null}
              <Link className="action-button-secondary" to="/pipeline">
                Document Pipeline
              </Link>
            </div>
          </div>

          <Panel className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="label-caps text-primary">Console Scope</p>
                <p className="mt-1 text-xl font-black text-white">Backend-connected modules</p>
              </div>
              <StatusBadge tone={user ? "success" : "warning"}>
                {user ? user.role : "Auth required"}
              </StatusBadge>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {operationalAreas.map((area) => (
                <div
                  className="rounded-md border border-outline-variant bg-surface-container-low px-3 py-3 text-sm font-semibold text-white"
                  key={area}
                >
                  {area}
                </div>
              ))}
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}
