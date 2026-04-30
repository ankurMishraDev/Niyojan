/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('documents', (table) => {
    table
      .uuid('source_survey_id')
      .references('id')
      .inTable('surveys')
      .onDelete('SET NULL');

    table.index(['source_survey_id']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('documents', (table) => {
    table.dropIndex(['source_survey_id']);
    table.dropColumn('source_survey_id');
  });
};
