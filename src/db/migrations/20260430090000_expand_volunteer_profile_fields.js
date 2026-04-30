exports.up = async function up(knex) {
  await knex.schema.alterTable('volunteers', (table) => {
    table.uuid('org_id').nullable().alter();
    table.string('gender', 30).nullable();
    table.integer('age').nullable();
    table.string('phone_number', 40).nullable();
    table.string('profession', 120).nullable();
    table.string('primary_domain', 80).nullable();
    table.text('profile_summary').nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('volunteers', (table) => {
    table.dropColumn('profile_summary');
    table.dropColumn('primary_domain');
    table.dropColumn('profession');
    table.dropColumn('phone_number');
    table.dropColumn('age');
    table.dropColumn('gender');
  });

  await knex.schema.alterTable('volunteers', (table) => {
    table.uuid('org_id').notNullable().alter();
  });
};
