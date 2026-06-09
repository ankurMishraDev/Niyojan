/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('volunteer_feedback', (table) => {
    table.uuid('need_id').alter().nullable(); // DROP NOT NULL
    table
      .uuid('aggregate_need_id')
      .references('id')
      .inTable('aggregate_needs')
      .onDelete('CASCADE');
  });

  await knex.raw(`
    ALTER TABLE volunteer_feedback 
    ADD CONSTRAINT check_feedback_target 
    CHECK (
      (need_id IS NOT NULL AND aggregate_need_id IS NULL) OR 
      (need_id IS NULL AND aggregate_need_id IS NOT NULL)
    );
  `);
};

exports.down = async function (knex) {
  await knex.raw('ALTER TABLE volunteer_feedback DROP CONSTRAINT check_feedback_target');
  await knex.schema.alterTable('volunteer_feedback', (table) => {
    table.dropColumn('aggregate_need_id');
  });
  await knex.raw('ALTER TABLE volunteer_feedback ALTER COLUMN need_id SET NOT NULL');
};
