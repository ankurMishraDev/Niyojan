/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('pipeline_routing_manifests', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('document_id')
      .notNullable()
      .references('id')
      .inTable('documents')
      .onDelete('CASCADE');
    table.string('manifest_version', 20).notNullable().defaultTo('v1');
    table.string('current_stage', 100).notNullable().defaultTo('ingestion');
    table.string('pipeline_status', 50).notNullable().defaultTo('running');
    table.jsonb('pii_fields_to_keep').notNullable().defaultTo('[]');
    table.jsonb('pii_fields_to_tokenize').notNullable().defaultTo('[]');
    table.jsonb('pii_fields_to_redact').notNullable().defaultTo('[]');
    table.string('initial_model', 100).notNullable().defaultTo('gemini-flash');
    table.boolean('escalation_triggered').notNullable().defaultTo(false);
    table.string('escalation_stage', 50);
    table.jsonb('escalation_reasons').notNullable().defaultTo('[]');
    table.jsonb('triage_flags').notNullable().defaultTo('[]');
    table.jsonb('extraction_quality_flags').notNullable().defaultTo('[]');
    table.jsonb('model_review_flags').notNullable().defaultTo('[]');
    table.boolean('auto_approve_eligible').notNullable().defaultTo(false);
    table.jsonb('auto_approve_blocked_by').notNullable().defaultTo('[]');
    table.string('auto_approve_policy_version', 50);
    table.boolean('semantic_loss_detected').notNullable().defaultTo(false);
    table.text('semantic_loss_reason');
    table.string('assigned_review_queue', 100);
    table.timestamp('started_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('completed_at', { useTz: true });
    table.timestamps(true, true);

    table.index(['document_id']);
    table.index(['pipeline_status']);
  });

  await knex.schema.createTable('canonical_projections', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('document_id')
      .notNullable()
      .references('id')
      .inTable('documents')
      .onDelete('CASCADE');
    table
      .uuid('manifest_id')
      .notNullable()
      .references('id')
      .inTable('pipeline_routing_manifests')
      .onDelete('CASCADE');
    table.string('extraction_method', 100).notNullable();
    table.string('detected_language', 20);
    table.integer('page_count');
    table.text('canonical_text').notNullable();
    table.jsonb('text_blocks').notNullable().defaultTo('[]');
    table.jsonb('key_value_pairs').notNullable().defaultTo('[]');
    table.jsonb('tables_json').notNullable().defaultTo('[]');
    table.jsonb('raw_docai_response');
    table.timestamps(true, true);

    table.unique(['document_id']);
  });

  await knex.schema.createTable('pii_token_maps', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('document_id')
      .notNullable()
      .references('id')
      .inTable('documents')
      .onDelete('CASCADE');
    table
      .uuid('manifest_id')
      .notNullable()
      .references('id')
      .inTable('pipeline_routing_manifests')
      .onDelete('CASCADE');
    table.integer('dlp_findings_count').notNullable().defaultTo(0);
    table.jsonb('dlp_info_types_found').notNullable().defaultTo('[]');
    table.integer('soft_pii_findings_count').notNullable().defaultTo(0);
    table.string('gcs_token_map_path', 1000);
    table.jsonb('inline_token_map');
    table.text('tokenized_text').notNullable();
    table.integer('original_token_count');
    table.integer('remaining_token_count');
    table.float('semantic_loss_ratio');
    table.timestamps(true, true);

    table.unique(['document_id']);
  });

  await knex.schema.createTable('ai_extractions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('document_id')
      .notNullable()
      .references('id')
      .inTable('documents')
      .onDelete('CASCADE');
    table
      .uuid('manifest_id')
      .notNullable()
      .references('id')
      .inTable('pipeline_routing_manifests')
      .onDelete('CASCADE');
    table.string('model_name', 100).notNullable();
    table.string('model_version', 50);
    table.string('prompt_version', 20).notNullable();
    table.jsonb('extracted_fields').notNullable().defaultTo('{}');
    table.jsonb('missing_fields').notNullable().defaultTo('[]');
    table.jsonb('contradictions').notNullable().defaultTo('[]');
    table.jsonb('model_quality_flags').notNullable().defaultTo('[]');
    table.integer('input_token_count');
    table.integer('output_token_count');
    table.integer('latency_ms');
    table.boolean('is_mock').notNullable().defaultTo(false);
    table.timestamps(true, true);

    table.index(['document_id']);
  });

  await knex.schema.createTable('validated_candidates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('document_id')
      .notNullable()
      .references('id')
      .inTable('documents')
      .onDelete('CASCADE');
    table
      .uuid('extraction_id')
      .notNullable()
      .references('id')
      .inTable('ai_extractions')
      .onDelete('CASCADE');
    table
      .uuid('manifest_id')
      .notNullable()
      .references('id')
      .inTable('pipeline_routing_manifests')
      .onDelete('CASCADE');
    table.jsonb('field_trust_map').notNullable().defaultTo('{}');
    table.float('composite_confidence').notNullable().defaultTo(0);
    table.float('field_completeness_score').notNullable().defaultTo(0);
    table.float('evidence_strength_score').notNullable().defaultTo(0);
    table.float('rule_consistency_score').notNullable().defaultTo(0);
    table.float('model_signal_score').notNullable().defaultTo(0);
    table.string('validation_status', 50).notNullable().defaultTo('passed');
    table.jsonb('validation_flags').notNullable().defaultTo('[]');
    table.jsonb('trusted_fields').notNullable().defaultTo('{}');
    table.jsonb('untrusted_fields').notNullable().defaultTo('[]');
    table.boolean('reasoning_invoked').notNullable().defaultTo(false);
    table.uuid('reasoning_extraction_id');
    table.timestamps(true, true);

    table.unique(['document_id']);
  });

  await knex.schema.createTable('ai_reasoning_outputs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('document_id')
      .notNullable()
      .references('id')
      .inTable('documents')
      .onDelete('CASCADE');
    table
      .uuid('validated_candidate_id')
      .notNullable()
      .references('id')
      .inTable('validated_candidates')
      .onDelete('CASCADE');
    table
      .uuid('manifest_id')
      .notNullable()
      .references('id')
      .inTable('pipeline_routing_manifests')
      .onDelete('CASCADE');
    table.string('model_name', 100).notNullable().defaultTo('gemini-1.5-pro');
    table.string('prompt_version', 20).notNullable().defaultTo('reasoning_prompt_v1');
    table.integer('urgency_score').notNullable().defaultTo(50);
    table.string('urgency_label', 50).notNullable().defaultTo('medium');
    table.jsonb('urgency_reasons').notNullable().defaultTo('[]');
    table.jsonb('urgency_evidence_refs').notNullable().defaultTo('[]');
    table.string('need_category', 100);
    table.string('need_subcategory', 100);
    table.jsonb('recommended_skill_keys').notNullable().defaultTo('[]');
    table.text('recommended_action');
    table.float('reasoning_confidence');
    table.string('verification_risk', 50);
    table.jsonb('verification_risk_reasons').notNullable().defaultTo('[]');
    table.integer('input_token_count');
    table.integer('output_token_count');
    table.integer('latency_ms');
    table.boolean('is_mock').notNullable().defaultTo(false);
    table.timestamps(true, true);

    table.index(['document_id']);
  });

  await knex.schema.createTable('human_reviews', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('document_id')
      .notNullable()
      .references('id')
      .inTable('documents')
      .onDelete('CASCADE');
    table
      .uuid('validated_candidate_id')
      .references('id')
      .inTable('validated_candidates')
      .onDelete('SET NULL');
    table
      .uuid('reviewed_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.string('review_action', 50).notNullable();
    table.jsonb('field_corrections').notNullable().defaultTo('{}');
    table.text('review_notes');
    table.jsonb('approved_fields').notNullable().defaultTo('{}');
    table.timestamp('reviewed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamps(true, true);

    table.index(['document_id']);
    table.index(['reviewed_by']);
  });

  await knex.schema.createTable('auto_approve_policies', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('org_id')
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.string('policy_version', 50).notNullable();
    table.timestamp('effective_from', { useTz: true });
    table.timestamp('effective_to', { useTz: true });
    table.jsonb('conditions').notNullable();
    table.jsonb('blocked_categories').notNullable().defaultTo('[]');
    table.boolean('is_active').notNullable().defaultTo(false);
    table
      .uuid('created_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .uuid('activated_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamps(true, true);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('auto_approve_policies');
  await knex.schema.dropTableIfExists('human_reviews');
  await knex.schema.dropTableIfExists('ai_reasoning_outputs');
  await knex.schema.dropTableIfExists('validated_candidates');
  await knex.schema.dropTableIfExists('ai_extractions');
  await knex.schema.dropTableIfExists('pii_token_maps');
  await knex.schema.dropTableIfExists('canonical_projections');
  await knex.schema.dropTableIfExists('pipeline_routing_manifests');
};
