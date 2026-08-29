/**
 * Seed data for the Internal Operations Portal.
 *
 * Satisfies the seed requirement in PLAN.md §11: 3+ departments, one user per
 * role, 4+ request types with varied form_schema, 3+ rooms, and sample tickets
 * in every status.
 *
 * The names, ticket titles, request types, and the 09:00-10:00 Meeting Room B
 * booking are deliberately IDENTICAL to the worked examples in API.md and the
 * mockup prompts in STITCH-PROMPTS.md, so the Stitch designs and the running
 * app tell the same story in the presentation (STITCH-PROMPTS.md §Notes).
 *
 * ----------------------------------------------------------------------------
 * THIS SCRIPT IS ADDITIVE. It never deletes.
 *
 * The database is a SHARED Neon instance with real teammate accounts in it, so
 * every write is an upsert keyed on something stable. Run it as many times as
 * you like; existing rows are updated in place and anything not described here
 * (including accounts your teammates registered by hand) is left alone.
 *
 * Run with:  npm run seed
 * ----------------------------------------------------------------------------
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma.js";

const SEED_PASSWORD = process.env.SEED_PASSWORD || "password123";

// ---------------------------------------------------------------------------
// helpers — every one of these is find-then-update-or-create, never delete
// ---------------------------------------------------------------------------

/**
 * Departments are matched CASE-INSENSITIVELY and renamed to the canonical form.
 *
 * This exists because the shared database already contains a department called
 * "hr" (lowercase) with a real user attached to it. A plain upsert on `name`
 * would treat "HR" as a different department and create a duplicate, orphaning
 * that user in the lowercase one. Matching loosely and normalising the name
 * keeps the existing row, its id, and its foreign keys intact.
 */
async function upsertDepartment(name) {
  const existing = await prisma.department.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });

  if (existing) {
    return existing.name === name
      ? existing
      : prisma.department.update({ where: { id: existing.id }, data: { name } });
  }

  return prisma.department.create({ data: { name } });
}

async function upsertUser({ email, firstname, lastname, role, departmentId, phone }) {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  return prisma.user.upsert({
    where: { email },
    // Re-running the seed must not silently reset a password someone changed,
    // but it SHOULD correct a role or department that drifted during testing.
    update: { firstname, lastname, role, departmentId, phone },
    create: { email, firstname, lastname, role, departmentId, phone, passwordHash },
  });
}

/** Rooms have no unique constraint on `name`, so match by name + location. */
async function upsertRoom({ name, location, capacity }) {
  const existing = await prisma.room.findFirst({ where: { name, location } });

  return existing
    ? prisma.room.update({ where: { id: existing.id }, data: { capacity } })
    : prisma.room.create({ data: { name, location, capacity } });
}

/** Request types are unique per department by name, but not at the DB level. */
async function upsertRequestType({ departmentId, name, description, formSchema, defaultAssigneeId }) {
  const existing = await prisma.requestType.findFirst({ where: { departmentId, name } });
  const data = { departmentId, name, description, formSchema, defaultAssigneeId };

  return existing
    ? prisma.requestType.update({ where: { id: existing.id }, data })
    : prisma.requestType.create({ data });
}

/**
 * Tickets have no natural key. Matching on title is good enough for demo data
 * and keeps the script safe: an existing ticket is left completely untouched,
 * so status changes you made while testing survive a re-seed.
 */
async function createTicketIfMissing({ title, ...rest }) {
  const existing = await prisma.ticket.findFirst({ where: { title } });
  if (existing) return { ticket: existing, created: false };

  const ticket = await prisma.ticket.create({ data: { title, ...rest } });
  return { ticket, created: true };
}

async function createBookingIfMissing({ roomId, userId, startTime, endTime }) {
  const existing = await prisma.roomBooking.findFirst({
    where: { roomId, startTime },
  });
  if (existing) return existing;

  return prisma.roomBooking.create({ data: { roomId, userId, startTime, endTime } });
}

