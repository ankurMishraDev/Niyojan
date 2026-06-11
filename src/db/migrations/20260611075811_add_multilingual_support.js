/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  // 1. Add template_language to form_templates
  await knex.schema.alterTable('form_templates', (table) => {
    table.string('template_language', 10).notNullable().defaultTo('en');
  });

  // 2. Add submitted_language to surveys
  await knex.schema.alterTable('surveys', (table) => {
    table.string('submitted_language', 10).notNullable().defaultTo('en');
  });

  // 3. Add english translations to survey_responses
  await knex.schema.alterTable('survey_responses', (table) => {
    table.text('english_value_text');
  });

  // 4. Add original language and english translations to volunteer_feedback
  await knex.schema.alterTable('volunteer_feedback', (table) => {
    table.string('original_language', 10).notNullable().defaultTo('en');
    table.text('english_actual_situation_summary');
    table.text('english_action_taken');
    table.text('english_escalation_reason');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('volunteer_feedback', (table) => {
    table.dropColumn('english_escalation_reason');
    table.dropColumn('english_action_taken');
    table.dropColumn('english_actual_situation_summary');
    table.dropColumn('original_language');
  });

  await knex.schema.alterTable('survey_responses', (table) => {
    table.dropColumn('english_value_text');
  });

  await knex.schema.alterTable('surveys', (table) => {
    table.dropColumn('submitted_language');
  });

  await knex.schema.alterTable('form_templates', (table) => {
    table.dropColumn('template_language');
  });
};
