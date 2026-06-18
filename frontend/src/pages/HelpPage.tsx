import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Panel } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import type { AppRole } from "@/types/api";

type SectionVideo = {
  /** Google Drive file ID extracted from the share URL.
   *  e.g. for https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view
   *  the ID is "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"
   *  Leave as a placeholder string until the real video is uploaded.
   */
  driveFileId: string;
  title: string;
  description: string;
  thumbnailSrc?: string;
};

type GuideSection = {
  label: string;
  title: string;
  description: string;
  to: string;
  steps: string[];
  /**
   * Optional tutorial video specific to this section.
   * Set driveFileId to the Google Drive file ID once the video is uploaded.
   */
  video?: SectionVideo;
};

type QuickStartVideo = {
  driveFileId: string;
  thumbnailSrc: string; // path to your thumbnail image
  title: string;
};

type RoleGuide = {
  eyebrow: string;
  title: string;
  description: string;
  quickStart: string[];
   quickStartVideo?: QuickStartVideo;
  sections: GuideSection[];
  tips: string[];
};



// ─── Helper ──────────────────────────────────────────────────────────────────
/** Returns the embeddable Drive URL if the file ID looks real, otherwise null. */
const PLACEHOLDER_IDS = new Set([
  "ADMIN_DASHBOARD_VIDEO_ID",
  "ADMIN_MATCHING_VIDEO_ID",
  "ADMIN_PIPELINE_VIDEO_ID",
  "ADMIN_ASSIGNMENTS_VIDEO_ID",
  "NGO_FORMBUILDER_VIDEO_ID",
  "NGO_DATACOLLECTION_VIDEO_ID",
  "NGO_DASHBOARD_VIDEO_ID",
  "NGO_FEEDBACK_VIDEO_ID",
  "FIELD_FORMBUILDER_VIDEO_ID",
  "FIELD_DATACOLLECTION_VIDEO_ID",
  "FIELD_FEEDBACK_VIDEO_ID",
  "FIELD_PROFILE_VIDEO_ID",
  "VOL_ASSIGNMENTS_VIDEO_ID",
  "VOL_FEEDBACK_VIDEO_ID",
  "VOL_PROFILE_VIDEO_ID",
]);

/**
 * Extracts the Drive file ID from any of these URL formats:
 *   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 *   https://drive.google.com/file/d/FILE_ID/preview
 *   FILE_ID  (raw ID)
 *
 * Returns null when the ID is a placeholder or cannot be extracted.
 */
function extractDriveFileId(input?: string): string | null {
  if (!input) return null;
  if (PLACEHOLDER_IDS.has(input)) return null;

  // Already a raw ID (no slashes)
  if (!input.includes("/")) {
    return input.length > 10 ? input : null;
  }

  // Extract from URL
  const match = input.match(/\/file\/d\/([^/?\s]+)/);
  return match ? match[1] : null;
}

/**
 * Google Drive /preview embed URL.
 * This is the only reliable way to embed Drive videos — the direct download URL
 * is blocked by Google for streaming. Returns null for placeholder IDs.
 */
