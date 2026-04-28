exports.up = async function up(knex) {
  await knex.schema.alterTable('organizations', (table) => {
    table.string('registration_id', 120).nullable();
    table.string('contact_email', 255).nullable();
    table.string('contact_phone', 40).nullable();
    table.string('website', 255).nullable();
    table.text('address_text').nullable();
    table.jsonb('focus_areas').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
    table.jsonb('operating_regions').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
    table.integer('team_size').nullable();
    table.integer('founded_year').nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('organizations', (table) => {
    table.dropColumn('founded_year');
    table.dropColumn('team_size');
    table.dropColumn('operating_regions');
    table.dropColumn('focus_areas');
    table.dropColumn('address_text');
    table.dropColumn('website');
    table.dropColumn('contact_phone');
    table.dropColumn('contact_email');
    table.dropColumn('registration_id');
  });
};
