import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button, Input, Panel, Textarea } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { useTranslation } from "react-i18next";

import { TermsAndConditions } from "@/components/TermsAndConditions";

export function SignupPage() {
  const { t } = useTranslation();
  const { status, user, signUpNgo, usingFirebase } = useAuth();
  const [organizationName, setOrganizationName] = useState("");
  const [organizationType, setOrganizationType] = useState("NGO");
  const [region, setRegion] = useState("");
  const [adminName, setAdminName] = useState("");
  const [registrationId, setRegistrationId] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [addressText, setAddressText] = useState("");
  const [focusAreas, setFocusAreas] = useState("");
  const [operatingRegions, setOperatingRegions] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [foundedYear, setFoundedYear] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  if (status === "authenticated" && user) {
    return <Navigate to={user.status === "active" ? "/dashboard" : "/account-status"} replace />;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!termsAccepted) {
      setError("Please accept the terms and conditions to register.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");

    const splitList = (value: string) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

    try {
      await signUpNgo(email, password, {
        organization_name: organizationName,
        organization_type: organizationType,
        region: region || undefined,
        admin_name: adminName || undefined,
        registration_id: registrationId || undefined,
        contact_phone: contactPhone || undefined,
        website: website || undefined,
        address_text: addressText || undefined,
        focus_areas: splitList(focusAreas),
        operating_regions: splitList(operatingRegions),
        team_size: teamSize ? Number(teamSize) : undefined,
        founded_year: foundedYear ? Number(foundedYear) : undefined,
      });
      setPassword("");
      setSuccess("NGO account created. Check your email for the verification link before signing in.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "NGO registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas-soft text-ink font-sans px-4 py-8 md:py-12 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Decorative gradient blur */}
      <div className="absolute top-0 right-0 w-full max-w-[800px] h-[500px] bg-mesh-hero opacity-20 -z-10 pointer-events-none rounded-full blur-[120px] translate-x-1/3 -translate-y-1/3"></div>

      <div className="w-full max-w-2xl mx-auto relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 mb-8 group">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center transition-transform group-hover:scale-105">
            <span className="text-on-primary font-bold text-sm">N</span>
          </div>
          <span className="text-xl font-bold tracking-tight">NIYOJAN</span>
        </Link>

        <Panel className="space-y-8 sm:p-10">
          <div>
            <p className="label-caps mb-2">{t("SignupPage_Header_NGOOnboarding")}</p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{t("SignupPage_Header_Title")}</h1>
            <p className="mt-2 text-sm text-body leading-relaxed max-w-lg">
              {t("SignupPage_Header_Description")}
            </p>
          </div>

          {error ? (
            <div className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger font-medium">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-md border border-success/30 bg-success/5 px-4 py-3 text-sm text-success font-medium">
              {success}
            </div>
          ) : null}

          <form className="grid gap-5 md:grid-cols-2" onSubmit={onSubmit}>
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-body px-1">{t("SignupPage_Input_OrgName")}</label>
              <Input
                placeholder={t("SignupPage_Input_OrgName_Placeholder")}
                required
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">{t("SignupPage_Input_OrgType")}</label>
              <Input
                placeholder={t("SignupPage_Input_OrgType_Placeholder")}
                value={organizationType}
                onChange={(event) => setOrganizationType(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">{t("SignupPage_Input_Region")}</label>
              <Input
                placeholder={t("SignupPage_Input_Region_Placeholder")}
                required
                value={region}
                onChange={(event) => setRegion(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">{t("SignupPage_Input_RegId")}</label>
              <Input
                placeholder={t("SignupPage_Input_RegId_Placeholder")}
                value={registrationId}
                onChange={(event) => setRegistrationId(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">{t("SignupPage_Input_Phone")}</label>
              <Input
                type="tel"
                placeholder={t("SignupPage_Input_Phone_Placeholder")}
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-body px-1">{t("SignupPage_Input_Website")}</label>
              <Input
                placeholder={t("SignupPage_Input_Website_Placeholder")}
                type="url"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-body px-1">{t("SignupPage_Input_Address")}</label>
              <Textarea
                className="min-h-[80px]"
                placeholder={t("SignupPage_Input_Address_Placeholder")}
                value={addressText}
                onChange={(event) => setAddressText(event.target.value)}
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-body px-1">{t("SignupPage_Input_FocusAreas")}</label>
              <Input
                placeholder={t("SignupPage_Input_FocusAreas_Placeholder")}
                value={focusAreas}
                onChange={(event) => setFocusAreas(event.target.value)}
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-body px-1">{t("SignupPage_Input_OperatingRegions")}</label>
              <Input
                placeholder={t("SignupPage_Input_OperatingRegions_Placeholder")}
                value={operatingRegions}
                onChange={(event) => setOperatingRegions(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">{t("SignupPage_Input_TeamSize")}</label>
              <Input
                placeholder={t("SignupPage_Input_TeamSize_Placeholder")}
                type="number"
                min={1}
                value={teamSize}
                onChange={(event) => setTeamSize(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">{t("SignupPage_Input_FoundedYear")}</label>
              <Input
                placeholder={t("SignupPage_Input_FoundedYear_Placeholder")}
                type="number"
                min={1800}
                max={new Date().getFullYear()}
                value={foundedYear}
                onChange={(event) => setFoundedYear(event.target.value)}
              />
            </div>

            <div className="md:col-span-2 pt-4 border-t border-hairline mt-2 space-y-1">
              <p className="font-medium text-sm text-ink mb-3">{t("SignupPage_Section_AdminDetails")}</p>
              <label className="text-xs font-medium text-body px-1">{t("SignupPage_Input_AdminName")}</label>
              <Input
                placeholder={t("SignupPage_Input_AdminName_Placeholder")}
                required
                value={adminName}
                onChange={(event) => setAdminName(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">{t("SignupPage_Input_AdminEmail")}</label>
              <Input
                placeholder={t("SignupPage_Input_AdminEmail_Placeholder")}
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">{t("SignupPage_Input_Password")}</label>
              <Input
                placeholder={t("SignupPage_Input_Password_Placeholder")}
                required
                minLength={8}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <TermsAndConditions checked={termsAccepted} onChange={setTermsAccepted} />

            <div className="md:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 pt-4 border-t border-hairline">
              <div className="flex flex-col gap-1 order-last sm:order-first">
                <p className="text-xs text-mute">
                  {t("SignupPage_Text_VerificationRequired")}
                </p>
                <Link className="text-sm text-link font-medium hover:underline underline-offset-2" to="/login">
                  {t("SignupPage_Link_BackToLogin")}
                </Link>
              </div>
              <Button className="w-full sm:w-auto px-8 py-2.5" disabled={submitting || !usingFirebase} type="submit">
                {submitting ? t("SignupPage_Button_Registering") : t("SignupPage_Button_CreateAccount")}
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </div>
  );
}
