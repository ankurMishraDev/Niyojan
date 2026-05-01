import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
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
  { label: "Pipeline", href: "/pipeline", roles: ["superadmin"] },
  { label: "AI Review", href: "/ai-review", roles: ["superadmin"] },
  { label: "Form Builder", href: "/form-builder", roles: ["ngo_admin", "field_worker"] },
  { label: "Data Collection", href: "/surveys/new", roles: ["ngo_admin", "field_worker"] },
  { label: "Matching", href: "/matching", roles: ["superadmin"] },
  { label: "Assignments", href: "/assignments", roles: ["superadmin", "volunteer"] },
  { label: "Feedback", href: "/feedback", roles: ["superadmin", "ngo_admin", "field_worker", "volunteer"] },
  { label: "Profile", href: "/profile", roles: ["superadmin", "ngo_admin", "field_worker", "volunteer"] },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isWorkspacePage = location.pathname.startsWith("/form-builder");

  useEffect(() => {
    const stored = window.localStorage.getItem("niyojan.sidebar.collapsed");
    if (stored) {
      setSidebarCollapsed(stored === "true");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("niyojan.sidebar.collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <div className="h-screen overflow-hidden bg-surface-container text-on-surface">
      <div
        className={cn(
          "grid h-screen",
          sidebarCollapsed ? "lg:grid-cols-[88px_minmax(0,1fr)]" : "lg:grid-cols-[220px_minmax(0,1fr)]",
        )}
      >
        <aside
          className={cn(
            "app-sidebar flex min-h-0 flex-col border-b border-outline-variant bg-surface-dim py-5 lg:border-b-0 lg:border-r",
            sidebarCollapsed ? "px-3" : "px-4",
          )}
        >
          <div
            className={cn(
              "rounded-panel border border-outline-variant bg-surface",
              sidebarCollapsed
                ? "flex flex-col items-center gap-3 px-2 py-3"
                : "flex items-start justify-between gap-3 px-4 py-4",
            )}
          >
            <div className={cn("min-w-0", sidebarCollapsed && "hidden")}>
              <p className="text-2xl font-semibold tracking-[-0.03em] text-on-surface">NIYOJAN</p>
              <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                Field operations workspace
              </p>
            </div>
            {sidebarCollapsed ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xl font-semibold tracking-[-0.03em] text-primary">
                N
              </div>
            ) : null}
            <button
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "rounded-md border border-outline-variant text-sm text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface",
                sidebarCollapsed ? "w-full px-2 py-1.5" : "px-2 py-1",
              )}
              onClick={() => setSidebarCollapsed((current) => !current)}
              type="button"
            >
              {sidebarCollapsed ? ">" : "<"}
            </button>
          </div>
          <nav className={cn("mt-6 min-h-0 flex-1 space-y-1 overflow-y-auto", sidebarCollapsed ? "" : "pr-1")}>
            {navItems
              .filter((item) => (user ? item.roles.includes(user.role) : false))
              .map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      "flex min-h-[38px] items-center rounded-md border-l-4 px-3 py-2 text-sm font-medium transition",
                      isActive
                        ? "border-l-primary bg-primary/10 text-primary"
                        : "border-l-transparent text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
                      sidebarCollapsed && "min-h-[52px] justify-center rounded-xl border-l-0 px-2 text-center text-[10px] leading-4",
                    )
                  }
                  title={item.label}
                >
                  {sidebarCollapsed ? (
                    <span className="block max-w-[52px]">{item.label.slice(0, 3).toUpperCase()}</span>
                  ) : (
                    item.label
                  )}
                </NavLink>
              ))}
          </nav>

          <div className="space-y-3 pt-5">
            <Button
              className="w-full justify-center"
              variant="secondary"
              onClick={() => void signOut()}
            >
              {sidebarCollapsed ? "Out" : "Sign Out"}
            </Button>
            <div
              className={cn(
                "rounded-panel border border-outline-variant bg-surface",
                sidebarCollapsed ? "px-2 py-3" : "px-4 py-4",
              )}
            >
              {sidebarCollapsed ? (
                <div className="space-y-2 text-center">
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {(user?.name ?? "U").slice(0, 1).toUpperCase()}
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-on-surface-variant">
                    {user?.role?.slice(0, 4)}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-on-surface">{user?.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-on-surface-variant">
                    {user?.role}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-on-surface-variant">{user?.email}</p>
                </>
              )}
            </div>
          </div>
        </aside>

        <div className="min-w-0 overflow-y-auto">
          <div className="border-b border-outline-variant bg-surface px-6 py-4 md:px-8">
            <div className="page-shell">
              <p className="text-sm text-on-surface-variant">
                {user?.organizationName ?? "Niyojan"} / {user?.role ?? "workspace"}
              </p>
            </div>
          </div>
          <main className="px-6 py-8 md:px-8">
            <div className={cn("page-shell", isWorkspacePage && "max-w-[1360px]")}>
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
