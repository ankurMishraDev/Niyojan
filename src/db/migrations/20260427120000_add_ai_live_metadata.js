/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('ai_extractions', (table) => {
    table.string('provider_name', 120).notNullable().defaultTo('unknown');
    table.string('validation_status', 50).notNullable().defaultTo('passed');
    table.jsonb('validation_errors').notNullable().defaultTo('[]');
    table.text('fallback_reason');
    table.boolean('review_required').notNullable().defaultTo(false);
    table.float('average_confidence').notNullable().defaultTo(0);
  });

  await knex.schema.alterTable('ai_reasoning_outputs', (table) => {
    table.string('provider_name', 120).notNullable().defaultTo('unknown');
    table.string('validation_status', 50).notNullable().defaultTo('passed');
    table.jsonb('validation_errors').notNullable().defaultTo('[]');
    table.text('fallback_reason');
    table.boolean('review_required').notNullable().defaultTo(false);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('ai_reasoning_outputs', (table) => {
    table.dropColumn('review_required');
    table.dropColumn('fallback_reason');
    table.dropColumn('validation_errors');
    table.dropColumn('validation_status');
    table.dropColumn('provider_name');
  });

  await knex.schema.alterTable('ai_extractions', (table) => {
    table.dropColumn('average_confidence');
    table.dropColumn('review_required');
    table.dropColumn('fallback_reason');
    table.dropColumn('validation_errors');
    table.dropColumn('validation_status');
    table.dropColumn('provider_name');
  });
};
