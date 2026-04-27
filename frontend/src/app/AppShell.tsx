import { NavLink, Outlet } from "react-router-dom";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useAuth } from "@/features/auth/AuthProvider";
import type { AppRole } from "@/types/api";

const navItems: Array<{
  label: string;
  href: string;
  roles: AppRole[];
}> = [
  { label: "Dashboard", href: "/dashboard", roles: ["superadmin", "ngo_admin", "field_worker"] },
  { label: "Pipeline", href: "/pipeline", roles: ["superadmin", "ngo_admin", "field_worker"] },
  { label: "AI Review", href: "/ai-review", roles: ["superadmin", "ngo_admin", "field_worker"] },
  { label: "Form Builder", href: "/form-builder", roles: ["superadmin", "ngo_admin", "field_worker", "volunteer"] },
  { label: "Matching", href: "/matching", roles: ["superadmin", "ngo_admin", "field_worker"] },
  { label: "Assignments", href: "/assignments", roles: ["superadmin", "ngo_admin", "field_worker", "volunteer"] },
  { label: "Feedback", href: "/feedback", roles: ["superadmin", "ngo_admin", "field_worker", "volunteer"] },
  { label: "Profile", href: "/profile", roles: ["superadmin", "ngo_admin", "field_worker", "volunteer"] },
];

export function AppShell() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-outline-variant bg-black/25 px-5 py-6 lg:border-b-0 lg:border-r">
          <div className="panel-muted px-4 py-5">
            <p className="text-3xl font-black tracking-[0.12em] text-white">FIELDOPS COMMAND</p>
            <p className="mt-2 text-sm text-on-surface-variant">
              Mission-critical data routing for Niyojan field operations.
            </p>
          </div>
          <nav className="mt-6 space-y-2">
            {navItems
              .filter((item) => (user ? item.roles.includes(user.role) : false))
              .map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center rounded-md border px-4 py-3 text-sm font-semibold transition",
                      isActive
                        ? "border-primary/70 bg-primary/10 text-primary"
                        : "border-transparent text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-low hover:text-white",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
          </nav>

          <div className="mt-8 space-y-4">
            <Button
              className="w-full justify-center"
              variant="primary"
              onClick={() => void signOut()}
            >
              Sign Out
            </Button>
            <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-4">
              <p className="text-sm font-semibold text-white">{user?.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-on-surface-variant">
                {user?.role}
              </p>
              <p className="mt-3 text-xs text-on-surface-variant">{user?.email}</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-outline-variant bg-surface/90 px-5 py-4 backdrop-blur">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="label-caps text-primary">Niyojan Operations Console</p>
                <p className="text-lg font-bold text-white">
                  Live backend-driven view for {user?.role?.replace("_", " ")}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <NavLink className="action-button-secondary" to="/surveys/new">
                  New Survey
                </NavLink>
                <NavLink className="action-button-secondary" to="/pipeline">
                  Upload Document
                </NavLink>
              </div>
            </div>
          </header>
          <main className="px-5 py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