function getDriveVideoUrl(input?: string): string | null {
  const id = extractDriveFileId(input);
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/preview`;
}

// ─── Guide data ───────────────────────────────────────────────────────────────
const guides: Record<AppRole, RoleGuide> = {

  superadmin: {
    eyebrow: "Admin Help",
    title: "Command panel guide",
    description: "Use this panel to review the full operating picture, approve NGO onboarding, run pipeline workflows, and monitor live assignment execution.",
    quickStart: [
      "Open Dashboard first to review metrics, pending NGO applications, and submitted survey flow.",
      "Use Matching when a case needs the best volunteer recommendation based on skills and availability.",
      "Open Assignments to inspect dispatched work and update operational status through completion.",
      "Use Pipeline and AI Review for document processing, assessment review, and quality control.",
      "Check Feedback and Profile regularly to close the loop and verify the active admin identity.",
    ],
    quickStartVideo: {
      driveFileId: "https://drive.google.com/file/d/1owbas5QuW19s5Rkv6Dhrq9F-DzxyA6dR/view?usp=sharing",
      thumbnailSrc: "./../../assests/land.png",
      title: "Admin Quick Start Overview",
    },
    sections: [
      {
        label: "Dashboard",
        title: "Review platform health and onboarding",
        description: "The dashboard is the main operating board for pending NGO decisions, survey volume, volunteer availability, and pipeline health.",
        to: "/dashboard",
        steps: [
          "Scan metrics to understand system load and active need volume.",
          "Review the pending NGO list and approve or reject applications.",
          "Inspect submitted surveys to spot urgent cases and routing gaps.",
        ],
        video: {
          // UPDATE: replace with actual Google Drive file ID after uploading
          driveFileId: "https://drive.google.com/file/d/16UcXki9vdooIRLA70T0LL1V4RLwlvmCT/view?usp=sharing",
          title: "Dashboard Walkthrough",
          description: "How to read platform metrics, approve NGO onboarding, and triage submitted surveys.",
        },
      },
      {
        label: "Matching",
        title: "Create stronger volunteer matches",
        description: "Use matching when urgent cases need the most relevant available volunteer based on skills, domain, and logistics.",
        to: "/matching",
        steps: [
          "Review the need summary and urgency context.",
          "Copy the survey id from the pipeline survey list and paste it into the matching id input field",
          "Compare recommended volunteers and suitability indicators.",
          "Promote the strongest candidate into assignment workflow.",
        ],
        video: {
          // UPDATE: replace with actual Google Drive file ID after uploading
          driveFileId: "https://drive.google.com/file/d/16UcXki9vdooIRLA70T0LL1V4RLwlvmCT/view?usp=sharing",
          title: "Volunteer Matching Guide",
          description: "How to compare candidates, read suitability scores, and promote matches into assignments.",
        },
      },
      {
        label: "Pipeline",
        title: "Track intake and extraction flow",
        description: "The pipeline helps you monitor document processing, generated artifacts, and operational blockers in the automation path.",
        to: "/pipeline",
        steps: [
          "Start the Survey Pipeline for the latest submitted surveys.",
          "Check intake queue depth and recent processing failures.",
          "Open a record to inspect generated forms or review packages.",
          "Use AI Review when the extracted assessment needs human confirmation.",
        ],
        video: {
          // UPDATE: replace with actual Google Drive file ID after uploading
          driveFileId: "https://drive.google.com/file/d/16UcXki9vdooIRLA70T0LL1V4RLwlvmCT/view?usp=sharing",
          title: "Pipeline & AI Review",
          description: "Monitoring the intake queue, inspecting extracted documents, and handling AI review confirmations.",
        },
      },
      {
        label: "Clustering",
        title: "Cluster surveys to identify similar cases",
        description: "The clustering sections helps you identify similar cases based on survey responses and AI embeddings. Use it to find related cases, spot trends, and identify outliers.",
        to: "/clustering",
        steps: [
          "Cluster surveys based on same requirements/needs and location proximity.",
          "Assign a single volunteer to address the core problems in a cluster of related cases.",
          "Use Map section to virtually inspect the location of cases in a cluster and volutneer available in that location proximity.",
        ],
        video: {
          // UPDATE: replace with actual Google Drive file ID after uploading
          driveFileId: "https://drive.google.com/file/d/16UcXki9vdooIRLA70T0LL1V4RLwlvmCT/view?usp=sharing",
          title: "Pipeline & AI Review",
          description: "Monitoring the intake queue, inspecting extracted documents, and handling AI review confirmations.",
        },
      },
      {
        label: "Assignments",
        title: "Monitor field execution",
        description: "Assignments connect approved needs to volunteers and let the admin team track progress from dispatch to feedback closure.",
        to: "/assignments",
        steps: [
          "Select an assignment to inspect survey details and AI context.",
          "Update assignment status as work moves through acceptance and completion.",
          "Open feedback once the field response is ready for review.",
        ],
        video: {
          // UPDATE: replace with actual Google Drive file ID after uploading
          driveFileId: "https://drive.google.com/file/d/16UcXki9vdooIRLA70T0LL1V4RLwlvmCT/view?usp=sharing",
          title: "Assignments & Field Tracking",
          description: "How to inspect dispatched assignments, update status, and close cases with feedback review.",
        },
      },
    ],
    tips: [
      "Use dashboard filters to focus on critical or unresolved cases first.",
      "Approve NGOs only after checking organization details and admin identity.",
      "Use Feedback as the final verification layer before considering a case operationally closed.",
    ],
  },

  ngo_admin: {
    eyebrow: "NGO Help",
    title: "NGO workspace guide",
    description: "Use this panel to build forms, capture field data, review follow-up feedback, and manage your organization workflow without admin-only tools.",
    quickStart: [
      "Start with Form Builder and create a reusable form template for your intake process.",
      "Publish the template before moving to Data Collection so field submissions use the correct form version.",
      "Use Dashboard to review submitted surveys and watch for linked assignment feedback.",
      "Open Feedback to review volunteer responses and operational outcomes after dispatch.",
      "Keep Profile current so the active NGO identity and organization scope stay accurate.",
    ],
     quickStartVideo: {
      driveFileId: "https://drive.google.com/file/d/1huphXH7V1YMZyYHFr5vs0gjhfVKUoO4S/view?usp=sharing",
      thumbnailSrc: "./../../assests/land.png",
      title: "NGO Quick Start Overview",
    },
    sections: [
      {
        label: "Form Builder",
        title: "Create and publish survey templates",
        description: "Form Builder is where your NGO defines the intake structure used by field teams during data collection.",
        to: "/form-builder",
        steps: [
          "Create a template for the survey or case intake you want to standardize.",
          "Add fields carefully so responses capture the information needed for review and matching.",
          "Publish the version only after confirming the field labels and required inputs are correct.",
        ],
        video: {
          // UPDATE: replace with actual Google Drive file ID after uploading
          driveFileId: "https://drive.google.com/file/d/16UcXki9vdooIRLA70T0LL1V4RLwlvmCT/view?usp=sharing",
          title: "Form Builder Guide",
          description: "How to create a template, add fields, and publish a version for field use.",
        },
      },
      {
        label: "Data Collection",
        title: "Submit real field responses",
        description: "Data Collection lets your team use a published template to record beneficiary details and submit surveys into the analysis flow.",
        to: "/surveys/new",
        steps: [
          "Choose the right published template for the case type.",
          "Enter field responses completely and verify sensitive details before submit.",
          "Submit the survey so it can enter review, need extraction, and downstream routing.",
        ],
        video: {
          // UPDATE: replace with actual Google Drive file ID after uploading
          driveFileId: "https://drive.google.com/file/d/16UcXki9vdooIRLA70T0LL1V4RLwlvmCT/view?usp=sharing",
          title: "Data Collection Walkthrough",
          description: "Selecting a template, filling in field responses, and submitting a survey correctly.",
        },
      },
      {
        label: "Dashboard",
        title: "Track submitted surveys and response status",
        description: "The NGO dashboard shows previously submitted surveys and whether linked volunteer feedback has been completed.",
        to: "/dashboard",
        steps: [
          "Review recently submitted surveys and their case priority.",
          "Open linked feedback records when a volunteer response is available.",
          "Use the survey history to monitor unresolved or follow-up cases.",
        ],
        video: {
          // UPDATE: replace with actual Google Drive file ID after uploading
          driveFileId: "https://drive.google.com/file/d/16UcXki9vdooIRLA70T0LL1V4RLwlvmCT/view?usp=sharing",
          title: "NGO Dashboard Overview",
          description: "Reading survey submission history, checking feedback status, and identifying unresolved cases.",
        },
      },
      {
        label: "Feedback",
        title: "Review field follow-up",
        description: "Feedback is the final handoff area where NGOs review what happened in the field after a volunteer handled an assignment.",
        to: "/feedback",
        steps: [
          "Open the assignment-linked feedback entry.",
          "Read the volunteer outcome notes and evidence paths.",
          "Use the result to plan next action with your organization team.",
        ],
        video: {
          // UPDATE: replace with actual Google Drive file ID after uploading
          driveFileId: "https://drive.google.com/file/d/16UcXki9vdooIRLA70T0LL1V4RLwlvmCT/view?usp=sharing",
          title: "Feedback Review Guide",
          description: "How to open feedback records, read volunteer outcomes, and plan follow-up actions.",
        },
      },
    ],
    tips: [
      "Keep templates simple enough for fast field entry but detailed enough for downstream analysis.",
      "Do not submit surveys from unpublished templates if you expect consistent reporting.",
      "Use dashboard history to identify cases still waiting on volunteer closure.",
    ],
  },

  field_worker: {
    eyebrow: "NGO Help",
    title: "NGO workspace guide",
    description: "Use this panel to build forms, submit field data, and review operational feedback within your NGO scope.",
    quickStart: [
      "Create or update templates in Form Builder when your intake workflow changes.",
      "Submit surveys through Data Collection using the latest published template.",
      "Review Dashboard to see what was submitted and what still needs follow-up.",
      "Open Feedback when a field response or assignment outcome is available.",
      "Confirm your account identity in Profile when working across multiple field cycles.",
    ],
    quickStartVideo: {
      driveFileId: "https://drive.google.com/file/d/19z6V2rOacuKIJ2VrXCpxbjWjj7eERFaa/view?usp=drivesdk",
      thumbnailSrc: "./../../assests/land.png",
      title: "Admin Quick Start Overview",
    },
    sections: [
      {
        label: "Form Builder",
        title: "Prepare field-ready templates",
        description: "Use Form Builder to keep intake forms aligned with real field workflows and reporting needs.",
        to: "/form-builder",
        steps: [
          "Review the template before editing so existing field structure is preserved.",
          "Adjust fields only when the collection workflow actually changes.",
          "Publish the updated version once the field team is ready to use it.",
        ],
        video: {
          // UPDATE: replace with actual Google Drive file ID after uploading
          driveFileId: "https://drive.google.com/file/d/19z6V2rOacuKIJ2VrXCpxbjWjj7eERFaa/view?usp=drivesdk",
          title: "Form Builder for Field Workers",
          description: "How to review, edit, and publish field-ready form templates.",
        },
      },
      {
        label: "Data Collection",
        title: "Record and submit case details",
        description: "This is where field information is captured against a published form and sent into the platform for processing.",
        to: "/surveys/new",
        steps: [
          "Select the correct template for the case type.",
          "Enter clean, complete responses and confirm location details.",
          "Submit once the case is ready for analysis and operational review.",
        ],
        video: {
          // UPDATE: replace with actual Google Drive file ID after uploading
          driveFileId: "https://drive.google.com/file/d/19z6V2rOacuKIJ2VrXCpxbjWjj7eERFaa/view?usp=drivesdk",
          title: "Field Data Collection",
          description: "Selecting a template, entering clean field responses, and submitting for analysis.",
        },
      },
      {
        label: "Feedback",
        title: "Review downstream case outcome",
        description: "Use Feedback to understand what happened after a submitted case moved into volunteer execution.",
        to: "/feedback",
        steps: [
          "Open the feedback record linked to the assignment.",
          "Review response notes and any attached evidence references.",
          "Coordinate internally if additional field verification is needed.",
        ],
        video: {
          // UPDATE: replace with actual Google Drive file ID after uploading
          driveFileId: "https://drive.google.com/file/d/19z6V2rOacuKIJ2VrXCpxbjWjj7eERFaa/view?usp=drivesdk",
          title: "Feedback Review for Field Workers",
          description: "Reading volunteer outcome notes and coordinating follow-up after a case is resolved.",
        },
      },
      {
        label: "Profile",
        title: "Keep field identity current",
        description: "Your profile confirms the account context being used for current NGO work.",
        to: "/profile",
        steps: [
          "Verify your name and account email.",
          "Check any volunteer-linked details if you work across field response cycles.",
          "Update relevant profile information when your role context changes.",
        ],
        video: {
          // UPDATE: replace with actual Google Drive file ID after uploading
          driveFileId: "https://drive.google.com/file/d/19z6V2rOacuKIJ2VrXCpxbjWjj7eERFaa/view?usp=drivesdk",
          title: "Profile Management",
          description: "How to verify identity details and keep your account context accurate for field cycles.",
        },
      },
    ],
    tips: [
      "Publish template changes before asking the field team to collect new data.",
      "Double-check survey responses before submit because downstream review depends on input quality.",
      "Use Feedback to close the loop on whether the field need was actually resolved.",
    ],
  },

  volunteer: {
    eyebrow: "Volunteer Help",
    title: "Volunteer panel guide",
    description: "Use this panel to inspect assigned cases, understand their context, submit field feedback, and keep your profile ready for future matching.",
    quickStart: [
      "Open Assignments first and select the case you are currently handling.",
      "Review the survey details and AI review summary before taking field action.",
      "Use the feedback action when your visit, verification, or support work is complete.",
      "Check Feedback to revisit recorded outcomes when follow-up is needed.",
      "Keep your profile and availability current so future assignments are matched correctly.",
    ],
     quickStartVideo: {
      driveFileId: "https://drive.google.com/file/d/1A6lIyM4c7bBKa1S44mHYR-E68QhTF8-z/view?usp=sharing",
      thumbnailSrc: "./../../assests/land.png",
      title: "Volunteer Quick Start Overview",
    },
    sections: [
      {
        label: "Assignments",
        title: "Understand each assigned case",
        description: "Assignments are your primary work queue. Each item includes case context, priority, survey responses, and any AI-generated summary available.",
        to: "/assignments",
        steps: [
          "Choose an assignment from the list to load full detail.",
          "Read the survey response set and case summary before acting.",
          "Open the feedback form from the assignment once the field action is complete.",
        ],
        video: {
          // UPDATE: replace with actual Google Drive file ID after uploading
          driveFileId: "https://drive.google.com/file/d/16UcXki9vdooIRLA70T0LL1V4RLwlvmCT/view?usp=sharing",
          title: "Using Assignments",
          description: "How to open a case, read survey details and AI summaries, and move to feedback.",
        },
      },
      {
        label: "Feedback",
        title: "Submit outcome and evidence",
        description: "Feedback is where you report what happened on the ground, including notes, evidence references, and closure details.",
        to: "/feedback",
        steps: [
          "Open the assignment-linked feedback record.",
          "Describe the real field outcome clearly and include evidence references if available.",
          "Submit feedback promptly so NGOs and admins can act on the latest information.",
        ],
        video: {
          // UPDATE: replace with actual Google Drive file ID after uploading
          driveFileId: "https://drive.google.com/file/d/16UcXki9vdooIRLA70T0LL1V4RLwlvmCT/view?usp=sharing",
          title: "Submitting Feedback",
          description: "Writing clear outcome notes, attaching evidence, and submitting field feedback on time.",
        },
      }
    ],
    tips: [
      "Always review the full assignment details before contacting the beneficiary or field site.",
      "Use precise feedback notes so the NGO can understand what was completed and what still needs action.",
      "Keep availability updated to avoid assignment delays or mismatched dispatch.",
    ],
  },
};

// ─── IframeScaler ─────────────────────────────────────────────────────────────
/**
 * Renders the Drive /preview iframe at a fixed 1280px logical width then
 * CSS-scales it down to fit the container. This prevents the player controls
 * from occupying most of the view on narrow mobile screens.
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
          height: `${LOGICAL_W * 0.5625}px`,
          transformOrigin: "0 0",
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
}

// ─── Video Modal ──────────────────────────────────────────────────────────────
function VideoModal({
  video,
  videoUrl,
  onClose,
}: {
  video: SectionVideo;
  videoUrl: string;
  onClose: () => void;
}) {
  const fileId = extractDriveFileId(video.driveFileId);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-primary rounded-lg overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Exit */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-ink/60 text-on-primary flex items-center justify-center hover:bg-ink transition-colors text-sm font-bold"
          aria-label="Close video"
        >
          ✕
        </button>

        {/* Google Drive /preview iframe via IframeScaler so controls stay
            proportional on narrow mobile screens. */}
        <div
          className="relative w-full bg-ink"
          style={{ paddingBottom: "56.25%" }}
        >
          <IframeScaler src={videoUrl} title={video.title} />
        </div>

        <div className="p-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-on-primary font-semibold text-sm">{video.title}</p>
            <p className="text-on-primary/70 text-xs mt-1">{video.description}</p>
          </div>
          {fileId && (
            <a
              href={`https://drive.google.com/file/d/${fileId}/view`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-on-primary/60 hover:text-on-primary text-xs underline whitespace-nowrap"
            >
              Open in Drive ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function HelpPage() {
  const { user } = useAuth();
  const [activeVideo, setActiveVideo] = useState<{ video: SectionVideo; videoUrl: string } | null>(null);

  if (!user) return null;

  const guide = guides[user.role];

  const openVideo = (video: SectionVideo) => {
    const videoUrl = getDriveVideoUrl(video.driveFileId);
    if (videoUrl) setActiveVideo({ video, videoUrl });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-8 px-4 sm:px-6">
      {/* Video Modal */}
      {activeVideo && (
        <VideoModal
          video={activeVideo.video}
          videoUrl={activeVideo.videoUrl}
          onClose={() => setActiveVideo(null)}
        />
      )}

      <PageHeader
        eyebrow={guide.eyebrow}
        title={guide.title}
        description={guide.description}
      />

      
      {/* Quick Start */}
<Panel className="space-y-5 bg-canvas-soft border-hairline-strong">
  <div>
    <p className="label-caps mb-2 text-primary">Quick Start</p>
    <h2 className="text-2xl font-semibold tracking-tight text-ink">How to use this panel</h2>
  </div>

  {guide.quickStartVideo &&(
    // ── Video thumbnail grid ──────────────────────────────────────────
    (() => {
      const qsVideoUrl = getDriveVideoUrl(guide.quickStartVideo.driveFileId);
      return (
        <div className="grid gap-4 sm:grid-cols-1  pt-1">
          {guide.quickStart.map((step, index) => {
            const isFirstCard = index === 0;
            const showThumbnail = isFirstCard && !!guide.quickStartVideo;

            return showThumbnail && (
              // Thumbnail card — replaces step text with clickable video thumb
              <div
                key={step}
                className="relative rounded-md border border-hairline bg-canvas shadow-sm overflow-hidden cursor-pointer group"
                style={{ minHeight: "360px" }}
                onClick={() => {
                  if (guide.quickStartVideo && qsVideoUrl) {
                    openVideo({
                      driveFileId: guide.quickStartVideo.driveFileId,
                      title: guide.quickStartVideo.title,
                      description: "",
                    });
                  }
                }}
              >
                {/* Thumbnail image */}
                <img
                  src={guide.quickStartVideo!.thumbnailSrc}
                  alt={guide.quickStartVideo!.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />

                {/* Dark overlay */}
                <div className="absolute inset-0 bg-ink/40 group-hover:bg-ink/50 transition-colors" />

                {/* Play button */}
                {qsVideoUrl && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-canvas/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <svg className="w-5 h-5 text-primary ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Title badge at bottom */}
                <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-ink/70 to-transparent">
                  <p className="text-on-primary text-xs font-medium leading-snug">
                    {guide.quickStartVideo!.title}
                  </p>
                </div>

                {/* "Soon" state when no real video URL */}
                {!qsVideoUrl && (
                  <div className="absolute top-3 right-3">
                    <span className="bg-canvas-soft-2 text-mute border border-hairline text-[10px] font-mono font-medium uppercase tracking-wider rounded-full px-2.5 py-1">
                      Soon
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      );
    })()
  ) }
</Panel>

      {/* Section Cards — each with its own video */}
      <div className="grid gap-6 lg:grid-cols-2 pt-6">
        {guide.sections.map((section) => {
          const sectionVideoUrl = getDriveVideoUrl(section.video?.driveFileId);
          const hasVideo = !!section.video;

          return (
            <Panel className="flex flex-col h-full shadow-card-soft" key={section.title}>
              <div className="mb-5">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <p className="label-caps">{section.label}</p>
                  {/* Per-section video badge */}
                  {hasVideo && (
                    <button
                      onClick={() => section.video && openVideo(section.video)}
                      disabled={!sectionVideoUrl}
                      title={sectionVideoUrl ? `Watch: ${section.video?.title}` : "Video coming soon"}
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono font-medium uppercase tracking-wider transition-colors shrink-0
                        ${sectionVideoUrl
                          ? "bg-primary text-on-primary hover:bg-primary/90 cursor-pointer"
                          : "bg-canvas-soft-2 text-mute cursor-default border border-hairline"
                        }`}
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      {sectionVideoUrl ? "Watch" : "Soon"}
                    </button>
                  )}
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-ink">{section.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-body">{section.description}</p>
              </div>

              <div className="space-y-3 mb-6 flex-1">
                {section.steps.map((step, index) => (
                  <div className="rounded-md border border-hairline bg-canvas-soft px-4 py-3" key={step}>
                    <p className="text-[10px] font-mono font-medium text-mute mb-1.5 uppercase">Action {index + 1}</p>
                    <p className="text-sm leading-relaxed text-ink">{step}</p>
                  </div>
                ))}
              </div>

              {/* Video CTA strip — only shown when video link is real */}
              {hasVideo && sectionVideoUrl && (
                <button
                  onClick={() => section.video && openVideo(section.video)}
                  className="flex items-center gap-2 rounded-md border border-hairline bg-canvas-soft px-4 py-2.5 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-canvas-soft-2 hover:border-hairline-strong mb-3 w-full"
                >
                  <svg className="w-4 h-4 text-primary shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span className="flex-1 text-left">{section.video?.title}</span>
                  <span className="text-xs text-mute font-mono uppercase tracking-wider">Watch</span>
                </button>
              )}

              <Link className="action-button-secondary w-full text-center mt-auto text-sm" to={section.to}>
                Open {section.label}
              </Link>
            </Panel>
          );
        })}
      </div>

      {/* Operational Tips */}
      {/* <Panel className="space-y-5 mt-6 border-warning/30 bg-warning/5">
        <div>
          <p className="label-caps mb-2 text-warning-deep">Operational Tips</p>
          <h2 className="text-xl font-semibold tracking-tight text-ink">Keep the workflow smooth</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guide.tips.map((tip) => (
            <div className="rounded-md border border-hairline bg-canvas p-4 shadow-sm" key={tip}>
              <p className="text-sm leading-relaxed text-body">{tip}</p>
            </div>
          ))}
        </div>
      </Panel> */}
    </div>
  );
}

