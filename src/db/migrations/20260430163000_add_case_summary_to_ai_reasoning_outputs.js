/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('ai_reasoning_outputs', (table) => {
    table.text('case_summary');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('ai_reasoning_outputs', (table) => {
    table.dropColumn('case_summary');
  });
};
