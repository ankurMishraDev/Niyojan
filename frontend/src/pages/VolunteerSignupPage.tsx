import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { Button, Input, LoaderBlock, Panel, Select, Textarea } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { authApi } from "@/lib/services";
import { scoreSkillForDomain } from "@/lib/volunteerDomains";

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
  const [submitting, setSubmitting] = useState(false);

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
    return <LoaderBlock label="Loading volunteer onboarding..." />;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Volunteer registration failed.");
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
                Join the field volunteer network to receive assignments, review case details, and submit ground-truth feedback.
              </p>
            </div>
            <div className="rounded-md border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
              Start by choosing your work domain, describe your real-world experience, and then attach the skills you want to be matched against.
            </div>
          </div>
          <div className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">
            Volunteer Onboarding
          </div>
        </Panel>

        <Panel className="space-y-5">
          <div>
            <p className="label-caps text-primary">Volunteer Access</p>
            <h1 className="mt-2 text-3xl font-black text-white">Register as a volunteer</h1>
          </div>

          {error ? (
            <div className="rounded-md border border-danger/60 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
            <Select
              className="md:col-span-2"
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
            >
              <option value="">Select NGO organization (optional)</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}{organization.region ? ` (${organization.region})` : ""}
                </option>
              ))}
            </Select>
            <Input
              className="md:col-span-2"
              placeholder="Volunteer full name"
              required
              value={volunteerName}
              onChange={(event) => setVolunteerName(event.target.value)}
            />
            <Select value={gender} onChange={(event) => setGender(event.target.value as "male" | "female" | "other" | "prefer_not_to_say")}>
              <option value="male">male</option>
              <option value="female">female</option>
              <option value="other">other</option>
              <option value="prefer_not_to_say">prefer_not_to_say</option>
            </Select>
            <Input
              placeholder="Age"
              type="number"
              min={16}
              max={120}
              value={age}
              onChange={(event) => setAge(event.target.value)}
            />
            <Input
              placeholder="Phone number"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
            <Input
              placeholder="Profession"
              value={profession}
              onChange={(event) => setProfession(event.target.value)}
            />
            <Select value={availabilityStatus} onChange={(event) => setAvailabilityStatus(event.target.value)}>
              <option value="available">available</option>
              <option value="limited">limited</option>
              <option value="unavailable">unavailable</option>
            </Select>
            <Input
              placeholder="Location / service area"
              value={locationText}
              onChange={(event) => setLocationText(event.target.value)}
            />
            <Input
              placeholder="Latitude"
              type="number"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
            />
            <Input
              placeholder="Longitude"
              type="number"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
            />

            <div className="md:col-span-2 rounded-md border border-outline-variant bg-surface-container-low p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
                <Select value={primaryDomain} onChange={(event) => setPrimaryDomain(event.target.value)}>
                  {domains.map((domain) => (
                    <option key={domain} value={domain}>
                      {domain}
                    </option>
                  ))}
                </Select>
                <Textarea
                  required
                  placeholder='Describe yourself, for example: "I work at a district hospital and assist with emergency triage and patient coordination."'
                  value={profileSummary}
                  onChange={(event) => setProfileSummary(event.target.value)}
                />
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-white">Skills and proficiency</p>
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <Select value={selectedSkillId} onChange={(event) => setSelectedSkillId(event.target.value)}>
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
                    Add skill
                  </Button>
                </div>
                {selectedSkillDetails.length > 0 ? (
                  <div className="space-y-2">
                    {selectedSkillDetails.map((selectedSkill) => (
                      <div key={selectedSkill.skillId} className="grid gap-3 rounded-md border border-outline-variant px-3 py-3 md:grid-cols-[1fr_180px_auto] md:items-center">
                        <div>
                          <p className="font-semibold text-white">{selectedSkill.skill?.name ?? "Unknown skill"}</p>
                          <p className="text-xs text-on-surface-variant">{selectedSkill.skill?.category ?? "Uncategorized"}</p>
                        </div>
                        <Select
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
                          <option value="1">1 - beginner</option>
                          <option value="2">2 - basic</option>
                          <option value="3">3 - working</option>
                          <option value="4">4 - strong</option>
                          <option value="5">5 - expert</option>
                        </Select>
                        <Button
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
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant">
                    Add only the skills that are actually relevant to your domain and ground work.
                  </p>
                )}
              </div>
            </div>

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
                {submitting ? "Submitting..." : "Create Volunteer Account"}
              </Button>
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
