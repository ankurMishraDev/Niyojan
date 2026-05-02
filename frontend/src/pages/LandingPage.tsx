import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";

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
  const { user, status } = useAuth();
  const destination = user ? (user.status === "active" ? "/dashboard" : "/account-status") : "/login";

  return (
    <main className="min-h-screen bg-[#f7f2e8] text-[#171512]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-5 lg:px-10">
        <header className="flex items-center justify-between border-b border-black/10 pb-5">
          <div className="space-y-1">
            <p className="text-2xl font-black tracking-tight md:text-3xl">NIYOJAN</p>
          </div>

          <nav className="hidden items-center gap-8 text-sm md:flex">
            <a className="transition hover:opacity-70" href="#home">
              Home
            </a>
            <a className="transition hover:opacity-70" href="#mission">
              Mission
            </a>
            {/* <a className="transition hover:opacity-70" href="#impact">
              Impact
            </a>
            <a className="transition hover:opacity-70" href="#contact">
              Contact
            </a> */}
          </nav>

          <Link
            className="rounded-xl bg-[#23231e] px-5 py-3 text-sm font-semibold text-[#f6f2e8] transition hover:scale-[1.01] hover:bg-[#313129]"
            to={destination}
          >
            Get Started
          </Link>
        </header>

        <section id="home" className="grid flex-1 gap-10 py-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="space-y-8">
            <div className="flex items-center justify-between gap-4 text-[#8b8478]">
              {/* <span className="text-sm font-medium uppercase tracking-[0.18em]">[2024]</span> */}
              <span className="hidden text-sm md:block">Operational coordination for field teams</span>
            </div>

            <div className="space-y-6">
              <h1 className="max-w-4xl font-serif text-5xl font-semibold leading-[0.92] tracking-[-0.05em] text-[#171512] md:text-7xl">
                Intelligence for
                <br />
                Smart Resource Coordination
              </h1>
              <p className="max-w-xl text-base leading-7 text-[#4f4a40] md:text-lg">
                NIYOJAN turns NGO intake, volunteer matching, field feedback, and document
                workflows into one operational control surface.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                className="rounded-xl bg-[#23231e] px-6 py-3 text-sm font-semibold text-[#f6f2e8] transition hover:bg-[#313129]"
                to={destination}
              >
                {user ? "Open Dashboard" : "Start Session"}
              </Link>
              {!user ? (
                <Link
                  className="rounded-xl border border-black/15 bg-white/40 px-6 py-3 text-sm font-semibold text-[#171512] transition hover:bg-white/70"
                  to="/signup"
                >
                  Register NGO
                </Link>
              ) : null}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[2rem] border border-black/10 bg-[#ece4d7] p-8 shadow-[0_18px_50px_rgba(0,0,0,0.08)]">
              <p className="text-sm uppercase tracking-[0.16em] text-[#7f7666]">Operational Scope</p>
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
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
                    className="rounded-2xl border border-black/10 bg-[#f7f3ea] px-4 py-4 text-sm font-semibold text-[#1a1612]"
                  >
                    {area}
                  </div>
                ))}
              </div>
            </div>

            <p className="max-w-md text-sm leading-6 text-[#4f4a40]">
              Welcome to NIYOJAN, where coordination meets clarity. NGO teams can register,
              review, and operate with a single authenticated session.
            </p>
          </div>
        </section>

        <section id="mission" className="grid gap-4 pb-10 lg:grid-cols-3">
          {featureCards.map((card, index) => (
            <article
              key={card.title}
              className={`min-h-[320px] rounded-[1.5rem] border border-black/10 p-6 shadow-[0_18px_42px_rgba(0,0,0,0.08)] ${
                index === 1 ? "bg-[#23231e] text-[#f6f2e8]" : index === 2 ? "bg-[#d5e0ea]" : "bg-[#d7cbb9]"
              }`}
            >
              <div className="flex h-full flex-col justify-between">
                <div className="space-y-5">
                  <div className="h-12 w-12 rounded-full border border-current/35" />
                  <h2 className="max-w-xs font-serif text-3xl leading-[1.04]">{card.title}</h2>
                </div>
                <div className="space-y-3">
                  <p className="max-w-xs text-sm leading-6 opacity-80">{card.description}</p>
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    Learn more <span aria-hidden="true">→</span>
                  </span>
                </div>
              </div>
            </article>
          ))}
        </section>

        <footer id="contact" className="flex flex-wrap items-center justify-between gap-4 border-t border-black/10 py-5 text-sm text-[#6b6459]">
          <span>NIYOJAN operations platform</span>
          <span>{status === "authenticated" ? `Signed in as ${user?.role}` : "Public landing page"}</span>
        </footer>
      </div>
    </main>
  );
}
