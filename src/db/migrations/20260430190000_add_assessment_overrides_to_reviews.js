/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('documents', (table) => {
    table.jsonb('assessment_overrides_json').notNullable().defaultTo('{}');
  });

  await knex.schema.alterTable('surveys', (table) => {
    table.jsonb('assessment_overrides_json').notNullable().defaultTo('{}');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('surveys', (table) => {
    table.dropColumn('assessment_overrides_json');
  });

  await knex.schema.alterTable('documents', (table) => {
    table.dropColumn('assessment_overrides_json');
  });
};
