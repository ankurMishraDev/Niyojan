const { db } = require('./src/config/db');

async function run() {
  try {
    await db('organizations').insert({
      name: 'Test Org',
      type: 'NGO',
      focus_areas: [],
      operating_regions: []
    });
    console.log("Success with array");
  } catch (err) {
    console.error("Error with array:", err.message);
  }
  
  try {
    await db('organizations').insert({
      name: 'Test Org 2',
      type: 'NGO',
      focus_areas: JSON.stringify([]),
      operating_regions: JSON.stringify([])
    });
    console.log("Success with stringified array");
  } catch (err) {
    console.error("Error with stringified array:", err.message);
  }
  process.exit(0);
}
run();