/** Local-time helper so demo bookings always land on a sensible clock hour. */
function at(daysFromToday, hour, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hour, minute, 0, 0);
  return date;
}

// ---------------------------------------------------------------------------
// form_schema blueprints
//
// Between them these cover ALL EIGHT field types DynamicForm switches on:
// text, textarea, number, date, select, multiselect, checkbox, user_picker.
// That is deliberate — it means the create-ticket page can be demonstrated
// exercising every branch without anyone hand-writing JSON first.
// ---------------------------------------------------------------------------

/** Copied verbatim from API.md → GET /api/departments/:id/request-types. */
const RECRUIT_EMPLOYEE = [
  { key: "position", label: "Position title", type: "text", required: true, order: 1 },
  {
    key: "hiring_department",
    label: "Hiring department",
    type: "select",
    options: ["Engineering", "Sales", "Marketing", "Finance"],
    required: true,
    order: 2,
  },
  {
    key: "openings",
    label: "Number of openings",
    type: "number",
    validation: { min: 1, max: 20 },
    required: true,
    order: 3,
  },
  { key: "hiring_manager", label: "Hiring manager", type: "user_picker", required: true, order: 4 },
  { key: "target_start_date", label: "Target start date", type: "date", required: false, order: 5 },
  { key: "job_description", label: "Job description", type: "textarea", required: false, order: 6 },
];

/** Also verbatim from API.md. */
const TRAINING_SESSION = [
  { key: "course_name", label: "Course name", type: "text", required: true, order: 1 },
  { key: "preferred_date", label: "Preferred date", type: "date", required: true, order: 2 },
  {
    key: "attendees",
    label: "Expected attendees",
    type: "number",
    validation: { min: 1, max: 100 },
    required: true,
    order: 3,
  },
  {
    key: "location_preference",
    label: "Location",
    type: "select",
    options: ["On-site", "Virtual", "Off-site"],
    required: true,
    order: 4,
  },
];

/** Adds the `checkbox` type, which the two HR schemas above do not use. */
const HARDWARE_ISSUE = [
  {
    key: "device_type",
    label: "Device type",
    type: "select",
    options: ["Laptop", "Desktop", "Monitor", "Phone", "Printer", "Other"],
    required: true,
    order: 1,
  },
  {
    key: "asset_tag",
    label: "Asset tag",
    type: "text",
    validation: { maxLength: 32 },
    required: false,
    order: 2,
  },
  { key: "issue_description", label: "What is wrong", type: "textarea", required: true, order: 3 },
  { key: "blocking_work", label: "This is blocking my work", type: "checkbox", required: false, order: 4 },
];

/** Adds the `multiselect` type — the last of the eight. */
const ACCESS_REQUEST = [
  {
    key: "systems",
    label: "Systems needed",
    type: "multiselect",
    options: ["GitHub", "Jira", "Figma", "AWS Console", "Production DB", "VPN"],
    required: true,
    order: 1,
  },
  {
    key: "access_level",
    label: "Access level",
    type: "select",
    options: ["Read only", "Read and write", "Admin"],
    required: true,
    order: 2,
  },
  { key: "approving_manager", label: "Approving manager", type: "user_picker", required: true, order: 3 },
  {
    key: "duration_days",
    label: "Duration in days (blank = permanent)",
    type: "number",
    validation: { min: 1, max: 365 },
    required: false,
    order: 4,
  },
  { key: "justification", label: "Business justification", type: "textarea", required: true, order: 5 },
];

const MAINTENANCE_REQUEST = [
  { key: "location", label: "Location", type: "text", required: true, order: 1 },
  {
    key: "category",
    label: "Category",
    type: "select",
    options: ["Electrical", "Plumbing", "Furniture", "Air conditioning", "Cleaning"],
    required: true,
    order: 2,
  },
  { key: "description", label: "Describe the problem", type: "textarea", required: true, order: 3 },
  { key: "preferred_date", label: "Preferred date", type: "date", required: false, order: 4 },
  { key: "safety_risk", label: "This is a safety risk", type: "checkbox", required: false, order: 5 },
];

