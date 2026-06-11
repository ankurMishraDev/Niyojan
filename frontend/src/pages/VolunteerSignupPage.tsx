import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { Button, Input, LoaderBlock, Panel, Select, Textarea } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { authApi } from "@/lib/services";
import { scoreSkillForDomain } from "@/lib/volunteerDomains";
import { TermsAndConditions } from "@/components/TermsAndConditions";

type SelectedSkill = {
  skillId: string;
  proficiency: number;
};

export function VolunteerSignupPage() {
  const { status, user, signUpVolunteer, usingFirebase } = useAuth();
  const [organizationId, setOrganizationId] = useState("");
  const [volunteerName, setVolunteerName] = useState("");
  const [availabilityStatus, setAvailabilityStatus] = useState("available");
  const [gender, setGender] = useState<"male" | "female" | "other" | "prefer_not_to_say">("prefer_not_to_say");
  const [age, setAge] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [profession, setProfession] = useState("");
  const [primaryDomain, setPrimaryDomain] = useState("medical");
  const [profileSummary, setProfileSummary] = useState("");
  const [locationText, setLocationText] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<SelectedSkill[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const optionsQuery = useQuery({
    queryKey: ["volunteer-onboarding-options"],
    queryFn: () => authApi.volunteerOnboardingOptions(),
  });

  const domains = optionsQuery.data?.domains ?? [];
  const organizations = optionsQuery.data?.organizations ?? [];
  const skills = optionsQuery.data?.skills ?? [];

  const filteredSkills = useMemo(() => {
    const ranked = [...skills]
      .map((skill) => ({ skill, score: scoreSkillForDomain(skill, primaryDomain) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score || left.skill.name.localeCompare(right.skill.name))
      .map(({ skill }) => skill);

    return ranked.length > 0 ? ranked : skills;
  }, [primaryDomain, skills]);

  const selectedSkillDetails = useMemo(
    () =>
      selectedSkills.map((selectedSkill) => ({
        ...selectedSkill,
        skill: skills.find((skill) => skill.id === selectedSkill.skillId) || null,
      })),
    [selectedSkills, skills],
  );

  if (status === "authenticated" && user) {
    return <Navigate to={user.role === "volunteer" ? "/assignments" : user.status === "active" ? "/dashboard" : "/account-status"} replace />;
  }

  if (optionsQuery.isLoading) {
    return <LoaderBlock label="Loading volunteer onboarding…" />;
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

    try {
      await signUpVolunteer(email, password, {
        org_id: organizationId || undefined,
        volunteer_name: volunteerName || undefined,
        availability_status: availabilityStatus,
        gender,
        age: age ? Number(age) : undefined,
        phone_number: phoneNumber || undefined,
        profession: profession || undefined,
        primary_domain: primaryDomain,
        profile_summary: profileSummary || undefined,
        location_text: locationText || undefined,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
        skills: selectedSkills.map((skill) => ({
          skill_id: skill.skillId,
          proficiency: skill.proficiency,
        })),
      });
      setPassword("");
      setSuccess("Volunteer account created. Check your email for the verification link before signing in.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Volunteer registration failed.");
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
            <p className="label-caps mb-2">Volunteer Access</p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Register as a Volunteer</h1>
            <p className="mt-2 text-sm text-body leading-relaxed max-w-lg">
              Join the field volunteer network to receive assignments, review case details, and submit ground-truth feedback.
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
              <label className="text-xs font-medium text-body px-1">Organization (Optional)</label>
              <Select
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
              >
                <option value="">Select NGO organization</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}{organization.region ? ` (${organization.region})` : ""}
                  </option>
                ))}
              </Select>
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-body px-1">Full Name *</label>
              <Input
                placeholder="Full legal name"
                required
                value={volunteerName}
                onChange={(event) => setVolunteerName(event.target.value)}
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Gender</label>
              <Select value={gender} onChange={(event) => setGender(event.target.value as "male" | "female" | "other" | "prefer_not_to_say")}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Age</label>
              <Input
                placeholder="E.g. 25"
                type="number"
                min={16}
                max={120}
                value={age}
                onChange={(event) => setAge(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Phone Number</label>
              <Input
                type="tel"
                placeholder="+1 234 567 8900"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Profession</label>
              <Input
                placeholder="Current occupation"
                value={profession}
                onChange={(event) => setProfession(event.target.value)}
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-body px-1">Availability</label>
              <Select value={availabilityStatus} onChange={(event) => setAvailabilityStatus(event.target.value)}>
                <option value="available">Available for dispatch</option>
                <option value="limited">Limited availability</option>
                <option value="unavailable">Currently unavailable</option>
              </Select>
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-body px-1">Location / Service Area</label>
              <Input
                placeholder="City, District, or Region"
                value={locationText}
                onChange={(event) => setLocationText(event.target.value)}
              />
            </div>

            <div className="space-y-1 hidden">
              <label className="text-xs font-medium text-body px-1">Latitude</label>
              <Input
                placeholder="Auto-detected ideally"
                type="number"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
              />
            </div>
            
            <div className="space-y-1 hidden">
              <label className="text-xs font-medium text-body px-1">Longitude</label>
              <Input
                placeholder="Auto-detected ideally"
                type="number"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
              />
            </div>

            <div className="md:col-span-2 rounded-md border border-hairline bg-canvas-soft-2 p-5 space-y-5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-body px-1">Primary Expertise Domain *</label>
                <Select value={primaryDomain} onChange={(event) => setPrimaryDomain(event.target.value)}>
                  {domains.map((domain) => (
                    <option key={domain} value={domain}>
                      {domain.charAt(0).toUpperCase() + domain.slice(1)}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-body px-1">Profile Summary *</label>
                <Textarea
                  required
                  className="min-h-[100px]"
                  placeholder='Describe your relevant experience, e.g., "I work at a district hospital and assist with emergency triage..."'
                  value={profileSummary}
                  onChange={(event) => setProfileSummary(event.target.value)}
                />
              </div>

              <div className="space-y-3 pt-3 border-t border-hairline">
                <p className="text-sm font-semibold text-ink">Skills & Proficiency</p>
                <p className="text-xs text-body mb-2">
                  Attach specific skills relevant to your domain and groundwork.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select className="flex-1" value={selectedSkillId} onChange={(event) => setSelectedSkillId(event.target.value)}>
                    <option value="">Select a skill</option>
                    {filteredSkills.map((skill) => (
                      <option key={skill.id} value={skill.id}>
                        {skill.name} ({skill.category})
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    disabled={!selectedSkillId}
                    onClick={() => {
                      setSelectedSkills((current) =>
                        current.some((item) => item.skillId === selectedSkillId)
                          ? current
                          : [...current, { skillId: selectedSkillId, proficiency: 3 }],
                      );
                      setSelectedSkillId("");
                    }}
                  >
                    Add Skill
                  </Button>
                </div>
                {selectedSkillDetails.length > 0 && (
                  <div className="space-y-2 mt-4">
                    {selectedSkillDetails.map((selectedSkill) => (
                      <div key={selectedSkill.skillId} className="flex flex-col sm:flex-row gap-3 rounded-md border border-hairline bg-canvas p-3 sm:items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-ink text-sm truncate">{selectedSkill.skill?.name ?? "Unknown skill"}</p>
                          <p className="text-[11px] font-mono text-mute">{selectedSkill.skill?.category ?? "Uncategorized"}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Select
                            className="w-32 text-xs py-1.5"
                            value={String(selectedSkill.proficiency)}
                            onChange={(event) => {
                              const nextProficiency = Number(event.target.value);
                              setSelectedSkills((current) =>
                                current.map((item) =>
                                  item.skillId === selectedSkill.skillId
                                    ? { ...item, proficiency: nextProficiency }
                                    : item,
                                ),
                              );
                            }}
                          >
                            <option value="1">1 - Beginner</option>
                            <option value="2">2 - Basic</option>
                            <option value="3">3 - Working</option>
                            <option value="4">4 - Strong</option>
                            <option value="5">5 - Expert</option>
                          </Select>
                          <Button
                            className="px-2.5 py-1.5 text-xs"
                            type="button"
                            variant="danger"
                            onClick={() => {
                              setSelectedSkills((current) =>
                                current.filter((item) => item.skillId !== selectedSkill.skillId),
                              );
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2 pt-4 border-t border-hairline mt-2 space-y-4">
              <p className="font-medium text-sm text-ink mb-1">Account Credentials</p>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-body px-1">Email *</label>
                  <Input
                    placeholder="volunteer@example.org"
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-body px-1">Password *</label>
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
              </div>
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
                {submitting ? "Registering…" : "Create Volunteer Account"}
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </div>
  );
}
