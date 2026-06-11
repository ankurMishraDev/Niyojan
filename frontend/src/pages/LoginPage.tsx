import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Button, Input, Panel } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { useTranslation } from "react-i18next";

export function LoginPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const { status, user, signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated" && user) {
    return (
      <Navigate
        to={
          user.status === "active"
            ? (location.state as { from?: string } | null)?.from ?? (user.role === "volunteer" ? "/assignments" : "/dashboard")
            : "/account-status"
        }
        replace
      />
    );
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

  return (
    <div className="min-h-screen bg-canvas-soft text-ink font-sans px-4 py-6 md:py-12 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Decorative gradient blur */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[500px] bg-mesh-hero opacity-30 -z-10 pointer-events-none rounded-full blur-[100px]"></div>

      <div className="w-full max-w-md mx-auto relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 mb-8 group">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center transition-transform group-hover:scale-105">
            <span className="text-on-primary font-bold text-sm">N</span>
          </div>
          <span className="text-xl font-bold tracking-tight">NIYOJAN</span>
        </Link>

        <Panel className="space-y-6 sm:p-8">
          <div>
            <p className="label-caps mb-2">{t("LoginPage_Header_CommandAccess")}</p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{t("LoginPage_Header_Title")}</h1>
            <p className="mt-2 text-sm text-body leading-relaxed">
              {t("LoginPage_Header_Description")}
            </p>
          </div>

          <div className="rounded-md bg-link-bg-soft/40 border border-link/20 px-4 py-3 text-sm text-body">
            {t("LoginPage_Alert_NewAccounts")}
          </div>

          {error ? (
            <div className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger font-medium">
              {error}
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={onFirebaseSubmit}>
            <div className="space-y-4">
              <Input
                type="email"
                placeholder={t("LoginPage_Input_Email")}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
              <Input
                type="password"
                placeholder={t("LoginPage_Input_Password")}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <Button className="w-full py-2.5 mt-2 text-sm" disabled={submitting} type="submit">
              {submitting ? t("LoginPage_Button_SigningIn") : t("LoginPage_Button_SignIn")}
            </Button>

            <div className="pt-6 border-t border-hairline flex flex-col gap-3">
              <p className="text-sm text-body">
                {t("LoginPage_Text_NewNGO")}{" "}
                <Link className="text-link font-medium hover:underline underline-offset-2" to="/signup">
                  {t("LoginPage_Link_NewNGO")}
                </Link>
              </p>
              <p className="text-sm text-body">
                {t("LoginPage_Text_NewVolunteer")}{" "}
                <Link className="text-link font-medium hover:underline underline-offset-2" to="/volunteer-signup">
                  {t("LoginPage_Link_NewVolunteer")}
                </Link>
              </p>
            </div>
          </form>
        </Panel>

        <div className="mt-8 text-center text-xs text-mute font-mono">
          {t("LoginPage_Footer_Text")}
        </div>
      </div>
    </div>
  );
}
