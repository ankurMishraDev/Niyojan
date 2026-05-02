import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button, Input, Panel, Textarea } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";

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

  if (status === "authenticated" && user) {
    return <Navigate to={user.status === "active" ? "/dashboard" : "/account-status"} replace />;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
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
    <div className="min-h-screen bg-surface px-4 py-5">
      <div className="mx-auto grid min-h-[calc(100vh-40px)] max-w-6xl gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <Panel className="flex flex-col justify-between overflow-hidden bg-black/25">
          <div className="space-y-5">
            <div>
              <p className="text-4xl font-black text-white">NIYOJAN</p>
              <p className="mt-3 max-w-md text-sm leading-6 text-on-surface-variant">
                Create an NGO workspace for form templates, survey collection, and feedback workflows.
              </p>
            </div>
            {/* <div className="rounded-md border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
              NGO accounts are restricted to data collection, template management,
              feedback, and profile pages. Admin-only matching, assignment, pipeline,
              and AI review tools stay reserved for the NIYOJAN superadmin.
            </div> */}
          </div>
            <div className="flex flex-wrap gap-4 rounded-full border border-outline-variant bg-surface-container-low px-5 py-3 text-xs uppercase tracking-[0.16em] text-on-surface-variant">
            <span>Operations Console</span>
            <span>Global Access</span>
            <span>Secure Sessions</span>
          </div>
          {/* <div className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">
            Firebase-backed onboarding
          </div> */}
        </Panel>

        <Panel className="space-y-5">
          <div>
            <p className="label-caps text-primary">NGO Onboarding</p>
            <h1 className="mt-2 text-3xl font-black text-white">Register a new NGO account</h1>
            {/* <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Firebase creates the login credential. The backend creates the
              organization and primary NGO admin profile.
            </p> */}
          </div>

          {/* <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            {usingFirebase
              ? "Firebase web config is present. Create the NGO account with email/password, then the backend will register the organization profile."
              : "Firebase web config is not fully configured yet. Add the VITE_FIREBASE_* values to enable NGO registration."}
          </div> */}

          {error ? (
            <div className="rounded-md border border-danger/60 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-md border border-primary/60 bg-primary/10 px-4 py-3 text-sm text-primary">
              {success}
            </div>
          ) : null}

          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
            <Input
              className="md:col-span-2"
              placeholder="Organization name"
              required
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
            />
            <Input
              placeholder="Organization type"
              value={organizationType}
              onChange={(event) => setOrganizationType(event.target.value)}
            />
            <Input
              placeholder="Region"
              required
              value={region}
              onChange={(event) => setRegion(event.target.value)}
            />
            <Input
              placeholder="Registration ID"
              value={registrationId}
              onChange={(event) => setRegistrationId(event.target.value)}
            />
            <Input
              placeholder="Contact phone"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
            />
            <Input
              className="md:col-span-2"
              placeholder="Website, e.g. https://example.org"
              type="url"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
            <Textarea
              className="md:col-span-2"
              placeholder="Registered address"
              value={addressText}
              onChange={(event) => setAddressText(event.target.value)}
            />
            <Input
              className="md:col-span-2"
              placeholder="Focus areas, comma-separated, e.g. health, shelter, education"
              value={focusAreas}
              onChange={(event) => setFocusAreas(event.target.value)}
            />
            <Input
              className="md:col-span-2"
              placeholder="Operating regions, comma-separated"
              value={operatingRegions}
              onChange={(event) => setOperatingRegions(event.target.value)}
            />
            <Input
              placeholder="Team size"
              type="number"
              min={1}
              value={teamSize}
              onChange={(event) => setTeamSize(event.target.value)}
            />
            <Input
              placeholder="Founded year"
              type="number"
              min={1800}
              max={new Date().getFullYear()}
              value={foundedYear}
              onChange={(event) => setFoundedYear(event.target.value)}
            />
            <Input
              className="md:col-span-2"
              placeholder="Primary admin name"
              required
              value={adminName}
              onChange={(event) => setAdminName(event.target.value)}
            />
            <Input
              placeholder="Email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              placeholder="Password"
              required
              minLength={8}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <Button disabled={submitting || !usingFirebase} type="submit">
                {submitting ? "Submitting..." : "Create NGO Account"}
              </Button>
              <p className="text-sm text-on-surface-variant">
                Verification is required before the first sign-in.
              </p>
              <Link className="text-sm text-on-surface-variant underline-offset-4 hover:text-white hover:underline" to="/login">
                Back to sign in
              </Link>
            </div>
          </form>
        </Panel>
      </div>
    </div>
  );
}
