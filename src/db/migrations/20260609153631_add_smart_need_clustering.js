/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // 1. cluster_policies
  await knex.schema.createTable('cluster_policies', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('org_id')
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.decimal('category_weight', 3, 2).notNullable().defaultTo(0.40);
    table.decimal('location_weight', 3, 2).notNullable().defaultTo(0.30);
    table.decimal('time_weight', 3, 2).notNullable().defaultTo(0.15);
    table.decimal('semantic_weight', 3, 2).notNullable().defaultTo(0.15);
    table.decimal('threshold', 3, 2).notNullable().defaultTo(0.72);
    table.integer('max_cluster_size').notNullable().defaultTo(15);
    table.integer('time_window_days').notNullable().defaultTo(14);
    table.decimal('radius_km_hard_cap', 5, 2).defaultTo(10.0);
    table.timestamps(true, true);
    table.unique(['org_id']);
  });

  // 2. aggregate_needs
  await knex.schema.createTable('aggregate_needs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('org_id')
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.text('title').notNullable();
    table.text('description');
    table.string('need_category', 120).notNullable();
    table.string('urgency_label', 50).notNullable();
    table.decimal('urgency_score', 5, 2).notNullable();
    table.decimal('centroid_lat', 10, 7);
    table.decimal('centroid_lng', 10, 7);
    table.decimal('radius_km', 5, 2);
    table.integer('member_count').notNullable().defaultTo(0);
    table.decimal('cluster_score', 4, 3);
    table.string('status', 50).notNullable().defaultTo('pending_review'); // pending_review | confirmed | assigned | partially_closed | closed
    table
      .uuid('reviewed_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.datetime('reviewed_at');
    table.timestamps(true, true);
  });

  // 3. aggregate_need_members
  await knex.schema.createTable('aggregate_need_members', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('aggregate_need_id')
      .notNullable()
      .references('id')
      .inTable('aggregate_needs')
      .onDelete('CASCADE');
    table
      .uuid('needs_analysis_id')
      .notNullable()
      .references('id')
      .inTable('needs_analysis')
      .onDelete('CASCADE');
    table.decimal('cluster_score', 4, 3);
    table.datetime('added_at').defaultTo(knex.fn.now());
    table.unique(['aggregate_need_id', 'needs_analysis_id']);
  });

  // 4. needs_analysis modifications
  await knex.schema.alterTable('needs_analysis', (table) => {
    table
      .uuid('aggregate_need_id')
      .references('id')
      .inTable('aggregate_needs')
      .onDelete('SET NULL');
    table.string('cluster_status', 50).defaultTo('unclustered');
  });

  // 5. task_assignments modifications (polymorphic)
  await knex.schema.alterTable('task_assignments', (table) => {
    table.uuid('need_id').alter().nullable(); // DROP NOT NULL
    table
      .uuid('aggregate_need_id')
      .references('id')
      .inTable('aggregate_needs')
      .onDelete('CASCADE');
    table.string('assignment_scope', 50).defaultTo('solo');
  });

  // Add the check constraint for task_assignments
  await knex.raw(`
    ALTER TABLE task_assignments 
    ADD CONSTRAINT check_task_assignment_target 
    CHECK (
      (need_id IS NOT NULL AND aggregate_need_id IS NULL) OR 
      (need_id IS NULL AND aggregate_need_id IS NOT NULL)
    );
  `);

  // 6. need_skills modifications (polymorphic)
  await knex.schema.alterTable('need_skills', (table) => {
    table.uuid('need_id').alter().nullable(); // DROP NOT NULL
    table
      .uuid('aggregate_need_id')
      .references('id')
      .inTable('aggregate_needs')
      .onDelete('CASCADE');
  });

  // Add the check constraint for need_skills
  await knex.raw(`
    ALTER TABLE need_skills 
    ADD CONSTRAINT check_need_skill_target 
    CHECK (
      (need_id IS NOT NULL AND aggregate_need_id IS NULL) OR 
      (need_id IS NULL AND aggregate_need_id IS NOT NULL)
    );
  `);
};

exports.down = async function (knex) {
  await knex.raw('ALTER TABLE need_skills DROP CONSTRAINT check_need_skill_target');
  await knex.schema.alterTable('need_skills', (table) => {
    table.dropColumn('aggregate_need_id');
  });
  await knex.raw('ALTER TABLE need_skills ALTER COLUMN need_id SET NOT NULL');

  await knex.raw('ALTER TABLE task_assignments DROP CONSTRAINT check_task_assignment_target');
  await knex.schema.alterTable('task_assignments', (table) => {
    table.dropColumn('aggregate_need_id');
    table.dropColumn('assignment_scope');
  });
  await knex.raw('ALTER TABLE task_assignments ALTER COLUMN need_id SET NOT NULL');

  await knex.schema.alterTable('needs_analysis', (table) => {
    table.dropColumn('cluster_status');
    table.dropColumn('aggregate_need_id');
  });

  await knex.schema.dropTableIfExists('aggregate_need_members');
  await knex.schema.dropTableIfExists('aggregate_needs');
  await knex.schema.dropTableIfExists('cluster_policies');
};