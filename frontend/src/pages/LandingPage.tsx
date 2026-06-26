import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useTranslation } from "react-i18next";

// ─── CONFIG — update these paths/URLs without touching component logic ────────

/**
 * INTRO VIDEO
 * Paste the Google Drive share URL (or YouTube embed URL) here.
 * For Google Drive: share the file as "Anyone with the link can view" and paste the URL.
 * The component extracts the file ID and builds the /preview embed URL automatically.
 * Leave as empty string to hide the section until the video is ready.
 */
const INTRO_VIDEO_URL = "https://drive.google.com/file/d/1B4AwUdWMfZMVfJypP0MMJn-vK5T7wOU1/view?usp=sharing"; // e.g. "https://drive.google.com/file/d/YOUR_FILE_ID/view?usp=sharing"
const INTRO_VIDEO_THUMBNAIL = "../../assests/land.png"; // e.g. "/assets/intro-thumb.jpg"  — relative to /public

/**
 * DOWNLOAD APP VIDEO
 * Same format as INTRO_VIDEO_URL.
 */
const DOWNLOAD_VIDEO_URL = "https://drive.google.com/file/d/1gwYK8r5P_fkpo1GTjaDI0P4JKp82Roy8/view?usp=sharing"; // e.g. "https://drive.google.com/file/d/YOUR_FILE_ID/view?usp=sharing"
const DOWNLOAD_VIDEO_THUMBNAIL = "../../assests/logo.png"; // e.g. "/assets/download-thumb.jpg"

/**
 * DOWNLOAD APP SECTION
 * Update the bullet points and the external download button URL here.
 */
const DOWNLOAD_APP_POINTS = [
  "Watch the video to know how to download the Niyojan Mobile App step by step",
  "Works offline — capture surveys even without internet and sync when back online.",
  "AI-powered document scanning: photograph filled forms and extract data automatically.",
  "Supports 15 Indian languages for field data collection.",
  "Download the apk from expo platform using android OS device or scan the QR code to get started."
];

/** Replace with your actual APK / Play Store / App Store link */
const DOWNLOAD_EXTERNAL_URL="https://expo.dev/accounts/ankur07/projects/niyojan-mobile/builds/763d10da-0c2a-43a6-b3ac-2bca57a106a0";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDriveFileId(input: string): string | null {
  if (!input) return null;
  if (!input.includes("/")) return input.length > 10 ? input : null;
  const match = input.match(/\/file\/d\/([^/?\s]+)/);
  return match ? match[1] : null;
}

