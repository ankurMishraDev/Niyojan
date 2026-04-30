/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('ai_reasoning_outputs', (table) => {
    table.string('prompt_version', 255).alter();
    table.string('model_name', 255).alter();
    table.string('provider_name', 255).alter();
    table.string('urgency_label', 255).alter();
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('ai_reasoning_outputs', (table) => {
    table.string('prompt_version', 20).alter();
    table.string('model_name', 100).alter();
    table.string('provider_name', 120).alter();
    table.string('urgency_label', 50).alter();
  });
};
