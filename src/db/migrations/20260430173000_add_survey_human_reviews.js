/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('survey_human_reviews', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('survey_id')
      .notNullable()
      .references('id')
      .inTable('surveys')
      .onDelete('CASCADE');
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

    table.index(['survey_id']);
    table.index(['reviewed_by']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('survey_human_reviews');
};
