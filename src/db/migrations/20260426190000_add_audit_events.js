/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('audit_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('org_id')
      .references('id')
      .inTable('organizations')
      .onDelete('SET NULL');
    table.string('event_type', 100).notNullable();
    table.string('entity_type', 100).notNullable();
    table.uuid('entity_id').notNullable();
    table
      .uuid('actor_id')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.string('actor_type', 50).notNullable().defaultTo('user');
    table.jsonb('old_value');
    table.jsonb('new_value');
    table.jsonb('metadata');
    table.string('expected_next_state', 100);
    table.timestamp('occurred_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['entity_type', 'entity_id']);
    table.index(['org_id']);
    table.index(['occurred_at']);
    table.index(['event_type']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('audit_events');
};
