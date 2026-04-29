import { db } from './src/config/db';
import { formTemplatesService } from './src/modules/formBuilder/formTemplates.service';

async function run() {
  const user = await db('users').where({ role: 'ngo_admin' }).first();
  if (!user) {
    console.log("No ngo admin found");
    process.exit(0);
  }

  const authUser = {
    id: user.id,
    orgId: user.org_id,
    firebaseUid: user.firebase_uid,
    name: user.name,
    email: user.email,
    role: user.role as any,
    status: user.status as any,
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };

  try {
    const template = await formTemplatesService.createTemplate({ name: "My Blank Template" }, authUser);
    console.log("Created successfully:", template);
  } catch (err) {
    console.error("Error creating template:", err);
  }

  process.exit(0);
}
run();