import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useTranslation } from "react-i18next";

const featureCards = [
  {
    title: "Real-time Mission Telemetry",
    description: "Track needs, volunteers, and operational changes across the active field network.",
  },
  {
    title: "AI Resource Matching",
    description: "Match volunteers to urgent work by skills, distance, and availability.",
  },
  {
    title: "Humanitarian Logistics",
    description: "Coordinate documents, assignments, feedback, and closure workflows from one surface.",
  },
];

export function LandingPage() {
  const { t } = useTranslation();
  const { user, status } = useAuth();
  const destination = user ? (user.status === "active" ? "/dashboard" : "/account-status") : "/login";

  return (
    <main className="min-h-screen bg-canvas-soft text-ink selection:bg-primary selection:text-on-primary font-sans relative overflow-x-hidden">
      <div className="absolute inset-0 bg-mesh-hero -z-10 opacity-60"></div>
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 sm:px-6 py-4 lg:px-8">
        
        {/* Navigation */}
        <header className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-on-primary font-bold text-sm">N</span>
            </div>
            <p className="text-xl font-bold tracking-tight">NIYOJAN</p>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-body">
            <a className="transition-colors hover:text-ink" href="#home">{t("LandingPage_Nav_Home")}</a>
            <a className="transition-colors hover:text-ink" href="#mission">{t("LandingPage_Nav_Mission")}</a>
            <a className="transition-colors hover:text-ink" href="#features">{t("LandingPage_Nav_Features")}</a>
            {/* <a className="transition-colors hover:text-ink" href="https://github.com/niyojan">{t("LandingPage_Nav_OpenSource")}</a> */}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <LanguageSelector />
            </div>
            <Link
              className="hidden sm:inline-flex items-center justify-center text-sm font-medium text-body hover:text-ink transition-colors px-4 py-2"
              to="/login"
            >
              {t("LandingPage_Button_Login")}
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-pill bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition-all hover:bg-ink/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none touch-manipulation"
              to={destination}
            >
              {t("LandingPage_Button_GetStarted")}
            </Link>
          </div>
        </header>

        {/* Hero Section */}
        <section id="home" className="flex-1 flex flex-col justify-center items-center text-center py-20 lg:py-32 space-y-8 relative z-10">
          <div className="inline-flex items-center rounded-pill border border-hairline bg-canvas/80 backdrop-blur px-3 py-1 text-xs font-mono text-body shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-cyan mr-2"></span>
            {t("LandingPage_Pill_Operational")}
          </div>

          <h1 className="max-w-4xl text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-[-0.03em] leading-tight text-ink text-balance">
            {t("LandingPage_Header_Title")}
          </h1>
          
          <p className="max-w-2xl text-lg sm:text-xl text-body leading-relaxed text-balance">
            {t("LandingPage_Header_Description")}
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 w-full sm:w-auto">
            <Link
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-pill bg-primary px-8 py-3.5 text-base font-medium text-on-primary shadow-card-soft transition-all hover:scale-[1.02] hover:bg-ink/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none touch-manipulation"
              to={destination}
            >
              {user ? t("LandingPage_Button_OpenDashboard") : t("LandingPage_Button_StartSession")}
            </Link>
            {!user ? (
              <Link
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-pill border border-hairline bg-canvas px-8 py-3.5 text-base font-medium text-ink shadow-sm transition-all hover:bg-canvas-soft focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none touch-manipulation"
                to="/signup"
              >
                {t("LandingPage_Button_RegisterNGO")}
              </Link>
            ) : null}
          </div>
        </section>

        {/* Features / Mission */}
        <section id="mission" className="grid gap-6 py-16 md:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((card, index) => (
            <article
              key={card.title}
              className={`flex flex-col justify-between rounded-lg p-8 shadow-card-medium transition-transform hover:-translate-y-1 ${
                index === 1 ? "bg-primary text-on-primary" : "bg-canvas text-ink"
              }`}
            >
              <div className="space-y-6">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-lg font-mono ${
                  index === 1 ? "bg-on-primary/10 text-on-primary" : "bg-canvas-soft-2 text-mute"
                }`}>
                  0{index + 1}
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-balance">{card.title}</h2>
                <p className={`text-sm sm:text-base leading-relaxed ${index === 1 ? "text-on-primary/80" : "text-body"}`}>
                  {card.description}
                </p>
              </div>
            </article>
          ))}
        </section>

        {/* Areas / Scope */}
        <section id="features" className="py-20 lg:py-32">
          <div className="rounded-xl border border-hairline bg-canvas p-8 md:p-12 shadow-card-float">
            <div className="flex flex-col md:flex-row gap-12 items-center">
              <div className="flex-1 space-y-6">
                <p className="text-xs font-mono uppercase tracking-widest text-mute">Operational Scope</p>
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">{t("LandingPage_Section_Scope_Title")}</h2>
                <p className="text-base text-body leading-relaxed max-w-md text-pretty">
                  {t("LandingPage_Section_Scope_Description")}
                </p>
              </div>
              <div className="flex-1 w-full grid grid-cols-2 gap-3 sm:gap-4">
                {[
                  "Dashboard",
                  "Pipeline",
                  "AI Review",
                  "Form Builder",
                  "Matching",
                  "Assignments",
                  "Feedback",
                ].map((area) => (
                  <div
                    key={area}
                    className="rounded-md border border-hairline bg-canvas-soft-2 px-4 py-3 sm:py-4 text-sm font-medium text-ink shadow-sm text-center"
                  >
                    {area}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer id="contact" className="mt-auto flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-hairline py-8 text-sm text-mute">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-mute flex items-center justify-center opacity-50">
              <span className="text-canvas font-bold text-[10px]">N</span>
            </div>
            <span>NIYOJAN operations platform</span>
          </div>
          <span>{status === "authenticated" ? `Signed in as ${user?.role}` : "Public landing page"}</span>
        </footer>
      </div>
    </main>
  );
}
