export type AppRole = "superadmin" | "ngo_admin" | "field_worker" | "volunteer";

export type ApiMeta = {
  page?: number;
  pageSize?: number;
  total?: number;
  [key: string]: unknown;
};

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: ApiMeta;
  timestamp: string;
};

export type UserProfile = {
  id: string;
  orgId: string | null;
  firebaseUid: string;
  name: string;
  email: string;
  role: AppRole;
  status: string;
  userStatus?: string;
  organizationStatus?: string | null;
  organizationName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NgoRegistrationPayload = {
  organization_name: string;
  organization_type: string;
  region?: string;
  admin_name?: string;
  registration_id?: string;
  contact_phone?: string;
  website?: string;
  address_text?: string;
  focus_areas?: string[];
  operating_regions?: string[];
  team_size?: number;
  founded_year?: number;
};

export type OnboardingOrganization = {
  id: string;
  name: string;
  type: string;
  region: string | null;
  registrationId?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  addressText?: string | null;
  focusAreas?: string[];
  operatingRegions?: string[];
  teamSize?: number | null;
  foundedYear?: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  primaryAdmin: {
    id: string;
    name: string | null;
    email: string | null;
    firebaseUid: string | null;
    status: string | null;
  } | null;
};

export type DashboardSummary = {
  activeNeeds: number;
  availableVolunteers: number;
  pendingReviews: number;
  submittedSurveys: number;
};

export type UrgentNeed = {
  id: string;
  orgId: string;
  category: string;
  summary: string;
  urgencyScore: number;
  priorityLevel: string;
  status: string;
  locationText: string | null;
  createdAt: string;
};

export type VolunteerAvailability = {
  breakdown: Array<{
    availabilityStatus: string;
    count: number;
  }>;
  totalActiveVolunteers: number;
};

export type PipelineHealth = {
  queueDepth: number;
  processingDocuments: number;
  jobStatusBreakdown: Array<{ status: string; count: number }>;
  recentFailures: Array<{
    id: string;
    type: string;
    entityType: string;
    entityId: string;
    errorMessage: string | null;
    updatedAt: string;
  }>;
};

export type FieldCatalogItem = {
  id: string;
  key: string;
  name: string;
  category: string;
  inputType: string;
  options: unknown;
  validation: unknown;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Skill = {
  id: string;
  key: string;
  name: string;
  category: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Volunteer = {
  id: string;
  orgId: string;
  userId: string;
  availabilityStatus: string;
  locationText: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  skills: Array<{
    skillId: string;
    key: string;
    name: string;
    category: string;
    proficiency: number;
  }>;
};

export type Paginated<T> = {
  items: T[];
  meta: ApiMeta;
};

export type DocumentItem = {
  id: string;
  orgId: string;
  uploadedBy: string | null;
  fileName: string;
  gcsPath: string;
  fileType: string;
  status: string;
  extractionResult: unknown;
  createdAt: string;
  updatedAt: string;
};

export type SignedUpload = {
  bucket: string;
  gcsPath: string;
  fileName: string;
  fileType: string;
  uploadUrl: string;
  method: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
};

export type PipelineManifest = {
  id: string;
  orgId?: string;
  documentId: string;
  fileName?: string;
  documentStatus?: string;
  currentStage: string;
  pipelineStatus: string;
  startedAt: string;
  completedAt: string | null;
  stageHistory?: unknown;
  routingDecision?: unknown;
  createdAt?: string;
  updatedAt?: string;
};

export type PipelineStatus = {
  document: {
    id: string;
    orgId: string;
    fileName: string;
    gcsPath: string;
    fileType: string;
    status: string;
  };
  manifest: PipelineManifest;
  job: {
    id: string;
    type: string;
    status: string;
    errorMessage: string | null;
    runAt: string;
  } | null;
};

export type ReviewPackage = {
  document: {
    id: string;
    fileName: string;
    fileType: string;
    status: string;
    readUrl: string;
    readUrlExpiresAt: string;
  };
  manifest: PipelineManifest;
  canonicalProjection: Record<string, unknown> | null;
  piiTokenMap: Record<string, unknown> | null;
  aiExtraction: Record<string, unknown> | null;
  validatedCandidate: Record<string, unknown> | null;
  reasoningOutput: Record<string, unknown> | null;
  humanReviews: Array<Record<string, unknown>>;
};

export type FormTemplate = {
  id: string;
  orgId: string;
  name: string;
  sourceDocumentId: string | null;
  status: string;
  activeVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FormField = {
  id: string;
  templateVersionId: string;
  fieldCatalogId: string | null;
  label: string;
  inputType: string;
  options: unknown;
  isRequired: boolean;
  displayOrder: number;
  isCustom: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FormTemplateVersion = {
  id: string;
  templateId: string;
  templateName?: string;
  versionNo: number;
  status: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  fields?: FormField[];
};

export type SurveyResponse = {
  id?: string;
  surveyId?: string;
  formFieldId: string;
  inputType: string;
  valueText?: string | null;
  valueNumber?: number | null;
  valueBool?: boolean | null;
  valueJson?: unknown;
};

export type Survey = {
  id: string;
  orgId: string;
  templateVersionId: string;
  conductedBy: string;
  respondentName: string | null;
  locationText: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  responses?: SurveyResponse[];
};

export type Need = {
  id: string;
  orgId: string;
  surveyId: string;
  category: string;
  summary: string;
  urgencyScore: number;
  priorityLevel: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  locationText: string | null;
  latitude: number | null;
  longitude: number | null;
  respondentName: string | null;
  templateVersionId: string | null;
  skills: Array<{
    skillId: string;
    key: string;
    name: string;
    category: string;
  }>;
};

export type MatchResult = {
  need: {
    id: string;
    orgId: string;
    surveyId: string;
    category: string;
    summary: string;
    urgencyScore: number;
    priorityLevel: string;
    status: string;
    locationText: string | null;
    latitude: number | null;
    longitude: number | null;
    requiredSkills: string[];
  };
  matches: Array<{
    volunteerId: string;
    userId: string;
    name: string;
    email: string;
    availabilityStatus: string;
    locationText: string | null;
    distanceKm: number | null;
    matchedSkills: string[];
    missingSkills: string[];
    matchScore: number;
    breakdown: {
      skillScore: number;
      availabilityScore: number;
      locationScore: number;
    };
    matchReason: {
      skill_overlap: number;
      availability: number;
      distance: number;
      explanation: string;
      matchedSkills: string[];
      missingSkills: string[];
      distanceKm: number | null;
    };
  }>;
};

export type Assignment = {
  id: string;
  orgId: string;
  needId: string;
  volunteerId: string;
  matchScore: number | null;
  matchReason: Record<string, unknown> | null;
  status: string;
  assignedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  needCategory: string;
  needSummary: string;
  needPriorityLevel: string;
  volunteerUserId: string;
  volunteerLocationText: string | null;
  volunteerAvailabilityStatus: string;
  volunteerName: string;
  volunteerEmail: string;
};

export type Feedback = {
  id: string;
  assignmentId: string;
  volunteerId: string;
  needId: string;
  visitCompleted: boolean;
  visitDate: string | null;
  needConfirmed: boolean | null;
  actualSituationSummary: string | null;
  actualUrgencyAssessment: string | null;
  actualAffectedCount: number | null;
  wasAiExtractionAccurate: boolean | null;
  extractionInaccuracies: string | null;
  evidenceGcsPaths: string[];
  actionTaken: string | null;
  resolutionStatus: string;
  escalationReason: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  assignmentOrgId?: string;
  volunteerUserId?: string;
  volunteerName?: string;
};
