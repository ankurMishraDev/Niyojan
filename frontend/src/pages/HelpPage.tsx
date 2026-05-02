import { Link } from "react-router-dom";
import { PageHeader, Panel } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import type { AppRole } from "@/types/api";

type GuideSection = {
  label: string;
  title: string;
  description: string;
  to: string;
  steps: string[];
};

type RoleGuide = {
  eyebrow: string;
  title: string;
  description: string;
  quickStart: string[];
  sections: GuideSection[];
  tips: string[];
};

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
      },
      {
        label: "Matching",
        title: "Create stronger volunteer matches",
        description: "Use matching when urgent cases need the most relevant available volunteer based on skills, domain, and logistics.",
        to: "/matching",
        steps: [
          "Review the need summary and urgency context.",
          "Compare recommended volunteers and suitability indicators.",
          "Promote the strongest candidate into assignment workflow.",
        ],
      },
      {
        label: "Pipeline",
        title: "Track intake and extraction flow",
        description: "The pipeline helps you monitor document processing, generated artifacts, and operational blockers in the automation path.",
        to: "/pipeline",
        steps: [
          "Check intake queue depth and recent processing failures.",
          "Open a record to inspect generated forms or review packages.",
          "Use AI Review when the extracted assessment needs human confirmation.",
        ],
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
      },
      {
        label: "Profile",
        title: "Maintain readiness for matching",
        description: "Your profile determines how the system and admins understand your availability, skills, and working context.",
        to: "/profile",
        steps: [
          "Update availability when your operational capacity changes.",
          "Keep location and profile summary accurate for better matching quality.",
          "Review skills periodically so new assignments reflect your current strengths.",
        ],
      },
    ],
    tips: [
      "Always review the full assignment details before contacting the beneficiary or field site.",
      "Use precise feedback notes so the NGO can understand what was completed and what still needs action.",
      "Keep availability updated to avoid assignment delays or mismatched dispatch.",
    ],
  },
};

export function HelpPage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  const guide = guides[user.role];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={guide.eyebrow}
        title={guide.title}
        description={guide.description}
      />

      <Panel className="space-y-4">
        <div>
          <p className="label-caps text-primary">Quick Start</p>
          <h2 className="mt-2 text-xl font-black text-white">How to use this panel</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {guide.quickStart.map((step, index) => (
            <div className="rounded-md border border-outline-variant bg-surface-container-low p-4" key={step}>
              <p className="label-caps">Step {index + 1}</p>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">{step}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        {guide.sections.map((section) => (
          <Panel className="space-y-4" key={section.title}>
            <div>
              <p className="label-caps text-primary">{section.label}</p>
              <h2 className="mt-2 text-xl font-black text-white">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">{section.description}</p>
            </div>
            <div className="space-y-2">
              {section.steps.map((step, index) => (
                <div className="rounded-md border border-outline-variant bg-surface-container-low px-3 py-3" key={step}>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">Action {index + 1}</p>
                  <p className="mt-2 text-sm leading-6 text-white">{step}</p>
                </div>
              ))}
            </div>
            <Link className="action-button-secondary inline-flex" to={section.to}>
              Open {section.label}
            </Link>
          </Panel>
        ))}
      </div>

      <Panel className="space-y-4">
        <div>
          <p className="label-caps text-primary">Operational Tips</p>
          <h2 className="mt-2 text-xl font-black text-white">Keep the workflow smooth</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {guide.tips.map((tip) => (
            <div className="rounded-md border border-outline-variant bg-surface-container-low p-4" key={tip}>
              <p className="text-sm leading-6 text-on-surface-variant">{tip}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
