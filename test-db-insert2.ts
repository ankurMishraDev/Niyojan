import { db } from './src/config/db';

async function run() {
  const query = db('organizations').insert({
    name: 'Test Org 3',
    type: 'NGO',
    focus_areas: ['health', 'education'],
    operating_regions: ['asia']
  });
  console.log(query.toSQL().toNative());
  process.exit(0);
}
run();