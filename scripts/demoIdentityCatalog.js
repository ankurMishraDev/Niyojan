const buildUuid = (prefix, index) =>
  `${prefix}-0000-4000-8000-${String(index).padStart(12, "0")}`;

const userId = (index) => buildUuid("10000000", index);
const volunteerId = (index) => buildUuid("70000000", index);
const volunteerSkillId = (index) => buildUuid("71000000", index);

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const ORG_C = "33333333-3333-4333-8333-333333333333";
const ORG_D = "44444444-4444-4444-8444-444444444444";
const ORG_E = "55555555-5555-4555-8555-555555555555";

const organizations = [
  { id: ORG_A, name: "HopeBridge Foundation", type: "NGO", region: "Bhopal Rural Belt", status: "active" },
  { id: ORG_B, name: "Seva Junction Trust", type: "NGO", region: "Indore Urban Fringe", status: "active" },
  { id: ORG_C, name: "Arogya Reach Collective", type: "NGO", region: "Vidisha Corridor", status: "active" },
  { id: ORG_D, name: "Udaan Relief Network", type: "NGO", region: "Sagar Relief Cluster", status: "active" },
  { id: ORG_E, name: "JanSahay Alliance", type: "NGO", region: "Narmadapuram Response Belt", status: "active" },
];

const orgRoster = [
  {
    orgId: ORG_A,
    ngoAdmin: {
      id: userId(2),
      firebase_uid: "firebase-ngo-admin-a-001",
      name: "Anita Sharma",
      email: "anita@hopebridge.demo",
      password: "Niyojan@1234",
      createFirebaseUser: true,
    },
    fieldWorker: {
      id: userId(3),
      firebase_uid: "firebase-field-worker-a-001",
      name: "Rahul Singh",
      email: "rahul@hopebridge.demo",
      password: "Niyojan@1234",
      createFirebaseUser: true,
    },
  },
  {
    orgId: ORG_B,
    ngoAdmin: {
      id: userId(6),
      firebase_uid: "firebase-ngo-admin-b-001",
      name: "Sara Khan",
      email: "sara@sevajunction.demo",
      password: "Niyojan@1234",
      createFirebaseUser: true,
    },
    fieldWorker: {
      id: userId(7),
      firebase_uid: "firebase-field-worker-b-001",
      name: "Dev Mehta",
      email: "dev@sevajunction.demo",
      password: "Niyojan@1234",
      createFirebaseUser: true,
    },
  },
  {
    orgId: ORG_C,
    ngoAdmin: {
      id: userId(8),
      firebase_uid: "firebase-ngo-admin-c-001",
      name: "Meera Joshi",
      email: "meera@arogyareach.demo",
      password: "Niyojan@1234",
      createFirebaseUser: true,
    },
    fieldWorker: {
      id: userId(9),
      firebase_uid: "firebase-field-worker-c-001",
      name: "Karan Verma",
      email: "karan@arogyareach.demo",
      password: "Niyojan@1234",
      createFirebaseUser: true,
    },
  },
  {
    orgId: ORG_D,
    ngoAdmin: {
      id: userId(10),
      firebase_uid: "firebase-ngo-admin-d-001",
      name: "Pooja Iyer",
      email: "pooja@udaanrelief.demo",
      password: "Niyojan@1234",
      createFirebaseUser: true,
    },
    fieldWorker: {
      id: userId(11),
      firebase_uid: "firebase-field-worker-d-001",
      name: "Lokesh Dubey",
      email: "lokesh@udaanrelief.demo",
      password: "Niyojan@1234",
      createFirebaseUser: true,
    },
  },
  {
    orgId: ORG_E,
    ngoAdmin: {
      id: userId(12),
      firebase_uid: "firebase-ngo-admin-e-001",
      name: "Farah Siddiqui",
      email: "farah@jansahay.demo",
      password: "Niyojan@1234",
      createFirebaseUser: true,
    },
    fieldWorker: {
      id: userId(13),
      firebase_uid: "firebase-field-worker-e-001",
      name: "Nitin Tiwari",
      email: "nitin@jansahay.demo",
      password: "Niyojan@1234",
      createFirebaseUser: true,
    },
  },
];

const skillIds = [
  "40000000-0000-4000-8000-000000000001",
  "40000000-0000-4000-8000-000000000003",
  "40000000-0000-4000-8000-000000000004",
  "40000000-0000-4000-8000-000000000005",
  "40000000-0000-4000-8000-000000000006",
  "40000000-0000-4000-8000-000000000008",
  "40000000-0000-4000-8000-000000000009",
  "40000000-0000-4000-8000-000000000012",
  "40000000-0000-4000-8000-000000000013",
  "40000000-0000-4000-8000-000000000017",
  "40000000-0000-4000-8000-000000000018",
  "40000000-0000-4000-8000-000000000019",
  "40000000-0000-4000-8000-000000000021",
  "40000000-0000-4000-8000-000000000022",
  "40000000-0000-4000-8000-000000000024",
];