const EXPENSE_CLAIM = [
  {
    key: "amount",
    label: "Amount (THB)",
    type: "number",
    validation: { min: 1, max: 1000000 },
    required: true,
    order: 1,
  },
  {
    key: "category",
    label: "Category",
    type: "select",
    options: ["Travel", "Meals", "Equipment", "Training", "Other"],
    required: true,
    order: 2,
  },
  { key: "expense_date", label: "Date of expense", type: "date", required: true, order: 3 },
  { key: "notes", label: "Notes", type: "textarea", required: false, order: 4 },
];

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding — additive, nothing is deleted.\n");

  // -- departments ----------------------------------------------------------
  const [hr, it, facilities, finance, marketing] = await Promise.all(
    ["HR", "IT", "Facilities", "Finance", "Marketing"].map(upsertDepartment),
  );
  console.log(`departments  ${[hr, it, facilities, finance, marketing].map((d) => d.name).join(", ")}`);

  // -- users, one per role (PLAN.md §11) ------------------------------------
  // Names and emails match the user-management mockup in STITCH-PROMPTS.md.
  const purachaet = await upsertUser({
    email: "purachaet@company.com",
    firstname: "Purachaet",
    lastname: "Nakhonsri",
    role: "ADMIN_SYSTEM",
    departmentId: it.id,
    phone: "0812345678",
  });
  const nid = await upsertUser({
    email: "nid@company.com",
    firstname: "Nid",
    lastname: "Kanjana",
    role: "ADMIN_DEPT",
    departmentId: hr.id,
    phone: "0823456789",
  });
  const anucha = await upsertUser({
    email: "anucha@company.com",
    firstname: "Anucha",
    lastname: "Thongchai",
    role: "ADMIN_DEPT",
    departmentId: it.id,
    phone: "0834567890",
  });
  const somchai = await upsertUser({
    email: "somchai@company.com",
    firstname: "Somchai",
    lastname: "Prasert",
    role: "STAFF",
    departmentId: marketing.id,
    phone: "0845678901",
  });
  const wipa = await upsertUser({
    email: "wipa@company.com",
    firstname: "Wipa",
    lastname: "Sunthorn",
    role: "STAFF",
    departmentId: finance.id,
    phone: null,
  });
  const thanakorn = await upsertUser({
    email: "thanakorn@company.com",
    firstname: "Thanakorn",
    lastname: "Phumipat",
    role: "STAFF",
    departmentId: facilities.id,
    phone: null,
  });
  const somying = await upsertUser({
    email: "somying@company.com",
    firstname: "Somying",
    lastname: "Rattana",
    role: "STAFF",
    departmentId: hr.id,
    phone: null,
  });
  console.log("users        7 accounts (1 ADMIN_SYSTEM, 2 ADMIN_DEPT, 4 STAFF)");

  // -- request types --------------------------------------------------------
  const recruit = await upsertRequestType({
    departmentId: hr.id,
    name: "Recruit employee",
    description: "Open a new hiring req",
    defaultAssigneeId: nid.id,
    formSchema: RECRUIT_EMPLOYEE,
  });
  const training = await upsertRequestType({
    departmentId: hr.id,
    name: "Training session",
    description: "Request a workshop or course",
    defaultAssigneeId: null,
    formSchema: TRAINING_SESSION,
  });
  const hardware = await upsertRequestType({
    departmentId: it.id,
    name: "Hardware issue",
    description: "Broken or faulty equipment",
    defaultAssigneeId: anucha.id,
    formSchema: HARDWARE_ISSUE,
  });
  const access = await upsertRequestType({
    departmentId: it.id,
    name: "Access request",
    description: "Access to an internal system",
    defaultAssigneeId: anucha.id,
    formSchema: ACCESS_REQUEST,
  });
  const maintenance = await upsertRequestType({
    departmentId: facilities.id,
    name: "Maintenance request",
    description: "Something in the building needs fixing",
    defaultAssigneeId: null,
    formSchema: MAINTENANCE_REQUEST,
  });
  const expense = await upsertRequestType({
    departmentId: finance.id,
    name: "Expense reimbursement",
    description: "Claim back an approved expense",
    defaultAssigneeId: null,
    formSchema: EXPENSE_CLAIM,
  });
  console.log("requestTypes 6 types across 4 departments, all 8 field types covered");

  // -- rooms ----------------------------------------------------------------
  const [meetingA, meetingB, trainingRoom, boardRoom, focus1, focus2] = await Promise.all(
    [
      { name: "Meeting Room A", location: "Floor 2", capacity: 6 },
      { name: "Meeting Room B", location: "Floor 2", capacity: 10 },
      { name: "Training Room", location: "Floor 3", capacity: 24 },
      { name: "Board Room", location: "Floor 5", capacity: 14 },
      { name: "Focus Room 1", location: "Floor 2", capacity: 2 },
      { name: "Focus Room 2", location: "Floor 2", capacity: 2 },
    ].map(upsertRoom),
  );
  console.log("rooms        6 rooms on floors 2, 3 and 5");

  // -- tickets, one in every status (PLAN.md §6) ----------------------------
  // Titles and status/priority pairings come from the ticket-list mockup in
  // STITCH-PROMPTS.md, so the demo screen matches the design.
  const tickets = [
    {
      title: "New hire onboarding for marketing team",
      description: "Marketing needs a specialist to start before Q4 planning.",
      requestTypeId: recruit.id,
      status: "SUBMITTED",
      priority: "HIGH",
      createdById: somchai.id,
      assignedToId: nid.id,
      // Matches the worked example in API.md → GET /api/tickets/:id
      customFields: {
        position: "Marketing Specialist",
        hiring_department: "Marketing",
        openings: 2,
        hiring_manager: nid.id,
        target_start_date: "2026-10-01",
        job_description: "Own campaign delivery for the APAC region.",
      },
    },
    {
      title: "Excel workshop for finance team",
      description: "Advanced formulas and pivot tables.",
      requestTypeId: training.id,
      status: "UNDER_REVIEW",
      priority: "MEDIUM",
      createdById: wipa.id,
      assignedToId: nid.id,
      customFields: {
        course_name: "Advanced Excel for Finance",
        preferred_date: "2026-09-22",
        attendees: 12,
        location_preference: "On-site",
      },
    },
    {
      title: "Onboarding pack for 3 new analysts",
      description: "Laptops, badges and desk setup needed before their start date.",
      requestTypeId: recruit.id,
      status: "SUBMITTED",
      priority: "URGENT",
      createdById: thanakorn.id,
      assignedToId: null, // unassigned — renders as an em dash in the queue
      customFields: {
        position: "Business Analyst",
        hiring_department: "Finance",
        openings: 3,
        hiring_manager: nid.id,
      },
    },
    {
      title: "Leadership coaching sessions Q4",
      description: "External coach for the senior management group.",
      requestTypeId: training.id,
      status: "IN_PROGRESS",
      priority: "LOW",
      createdById: anucha.id,
      assignedToId: nid.id,
      customFields: {
        course_name: "Leadership Coaching",
        preferred_date: "2026-11-10",
        attendees: 8,
        location_preference: "Off-site",
      },
    },
    {
      title: "Replace resigned developer",
      description: "Backend developer left; the team is now one short.",
      requestTypeId: recruit.id,
      status: "IN_PROGRESS",
      priority: "HIGH",
      createdById: somying.id,
      assignedToId: anucha.id,
      customFields: {
        position: "Backend Developer",
        hiring_department: "Engineering",
        openings: 1,
        hiring_manager: anucha.id,
        target_start_date: "2026-09-30",
      },
    },
    {
      title: "First aid training for facilities",
      description: "Annual certification renewal.",
      requestTypeId: training.id,
      status: "RESOLVED",
      priority: "MEDIUM",
      createdById: somying.id,
      assignedToId: nid.id,
      customFields: {
        course_name: "First Aid Level 2",
        preferred_date: "2026-09-05",
        attendees: 15,
        location_preference: "On-site",
      },
    },
    {
      title: "Intern recruitment for Q1",
      description: "Six-month internship programme.",
      requestTypeId: recruit.id,
      status: "CLOSED",
      priority: "LOW",
      createdById: somchai.id,
      assignedToId: nid.id,
      customFields: {
        position: "Marketing Intern",
        hiring_department: "Marketing",
        openings: 4,
        hiring_manager: nid.id,
      },
    },
    {
      // The sixth status. Without this, REJECTED never appears in the demo.
      title: "Standing desk for every developer",
      description: "Requested for the whole engineering floor.",
      requestTypeId: hardware.id,
      status: "REJECTED",
      priority: "LOW",
      createdById: thanakorn.id,
      assignedToId: anucha.id,
      customFields: {
        device_type: "Other",
        asset_tag: "",
        issue_description: "Requesting standing desks for 24 developers.",
        blocking_work: false,
      },
    },
    {
      title: "VPN access for the new contractor",
      description: "Short-term access while the audit runs.",
      requestTypeId: access.id,
      status: "UNDER_REVIEW",
      priority: "MEDIUM",
      createdById: wipa.id,
      assignedToId: anucha.id,
      customFields: {
        systems: ["VPN", "Jira"],
        access_level: "Read only",
        approving_manager: anucha.id,
        duration_days: 90,
        justification: "External auditor needs read access for the Q3 review.",
      },
    },
    {
      title: "Air conditioning broken on floor 3",
      description: "Training Room is unusable in the afternoon.",
      requestTypeId: maintenance.id,
      status: "IN_PROGRESS",
      priority: "HIGH",
      createdById: somchai.id,
      assignedToId: null,
      customFields: {
        location: "Floor 3, Training Room",
        category: "Air conditioning",
        description: "Unit runs but blows warm air after about 30 minutes.",
        safety_risk: false,
      },
    },
  ];

  let createdTickets = 0;
  let firstTicket = null;
  for (const ticket of tickets) {
    const { ticket: row, created } = await createTicketIfMissing(ticket);
    if (created) createdTickets += 1;
    if (ticket.title === "New hire onboarding for marketing team") firstTicket = row;
  }
  console.log(
    `tickets      ${createdTickets} created, ${tickets.length - createdTickets} already existed ` +
      "(all 6 statuses, all 4 priorities)",
  );

  // -- comments on the flagship ticket --------------------------------------
  // The comments table is polymorphic: entityType + entityId, no DB-level FK
  // (PLAN.md §5). The service layer is what checks the entity exists.
  if (firstTicket) {
    const existingComments = await prisma.comment.count({
      where: { entityType: "ticket", entityId: firstTicket.id },
    });

    if (existingComments === 0) {
      await prisma.comment.createMany({
        data: [
          {
            entityType: "ticket",
            entityId: firstTicket.id,
            userId: somchai.id,
            text: "Job description is attached and ready for posting.",
          },
          {
            entityType: "ticket",
            entityId: firstTicket.id,
            userId: nid.id,
            text: "Thanks — I will review headcount with Finance before moving this forward.",
          },
        ],
      });
      console.log("comments     2 on the flagship ticket");
    } else {
      console.log("comments     already present, left alone");
    }
  }

  // -- room bookings --------------------------------------------------------
  // The 09:00-10:00 Meeting Room B booking is the one API.md uses in its
  // 409 ROOM_UNAVAILABLE example. Keep it: it is how you demo the conflict.
  await createBookingIfMissing({
    roomId: meetingB.id,
    userId: wipa.id,
    startTime: at(0, 9),
    endTime: at(0, 10),
  });
  await createBookingIfMissing({
    roomId: meetingB.id,
    userId: anucha.id,
    startTime: at(0, 14),
    endTime: at(0, 15, 30),
  });
  await createBookingIfMissing({
    roomId: meetingA.id,
    userId: somchai.id,
    startTime: at(0, 10),
    endTime: at(0, 11),
  });
  await createBookingIfMissing({
    roomId: trainingRoom.id,
    userId: nid.id,
    startTime: at(1, 13),
    endTime: at(1, 15),
  });
  await createBookingIfMissing({
    roomId: boardRoom.id,
    userId: purachaet.id,
    startTime: at(7, 10),
    endTime: at(7, 11, 30),
  });
  console.log("bookings     5 bookings, incl. the 09:00-10:00 Meeting Room B clash from API.md");

  // -- events ---------------------------------------------------------------
  const eventTitle = "Company town hall — Q3 results";
  let townHall = await prisma.event.findFirst({ where: { title: eventTitle } });
  if (!townHall) {
    townHall = await prisma.event.create({
      data: {
        title: eventTitle,
        description: "Quarterly results and the roadmap for Q4.",
        startTime: at(10, 14),
        endTime: at(10, 16),
        organizerId: purachaet.id,
        status: "APPROVE",
      },
    });
    await prisma.eventAttendee.createMany({
      data: [
        { eventId: townHall.id, userId: nid.id, rsvpStatus: "going" },
        { eventId: townHall.id, userId: somchai.id, rsvpStatus: "going" },
        { eventId: townHall.id, userId: wipa.id, rsvpStatus: "maybe" },
        { eventId: townHall.id, userId: thanakorn.id, rsvpStatus: "invited" },
      ],
      skipDuplicates: true,
    });
  }

  const socialTitle = "New joiner welcome lunch";
  const social = await prisma.event.findFirst({ where: { title: socialTitle } });
  if (!social) {
    const created = await prisma.event.create({
      data: {
        title: socialTitle,
        description: "Informal lunch for everyone who joined this quarter.",
        startTime: at(3, 12),
        endTime: at(3, 13, 30),
        organizerId: nid.id,
        status: "PENDING",
      },
    });
    await prisma.eventAttendee.createMany({
      data: [
        { eventId: created.id, userId: somying.id, rsvpStatus: "going" },
        { eventId: created.id, userId: anucha.id, rsvpStatus: "not_going" },
      ],
      skipDuplicates: true,
    });
  }
  console.log("events       2 events with attendees");

  // -- notifications --------------------------------------------------------
  // Unread ones so the bell badge shows a count during the demo.
  const notificationCount = await prisma.notification.count({ where: { userId: nid.id } });
  if (notificationCount === 0) {
    await prisma.notification.createMany({
      data: [
        { userId: nid.id, message: "Somchai Prasert submitted a new ticket" },
        { userId: nid.id, message: "Thanakorn Phumipat submitted an urgent ticket" },
        { userId: nid.id, message: "Somchai Prasert commented on a ticket you are assigned to" },
        { userId: anucha.id, message: "A hardware issue was assigned to you" },
        {
          userId: somchai.id,
          message: "Your ticket moved to UNDER_REVIEW",
          readAt: new Date(),
        },
      ],
    });
    console.log("notifications 5 (3 unread for nid@company.com)");
  } else {
    console.log("notifications already present, left alone");
  }

  // NOTE: no inventory seed. InventoryItem and InventoryRequest are not in
  // schema.prisma yet — see PLAN.md §4 for the models to add before Phase 2.

  console.log(`\nDone. Every seeded account uses the password: ${SEED_PASSWORD}`);
  console.log("Sign in as nid@company.com (ADMIN_DEPT, HR) for the best demo.\n");
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
