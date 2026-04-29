import { db } from '../src/config/db';
import { getFirebaseAuth } from '../src/config/firebase';

async function createSuperAdmin() {
  const email = "niyojanAdmin@gmail.com";
  const password = "asdf@1234";
  const auth = getFirebaseAuth();

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    console.log("Firebase user found. Updating password.");
    await auth.updateUser(userRecord.uid, { password });
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      console.log("Firebase user not found. Creating new user in Firebase...");
      userRecord = await auth.createUser({
        email,
        password,
        displayName: "Super Admin",
        emailVerified: true
      });
    } else {
      throw error;
    }
  }

  const uid = userRecord.uid;
  
  let existingDbUser = await db('users').where({ firebase_uid: uid }).first();
  if (!existingDbUser) {
    existingDbUser = await db('users').where({ email }).first();
  }

  if (existingDbUser) {
    console.log("DB user found. Upgrading to superadmin.");
    await db('users').where({ id: existingDbUser.id }).update({
      firebase_uid: uid,
      role: 'superadmin',
      status: 'active'
    });
  } else {
    console.log("Creating new superadmin profile in DB.");
    await db('users').insert({
      firebase_uid: uid,
      email: email,
      name: "Super Admin",
      role: "superadmin",
      status: "active"
    });
  }

  console.log("Superadmin setup complete! You can now log in.");
  process.exit(0);
}

createSuperAdmin().catch((err) => {
  console.error("Error creating superadmin:", err);
  process.exit(1);
});