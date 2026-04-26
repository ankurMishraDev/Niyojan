/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('volunteer_feedback', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('assignment_id')
      .notNullable()
      .references('id')
      .inTable('task_assignments')
      .onDelete('CASCADE');
    table
      .uuid('volunteer_id')
      .notNullable()
      .references('id')
      .inTable('volunteers')
      .onDelete('CASCADE');
    table
      .uuid('need_id')
      .notNullable()
      .references('id')
      .inTable('needs_analysis')
      .onDelete('CASCADE');
    table.boolean('visit_completed').notNullable().defaultTo(false);
    table.date('visit_date');
    table.boolean('need_confirmed');
    table.text('actual_situation_summary');
    table.string('actual_urgency_assessment', 50);
    table.integer('actual_affected_count');
    table.boolean('was_ai_extraction_accurate');
    table.text('extraction_inaccuracies');
    table.jsonb('evidence_gcs_paths').notNullable().defaultTo('[]');
    table.text('action_taken');
    table.string('resolution_status', 50).notNullable().defaultTo('pending');
    table.text('escalation_reason');
    table.timestamp('submitted_at', { useTz: true });
    table.timestamps(true, true);

    table.unique(['assignment_id']);
    table.index(['volunteer_id']);
    table.index(['need_id']);
    table.index(['resolution_status']);
  });

  await knex.schema.createTable('case_outcomes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('org_id')
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table
      .uuid('need_id')
      .notNullable()
      .references('id')
      .inTable('needs_analysis')
      .onDelete('CASCADE');
    table
      .uuid('assignment_id')
      .notNullable()
      .references('id')
      .inTable('task_assignments')
      .onDelete('CASCADE');
    table
      .uuid('feedback_id')
      .notNullable()
      .references('id')
      .inTable('volunteer_feedback')
      .onDelete('CASCADE');
    table
      .uuid('closed_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.string('outcome', 50).notNullable();
    table.boolean('extraction_was_accurate');
    table.boolean('urgency_was_accurate');
    table.boolean('category_was_accurate');
    table.boolean('matching_was_appropriate');
    table.text('coordinator_notes');
    table.timestamp('closed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamps(true, true);

    table.unique(['need_id']);
    table.unique(['assignment_id']);
    table.index(['org_id']);
    table.index(['closed_by']);
    table.index(['outcome']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('case_outcomes');
  await knex.schema.dropTableIfExists('volunteer_feedback');
};
