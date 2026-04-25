/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.schema.createTable('organizations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.string('type', 100).notNullable();
    table.string('region', 120);
    table.string('status', 50).notNullable().defaultTo('active');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('org_id')
      .references('id')
      .inTable('organizations')
      .onDelete('SET NULL');
    table.string('firebase_uid', 255).notNullable().unique();
    table.string('name', 255).notNullable();
    table.string('email', 255).notNullable().unique();
    table.string('role', 40).notNullable();
    table.string('status', 50).notNullable().defaultTo('active');
    table.timestamps(true, true);

    table.index(['org_id']);
    table.index(['role']);
  });

  await knex.schema.createTable('field_catalog', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('key', 150).notNullable().unique();
    table.string('name', 255).notNullable();
    table.string('category', 120).notNullable();
    table.string('input_type', 80).notNullable();
    table.jsonb('options_json');
    table.jsonb('validation_json');
    table.boolean('is_system').notNullable().defaultTo(false);
    table.timestamps(true, true);

    table.index(['category']);
    table.index(['input_type']);
    table.index(['is_system']);
  });

  await knex.schema.createTable('documents', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('org_id')
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table
      .uuid('uploaded_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.string('file_name', 255).notNullable();
    table.string('gcs_path', 1024).notNullable();
    table.string('file_type', 120).notNullable();
    table.string('status', 50).notNullable().defaultTo('uploaded');
    table.jsonb('extraction_result_json');
    table.timestamps(true, true);

    table.index(['org_id']);
    table.index(['uploaded_by']);
    table.index(['status']);
  });

  await knex.schema.createTable('form_templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('org_id')
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table
      .uuid('created_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table
      .uuid('source_document_id')
      .references('id')
      .inTable('documents')
      .onDelete('SET NULL');
    table.string('name', 255).notNullable();
    table.string('status', 50).notNullable().defaultTo('draft');
    table.timestamps(true, true);

    table.index(['org_id']);
    table.index(['created_by']);
    table.index(['source_document_id']);
  });

  await knex.schema.createTable('form_template_versions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('template_id')
      .notNullable()
      .references('id')
      .inTable('form_templates')
      .onDelete('CASCADE');
    table.integer('version_no').notNullable();
    table.string('status', 50).notNullable().defaultTo('draft');
    table.boolean('is_published').notNullable().defaultTo(false);
    table.timestamps(true, true);

    table.unique(['template_id', 'version_no']);
    table.index(['template_id']);
    table.index(['status']);
    table.index(['is_published']);
  });

  await knex.schema.createTable('form_fields', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('template_version_id')
      .notNullable()
      .references('id')
      .inTable('form_template_versions')
      .onDelete('CASCADE');
    table
      .uuid('field_catalog_id')
      .references('id')
      .inTable('field_catalog')
      .onDelete('SET NULL');
    table.string('label', 255).notNullable();
    table.string('input_type', 80).notNullable();
    table.jsonb('options_json');
    table.boolean('is_required').notNullable().defaultTo(false);
    table.integer('display_order').notNullable().defaultTo(0);
    table.boolean('is_custom').notNullable().defaultTo(false);
    table.timestamps(true, true);

    table.index(['template_version_id']);
    table.index(['field_catalog_id']);
    table.index(['display_order']);
  });

  await knex.schema.createTable('surveys', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('org_id')
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table
      .uuid('template_version_id')
      .notNullable()
      .references('id')
      .inTable('form_template_versions');
    table
      .uuid('conducted_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.string('respondent_name', 255);
    table.string('location_text', 255);
    table.decimal('latitude', 10, 7);
    table.decimal('longitude', 10, 7);
    table.string('status', 50).notNullable().defaultTo('draft');
    table.timestamp('submitted_at', { useTz: true });
    table.timestamps(true, true);

    table.index(['org_id']);
    table.index(['template_version_id']);
    table.index(['conducted_by']);
    table.index(['status']);
  });

  await knex.schema.createTable('survey_responses', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('survey_id')
      .notNullable()
      .references('id')
      .inTable('surveys')
      .onDelete('CASCADE');
    table
      .uuid('form_field_id')
      .notNullable()
      .references('id')
      .inTable('form_fields')
      .onDelete('CASCADE');
    table.string('input_type', 80).notNullable();
    table.text('value_text');
    table.decimal('value_number', 14, 2);
    table.boolean('value_bool');
    table.jsonb('value_json');
    table.timestamps(true, true);

    table.index(['survey_id']);
    table.index(['form_field_id']);
  });

  await knex.schema.createTable('volunteers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('org_id')
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table
      .uuid('user_id')
      .notNullable()
      .unique()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.string('availability_status', 50).notNullable().defaultTo('available');
    table.string('location_text', 255);
    table.decimal('latitude', 10, 7);
    table.decimal('longitude', 10, 7);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.index(['org_id']);
    table.index(['availability_status']);
    table.index(['is_active']);
  });

  await knex.schema.createTable('skills', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('key', 150).notNullable().unique();
    table.string('name', 255).notNullable();
    table.string('category', 120).notNullable();
    table.timestamps(true, true);

    table.index(['category']);
  });

  await knex.schema.createTable('volunteer_skills', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('volunteer_id')
      .notNullable()
      .references('id')
      .inTable('volunteers')
      .onDelete('CASCADE');
    table
      .uuid('skill_id')
      .notNullable()
      .references('id')
      .inTable('skills')
      .onDelete('CASCADE');
    table.integer('proficiency').notNullable().defaultTo(3);
    table.timestamps(true, true);

    table.unique(['volunteer_id', 'skill_id']);
    table.index(['volunteer_id']);
    table.index(['skill_id']);
  });

  await knex.schema.createTable('needs_analysis', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('org_id')
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table
      .uuid('survey_id')
      .notNullable()
      .references('id')
      .inTable('surveys')
      .onDelete('CASCADE');
    table.string('category', 120).notNullable();
    table.text('summary').notNullable();
    table.decimal('urgency_score', 5, 2).notNullable().defaultTo(0);
    table.string('priority_level', 50).notNullable().defaultTo('medium');
    table.string('status', 50).notNullable().defaultTo('detected');
    table.timestamps(true, true);

    table.index(['org_id']);
    table.index(['survey_id']);
    table.index(['category']);
    table.index(['status']);
  });

  await knex.schema.createTable('need_skills', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('need_id')
      .notNullable()
      .references('id')
      .inTable('needs_analysis')
      .onDelete('CASCADE');
    table
      .uuid('skill_id')
      .notNullable()
      .references('id')
      .inTable('skills')
      .onDelete('CASCADE');
    table.timestamps(true, true);

    table.unique(['need_id', 'skill_id']);
    table.index(['need_id']);
    table.index(['skill_id']);
  });

  await knex.schema.createTable('task_assignments', (table) => {
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
      .uuid('volunteer_id')
      .notNullable()
      .references('id')
      .inTable('volunteers')
      .onDelete('CASCADE');
    table.decimal('match_score', 5, 2).notNullable().defaultTo(0);
    table.jsonb('match_reason_json').notNullable().defaultTo('{}');
    table.string('status', 50).notNullable().defaultTo('suggested');
    table.timestamp('assigned_at', { useTz: true });
    table.timestamp('completed_at', { useTz: true });
    table.timestamps(true, true);

    table.index(['org_id']);
    table.index(['need_id']);
    table.index(['volunteer_id']);
    table.index(['status']);
  });

  await knex.schema.createTable('jobs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('org_id')
      .references('id')
      .inTable('organizations')
      .onDelete('SET NULL');
    table.string('type', 120).notNullable();
    table.string('entity_type', 120).notNullable();
    table.uuid('entity_id');
    table.jsonb('payload_json').notNullable().defaultTo('{}');
    table.jsonb('result_json');
    table.string('status', 50).notNullable().defaultTo('pending');
    table.integer('attempts').notNullable().defaultTo(0);
    table.text('error_message');
    table.timestamp('run_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamps(true, true);

    table.index(['org_id']);
    table.index(['status']);
    table.index(['run_at']);
    table.index(['entity_type', 'entity_id']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('jobs');
  await knex.schema.dropTableIfExists('task_assignments');
  await knex.schema.dropTableIfExists('need_skills');
  await knex.schema.dropTableIfExists('needs_analysis');
  await knex.schema.dropTableIfExists('volunteer_skills');
  await knex.schema.dropTableIfExists('skills');
  await knex.schema.dropTableIfExists('volunteers');
  await knex.schema.dropTableIfExists('survey_responses');
  await knex.schema.dropTableIfExists('surveys');
  await knex.schema.dropTableIfExists('form_fields');
  await knex.schema.dropTableIfExists('form_template_versions');
  await knex.schema.dropTableIfExists('form_templates');
  await knex.schema.dropTableIfExists('documents');
  await knex.schema.dropTableIfExists('field_catalog');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('organizations');

  await knex.raw('DROP EXTENSION IF EXISTS "pgcrypto"');
};
