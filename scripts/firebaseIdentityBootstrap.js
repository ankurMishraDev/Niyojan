require("dotenv").config();

const fs = require("node:fs");
const admin = require("firebase-admin");
const knexConfig = require("../knexfile");
const { firebaseSeedUsers, bootstrapAdmin, seedOrganizations, seedUsers } = require("./demoIdentityCatalog");

const environment = process.env.NODE_ENV || "development";
const knex = require("knex")(knexConfig[environment] || knexConfig.development);

const loadServiceAccount = () => {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"));
  }

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }

  throw new Error(
    "Provide GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY before bootstrapping Firebase users.",
  );
};

const initializeFirebaseAdmin = () => {
  if (admin.apps.length > 0) {
    return admin.auth();
  }

  const serviceAccount = loadServiceAccount();
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
    }),
    projectId: serviceAccount.project_id,
  });

  return admin.auth();
};

const upsertFirebaseUser = async (auth, user) => {
  try {
    await auth.getUser(user.uid);
    await auth.updateUser(user.uid, {
      email: user.email,
      password: user.password,
      displayName: user.displayName,
      emailVerified: true,
      disabled: false,
    });
  } catch (error) {
    if (error && error.code === "auth/user-not-found") {
      await auth.createUser({
        uid: user.uid,
        email: user.email,
        password: user.password,
        displayName: user.displayName,
        emailVerified: true,
        disabled: false,
      });
      return;
    }

    throw error;
  }
};

const upsertDbUser = async (user, options = {}) => {
  const dbUser = seedUsers.find((entry) => entry.firebase_uid === user.uid);
  if (!dbUser) {
    throw new Error(`No matching DB user found for Firebase uid ${user.uid}`);
  }

  if (options.includeOrganizations) {
    await knex("organizations")
      .insert(seedOrganizations)
      .onConflict("id")
      .merge({
        name: knex.ref("excluded.name"),
        type: knex.ref("excluded.type"),
        region: knex.ref("excluded.region"),
        registration_id: knex.ref("excluded.registration_id"),
        contact_email: knex.ref("excluded.contact_email"),
        contact_phone: knex.ref("excluded.contact_phone"),
        website: knex.ref("excluded.website"),
        address_text: knex.ref("excluded.address_text"),
        focus_areas: knex.ref("excluded.focus_areas"),
        operating_regions: knex.ref("excluded.operating_regions"),
        team_size: knex.ref("excluded.team_size"),
        founded_year: knex.ref("excluded.founded_year"),
        status: knex.ref("excluded.status"),
        updated_at: knex.fn.now(),
      });
  }

  await knex("users")
    .insert({
      id: dbUser.id,
      org_id: dbUser.org_id,
      firebase_uid: dbUser.firebase_uid,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      status: dbUser.status,
    })
    .onConflict("firebase_uid")
    .merge({
      org_id: knex.ref("excluded.org_id"),
      name: knex.ref("excluded.name"),
      email: knex.ref("excluded.email"),
      role: knex.ref("excluded.role"),
      status: knex.ref("excluded.status"),
      updated_at: knex.fn.now(),
    });
};

const run = async (mode) => {
  const auth = initializeFirebaseAdmin();
  const users = mode === "admin" ? [bootstrapAdmin] : firebaseSeedUsers;

  if (!users || users.length === 0) {
    throw new Error(`No users configured for bootstrap mode: ${mode}`);
  }

  for (const user of users) {
    await upsertFirebaseUser(auth, user);
    await upsertDbUser(user, { includeOrganizations: mode !== "admin" });
  }
};

const main = async () => {
  const mode = process.argv[2] || "demo";

  try {
    await run(mode);
    console.log(
      mode === "admin"
        ? "NIYOJAN admin bootstrap complete."
        : "NIYOJAN demo Firebase identity bootstrap complete.",
    );
  } finally {
    await knex.destroy();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
