/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('aggregate_needs', (table) => {
    table.string('langgraph_thread_id', 255);
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('aggregate_needs', (table) => {
    table.dropColumn('langgraph_thread_id');
  });
};
