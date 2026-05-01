import { db } from '../src/config/db';
import crypto from 'crypto';

const FAKE_EMAIL_DOMAIN = '@fake-mp-volunteer.local';

const firstNames = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Diya', 'Ananya', 'Aadhya', 'Pari', 'Saanvi', 'Avni', 'Riya', 'Aarohi', 'Myra', 'Kriti',
  'Rahul', 'Priya', 'Amit', 'Neha', 'Vikram', 'Pooja', 'Suresh', 'Anita', 'Ramesh', 'Sunita',
  'Deepak', 'Kavita', 'Ravi', 'Meena', 'Sanjay', 'Rekha', 'Rajesh', 'Geeta', 'Nitin', 'Nisha'
];

const lastNames = [
  'Sharma', 'Verma', 'Singh', 'Kumar', 'Das', 'Jain', 'Gupta', 'Yadav', 'Patel', 'Mishra',
  'Pandey', 'Tiwari', 'Yadav', 'Dubey', 'Rajput', 'Chouhan', 'Tomar', 'Rathor', 'Joshi', 'Bhatt'
];

const domains = [
  'Healthcare', 'Education', 'Disaster Relief', 'Animal Welfare', 'Environment', 'Food Distribution', 'Eldercare', 'Women Empowerment'
];

const professions = [
  'Doctor', 'Teacher', 'Engineer', 'Student', 'Nurse', 'Business Owner', 'Social Worker', 'Farmer', 'IT Professional', 'Lawyer', 'Retired'
];

const genders = ['Male', 'Female', 'Other'];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomNumber(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

async function seedFakeVolunteers(count: number) {
  console.log(`Seeding ${count} fake volunteers in Madhya Pradesh...`);
  let inserted = 0;

  for (let i = 0; i < count; i++) {
    const firstName = getRandomItem(firstNames);
    const lastName = getRandomItem(lastNames);
    const name = `${firstName} ${lastName}`;
    const uuidStr = crypto.randomUUID();
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${uuidStr.substring(0, 8)}${FAKE_EMAIL_DOMAIN}`;
    const firebase_uid = `fake_${uuidStr}`;

    // Random location in Madhya Pradesh (Approximate bounds)
    const lat = getRandomNumber(21.1, 26.8);
    const lng = getRandomNumber(74.0, 82.8);

    // Insert user
    const [user] = await db('users').insert({
      firebase_uid,
      name,
      email,
      role: 'volunteer',
      status: 'active'
    }).returning('*');

    // Insert volunteer profile
    await db('volunteers').insert({
      user_id: user.id,
      availability_status: Math.random() > 0.2 ? 'available' : 'busy',
      location_text: 'Madhya Pradesh',
      latitude: lat,
      longitude: lng,
      is_active: true,
      gender: getRandomItem(genders),
      age: Math.floor(getRandomNumber(18, 65)),
      phone_number: `+919${Math.floor(getRandomNumber(100000000, 999999999))}`,
      profession: getRandomItem(professions),
      primary_domain: getRandomItem(domains),
      profile_summary: `Passionate about ${getRandomItem(domains).toLowerCase()} and helping the community in Madhya Pradesh.`
    });

    inserted++;
    if (inserted % 10 === 0) {
      console.log(`Inserted ${inserted} volunteers...`);
    }
  }

  console.log(`Successfully seeded ${inserted} fake volunteers.`);
}

async function deleteFakeVolunteers() {
  console.log(`Deleting all fake volunteers with domain ${FAKE_EMAIL_DOMAIN}...`);
  
  // Find users
  const usersToDelete = await db('users').where('email', 'like', `%${FAKE_EMAIL_DOMAIN}`);
  
  if (usersToDelete.length === 0) {
    console.log("No fake volunteers found to delete.");
    return;
  }

  const userIds = usersToDelete.map(u => u.id);
  
  // Note: 'volunteers' table has ON DELETE CASCADE for user_id
  // but we can delete from 'users' and let DB cascade
  const deletedCount = await db('users').whereIn('id', userIds).delete();

  console.log(`Successfully deleted ${deletedCount} fake volunteers (and their profiles via cascade).`);
}

async function main() {
  const command = process.argv[2];

  try {
    if (command === 'seed') {
      const count = parseInt(process.argv[3]) || 120; // Default to 120
      await seedFakeVolunteers(count);
    } else if (command === 'delete') {
      await deleteFakeVolunteers();
    } else {
      console.log("Usage:");
      console.log("  npx ts-node scripts/manage-fake-volunteers.ts seed [count]");
      console.log("  npx ts-node scripts/manage-fake-volunteers.ts delete");
    }
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    await db.destroy();
  }
}

main();