function getDriveEmbedUrl(input: string): string | null {
  const id = extractDriveFileId(input);
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/preview`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * IframeScaler — renders an iframe at 1280×720 then CSS-scales it to fill
 * its parent container. This makes Google Drive's fixed-size player controls
 * appear proportional on all screen sizes, including narrow mobile viewports.
 *
 * Parent must be position:relative with a defined height (e.g. aspect-video).
 */
function IframeScaler({ src, title }: { src: string; title: string }) {
  const LOGICAL_W = 1280;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect;
      if (width > 0) setScale(width / LOGICAL_W);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      style={{ position: "absolute", inset: 0, overflow: "hidden" }}
    >
      <iframe
        src={src}
        title={title}
        allow="autoplay; fullscreen"
        allowFullScreen
        style={{
          border: 0,
          width: `${LOGICAL_W}px`,
          height: `${LOGICAL_W * 0.5625}px`, // 16:9
          transformOrigin: "0 0",
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
}

/**
 * Reusable video section — shows thumbnail + play overlay until clicked,
 * then embeds the Drive /preview iframe.
 */
function VideoEmbed({
  videoUrl,
  thumbnailSrc,
  title,
  aspectClass = "aspect-video",
}: {
  videoUrl: string;
  thumbnailSrc: string;
  title: string;
  aspectClass?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const embedUrl = getDriveEmbedUrl(videoUrl);

  if (!embedUrl) {
    // Video not configured yet — show placeholder
    return (
      <div
        className={`w-full ${aspectClass} rounded-xl bg-canvas-soft-2 border border-hairline flex flex-col items-center justify-center gap-3`}
      >
        <div className="w-14 h-14 rounded-full bg-canvas-soft flex items-center justify-center border border-hairline">
          <svg className="w-6 h-6 text-mute" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <p className="text-xs font-mono text-mute uppercase tracking-widest">Video coming soon</p>
      </div>
    );
  }

  if (playing) {
    return (
      <div className={`w-full ${aspectClass} rounded-xl overflow-hidden border border-hairline shadow-[0px_2px_2px_#0000000a,0px_8px_16px_-4px_#0000000a] relative`}>
        {/*
          Drive /preview renders its player controls at fixed pixel sizes that don't
          scale with the iframe dimensions — on narrow screens the controls dominate.
          Fix: render the iframe at a fixed 1280×720 logical size, then CSS-scale it
          down to exactly fill the container. The player sees a "desktop" viewport and
          renders proportional controls; we just shrink the whole thing to fit.
        */}
        <IframeScaler src={`${embedUrl}?autoplay=1`} title={title} />
      </div>
    );
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      className={`group relative w-full ${aspectClass} rounded-xl overflow-hidden border border-hairline shadow-[0px_2px_2px_#0000000a,0px_8px_16px_-4px_#0000000a] cursor-pointer`}
      aria-label={`Play ${title}`}
    >
      {/* Thumbnail */}
      {thumbnailSrc ? (
        <img
          src={thumbnailSrc}
          alt={`${title} thumbnail`}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-canvas-soft-2 via-canvas-soft to-canvas" />
      )}

      {/* Play overlay */}
      <div className="absolute inset-0 bg-ink/20 group-hover:bg-ink/30 transition-colors flex items-center justify-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-canvas/90 backdrop-blur-sm flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
          <svg className="w-7 h-7 sm:w-8 sm:h-8 text-primary translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>

      {/* Label */}
      <div className="absolute bottom-3 left-4">
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-canvas/80 backdrop-blur-sm px-3 py-1 text-xs font-mono text-ink border border-hairline">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan"></span>
          Watch video
        </span>
      </div>
    </button>
  );
}

