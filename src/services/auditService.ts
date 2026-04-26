import { Knex } from "knex";
import { db } from "../config/db";
import { logger } from "../utils/logger";

type AuditEventInput = {
	orgId?: string | null;
	eventType: string;
	entityType: string;
	entityId: string;
	actorId?: string | null;
	actorType?: string;
	oldValue?: unknown;
	newValue?: unknown;
	metadata?: unknown;
	expectedNextState?: string;
};

const toJsonValue = (value: unknown) => {
	if (value === undefined) {
		return null;
	}

	return JSON.stringify(value);
};

export class AuditService {
	async writeEvent(trx: Knex.Transaction, input: AuditEventInput) {
		await trx("audit_events").insert({
			org_id: input.orgId || null,
			event_type: input.eventType,
			entity_type: input.entityType,
			entity_id: input.entityId,
			actor_id: input.actorId || null,
			actor_type: input.actorType || "user",
			old_value: toJsonValue(input.oldValue),
			new_value: toJsonValue(input.newValue),
			metadata: toJsonValue(input.metadata),
			expected_next_state: input.expectedNextState || null,
			occurred_at: trx.fn.now(),
		});
	}

	async logEvent(input: AuditEventInput) {
		try {
			await db("audit_events").insert({
				org_id: input.orgId || null,
				event_type: input.eventType,
				entity_type: input.entityType,
				entity_id: input.entityId,
				actor_id: input.actorId || null,
				actor_type: input.actorType || "user",
				old_value: toJsonValue(input.oldValue),
				new_value: toJsonValue(input.newValue),
				metadata: toJsonValue(input.metadata),
				expected_next_state: input.expectedNextState || null,
				occurred_at: db.fn.now(),
			});
		} catch (error) {
			logger.error("Failed to write audit event", {
				eventType: input.eventType,
				entityType: input.entityType,
				entityId: input.entityId,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
}

export const auditService = new AuditService();