const volunteerProfiles = [
  ["Priya Nair", "Ward 12, Bhopal", 23.2467, 77.4056],
  ["Arjun Patel", "Ward 8, Bhopal", 23.2599, 77.4126],
  ["Sneha Mishra", "Ayodhya Nagar, Bhopal", 23.2418, 77.4374],
  ["Rohit Jain", "Ashoka Garden, Bhopal", 23.2592, 77.4331],
  ["Neha Kulkarni", "Kolar Road, Bhopal", 23.1634, 77.4432],
  ["Vikas Parmar", "Kohefiza, Bhopal", 23.2581, 77.3702],
  ["Ayesha Qureshi", "LIG Colony, Bhopal", 23.2234, 77.4171],
  ["Sanjay Rao", "Berasia Road, Bhopal", 23.3042, 77.3907],
  ["Divya Soni", "Palasia, Indore", 22.7196, 75.8577],
  ["Harsh Tomar", "Vijay Nagar, Indore", 22.7533, 75.8937],
  ["Ritika Jain", "Rajendra Nagar, Indore", 22.6751, 75.8278],
  ["Faizan Ali", "Mhow Naka, Indore", 22.6983, 75.8434],
  ["Komal Dube", "Bhanwarkua, Indore", 22.6917, 75.8679],
  ["Kushagra Shah", "Annapurna, Indore", 22.7009, 75.8361],
  ["Sakshi Bhatia", "Lasudia, Indore", 22.7588, 75.9332],
  ["Irfan Mansoori", "MR-10, Indore", 22.7421, 75.9099],
  ["Aparna Gupta", "Vidisha Main, Vidisha", 23.5242, 77.8065],
  ["Gopal Tandon", "Lateri Road, Vidisha", 23.5301, 77.8124],
  ["Payal Dixit", "Kurwai Block, Vidisha", 23.6204, 78.0438],
  ["Hemant Yadav", "Shamshabad, Vidisha", 23.4088, 77.6662],
  ["Tanvi Solanki", "Ganj Basoda, Vidisha", 23.8512, 77.9404],
  ["Rakesh Ahirwar", "Sironj Link, Vidisha", 24.1105, 77.6884],
  ["Minal Rajput", "Nateran Belt, Vidisha", 23.4155, 77.7603],
  ["Zeeshan Pathan", "Lateri Village Cluster", 23.5608, 77.8901],
  ["Yamini Tiwari", "Civil Lines, Sagar", 23.8388, 78.7378],
  ["Anmol Jain", "Makronia, Sagar", 23.8319, 78.7151],
  ["Rehana Sheikh", "Banda Road, Sagar", 23.8664, 78.7948],
  ["Shubham Sen", "Khurai Route, Sagar", 24.0431, 78.3314],
  ["Pallavi Chouhan", "Rahli Sector, Sagar", 23.9002, 78.5709],
  ["Naved Khan", "Garhakota, Sagar", 23.7796, 78.5439],
  ["Bhavna Namdeo", "Bina Extension, Sagar", 24.2062, 78.1931],
  ["Prashant Lodhi", "Deori, Sagar", 23.3897, 79.0223],
  ["Isha Trivedi", "Narmadapuram South", 22.7532, 77.7201],
  ["Chirag Chandel", "Itarsi Station Belt", 22.6148, 77.7622],
  ["Asmita Saxena", "Sohagpur Road", 22.7007, 77.8714],
  ["Sameer Chaturvedi", "Babai Cluster", 22.7023, 77.9349],
  ["Rupal Rathore", "Pipariya Link", 22.7644, 78.3481],
  ["Naseem Sheikh", "Bankhedi Rural", 22.7817, 78.2061],
  ["Monika Sahu", "Semri Harchand", 22.6623, 77.8774],
  ["Aditya Raghuvanshi", "Kesla Range", 22.6711, 77.4962],
  ["Bhavesh Thakur", "Sarni Corridor", 22.0912, 78.1745],
  ["Garima Chaturvedi", "Timarni Belt", 22.3904, 77.3341],
];

const availabilityStatuses = ["available", "available", "part_time", "busy"];
const orgIdsForVolunteers = [ORG_A, ORG_B, ORG_C, ORG_D, ORG_E];

