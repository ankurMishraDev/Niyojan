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
  { label: "Pipeline", href: "/pipeline", roles: ["superadmin"] },
  { label: "AI Review", href: "/ai-review", roles: ["superadmin"] },
  { label: "Form Builder", href: "/form-builder", roles: ["superadmin", "ngo_admin", "field_worker"] },
  { label: "Data Collection", href: "/surveys/new", roles: ["superadmin", "ngo_admin", "field_worker"] },
  { label: "Matching", href: "/matching", roles: ["superadmin"] },
  { label: "Assignments", href: "/assignments", roles: ["superadmin", "volunteer"] },
  { label: "Feedback", href: "/feedback", roles: ["superadmin", "ngo_admin", "field_worker", "volunteer"] },
  { label: "Profile", href: "/profile", roles: ["superadmin", "ngo_admin", "field_worker", "volunteer"] },
];

export function AppShell() {
  const { user, signOut } = useAuth();

  return (
    <div className="h-screen overflow-hidden bg-surface text-on-surface">
      <div className="grid h-screen lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-outline-variant bg-black/25 px-4 py-4 lg:border-b-0 lg:border-r">
          <div className="panel-muted px-3 py-3">
            <p className="text-2xl font-black text-white">NIYOJAN</p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Smart Resource allocation 
            </p>
          </div>
          <nav className="mt-4 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {navItems
              .filter((item) => (user ? item.roles.includes(user.role) : false))
              .map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center rounded-md border px-3 py-2 text-sm font-semibold transition",
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

          <div className="space-y-3 pt-4">
            <Button
              className="w-full justify-center"
              variant="primary"
              onClick={() => void signOut()}
            >
              Sign Out
            </Button>
            <div className="rounded-md border border-outline-variant bg-surface-container-low px-3 py-3">
              <p className="text-sm font-semibold text-white">{user?.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-on-surface-variant">
                {user?.role}
              </p>
              <p className="mt-3 text-xs text-on-surface-variant">{user?.email}</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0 overflow-y-auto">
          
          <main className="px-4 py-4">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}