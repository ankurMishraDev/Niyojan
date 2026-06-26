import { PipelineState } from "../pipelineState";
import { db } from "../../config/db";

type SurveyResponseRow = {
  value_text: string | null;
  value_number: string | number | null;
  value_bool: boolean | null;
  field_label: string;
};

const formatResponseValue = (r: SurveyResponseRow): string => {
  if (r.value_text?.trim()) return r.value_text.trim();
  if (r.value_number !== null && r.value_number !== undefined) return String(r.value_number);
  if (r.value_bool !== null && r.value_bool !== undefined) return r.value_bool ? "Yes" : "No";
  return "";
};

/**
 * inputNode — validates the document exists and, critically, loads the
 * survey's digitized responses into rawText so the rest of the pipeline
 * never touches the uploaded PDF.
 *
 * This mirrors what the legacy path does: build a canonical text string
 * from `survey_responses JOIN form_fields` and use that as the AI input,
 * whether the NGO filled the form manually or via document upload.
 */
export async function inputNode(state: PipelineState): Promise<Partial<PipelineState>> {
  const startTime = Date.now();

  if (!state.documentId) {
    return {
      pipelineStatus: "failed",
      errors: [...(state.errors || []), "Document ID missing"],
      nodeTimings: { ...state.nodeTimings, input: Date.now() - startTime },
    };
  }

  if (state.surveyId === undefined) {
    return {
      pipelineStatus: "failed",
      errors: [...(state.errors || []), "Survey ID cannot be undefined"],
      nodeTimings: { ...state.nodeTimings, input: Date.now() - startTime },
    };
  }

  // ── Load survey responses to build canonical text ─────────────────────────
  // We use the digitized survey data (not the uploaded PDF) as the AI input.
  // This is the same approach used by the manual-fill pipeline and it's both
  // faster and more accurate than sending raw OCR output.
  try {
    let rawText = "";
    let respondentLine = "";

    if (state.surveyId) {
      const survey = await db("surveys")
        .where({ id: state.surveyId })
        .select("respondent_name", "location_text")
        .first() as { respondent_name: string | null; location_text: string | null } | undefined;

      if (survey?.respondent_name) respondentLine += `Respondent: ${survey.respondent_name}\n`;
      if (survey?.location_text) respondentLine += `Location: ${survey.location_text}\n`;

      const responses = await db("survey_responses as sr")
        .join("form_fields as ff", "sr.form_field_id", "ff.id")
        .where("sr.survey_id", state.surveyId)
        .orderBy("ff.display_order", "asc")
        .select(
          "ff.label as field_label",
          "sr.value_text",
          "sr.value_number",
          "sr.value_bool",
        ) as SurveyResponseRow[];

      const lines = responses
        .map((r) => {
          const val = formatResponseValue(r);
          return val ? `${r.field_label}: ${val}` : null;
        })
        .filter(Boolean)
        .join("\n");

      rawText = respondentLine + lines;
      console.log(`[inputNode] Built rawText from ${responses.length} survey responses. Length: ${rawText.length}`);
    }

    if (!rawText.trim()) {
      return {
        pipelineStatus: "failed",
        errors: [...(state.errors || []), "Survey has no responses to process"],
        nodeTimings: { ...state.nodeTimings, input: Date.now() - startTime },
      };
    }

    return {
      rawText,
      nodeTimings: { ...state.nodeTimings, input: Date.now() - startTime },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      pipelineStatus: "failed",
      errors: [...(state.errors || []), `inputNode DB error: ${msg}`],
      nodeTimings: { ...state.nodeTimings, input: Date.now() - startTime },
    };
  }
}
