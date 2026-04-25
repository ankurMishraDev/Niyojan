import { db } from "../config/db";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface CreateJobInput {
  orgId?: string | null;
  type: string;
  entityType: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  runAt?: Date;
}

const toJson = (value?: Record<string, unknown>) => {
  if (!value) {
    return null;
  }

  return JSON.stringify(value);
};

export class JobService {
  async createJob(input: CreateJobInput) {
    const [job] = await db("jobs")
      .insert({
        org_id: input.orgId || null,
        type: input.type,
        entity_type: input.entityType,
        entity_id: input.entityId || null,
        payload_json: toJson(input.payload) || JSON.stringify({}),
        run_at: input.runAt || new Date(),
        status: "pending",
      })
      .returning("*");

    return job;
  }

  async markRunning(jobId: string) {
    const [job] = await db("jobs")
      .where({ id: jobId })
      .update({ status: "running", updated_at: new Date() })
      .returning("*");

    return job;
  }

  async markCompleted(jobId: string, result?: Record<string, unknown>) {
    const [job] = await db("jobs")
      .where({ id: jobId })
      .update({
        status: "completed",
        result_json: toJson(result) || JSON.stringify({}),
        updated_at: new Date(),
      })
      .returning("*");

    return job;
  }

  async markFailed(jobId: string, errorMessage: string) {
    const [job] = await db("jobs")
      .where({ id: jobId })
      .update({
        status: "failed",
        error_message: errorMessage,
        attempts: db.raw("attempts + 1"),
        updated_at: new Date(),
      })
      .returning("*");

    return job;
  }
}

export const jobService = new JobService();
