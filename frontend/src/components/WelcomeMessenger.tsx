import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "niyojan_welcome_messenger_disabled";

/**
 * Welcome messenger popup shown after login.
 * Persists user preference via localStorage:
 *   - "Turn off messenger" toggled ON  → never show again (stored in localStorage)
 *   - "Turn off messenger" toggled OFF → show on every visit after auth
 */
export function WelcomeMessenger() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [turnedOff, setTurnedOff] = useState(false);

  useEffect(() => {
    const disabled = localStorage.getItem(STORAGE_KEY) === "true";
    if (!disabled) {
      // Small delay so the dashboard renders first
      const t = setTimeout(() => setVisible(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  const handleToggle = () => {
    const next = !turnedOff;
    setTurnedOff(next);
    if (next) {
      localStorage.setItem(STORAGE_KEY, "true");
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleClose = () => setVisible(false);

  const handleGoToHelp = () => {
    setVisible(false);
    navigate("/help");
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-messenger-title"
        className="fixed z-50 inset-0 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="pointer-events-auto relative w-full max-w-md rounded-xl bg-canvas shadow-[0px_2px_2px_#0000000a,0px_8px_16px_-4px_#0000000a,0px_24px_32px_-8px_#0000000f] border border-hairline overflow-hidden">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-canvas-soft-2 text-mute hover:text-ink hover:bg-canvas-soft flex items-center justify-center transition-colors text-sm"
            aria-label="Close"
          >
            ✕
          </button>

          {/* Gradient accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-[#007cf0] via-[#7928ca] to-[#ff0080]" />

          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="space-y-1 pr-6">
              <p className="text-[10px] font-mono uppercase tracking-widest text-mute">Welcome to Niyojan</p>
              <h2
                id="welcome-messenger-title"
                className="text-xl font-semibold tracking-tight text-ink"
              >
                Are you new here?
              </h2>
            </div>

            {/* Message */}
            <p className="text-sm leading-relaxed text-body">
              Welcome, are you new at Niyojan? If yes then we kindly request you to checkout the{" "}
              <strong className="font-medium text-ink">Help section</strong> first to understand how this panel works.
              It covers quick-start guides, section walkthroughs, and tutorial videos for your role.
            </p>

            {/* CTA */}
            <button
              onClick={handleGoToHelp}
              className="w-full inline-flex items-center justify-center rounded-pill bg-primary px-6 py-2.5 text-sm font-medium text-on-primary transition-all hover:bg-ink/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              Go to Help Section
            </button>

            {/* Divider */}
            <div className="border-t border-hairline" />

            {/* Turn off toggle */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-ink">Turn off messenger</p>
                <p className="text-[11px] text-mute mt-0.5">
                  {turnedOff ? "Won't appear again on future visits." : "Appears on every visit after login."}
                </p>
              </div>
              {/* Toggle switch */}
              <button
                role="switch"
                aria-checked={turnedOff}
                onClick={handleToggle}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                  turnedOff ? "bg-primary" : "bg-canvas-soft-2 border border-hairline-strong"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-5 w-5 transform rounded-full bg-canvas shadow-sm transition-transform duration-200 ${
                    turnedOff ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
