import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { cn } from "@/lib/cn";
import type { AppRole } from "@/types/api";
import { LanguageSelector } from "@/components/LanguageSelector";

const navItems: Array<{
  i18nKey: string;
  href: string;
  roles: AppRole[];
}> = [
  // ── Superadmin ────────────────────────────────────────────────────────────
  { i18nKey: "Common_Navigation_Link_Dashboard", href: "/dashboard", roles: ["superadmin"] },
  { i18nKey: "Common_Navigation_Link_Pipeline", href: "/pipeline", roles: ["superadmin"] },
  { i18nKey: "Common_Navigation_Link_AIReview", href: "/ai-review", roles: ["superadmin"] },
  { i18nKey: "Common_Navigation_Link_Clustering", href: "/clustering", roles: ["superadmin"] },
  { i18nKey: "Common_Navigation_Link_Map", href: "/map", roles: ["superadmin"] },
  { i18nKey: "Common_Navigation_Link_Matching", href: "/matching", roles: ["superadmin"] },
  { i18nKey: "Common_Navigation_Link_Assignments", href: "/assignments", roles: ["superadmin"] },

  // ── NGO admin + field worker ──────────────────────────────────────────────
  { i18nKey: "Common_Navigation_Link_Dashboard", href: "/dashboard", roles: ["ngo_admin", "field_worker"] },
  { i18nKey: "Common_Navigation_Link_FormBuilder", href: "/form-builder", roles: ["ngo_admin", "field_worker"] },
  { i18nKey: "Common_Navigation_Link_DataCollection", href: "/surveys/new", roles: ["ngo_admin", "field_worker"] },

  // ── Volunteer ─────────────────────────────────────────────────────────────
  { i18nKey: "Common_Navigation_Link_Assignments", href: "/assignments", roles: ["volunteer"] },

  // ── All authenticated ─────────────────────────────────────────────────────
  { i18nKey: "Common_Navigation_Link_Feedback", href: "/feedback", roles: ["superadmin", "ngo_admin", "field_worker", "volunteer"] },
  { i18nKey: "Common_Navigation_Link_Help", href: "/help", roles: ["superadmin", "ngo_admin", "field_worker", "volunteer"] },
  { i18nKey: "Common_Navigation_Link_Profile", href: "/profile", roles: ["superadmin", "ngo_admin", "field_worker", "volunteer"] },
];

const helpPrompts: Record<AppRole, string> = {
  superadmin: "Open the command guide for onboarding approvals, matching, pipeline review, and assignment oversight.",
  ngo_admin: "Open the NGO guide for form builder, data collection, feedback follow-up, and account workflow.",
  field_worker: "Open the NGO guide for form builder, survey submission, feedback follow-up, and field operations.",
  volunteer: "Open the volunteer guide for assignments, case review, feedback submission, and profile readiness.",
};

export function AppShell() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close mobile menu on navigation
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="h-[100dvh] overflow-hidden bg-canvas-soft text-ink font-sans flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between border-b border-hairline bg-canvas px-4 py-3 z-20 relative">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <span className="text-on-primary font-bold text-xs">N</span>
          </div>
          <p className="text-lg font-bold tracking-tight">NIYOJAN</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile Language Selector */}
          {user?.role !== 'superadmin' && (
            <div className="w-24">
              <LanguageSelector />
            </div>
          )}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 -mr-2 text-ink hover:bg-canvas-soft rounded-md transition-colors"
            aria-label="Toggle menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isMobileMenuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </>
              ) : (
                <>
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-ink/20 backdrop-blur-sm z-10"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed md:static inset-y-0 left-0 w-[260px] md:w-[240px] lg:w-[260px] flex flex-col border-r border-hairline bg-canvas transition-transform duration-300 ease-in-out z-20",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="hidden md:flex flex-col px-5 py-6 border-b border-hairline bg-canvas">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
              <span className="text-on-primary font-bold text-sm">N</span>
            </div>
            <p className="text-xl font-bold tracking-tight text-ink">NIYOJAN</p>
          </div>
          <p className="text-[11px] font-mono text-mute uppercase tracking-widest mb-3">
            {user?.role.replace('_', ' ')}
          </p>
          {/* Desktop Language Selector */}
          {user?.role !== 'superadmin' && <LanguageSelector />}
        </div>
        
        <div className="md:hidden flex flex-col px-5 py-6 border-b border-hairline bg-canvas mt-14">
           <p className="text-[11px] font-mono text-mute uppercase tracking-widest">
            {user?.role.replace('_', ' ')} Workspace
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems
            .filter((item) => (user ? item.roles.includes(user.role) : false))
            .map((item, index) => (
              <NavLink
                key={`${item.href}-${index}`}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-all",
                    isActive
                      ? "bg-canvas-soft-2 text-ink font-semibold border border-hairline shadow-sm"
                      : "text-body border border-transparent hover:bg-canvas-soft hover:text-ink",
                  )
                }
              >
                {t(item.i18nKey)}
              </NavLink>
            ))}
        </nav>

        <div className="p-4 border-t border-hairline bg-canvas space-y-4">
          {user ? (
            <div className="rounded-md border border-hairline bg-canvas-soft p-3">
              <p className="label-caps text-ink">{t('Common_Navigation_Text_HelpCenter')}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-body">{helpPrompts[user.role]}</p>
              <NavLink className="action-button-secondary w-full text-xs mt-3 py-1.5" to="/help">
                {t('Common_Navigation_Button_OpenGuide')}
              </NavLink>
            </div>
          ) : null}
          <Button
            className="w-full text-sm py-2"
            variant="ghost"
            onClick={() => void signOut()}
          >
            {t('Common_Navigation_Button_SignOut')}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 overflow-y-auto flex flex-col relative z-0">
        <main className="flex-1 relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