const existingVolunteerUsers = [
  {
    id: userId(4),
    org_id: ORG_A,
    firebase_uid: "firebase-volunteer-a-001",
    name: "Priya Nair",
    email: "priya@hopebridge.demo",
    role: "volunteer",
    status: "active",
  },
  {
    id: userId(5),
    org_id: ORG_A,
    firebase_uid: "firebase-volunteer-a-002",
    name: "Arjun Patel",
    email: "arjun@hopebridge.demo",
    role: "volunteer",
    status: "active",
  },
];

const extraVolunteerUsers = volunteerProfiles.slice(2).map((profile, index) => {
  const [name] = profile;
  const orgId = orgIdsForVolunteers[index % orgIdsForVolunteers.length];
  const normalized = name.toLowerCase().replace(/[^a-z]+/g, "");
  const qaLogin = index < 4;

  return {
    id: userId(14 + index),
    org_id: orgId,
    firebase_uid: qaLogin ? `firebase-volunteer-qa-${String(index + 1).padStart(3, "0")}` : `demo-volunteer-${String(index + 1).padStart(3, "0")}`,
    name,
    email: `${normalized}@niyojan-volunteer.demo`,
    role: "volunteer",
    status: "active",
    createFirebaseUser: qaLogin,
    password: qaLogin ? "Volunteer@1234" : undefined,
  };
});

const volunteerUsers = [...existingVolunteerUsers, ...extraVolunteerUsers];

const volunteerRecords = volunteerUsers.map((user, index) => {
  const locationProfile = volunteerProfiles[index];
  const orgId = user.org_id;
  return {
    id: volunteerId(index + 1),
    org_id: orgId,
    user_id: user.id,
    availability_status: availabilityStatuses[index % availabilityStatuses.length],
    location_text: locationProfile[1],
    latitude: locationProfile[2],
    longitude: locationProfile[3],
    is_active: true,
  };
});

const volunteerSkills = volunteerRecords.flatMap((volunteer, index) => {
  const skillA = skillIds[index % skillIds.length];
  const skillB = skillIds[(index + 3) % skillIds.length];
  const skillC = skillIds[(index + 7) % skillIds.length];
  return [
    { id: volunteerSkillId(index * 3 + 1), volunteer_id: volunteer.id, skill_id: skillA, proficiency: 3 + (index % 3) },
    { id: volunteerSkillId(index * 3 + 2), volunteer_id: volunteer.id, skill_id: skillB, proficiency: 2 + (index % 4) },
    { id: volunteerSkillId(index * 3 + 3), volunteer_id: volunteer.id, skill_id: skillC, proficiency: 4 },
  ];
});

const users = [
  {
    id: userId(1),
    org_id: null,
    firebase_uid: "niyojan-admin-001",
    name: "NIYOJAN Superadmin",
    email: "niyojanAdmin@gmail.com",
    role: "superadmin",
    status: "active",
    createFirebaseUser: true,
    password: "asdf@1234",
  },
  ...orgRoster.flatMap((entry) => [
    { ...entry.ngoAdmin, org_id: entry.orgId, role: "ngo_admin", status: "active" },
    { ...entry.fieldWorker, org_id: entry.orgId, role: "field_worker", status: "active" },
  ]),
  ...volunteerUsers,
];

const firebaseSeedUsers = users
  .filter((user) => user.createFirebaseUser)
  .map((user) => ({
    uid: user.firebase_uid,
    email: user.email,
    password: user.password,
    displayName: user.name,
    role: user.role,
    orgId: user.org_id || null,
    dbUserId: user.id,
  }));

const bootstrapAdmin = firebaseSeedUsers.find((user) => user.email === "niyojanAdmin@gmail.com");

module.exports = {
  ids: {
    ORG_A,
    ORG_B,
    ORG_C,
    ORG_D,
    ORG_E,
    USER_SUPERADMIN: userId(1),
    USER_NGO_ADMIN_A: userId(2),
    USER_FIELD_WORKER_A: userId(3),
    USER_VOLUNTEER_A1: userId(4),
    USER_VOLUNTEER_A2: userId(5),
    USER_NGO_ADMIN_B: userId(6),
  },
  seedOrganizations: organizations,
  seedUsers: users.map(({ createFirebaseUser, password, ...user }) => user),
  seedVolunteerUsers: volunteerUsers.map(({ createFirebaseUser, password, ...user }) => user),
  seedExtraVolunteers: volunteerRecords.slice(2),
  seedExtraVolunteerSkills: volunteerSkills.filter((entry) => Number(entry.id.slice(-3)) > 6),
  firebaseSeedUsers,
  bootstrapAdmin,
};
