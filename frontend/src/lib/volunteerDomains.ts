export const DOMAIN_KEYWORDS: Record<string, string[]> = {
  medical: ["health", "medical", "triage", "first aid", "aid", "nursing"],
  counsellor: ["counsel", "mental", "psychosocial", "support"],
  distributor: ["distribution", "food", "shelter", "supply", "logistics"],
  technical: ["technical", "data", "digital", "it", "documentation", "analysis"],
  manager: ["management", "manager", "coordination", "case", "lead"],
  community_outreach: ["community", "outreach", "mobilization", "translation"],
  logistics: ["logistics", "transport", "inventory", "warehouse"],
  other: [],
};

export const scoreSkillForDomain = (
  skill: { key: string; name: string; category: string },
  domain: string,
) => {
  const keywords = DOMAIN_KEYWORDS[domain] ?? [];
  if (keywords.length === 0) {
    return 1;
  }

  const haystack = `${skill.key} ${skill.name} ${skill.category}`.toLowerCase();
  return keywords.reduce((score, keyword) => (haystack.includes(keyword) ? score + 1 : score), 0);
};

export const inferVolunteerDomain = (input: {
  primaryDomain?: string | null;
  profession?: string | null;
  profileSummary?: string | null;
  skills?: Array<{ key: string; name: string; category: string }>;
}) => {
  if (input.primaryDomain) {
    return input.primaryDomain;
  }

  const haystack = [
    input.profession ?? "",
    input.profileSummary ?? "",
    ...(input.skills ?? []).flatMap((skill) => [skill.key, skill.name, skill.category]),
  ]
    .join(" ")
    .toLowerCase();

  let bestDomain = "other";
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.length === 0) {
      continue;
    }

    const score = keywords.reduce((sum, keyword) => (haystack.includes(keyword) ? sum + 1 : sum), 0);
    if (score > bestScore) {
      bestScore = score;
      bestDomain = domain;
    }
  }

  return bestScore > 0 ? bestDomain : "other";
};