/** FAQ accordion — shows one answer at a time */
const FAQ_ITEMS = [
  {
    q: "What is Niyojan and who is it for?",
    a: "Niyojan is a humanitarian operations platform that connects NGOs, field workers, and volunteers in a single coordinated workflow. It helps NGOs collect field data, AI-extract needs, match volunteers by skill and proximity, and track assignments from dispatch to closure.",
  },
  {
    q: "How does the AI matching work?",
    a: "When a field survey is submitted, the platform extracts the beneficiary's needs using an AI pipeline. The matching engine then scores all active volunteers by skill overlap, physical distance (haversine), and current availability — and presents ranked candidates for the admin to review and assign.",
  },
  {
    q: "Can the mobile app work without internet?",
    a: "Yes. The mobile app includes an offline sync engine. Field workers can fill surveys, pick from cached form templates, and submit — all without internet. Submissions are queued locally in SQLite and automatically synced to the server when connectivity is restored.",
  },
  {
    q: "How do I get started as an NGO?",
    a: "Register your NGO through the Sign Up flow on the web platform. Once a superadmin approves your application, you will receive access to the Form Builder, Data Collection, and Feedback modules. Your volunteers register separately and are linked to your organization.",
  },
  {
    q: "Is my data secure?",
    a: "All API traffic is encrypted over HTTPS. Authentication runs through Firebase Auth with JWT tokens. Sensitive beneficiary data is stored in a private PostgreSQL database with role-based access controls — each user role only sees the data relevant to their scope.",
  },
];

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={item.q}
            className="rounded-lg border border-hairline bg-canvas overflow-hidden shadow-sm transition-shadow hover:shadow-[0px_2px_2px_#0000000a,0px_4px_8px_-2px_#0000000a]"
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-sm sm:text-base font-medium text-ink">{item.q}</span>
              <span
                className={`shrink-0 w-6 h-6 rounded-full bg-canvas-soft-2 flex items-center justify-center text-mute transition-transform ${
                  isOpen ? "rotate-45" : ""
                }`}
                aria-hidden="true"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </span>
            </button>
            {isOpen && (
              <div className="px-5 pb-5">
                <p className="text-sm leading-relaxed text-body">{item.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Feature cards ────────────────────────────────────────────────────────────

const featureCards = [
  {
    title: "Multilingual Support",
    description:
      "Supports 15+ Indian languages, including Hindi, Marathi, Gujarati, and Urdu etc. Using government entrusted service Bhashini",
  },
  {
    title: "Smart Volunteer Matching",
    description:
      "Match volunteers to urgent work by skills, distance, and availability — automatically scored and ranked",
  },
  {
    title: "Offline Compatibility",
    description:
      "Niyojan Mobile app is built to collect data in low connectivity areas which makes it adapatable to realworld challenges of field work",
  },
  {
    title: "Smart Volunteer Allocation",
    description:
      "Groups similar survey requests based on location, urgency, and requirement type and assign the volunteer to resolve core problem directly",
  },
  {
    title: "Privacy First Processing",
    description:
      "Protect confidential beneficiary data by coverting them into tokens and only sharing necessary insights with volunteers for effective resolution",
  },
  {
    title: "Customizable Forms & Surveys",
    description:
      "Build structured survey forms manually using standard cataloges, or upload a blank form and let AI generate the digital equivalent automatically."
  }
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export function LandingPage() {
  const { t } = useTranslation();
  const { user, status } = useAuth();
  const destination = user
    ? user.status === "active"
      ? "/dashboard"
      : "/account-status"
    : "/login";

  const faqRef = useRef<HTMLElement>(null);
  const downloadRef = useRef<HTMLElement>(null);

  const scrollToFaq = (e: React.MouseEvent) => {
    e.preventDefault();
    faqRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    downloadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="min-h-screen bg-canvas-soft text-ink selection:bg-primary selection:text-on-primary font-sans relative overflow-x-hidden">
      {/* Mesh gradient background */}
      <div className="absolute inset-0 bg-mesh-hero -z-10 opacity-60 pointer-events-none" />

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 sm:px-6 py-4 lg:px-8">

        {/* ── Navigation ─────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-on-primary font-bold text-sm">N</span>
            </div>
            <p className="text-xl font-bold tracking-tight">NIYOJAN</p>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm text-body">
            <a className="transition-colors hover:text-ink" href="#intro-video">{t("LandingPage_Nav_Home")}</a>
            <a className="transition-colors hover:text-ink" href="#mission">{t("LandingPage_Nav_Mission")}</a>
            {/* <a className="transition-colors hover:text-ink" href="#features">{t("LandingPage_Nav_Features")}</a> */}
            {/* FAQs nav link — scrolls to FAQ section */}
            <a className="transition-colors hover:text-ink" href="#faqs" onClick={scrollToFaq}>
              {/* FAQs */}
            </a>
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
            {/* Download App button — scrolls to download section */}
            <a
              href="#download"
              onClick={scrollToDownload}
              className="inline-flex items-center justify-center rounded-pill bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition-all hover:bg-ink/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none touch-manipulation"
            >
              Download App
            </a>
          </div>
        </header>

        {/* ── Hero Section ───────────────────────────────────────────────── */}
        <section
          id="home"
          className="flex-1 flex flex-col justify-center items-center text-center py-20 lg:py-32 space-y-8 relative z-10"
        >
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

        {/* ── Intro Video Section ─────────────────────────────────────────── */}
        <section id="intro-video" className="py-16 lg:py-24">
          <div className="max-w-7xl mx-auto w-full">
            {/* 70% width centred */}
            <div className="mx-auto w-full" style={{minWidth:"40%", minHeight:"40%",maxHeight: "100%", maxWidth: "100%" }}>
              <VideoEmbed
                videoUrl={INTRO_VIDEO_URL}
                thumbnailSrc={INTRO_VIDEO_THUMBNAIL}
                title="Niyojan platform introduction"
                aspectClass="aspect-video"
              />
            </div>
          </div>
        </section>

        {/* ── Features Section ───────────────────────────────────────────── */}
        <section id="mission">
        <p className="text-3xl bold font-mono uppercase tracking-widest pt-5 text-primary">{t("LandingPage_Nav_Mission")}</p>
          <div className="grid gap-6 py-16 md:grid-cols-2 lg:grid-cols-3">
          
          {featureCards.map((card, index) => (
            <article
              key={card.title}
              className={`flex flex-col justify-between rounded-lg p-8 shadow-card-medium transition-transform hover:-translate-y-1 ${
                index === 1 || index === 3 || index === 5 ? "bg-primary text-on-primary" : "bg-canvas text-ink"
              }`}
            >
              <div className="space-y-6">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center text-lg font-mono ${
                    index === 1 || index === 3 || index === 5? "bg-on-primary/10 text-on-primary" : "bg-canvas-soft-2 text-mute"
                  }`}
                >
                  0{index + 1}
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-balance">
                  {card.title}
                </h2>
                <p
                  className={`text-sm sm:text-base leading-relaxed ${
                    index === 1 || index === 3 || index === 5 ? "text-on-primary/80" : "text-body"
                  }`}
                >
                  {card.description}
                </p>
              </div>
            </article>
          ))}
          </div>
        </section>

        {/* ── Download App Section ────────────────────────────────────────── */}
        <section id="download" ref={downloadRef} className="py-16 lg:py-24">
          <div className="rounded-xl border border-hairline bg-canvas p-8 md:p-12 shadow-[0px_2px_2px_#0000000a,0px_8px_16px_-4px_#0000000a] space-y-10">
            {/* Section header */}
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <p className="text-xs font-mono uppercase tracking-widest text-mute">Mobile App</p>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink">
                Take Niyojan to the field.
              </h2>
              <p className="text-base text-body leading-relaxed">
                The Niyojan mobile app is built for field workers who need to collect data, fill surveys, and make coordinate without a reliable internet connection.
              </p>
            </div>

            <div className="grid gap-10 lg:grid-cols-[1fr_1fr] items-start">
              {/* Left: bullet points + CTA */}
              <div className="space-y-6">
                <ul className="space-y-4">
                  {DOWNLOAD_APP_POINTS.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-canvas-soft-2 border border-hairline flex items-center justify-center">
                        <svg className="w-3 h-3 text-primary" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <span className="text-sm leading-relaxed text-body">{point}</span>
                    </li>
                  ))}
                </ul>

                {/* External download button — update DOWNLOAD_EXTERNAL_URL at top of file */}
                <a
                  href={DOWNLOAD_EXTERNAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-pill bg-primary px-7 py-3 text-sm font-medium text-on-primary transition-all hover:bg-ink/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none shadow-card-soft"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download APK
                </a>
              </div>

              {/* Right: video — same HelpPage-style Drive embed */}
              <VideoEmbed
                videoUrl={DOWNLOAD_VIDEO_URL}
                thumbnailSrc={DOWNLOAD_VIDEO_THUMBNAIL}
                title="Download and setup guide"
                aspectClass="aspect-video"
              />
            </div>
          </div>
        </section>

        {/* ── FAQs Section ────────────────────────────────────────────────── */}
        <section id="faqs" ref={faqRef} className="py-16 lg:py-24">
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center space-y-3">
              <p className="text-xs font-mono uppercase tracking-widest text-mute">Frequently Asked</p>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink">
                Questions about Niyojan.
              </h2>
              <p className="text-base text-body leading-relaxed">
                Everything you need to know before getting started.
              </p>
            </div>

            <FaqAccordion />
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer
          id="contact"
          className="mt-auto flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-hairline py-8 text-sm text-mute"
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-mute flex items-center justify-center opacity-50">
              <span className="text-canvas font-bold text-[10px]">N</span>
            </div>
            <span>NIYOJAN platform</span>
          </div>
          <span>
            {status === "authenticated" ? `Signed in as ${user?.role}` : "Public landing page"}
          </span>
        </footer>
      </div>
    </main>
  );
}
