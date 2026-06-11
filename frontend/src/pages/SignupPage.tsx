import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button, Input, Panel, Textarea } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";

import { TermsAndConditions } from "@/components/TermsAndConditions";

export function SignupPage() {
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
            <p className="label-caps mb-2">NGO Onboarding</p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Register Organization</h1>
            <p className="mt-2 text-sm text-body leading-relaxed max-w-lg">
              Create an NGO workspace for form templates, survey collection, and feedback workflows.
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
              <label className="text-xs font-medium text-body px-1">Organization Name *</label>
              <Input
                placeholder="e.g. Red Cross"
                required
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Organization Type</label>
              <Input
                placeholder="e.g. NGO, Non-Profit"
                value={organizationType}
                onChange={(event) => setOrganizationType(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Primary Region *</label>
              <Input
                placeholder="e.g. South Asia"
                required
                value={region}
                onChange={(event) => setRegion(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Registration ID</label>
              <Input
                placeholder="Government ID or Tax ID"
                value={registrationId}
                onChange={(event) => setRegistrationId(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Contact Phone</label>
              <Input
                type="tel"
                placeholder="+1 234 567 8900"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-body px-1">Website URL</label>
              <Input
                placeholder="https://example.org"
                type="url"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-body px-1">Headquarters Address</label>
              <Textarea
                className="min-h-[80px]"
                placeholder="Full address details"
                value={addressText}
                onChange={(event) => setAddressText(event.target.value)}
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-body px-1">Focus Areas</label>
              <Input
                placeholder="e.g. health, shelter, education (comma-separated)"
                value={focusAreas}
                onChange={(event) => setFocusAreas(event.target.value)}
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-body px-1">Operating Regions</label>
              <Input
                placeholder="e.g. Kenya, Uganda, Tanzania (comma-separated)"
                value={operatingRegions}
                onChange={(event) => setOperatingRegions(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Team Size</label>
              <Input
                placeholder="Number of members"
                type="number"
                min={1}
                value={teamSize}
                onChange={(event) => setTeamSize(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Founded Year</label>
              <Input
                placeholder="YYYY"
                type="number"
                min={1800}
                max={new Date().getFullYear()}
                value={foundedYear}
                onChange={(event) => setFoundedYear(event.target.value)}
              />
            </div>

            <div className="md:col-span-2 pt-4 border-t border-hairline mt-2 space-y-1">
              <p className="font-medium text-sm text-ink mb-3">Admin Account Details</p>
              <label className="text-xs font-medium text-body px-1">Primary Admin Name *</label>
              <Input
                placeholder="Full name"
                required
                value={adminName}
                onChange={(event) => setAdminName(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Admin Email *</label>
              <Input
                placeholder="admin@example.org"
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Secure Password *</label>
              <Input
                placeholder="Min. 8 characters"
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
                  Verification required before first sign-in.
                </p>
                <Link className="text-sm text-link font-medium hover:underline underline-offset-2" to="/login">
                  Back to sign in
                </Link>
              </div>
              <Button className="w-full sm:w-auto px-8 py-2.5" disabled={submitting || !usingFirebase} type="submit">
                {submitting ? "Registering…" : "Create NGO Account"}
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </div>
  );
}
