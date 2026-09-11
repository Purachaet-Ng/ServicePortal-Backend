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
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma.js";
// The statuses that occupy a resource, shared with both services and both
// exclusion constraints. Reused rather than restated — reservation.js calls out
// that this rule already lives in three places.
import { HOLDS_A_SLOT } from "../src/lib/reservation.js";

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

/**
 * rooms.name is @unique and citext, so the name alone is the key.
 *
 * This used to match on name + location, from when nothing stopped two rooms
 * sharing a name. Under the constraint that lookup is actively unsafe: move a
 * room to another floor from the admin page and the seed would no longer find
 * it, fall through to create, and die on the unique index — breaking the
 * promise at the top of this file that re-running is always safe.
 *
 * location is restored alongside capacity for the same reason it always was:
 * this is demo data, and a re-seed puts the documented values back.
 */
async function upsertRoom({ name, location, capacity }) {
  return prisma.room.upsert({
    where: { name },
    update: { location, capacity },
    create: { name, location, capacity },
  });
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

  if (existing) {
    // createdAt is the ONE field corrected on an existing ticket, and only
    // because the rule above is about status: what a re-seed must not undo is
    // work someone did while testing. Nobody edits a creation date by hand, and
    // leaving it alone defeats the point of declaring one — every ticket seeded
    // before these dates existed reads as minutes old, so the Age column shows
    // thirty-nine identical values and the list looks like a batch import.
    if (rest.createdAt && existing.createdAt.getTime() !== rest.createdAt.getTime()) {
      const ticket = await prisma.ticket.update({
        where: { id: existing.id },
        data: { createdAt: rest.createdAt },
      });
      return { ticket, created: false };
    }
    return { ticket: existing, created: false };
  }

  const ticket = await prisma.ticket.create({ data: { title, ...rest } });
  return { ticket, created: true };
}

/**
 * Skip a demo booking that is already here or would be refused — rooms and
 * cars alike.
 *
 * `delegate` is prisma.roomBooking or prisma.carBooking, following
 * cancelOwnBooking in src/lib/reservation.js: the two models are identical in
 * every field this touches, so passing the delegate is what keeps this one
 * function instead of two that drift.
 *
 * This used to match on resource + exact startTime, separately for each. That
 * breaks against a database holding bookings from an earlier run — every
 * seeded time is relative to TODAY (see `at`), so a row seeded on another day
 * never matches, the lookup falls through to create, and the insert dies on
 * room_bookings_no_overlap / car_bookings_no_overlap. Which is exactly what
 * happened: the seed had become un-re-runnable against its own past output,
 * breaking the promise at the top of this file.
 *
 * Two questions now, because they are genuinely different:
 *
 *   - is this seeded row already here?   same resource, same purpose
 *   - would inserting it be refused?     the constraint's own test — the same
 *                                        half-open comparison over the same
 *                                        HOLDS_A_SLOT statuses
 *
 * The second alone is not enough: a REJECTED trip holds no slot, so it can
 * never clash, and only the first stops it being re-created on every run.
 */
async function createReservationIfFree(delegate, resource, data) {
  const { startTime, endTime, purpose } = data;

  if (purpose) {
    const same = await delegate.findFirst({ where: { ...resource, purpose } });
    if (same) return same;
  }

  const clash = await delegate.findFirst({
    where: {
      ...resource,
      status: { in: HOLDS_A_SLOT },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });
  if (clash) return clash;

  return delegate.create({ data: { ...resource, ...data } });
}

const createBookingIfMissing = ({ roomId, ...data }) =>
  createReservationIfFree(prisma.roomBooking, { roomId }, data);

/** cars.plate is @unique, so the plate alone is the key — same shape as rooms. */
async function upsertCar({ name, plate, seats, location }) {
  return prisma.car.upsert({
    where: { plate },
    update: { name, seats, location },
    create: { name, plate, seats, location },
  });
}

/**
 * Same guard as rooms, and that is now literally true rather than merely
 * similar — see createReservationIfFree above.
 *
 * The old comment here said cars had no exclusion constraint "the way
 * room_bookings do". They have had one since migration 20260908150000
 * (car_bookings_no_overlap), which is what the trips below were colliding
 * with. The guard is the constraint's own test, so care is no longer the only
 * thing keeping them apart.
 */
const createCarBookingIfMissing = ({ carId, ...data }) =>
  createReservationIfFree(prisma.carBooking, { carId }, data);

/** inventory_items.sku is @unique, so the sku alone is the key. */
const upsertItem = (item) =>
  prisma.inventoryItem.upsert({ where: { sku: item.sku }, update: item, create: item });

/**
 * department_stocks has @@unique([departmentId, itemId]), but CENTRAL stock is
 * departmentId NULL and NULL never matches a unique lookup — which is exactly
 * why migration 20260910150000 carries a partial unique index instead
 * (department_stocks_central_item_key). So this is findFirst, not upsert:
 * `where: { departmentId: null }` compiles to IS NULL and handles both cases
 * down one path.
 */
async function upsertStock({ departmentId, itemId, onHand, minStock }) {
  const data = { onHand, minStock };
  const existing = await prisma.departmentStock.findFirst({ where: { departmentId, itemId } });

  return existing
    ? prisma.departmentStock.update({ where: { id: existing.id }, data })
    : prisma.departmentStock.create({ data: { departmentId, itemId, ...data } });
}

/**
 * `reserved` is DERIVED, never declared — which is why upsertStock above does
 * not take it.
 *
 * It started out as a literal beside onHand, and that quietly assumed the
 * request block below had run. It does not always: the block is skipped on a
 * database that already holds inventory requests, which left a reservation
 * with nothing behind it and failed the assert. Recomputing from the rows that
 * actually exist cannot drift — it is the same sum assertInventoryConsistent
 * checks, which is exactly the point.
 *
 * Only an APPROVED request or replenishment holds a reservation: PENDING has
 * not reserved yet, and FULFILLED, REJECTED and CANCELLED have all released.
 */
async function syncReserved(stocks) {
  for (const stock of stocks) {
    const [lines, replenishments] = await Promise.all([
      prisma.inventoryRequestLine.aggregate({
        _sum: { quantity: true },
        where: { stockId: stock.id, request: { status: "APPROVED" } },
      }),
      prisma.inventoryReplenishment.aggregate({
        _sum: { quantity: true },
        where: { sourceStockId: stock.id, status: "APPROVED" },
      }),
    ]);

    await prisma.departmentStock.update({
      where: { id: stock.id },
      data: { reserved: (lines._sum.quantity ?? 0) + (replenishments._sum.quantity ?? 0) },
    });
  }
}

/** inventory_assets.serial_no is @unique — the serial is the key. */
const upsertAsset = ({ serialNo, ...rest }) =>
  prisma.inventoryAsset.upsert({
    where: { serialNo },
    update: rest,
    create: { serialNo, ...rest },
  });

/**
 * The check that makes the hand-written balances below trustworthy.
 *
 * Two rules, both enforced by the service layer at runtime, neither enforced
 * by the schema:
 *
 *   1. updateBalance (inventory.service.js:55-67) refuses, in SQL, to let
 *      on_hand or reserved go negative or reserved exceed on_hand.
 *   2. For a SERIALIZED stock, onHand is exactly the number of its assets with
 *      status AVAILABLE — addAsset(+1), assignAsset(-1) and adjustAssetStatus
 *      (±1 across the AVAILABLE boundary) are the only things that move it, so
 *      ASSIGNED, IN_TRANSIT, MAINTENANCE and RETIRED all sit outside it.
 *
 * Seeded balances are literals, and literals drift the moment someone adds a
 * row. Without this, drift surfaces as a 409 INSUFFICIENT_STOCK three screens
 * into a demo; with it, the seed fails on the spot and says which stock.
 */
async function assertInventoryConsistent() {
  const stocks = await prisma.departmentStock.findMany({
    include: {
      item: true,
      department: true,
      assets: true,
      requestLines: { include: { request: true } },
      replenishments: true,
    },
  });

  for (const stock of stocks) {
    const where = `${stock.department?.name ?? "Central"} · ${stock.item.sku}`;

    assert.ok(stock.onHand >= 0, `${where}: onHand is negative (${stock.onHand})`);
    assert.ok(stock.reserved >= 0, `${where}: reserved is negative (${stock.reserved})`);
    assert.ok(
      stock.reserved <= stock.onHand,
      `${where}: reserved ${stock.reserved} exceeds onHand ${stock.onHand}`,
    );

    if (stock.item.isSerialized) {
      const available = stock.assets.filter((a) => a.status === "AVAILABLE").length;
      assert.equal(
        stock.onHand,
        available,
        `${where}: onHand is ${stock.onHand} but ${available} assets are AVAILABLE`,
      );
    }

    // Only an APPROVED request or replenishment holds a reservation. PENDING
    // has not reserved yet; FULFILLED, REJECTED and CANCELLED have released.
    const expected =
      stock.requestLines
        .filter((line) => line.request.status === "APPROVED")
        .reduce((total, line) => total + line.quantity, 0) +
      stock.replenishments
        .filter((row) => row.status === "APPROVED")
        .reduce((total, row) => total + row.quantity, 0);

    assert.equal(
      stock.reserved,
      expected,
      `${where}: reserved is ${stock.reserved} but APPROVED rows account for ${expected}`,
    );
  }
}

/**
 * A department whose name was typo'd anywhere above silently splits in two and
 * strands its users in the copy nothing else references. Cheap to catch here.
 *
 * Scoped to the five departments this script seeds, deliberately. A shared
 * database picks up empty leftovers from automated test runs ("Test
 * Department2"), and those are not this script's business — failing the seed
 * over one would block a run for a row the seed neither created nor claims
 * anything about. Unlike assertInventoryConsistent, which checks an invariant
 * the service layer maintains for EVERY row, "six users and three request
 * types" is only ever a claim about the seeded five.
 */
async function assertDepartmentsPopulated(seeded) {
  const departments = await prisma.department.findMany({
    where: { id: { in: seeded.map((department) => department.id) } },
    include: { users: true, requestTypes: true },
  });

  for (const department of departments) {
    assert.ok(
      department.users.length >= 5,
      `${department.name}: only ${department.users.length} users`,
    );
    assert.ok(
      department.users.some((user) => user.role === "ADMIN_DEPT"),
      `${department.name}: no ADMIN_DEPT, so nobody can approve anything in it`,
    );
    assert.ok(
      department.requestTypes.length >= 2,
      `${department.name}: only ${department.requestTypes.length} request types`,
    );
  }
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
// The nine schemas below bring every department up to three request types.
// They invent no new field type — all eight are already covered above, so
// nothing on the create-ticket page has to change to render any of them.
// ---------------------------------------------------------------------------

const LEAVE_REQUEST = [
  {
    key: "leave_type",
    label: "Type of leave",
    type: "select",
    options: ["Annual", "Sick", "Personal", "Unpaid", "Parental"],
    required: true,
    order: 1,
  },
  { key: "start_date", label: "First day away", type: "date", required: true, order: 2 },
  { key: "end_date", label: "Last day away", type: "date", required: true, order: 3 },
  {
    key: "days",
    label: "Working days",
    type: "number",
    validation: { min: 1, max: 90 },
    required: true,
    order: 4,
  },
  { key: "handover_to", label: "Covering for me", type: "user_picker", required: false, order: 5 },
  { key: "reason", label: "Reason", type: "textarea", required: false, order: 6 },
];

const SOFTWARE_INSTALL = [
  { key: "software_name", label: "Software", type: "text", required: true, order: 1 },
  {
    key: "machine_asset_tag",
    label: "Asset tag of the machine",
    type: "text",
    validation: { maxLength: 32 },
    required: false,
    order: 2,
  },
  {
    key: "urgency",
    label: "Urgency",
    type: "select",
    options: ["Low", "Normal", "High"],
    required: true,
    order: 3,
  },
  { key: "license_needed", label: "A paid licence is required", type: "checkbox", required: false, order: 4 },
  { key: "notes", label: "Anything else", type: "textarea", required: false, order: 5 },
];

const ROOM_SETUP = [
  { key: "room", label: "Room", type: "text", required: true, order: 1 },
  { key: "setup_date", label: "Date needed", type: "date", required: true, order: 2 },
  {
    key: "layout",
    label: "Layout",
    type: "select",
    options: ["Theatre", "Classroom", "U-shape", "Boardroom", "Banquet"],
    required: true,
    order: 3,
  },
  {
    key: "equipment",
    label: "Equipment",
    type: "multiselect",
    options: ["Projector", "Whiteboard", "Microphone", "Video conference", "Flipchart"],
    required: false,
    order: 4,
  },
  {
    key: "headcount",
    label: "Expected headcount",
    type: "number",
    validation: { min: 1, max: 200 },
    required: true,
    order: 5,
  },
  { key: "notes", label: "Notes for the team", type: "textarea", required: false, order: 6 },
];

const CLEANING_REQUEST = [
  { key: "area", label: "Area", type: "text", required: true, order: 1 },
  {
    key: "cleaning_type",
    label: "Type of clean",
    type: "select",
    options: ["Routine", "Deep clean", "Spill or urgent", "Post-event"],
    required: true,
    order: 2,
  },
  { key: "preferred_date", label: "Preferred date", type: "date", required: false, order: 3 },
  { key: "after_hours", label: "Must happen outside office hours", type: "checkbox", required: false, order: 4 },
  { key: "details", label: "Details", type: "textarea", required: true, order: 5 },
];

const PURCHASE_ORDER = [
  { key: "vendor", label: "Vendor", type: "text", required: true, order: 1 },
  { key: "item_description", label: "What is being bought", type: "textarea", required: true, order: 2 },
  {
    key: "amount",
    label: "Amount",
    type: "number",
    validation: { min: 1, max: 5000000 },
    required: true,
    order: 3,
  },
  {
    key: "currency",
    label: "Currency",
    type: "select",
    options: ["THB", "USD", "EUR"],
    required: true,
    order: 4,
  },
  { key: "needed_by", label: "Needed by", type: "date", required: false, order: 5 },
  { key: "approver", label: "Approving manager", type: "user_picker", required: true, order: 6 },
];

const BUDGET_APPROVAL = [
  { key: "budget_owner", label: "Budget owner", type: "user_picker", required: true, order: 1 },
  { key: "cost_centre", label: "Cost centre", type: "text", required: true, order: 2 },
  {
    key: "amount",
    label: "Amount (THB)",
    type: "number",
    validation: { min: 1, max: 10000000 },
    required: true,
    order: 3,
  },
  {
    key: "period",
    label: "Period",
    type: "select",
    options: ["Q1", "Q2", "Q3", "Q4"],
    required: true,
    order: 4,
  },
  { key: "justification", label: "Justification", type: "textarea", required: true, order: 5 },
];

const CAMPAIGN_BRIEF = [
  { key: "campaign_name", label: "Campaign name", type: "text", required: true, order: 1 },
  {
    key: "channels",
    label: "Channels",
    type: "multiselect",
    options: ["Facebook", "Instagram", "LINE", "Google Ads", "Email", "Print"],
    required: true,
    order: 2,
  },
  { key: "launch_date", label: "Launch date", type: "date", required: true, order: 3 },
  {
    key: "budget",
    label: "Budget (THB)",
    type: "number",
    validation: { min: 1000, max: 5000000 },
    required: true,
    order: 4,
  },
  { key: "target_audience", label: "Target audience", type: "textarea", required: true, order: 5 },
  { key: "needs_legal_review", label: "Needs legal review", type: "checkbox", required: false, order: 6 },
];

const DESIGN_ASSET = [
  {
    key: "asset_type",
    label: "Asset type",
    type: "select",
    options: ["Banner", "Social post", "Poster", "Brochure", "Video", "Logo lockup"],
    required: true,
    order: 1,
  },
  { key: "dimensions", label: "Dimensions or format", type: "text", required: false, order: 2 },
  { key: "deadline", label: "Deadline", type: "date", required: true, order: 3 },
  {
    key: "quantity",
    label: "How many variants",
    type: "number",
    validation: { min: 1, max: 50 },
    required: false,
    order: 4,
  },
  { key: "brief", label: "Brief", type: "textarea", required: true, order: 5 },
  { key: "brand_guidelines", label: "Follows brand guidelines", type: "checkbox", required: false, order: 6 },
];

const EVENT_SPONSORSHIP = [
  { key: "event_name", label: "Event", type: "text", required: true, order: 1 },
  { key: "event_date", label: "Event date", type: "date", required: true, order: 2 },
  {
    key: "sponsorship_tier",
    label: "Tier",
    type: "select",
    options: ["Platinum", "Gold", "Silver", "Bronze", "In-kind"],
    required: true,
    order: 3,
  },
  {
    key: "amount",
    label: "Amount (THB)",
    type: "number",
    validation: { min: 1, max: 2000000 },
    required: true,
    order: 4,
  },
  { key: "contact_person", label: "Our contact", type: "user_picker", required: true, order: 5 },
  {
    key: "expected_reach",
    label: "Expected reach",
    type: "number",
    validation: { min: 1, max: 1000000 },
    required: false,
    order: 6,
  },
  { key: "rationale", label: "Why this event", type: "textarea", required: true, order: 7 },
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

  // One ADMIN_DEPT per department. Marketing, Finance and Facilities had none
  // before this, which meant nobody could approve anything in them: three of
  // the five departments could not demonstrate an approval at all. These three
  // are bound to consts because the request types below assign work to them.
  const malee = await upsertUser({
    email: "malee@company.com",
    firstname: "Malee",
    lastname: "Suwanna",
    role: "ADMIN_DEPT",
    departmentId: marketing.id,
    phone: "0856789012",
  });
  const surasak = await upsertUser({
    email: "surasak@company.com",
    firstname: "Surasak",
    lastname: "Chotirat",
    role: "ADMIN_DEPT",
    departmentId: finance.id,
    phone: "0867890123",
  });
  const boonmee = await upsertUser({
    email: "boonmee@company.com",
    firstname: "Boonmee",
    lastname: "Kaewsai",
    role: "ADMIN_DEPT",
    departmentId: facilities.id,
    phone: "0878901234",
  });

  // Plain STAFF, four per department, padding every department out to six
  // people. A department dropdown with one name in it reads as a prototype.
  // These are a table rather than twenty more const bindings — only the ones
  // referenced by tickets or inventory rows below need a name, and those are
  // reachable through `staff` by first name.
  const EXTRA_STAFF = [
    ["Krit", "Wongsawat", it],
    ["Natthapong", "Sirichai", it],
    ["Siriwan", "Boonrueang", it],
    ["Ekkachai", "Meesap", it],
    ["Pensri", "Chaiyaphum", hr],
    ["Wanida", "Klahan", hr],
    ["Chaiwat", "Ruangsri", hr],
    ["Suphap", "Intira", hr],
    ["Pornthip", "Wattana", marketing],
    ["Jirawat", "Saelim", marketing],
    ["Kanya", "Thepsiri", marketing],
    ["Teerapat", "Ngamdee", marketing],
    ["Duangjai", "Phanit", finance],
    ["Apichart", "Rungroj", finance],
    ["Nuchanart", "Somsri", finance],
    ["Phongsak", "Kiatkul", finance],
    ["Sarawut", "Jaidee", facilities],
    ["Ratchanee", "Phonlap", facilities],
    ["Wichai", "Tansiri", facilities],
    ["Prasit", "Buakhao", facilities],
  ];

  const staff = {};
  for (const [firstname, lastname, department] of EXTRA_STAFF) {
    const key = firstname.toLowerCase();
    staff[key] = await upsertUser({
      email: `${key}@company.com`,
      firstname,
      lastname,
      role: "STAFF",
      departmentId: department.id,
      phone: null,
    });
  }
  console.log("users        30 accounts, 6 per department (1 ADMIN_SYSTEM, 5 ADMIN_DEPT, 24 STAFF)");

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

  // Three per department. Marketing had none at all before this, so picking it
  // on the create-ticket page produced an empty second dropdown and a dead end.
  // Every default assignee is that department's own ADMIN_DEPT — that is what
  // actually routes work to the three admins added above.
  const leave = await upsertRequestType({
    departmentId: hr.id,
    name: "Leave request",
    description: "Book annual, sick or unpaid leave",
    defaultAssigneeId: nid.id,
    formSchema: LEAVE_REQUEST,
  });
  const software = await upsertRequestType({
    departmentId: it.id,
    name: "Software installation",
    description: "Install or licence software on a company machine",
    defaultAssigneeId: anucha.id,
    formSchema: SOFTWARE_INSTALL,
  });
  const roomSetup = await upsertRequestType({
    departmentId: facilities.id,
    name: "Room setup request",
    description: "Furniture and equipment laid out before a session",
    defaultAssigneeId: boonmee.id,
    formSchema: ROOM_SETUP,
  });
  const cleaning = await upsertRequestType({
    departmentId: facilities.id,
    name: "Cleaning request",
    description: "Routine, deep or urgent cleaning",
    defaultAssigneeId: boonmee.id,
    formSchema: CLEANING_REQUEST,
  });
  const purchaseOrder = await upsertRequestType({
    departmentId: finance.id,
    name: "Purchase order",
    description: "Raise a PO against a vendor",
    defaultAssigneeId: surasak.id,
    formSchema: PURCHASE_ORDER,
  });
  const budget = await upsertRequestType({
    departmentId: finance.id,
    name: "Budget approval",
    description: "Approve spend against a cost centre",
    defaultAssigneeId: surasak.id,
    formSchema: BUDGET_APPROVAL,
  });
  const campaign = await upsertRequestType({
    departmentId: marketing.id,
    name: "Campaign brief",
    description: "Kick off a new marketing campaign",
    defaultAssigneeId: malee.id,
    formSchema: CAMPAIGN_BRIEF,
  });
  const designAsset = await upsertRequestType({
    departmentId: marketing.id,
    name: "Design asset request",
    description: "Artwork for a channel or event",
    defaultAssigneeId: malee.id,
    formSchema: DESIGN_ASSET,
  });
  const sponsorship = await upsertRequestType({
    departmentId: marketing.id,
    name: "Event sponsorship",
    description: "Sponsor an external event",
    defaultAssigneeId: malee.id,
    formSchema: EVENT_SPONSORSHIP,
  });
  console.log("requestTypes 15 types, 3 per department, all 8 field types covered");

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

  // -- cars ------------------------------------------------------------------
  const [commuter, fortuner, city, dmax] = await Promise.all(
    [
      { name: "Toyota Commuter", plate: "ฮค-4488", seats: 12, location: "Basement B1" },
      { name: "Toyota Fortuner", plate: "กข-1234", seats: 7, location: "Basement B1" },
      { name: "Honda City", plate: "ขค-5678", seats: 5, location: "Basement B2" },
      { name: "Isuzu D-Max", plate: "งจ-3456", seats: 4, location: "Loading bay" },
    ].map(upsertCar),
  );
  console.log("cars         4 vehicles, plates in Thai (the mixed-script case)");

  // -- car bookings ----------------------------------------------------------
  //
  // A CAR BOOKING IS A TRIP, NOT A MEETING. That is the whole difference from
  // room bookings above, and it is why the Cars page draws a range of days
  // where the Rooms page draws one day of hours: a van goes to the provinces on
  // Monday and comes back on Thursday, and the useful question is "which DAYS
  // is it out", not "which hour".
  //
  // Seed data has to say that, or the screen gets designed against the wrong
  // shape — which is exactly what happened when these rows were hand-made and
  // every one of them was a 3-hour errand.
  //
  // The set below is deliberate, one row per case the grid has to survive:
  await createCarBookingIfMissing({
    carId: commuter.id,
    userId: nid.id,
    startTime: at(1, 8),
    endTime: at(3, 18),
    status: "APPROVED",
    purpose: "Site visit — Rayong plant",
  });
  await createCarBookingIfMissing({
    carId: fortuner.id,
    userId: anucha.id,
    startTime: at(5, 8),
    endTime: at(11, 17),
    status: "APPROVED",
    purpose: "Upcountry dealer tour — Chiang Mai and Lampang",
  });
  // Pending, so the grid has something to draw hatched. A pending trip is
  // occupied space, not free space.
  await createCarBookingIfMissing({
    carId: city.id,
    userId: somchai.id,
    startTime: at(2, 9),
    endTime: at(3, 17),
    status: "PENDING",
    purpose: "Client meetings in Ayutthaya",
  });
  // The short one. Cars are mostly multi-day, but not always, and a half-day
  // errand still has to render inside its single column rather than vanish.
  await createCarBookingIfMissing({
    carId: dmax.id,
    userId: thanakorn.id,
    startTime: at(0, 9),
    endTime: at(0, 16),
    status: "APPROVED",
    purpose: "Collect server hardware from the supplier",
  });
  // Straddles the month boundary in most months. The availability endpoint is
  // keyed by MONTH (getCarbookingByDay), so this is the row that proves a
  // window crossing 1st-of-month still draws whole.
  await createCarBookingIfMissing({
    carId: city.id,
    userId: wipa.id,
    startTime: at(20, 8),
    endTime: at(26, 18),
    status: "APPROVED",
    purpose: "Regional audit, four provinces",
  });
  // Rejected, and therefore FREE space. If this ever draws, the grid is lying.
  await createCarBookingIfMissing({
    carId: dmax.id,
    userId: somying.id,
    startTime: at(4, 8),
    endTime: at(6, 18),
    status: "REJECTED",
    purpose: "Move office furniture to the new branch",
    // The only seeded rejection, and now the only row that demonstrates a
    // requester being told WHY. Without it the rejected branch on the detail
    // page renders an empty box.
    rejectionReason: "The D-Max is booked for the plant delivery those days. Try the Fortuner, or move to the following week.",
  });
  // More trips, spread over five weeks either side of today, so the grid has
  // something on most columns instead of four blocks clustered on this week.
  //
  // Same rule as the six above: nothing on the same car may overlap. Worth
  // checking by eye per plate, because a REJECTED row holds no slot and so does
  // not protect the days it covers — the D-Max rows below sit either side of
  // the rejected one on purpose.
  const MORE_TRIPS = [
    // car        from-day  to-day  status       driver            purpose
    [commuter,      -14, 8,  -12, 18, "APPROVED", staff.pensri,   "Staff outing — Hua Hin"],
    [commuter,        8, 7,    9, 20, "APPROVED", staff.suphap,   "Airport runs for the visiting auditors"],
    [commuter,       14, 7,   16, 19, "PENDING",  nid,            "Team building trip — Kanchanaburi"],
    [fortuner,       -6, 8,   -5, 17, "APPROVED", staff.apichart, "Supplier visit — Samut Prakan"],
    [fortuner,        0, 9,    0, 12, "APPROVED", staff.nuchanart,"Bank and revenue department errands"],
    [fortuner,       13, 8,   15, 18, "PENDING",  malee,          "Trade show setup — Chonburi"],
    [city,           -9, 9,   -9, 16, "APPROVED", staff.kanya,    "Client pitch — Silom"],
    [city,            5, 8,    6, 18, "APPROVED", staff.jirawat,  "Provincial office visit — Nakhon Pathom"],
    [dmax,           12, 8,   14, 17, "APPROVED", boonmee,        "Deliver furniture to the new branch"],
    [dmax,          -11, 8,  -10, 16, "APPROVED", staff.sarawut,  "Collect replacement air-conditioning units"],
  ];

  for (const [car, fromDay, fromH, toDay, toH, status, driver, purpose] of MORE_TRIPS) {
    await createCarBookingIfMissing({
      carId: car.id,
      userId: driver.id,
      startTime: at(fromDay, fromH),
      endTime: at(toDay, toH),
      status,
      purpose,
    });
  }
  console.log(`carBookings  ${6 + MORE_TRIPS.length} trips over ~5 weeks: multi-day, same-day, 2 pending, 1 rejected (must not draw)`);

  // -- tickets, one in every status (PLAN.md §6) ----------------------------
  // Titles and status/priority pairings come from the ticket-list mockup in
  // STITCH-PROMPTS.md, so the demo screen matches the design.
  const tickets = [
    {
      title: "New hire onboarding for marketing team",
      createdAt: at(0, 9, 15),
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
      createdAt: at(-2, 14),
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
      createdAt: at(0, 8, 40),
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
      createdAt: at(-9, 11),
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
      createdAt: at(-15, 10, 30),
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
      createdAt: at(-26, 9),
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
      createdAt: at(-47, 15),
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
      createdAt: at(-33, 16, 20),
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
      createdAt: at(-4, 13, 45),
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
      createdAt: at(-6, 8, 10),
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

  // The ten above are the documented ones — titles and status/priority pairings
  // come from the mockups, so they stay first and stay exactly as they are.
  //
  // These twenty-six are volume. A ten-row list demonstrates that the table
  // works; it does not show what the table looks like in use, which is what a
  // recording is for. They spread across all five departments and all fifteen
  // request types, and their createdAt spans a few hours to eleven weeks so the
  // Age column reads like a real backlog instead of a batch import.
  tickets.push(
    // -- HR ------------------------------------------------------------------
    {
      title: "Annual leave — Songkran week",
      description: "Taking the full week, back on the Monday after.",
      requestTypeId: leave.id,
      status: "SUBMITTED",
      priority: "LOW",
      createdById: staff.pensri.id,
      assignedToId: nid.id,
      createdAt: at(-3, 9, 20),
      customFields: {
        leave_type: "Annual",
        start_date: "2026-04-12",
        end_date: "2026-04-16",
        days: 5,
        handover_to: staff.wanida.id,
        reason: "Family trip, booked last year.",
      },
    },
    {
      title: "Sick leave — medical certificate attached",
      description: "Two days off, certificate from the clinic.",
      requestTypeId: leave.id,
      status: "RESOLVED",
      priority: "MEDIUM",
      createdById: staff.chaiwat.id,
      assignedToId: nid.id,
      createdAt: at(-24, 8, 5),
      customFields: {
        leave_type: "Sick",
        start_date: "2026-08-18",
        end_date: "2026-08-19",
        days: 2,
        reason: "Food poisoning.",
      },
    },
    {
      title: "Hire two QA engineers",
      description: "Testing is the bottleneck on every release.",
      requestTypeId: recruit.id,
      status: "IN_PROGRESS",
      priority: "HIGH",
      createdById: anucha.id,
      assignedToId: nid.id,
      createdAt: at(-17, 10, 45),
      customFields: {
        position: "QA Engineer",
        hiring_department: "Engineering",
        openings: 2,
        hiring_manager: anucha.id,
        target_start_date: "2026-11-03",
        job_description: "Manual and automated testing across the portal.",
      },
    },
    {
      title: "Thai language course for expat staff",
      description: "Weekly evening classes, ten weeks.",
      requestTypeId: training.id,
      status: "RESOLVED",
      priority: "LOW",
      createdById: staff.suphap.id,
      assignedToId: nid.id,
      createdAt: at(-29, 13, 30),
      customFields: {
        course_name: "Conversational Thai for Beginners",
        preferred_date: "2026-10-05",
        attendees: 6,
        location_preference: "On-site",
      },
    },
    // -- IT ------------------------------------------------------------------
    {
      title: "Adobe Creative Cloud for the design team",
      description: "Three seats, annual billing.",
      requestTypeId: software.id,
      status: "UNDER_REVIEW",
      priority: "MEDIUM",
      createdById: staff.pornthip.id,
      assignedToId: anucha.id,
      createdAt: at(-5, 11, 15),
      customFields: {
        software_name: "Adobe Creative Cloud",
        machine_asset_tag: "AST-1102",
        urgency: "Normal",
        license_needed: true,
        notes: "Existing seats expire at the end of the month.",
      },
    },
    {
      title: "Install Docker Desktop on the dev laptops",
      description: "Four machines, licence already covered.",
      requestTypeId: software.id,
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      createdById: staff.krit.id,
      assignedToId: anucha.id,
      createdAt: at(-12, 9, 50),
      customFields: {
        software_name: "Docker Desktop",
        urgency: "Normal",
        license_needed: false,
        notes: "Needed before the container workshop.",
      },
    },
    {
      title: "Figma licence for two new designers",
      description: "Both start on Monday.",
      requestTypeId: software.id,
      status: "SUBMITTED",
      priority: "HIGH",
      createdById: malee.id,
      assignedToId: anucha.id,
      createdAt: at(-1, 16, 10),
      customFields: {
        software_name: "Figma Professional",
        urgency: "High",
        license_needed: true,
        notes: "Two seats on the existing team plan.",
      },
    },
    {
      title: "Monitor flickering on the 2nd floor",
      description: "Intermittent, worse in the afternoon.",
      requestTypeId: hardware.id,
      status: "IN_PROGRESS",
      priority: "LOW",
      createdById: staff.siriwan.id,
      assignedToId: anucha.id,
      createdAt: at(-11, 14, 25),
      customFields: {
        device_type: "Monitor",
        asset_tag: "AST-2101",
        issue_description: "Screen flickers every few minutes, cable reseated already.",
        blocking_work: false,
      },
    },
    {
      title: "Printer jams constantly — Floor 3",
      description: "Roughly every third job.",
      requestTypeId: hardware.id,
      status: "SUBMITTED",
      priority: "MEDIUM",
      createdById: staff.ratchanee.id,
      assignedToId: null,
      createdAt: at(-2, 10, 5),
      customFields: {
        device_type: "Printer",
        asset_tag: "",
        issue_description: "Paper jams in the lower tray on most double-sided jobs.",
        blocking_work: true,
      },
    },
    {
      title: "AWS Console access for the new DevOps hire",
      description: "Read and write on the staging account.",
      requestTypeId: access.id,
      status: "UNDER_REVIEW",
      priority: "HIGH",
      createdById: staff.natthapong.id,
      assignedToId: anucha.id,
      createdAt: at(-5, 15, 40),
      customFields: {
        systems: ["AWS Console", "GitHub", "VPN"],
        access_level: "Read and write",
        approving_manager: anucha.id,
        duration_days: null,
        justification: "Owns the deployment pipeline from next sprint.",
      },
    },
    {
      title: "Production database read access for the audit",
      description: "Read only, for the duration of the audit.",
      requestTypeId: access.id,
      status: "REJECTED",
      priority: "URGENT",
      createdById: staff.duangjai.id,
      assignedToId: anucha.id,
      createdAt: at(-38, 11, 55),
      customFields: {
        systems: ["Production DB"],
        access_level: "Read only",
        approving_manager: purachaet.id,
        duration_days: 30,
        justification: "External auditor asked for direct query access.",
      },
    },
    // -- Facilities ----------------------------------------------------------
    {
      title: "Board Room setup for the quarterly review",
      description: "Boardroom layout, video conference kit needed.",
      requestTypeId: roomSetup.id,
      status: "SUBMITTED",
      priority: "HIGH",
      createdById: purachaet.id,
      assignedToId: boonmee.id,
      createdAt: at(-2, 9, 35),
      customFields: {
        room: "Board Room",
        setup_date: "2026-09-18",
        layout: "Boardroom",
        equipment: ["Projector", "Video conference", "Whiteboard"],
        headcount: 14,
        notes: "Please set up the evening before.",
      },
    },
    {
      title: "Training Room — classroom layout for onboarding",
      description: "Twenty-four desks, projector and flipchart.",
      requestTypeId: roomSetup.id,
      status: "RESOLVED",
      priority: "MEDIUM",
      createdById: nid.id,
      assignedToId: boonmee.id,
      createdAt: at(-19, 8, 45),
      customFields: {
        room: "Training Room",
        setup_date: "2026-08-24",
        layout: "Classroom",
        equipment: ["Projector", "Flipchart"],
        headcount: 24,
      },
    },
    {
      title: "Deep clean of the 3rd floor pantry",
      description: "Fridge and microwave included.",
      requestTypeId: cleaning.id,
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      createdById: staff.wichai.id,
      assignedToId: boonmee.id,
      createdAt: at(-7, 12, 20),
      customFields: {
        area: "Floor 3 pantry",
        cleaning_type: "Deep clean",
        preferred_date: "2026-09-14",
        after_hours: true,
        details: "Fridge has not been cleared since June. Microwave needs degreasing.",
      },
    },
    {
      title: "Urgent — coffee spill in Meeting Room A",
      description: "Carpet, before the afternoon meeting.",
      requestTypeId: cleaning.id,
      status: "CLOSED",
      priority: "URGENT",
      createdById: somchai.id,
      assignedToId: boonmee.id,
      createdAt: at(-31, 10, 15),
      customFields: {
        area: "Meeting Room A",
        cleaning_type: "Spill or urgent",
        after_hours: false,
        details: "Full cup of coffee on the carpet by the window.",
      },
    },
    {
      title: "Broken door handle — Meeting Room B",
      description: "Handle comes off in your hand.",
      requestTypeId: maintenance.id,
      status: "CLOSED",
      priority: "MEDIUM",
      createdById: staff.sarawut.id,
      assignedToId: boonmee.id,
      createdAt: at(-41, 9, 5),
      customFields: {
        location: "Floor 2, Meeting Room B",
        category: "Furniture",
        description: "Interior handle is loose and detaches when pulled.",
        safety_risk: false,
      },
    },
    {
      title: "Leaking tap in the 2nd floor washroom",
      description: "Constant drip overnight.",
      requestTypeId: maintenance.id,
      status: "SUBMITTED",
      priority: "LOW",
      createdById: staff.prasit.id,
      assignedToId: boonmee.id,
      createdAt: at(-1, 8, 25),
      customFields: {
        location: "Floor 2 washroom",
        category: "Plumbing",
        description: "Hot tap drips continuously even when fully closed.",
        preferred_date: "2026-09-15",
        safety_risk: false,
      },
    },
    {
      title: "Emergency light failed on the fire stairs",
      description: "Flagged by the safety walkthrough.",
      requestTypeId: maintenance.id,
      status: "IN_PROGRESS",
      priority: "URGENT",
      createdById: boonmee.id,
      assignedToId: boonmee.id,
      createdAt: at(-8, 17, 30),
      customFields: {
        location: "North stairwell, floors 3 to 5",
        category: "Electrical",
        description: "Emergency light does not come on during the drill test.",
        safety_risk: true,
      },
    },
    // -- Finance -------------------------------------------------------------
    {
      title: "PO for 10 replacement laptops",
      description: "Standard developer spec, existing vendor.",
      requestTypeId: purchaseOrder.id,
      status: "UNDER_REVIEW",
      priority: "HIGH",
      createdById: anucha.id,
      assignedToId: surasak.id,
      createdAt: at(-9, 14, 50),
      customFields: {
        vendor: "SiamTech Solutions",
        item_description: "10 × Laptop 14\", 32GB RAM, 1TB SSD, three-year warranty.",
        amount: 780000,
        currency: "THB",
        needed_by: "2026-10-15",
        approver: purachaet.id,
      },
    },
    {
      title: "Annual subscription renewal — accounting software",
      description: "Same tier as last year.",
      requestTypeId: purchaseOrder.id,
      status: "CLOSED",
      priority: "MEDIUM",
      createdById: staff.nuchanart.id,
      assignedToId: surasak.id,
      createdAt: at(-52, 10, 40),
      customFields: {
        vendor: "AccountPro Asia",
        item_description: "Annual licence renewal, 12 seats.",
        amount: 4200,
        currency: "USD",
        needed_by: "2026-09-30",
        approver: surasak.id,
      },
    },
    {
      title: "Q4 marketing budget sign-off",
      description: "Campaign spend for the final quarter.",
      requestTypeId: budget.id,
      status: "SUBMITTED",
      priority: "HIGH",
      createdById: malee.id,
      assignedToId: surasak.id,
      createdAt: at(-4, 11, 10),
      customFields: {
        budget_owner: malee.id,
        cost_centre: "MKT-2026-Q4",
        amount: 1500000,
        period: "Q4",
        justification: "Year-end campaign plus the trade show booth.",
      },
    },
    {
      title: "Additional headcount budget for IT",
      description: "Two engineers beyond the approved plan.",
      requestTypeId: budget.id,
      status: "REJECTED",
      priority: "MEDIUM",
      createdById: anucha.id,
      assignedToId: surasak.id,
      createdAt: at(-21, 15, 20),
      customFields: {
        budget_owner: anucha.id,
        cost_centre: "IT-2026-HC",
        amount: 2400000,
        period: "Q4",
        justification: "Support load has doubled since the portal launched.",
      },
    },
    {
      title: "Travel reimbursement — Chiang Mai dealer tour",
      description: "Four nights, receipts attached.",
      requestTypeId: expense.id,
      status: "IN_PROGRESS",
      priority: "LOW",
      createdById: staff.apichart.id,
      assignedToId: surasak.id,
      createdAt: at(-13, 16, 35),
      customFields: {
        amount: 18600,
        category: "Travel",
        expense_date: "2026-08-28",
        notes: "Hotel and fuel for the upcountry dealer visits.",
      },
    },
    // -- Marketing -----------------------------------------------------------
    {
      title: "Songkran promotion campaign",
      description: "Two-week run across social and print.",
      requestTypeId: campaign.id,
      status: "IN_PROGRESS",
      priority: "HIGH",
      createdById: staff.jirawat.id,
      assignedToId: malee.id,
      createdAt: at(-14, 10, 55),
      customFields: {
        campaign_name: "Songkran 2026",
        channels: ["Facebook", "Instagram", "LINE", "Print"],
        launch_date: "2026-04-01",
        budget: 850000,
        target_audience: "Domestic customers aged 25–44 in Bangkok and the central provinces.",
        needs_legal_review: true,
      },
    },
    {
      title: "Year-end customer appreciation campaign",
      description: "Email and LINE, existing customers only.",
      requestTypeId: campaign.id,
      status: "SUBMITTED",
      priority: "MEDIUM",
      createdById: staff.kanya.id,
      assignedToId: malee.id,
      createdAt: at(0, 11, 30),
      customFields: {
        campaign_name: "Thank You 2026",
        channels: ["Email", "LINE"],
        launch_date: "2026-12-01",
        budget: 320000,
        target_audience: "Customers who purchased at least twice this year.",
        needs_legal_review: false,
      },
    },
    {
      title: "Booth banners for the trade show",
      description: "Three roll-up banners plus a backdrop.",
      requestTypeId: designAsset.id,
      status: "UNDER_REVIEW",
      priority: "HIGH",
      createdById: staff.teerapat.id,
      assignedToId: malee.id,
      createdAt: at(-6, 13, 15),
      customFields: {
        asset_type: "Banner",
        dimensions: "850 × 2000 mm roll-up, 3 m backdrop",
        deadline: "2026-09-26",
        quantity: 4,
        brief: "Match the Songkran campaign look, English and Thai on separate banners.",
        brand_guidelines: true,
      },
    },
    {
      title: "Social media pack for the product launch",
      description: "Square, story and banner sizes.",
      requestTypeId: designAsset.id,
      status: "RESOLVED",
      priority: "MEDIUM",
      createdById: staff.pornthip.id,
      assignedToId: malee.id,
      createdAt: at(-23, 9, 40),
      customFields: {
        asset_type: "Social post",
        dimensions: "1080×1080, 1080×1920, 1200×628",
        deadline: "2026-08-22",
        quantity: 12,
        brief: "Three concepts, each in all three sizes, with and without the price tag.",
        brand_guidelines: true,
      },
    },
    {
      title: "Sponsor the Bangkok Tech Week",
      description: "Gold tier, booth included.",
      requestTypeId: sponsorship.id,
      status: "SUBMITTED",
      priority: "MEDIUM",
      createdById: malee.id,
      assignedToId: surasak.id,
      createdAt: at(-8, 15, 5),
      customFields: {
        event_name: "Bangkok Tech Week 2026",
        event_date: "2026-11-18",
        sponsorship_tier: "Gold",
        amount: 450000,
        contact_person: malee.id,
        expected_reach: 15000,
        rationale: "Our hiring pipeline and three of our enterprise leads came from last year.",
      },
    },
    {
      title: "University career fair sponsorship",
      description: "Bronze tier, two universities.",
      requestTypeId: sponsorship.id,
      status: "REJECTED",
      priority: "LOW",
      createdById: staff.kanya.id,
      assignedToId: surasak.id,
      createdAt: at(-36, 14, 0),
      customFields: {
        event_name: "Chulalongkorn & Thammasat Career Fair",
        event_date: "2026-10-08",
        sponsorship_tier: "Bronze",
        amount: 80000,
        contact_person: nid.id,
        expected_reach: 3000,
        rationale: "Graduate hiring for the QA and support roles.",
      },
    },
  );

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
    purpose: "Sprint review with the vendor",
  });
  await createBookingIfMissing({
    roomId: meetingB.id,
    userId: anucha.id,
    startTime: at(0, 14),
    endTime: at(0, 15, 30),
    purpose: "Interview — backend candidate, second round",
  });
  // No purpose, deliberately. It is optional, so at least one seeded row has to
  // be missing it or the detail page's "no purpose given" branch never renders
  // in a demo and nobody notices it is broken.
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
    purpose: "New-hire onboarding session",
  });
  await createBookingIfMissing({
    roomId: boardRoom.id,
    userId: purachaet.id,
    startTime: at(7, 10),
    endTime: at(7, 11, 30),
    purpose: "Quarterly budget review",
  });
  // Volume, for the same reason the extra tickets exist: five bookings across
  // six rooms leaves the grid looking empty on every day but today.
  //
  // Laid out as a table because the only thing that matters about these rows is
  // that no two on the same room overlap — that is far easier to see in a grid
  // than spread across thirty call sites. Half-open, so 09:00-10:00 and
  // 10:00-11:00 are fine back to back; createReservationIfFree skips anything
  // that would clash rather than dying on the constraint.
  //
  // Negative days are deliberate: "My bookings" and the department history look
  // wrong with no past in them.
  const MORE_BOOKINGS = [
    // room          day  from   to     booker              purpose
    [meetingA,        -8,  9, 0, 10, 0, staff.pensri,  "Candidate screening call"],
    [meetingA,        -5, 13, 0, 14, 0, somchai,       "Campaign copy review"],
    [meetingA,        -2, 10, 0, 11, 0, staff.krit,    "Sprint planning"],
    [meetingA,         0, 14, 0, 15, 0, staff.wanida,  "Policy handbook review"],
    [meetingA,         1,  9, 0, 10, 0, staff.jirawat, "Creative kickoff"],
    [meetingA,         2, 11, 0, 12, 0, staff.duangjai,"Month-end close check-in"],
    [meetingA,         5,  9, 0, 10, 30, staff.siriwan,"Vendor demo — monitoring tools"],
    [meetingA,         8, 14, 0, 16, 0, malee,         "Trade show booth planning"],

    [meetingB,        -6, 15, 0, 16, 0, surasak,       "Budget variance walkthrough"],
    [meetingB,        -1, 15, 0, 16, 0, anucha,        "Incident post-mortem"],
    [meetingB,         0, 11, 0, 12, 0, staff.natthapong, "Architecture review"],
    [meetingB,         1, 10, 0, 11, 30, nid,          "Offer discussion — QA candidates"],
    [meetingB,         2, 14, 0, 15, 0, staff.apichart,"Expense policy briefing"],
    [meetingB,         4,  9, 0, 10, 0, boonmee,       "Facilities contractor meeting"],
    [meetingB,         9, 13, 0, 14, 30, purachaet,    "Portal roadmap review"],

    [trainingRoom,    -4,  9, 0, 11, 0, nid,           "Compliance refresher — session 1"],
    [trainingRoom,     1,  9, 0, 12, 0, staff.suphap,  "Thai language course — week 3"],
    [trainingRoom,     3,  9, 0, 12, 0, anucha,        "Container workshop"],
    [trainingRoom,     5, 13, 0, 17, 0, boonmee,       "First aid certification"],
    [trainingRoom,    10, 10, 0, 12, 0, malee,         "Brand guidelines training"],

    [boardRoom,       -9, 10, 0, 12, 0, purachaet,     "Board meeting — August"],
    [boardRoom,        0, 15, 0, 16, 0, surasak,       "Audit opening meeting"],
    [boardRoom,        2,  9, 0, 10, 30, malee,        "Q4 campaign presentation"],
    [boardRoom,        4, 14, 0, 16, 0, nid,           "Headcount planning"],
    [boardRoom,       12,  9, 0, 11, 0, purachaet,     "Board meeting — October"],

    [focus1,          -3,  9, 0, 10, 0, staff.pornthip,"Focus block — campaign copy"],
    [focus1,           0,  9, 0, 10, 0, staff.teerapat,"One-to-one"],
    [focus1,           0, 13, 0, 14, 0, staff.nuchanart,"Supplier call"],
    [focus1,           1, 11, 0, 12, 0, staff.ekkachai,"Code review call"],
    [focus1,           3, 15, 0, 16, 0, staff.chaiwat, "Interview — second round"],

    [focus2,           0, 10, 0, 11, 0, staff.phongsak,"Reconciliation call"],
    [focus2,           1, 14, 0, 15, 0, staff.ratchanee,"Contractor check-in"],
    [focus2,           3, 10, 0, 11, 0, staff.wichai,  "Maintenance scheduling"],
    [focus2,           6,  9, 0, 10, 0, staff.prasit,  "Safety walkthrough debrief"],
  ];

  for (const [room, day, fromH, fromM, toH, toM, booker, purpose] of MORE_BOOKINGS) {
    await createBookingIfMissing({
      roomId: room.id,
      userId: booker.id,
      startTime: at(day, fromH, fromM),
      endTime: at(day, toH, toM),
      purpose,
    });
  }
  console.log(`bookings     ${5 + MORE_BOOKINGS.length} bookings across 6 rooms and ~3 weeks, incl. the 09:00-10:00 Meeting Room B clash from API.md`);

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
        { eventId: townHall.id, userId: nid.id, rsvpStatus: "ACCEPTED" },
        { eventId: townHall.id, userId: somchai.id, rsvpStatus: "INVITED" },
        { eventId: townHall.id, userId: wipa.id, rsvpStatus: "INVITED" },
        { eventId: townHall.id, userId: thanakorn.id, rsvpStatus: "DECLINED" },
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
        { eventId: created.id, userId: somying.id, rsvpStatus: "ACCEPTED" },
        { eventId: created.id, userId: anucha.id, rsvpStatus: "DECLINED" },
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

  // -- inventory -------------------------------------------------------------
  //
  // ponytail: onHand is written as a literal rather than replayed through the
  // service layer — deterministic and readable, at the cost of being able to
  // drift from the assets below. `reserved` is NOT a literal; syncReserved
  // derives it at the end of this section, because the version that was a
  // literal silently assumed the request block had run. assertInventoryConsistent
  // re-derives both from what was actually written and fails the seed if they
  // disagree; if onHand ever needs the same treatment, that is the upgrade.
  const [laptop, monitor, paper, pen] = await Promise.all(
    [
      { sku: "LAPTOP-14", name: 'Laptop 14"', unit: "unit", isSerialized: true },
      { sku: "MON-27", name: 'Monitor 27"', unit: "unit", isSerialized: true },
      { sku: "A4-PAPER", name: "A4 paper (500 sheets)", unit: "ream", isSerialized: false },
      { sku: "PEN-BLUE", name: "Blue ballpoint pen", unit: "box", isSerialized: false },
    ].map(upsertItem),
  );

  // departmentId null is the System Admin's central warehouse — the stock that
  // supplies every department stock (schema.prisma:370). The UI labels it
  // "Central warehouse" (inventory.service.js:246).
  const centralLaptop = await upsertStock({ departmentId: null, itemId: laptop.id, onHand: 3, minStock: 2 });
  const centralMonitor = await upsertStock({ departmentId: null, itemId: monitor.id, onHand: 2, minStock: 1 });
  const centralPaper = await upsertStock({ departmentId: null, itemId: paper.id, onHand: 200, minStock: 50 });
  const centralPen = await upsertStock({ departmentId: null, itemId: pen.id, onHand: 80, minStock: 20 });

  const itLaptop = await upsertStock({ departmentId: it.id, itemId: laptop.id, onHand: 1, minStock: 2 });
  const itMonitor = await upsertStock({ departmentId: it.id, itemId: monitor.id, onHand: 1, minStock: 1 });
  // Below its minimum on purpose: the replenishment prompt needs a stock that
  // actually warrants one, or the low-stock branch never renders.
  const itPaper = await upsertStock({ departmentId: it.id, itemId: paper.id, onHand: 12, minStock: 20 });
  const hrPaper = await upsertStock({ departmentId: hr.id, itemId: paper.id, onHand: 30, minStock: 10 });
  const hrPen = await upsertStock({ departmentId: hr.id, itemId: pen.id, onHand: 4, minStock: 10 });

  // One asset per InventoryAssetStatus, so no status badge goes undemonstrated.
  // Only AVAILABLE ones count toward onHand above — see assertInventoryConsistent.
  const assets = {};
  for (const asset of [
    { serialNo: "LT-C-0001", assetTag: "AST-1001", stockId: centralLaptop.id, status: "AVAILABLE", condition: "New, boxed" },
    { serialNo: "LT-C-0002", assetTag: "AST-1002", stockId: centralLaptop.id, status: "AVAILABLE", condition: "New, boxed" },
    { serialNo: "LT-C-0003", assetTag: "AST-1003", stockId: centralLaptop.id, status: "AVAILABLE", condition: "New, boxed" },
    { serialNo: "MN-C-0001", assetTag: "AST-2001", stockId: centralMonitor.id, status: "AVAILABLE", condition: "New, boxed" },
    { serialNo: "MN-C-0002", assetTag: "AST-2002", stockId: centralMonitor.id, status: "AVAILABLE", condition: "New, boxed" },
    // In transit to HR on the DISPATCHED replenishment below. Out of central's
    // onHand, not yet in HR's — a shipment in flight is nobody's stock.
    { serialNo: "MN-C-0003", assetTag: "AST-2003", stockId: centralMonitor.id, status: "IN_TRANSIT", condition: "New, boxed" },
    { serialNo: "LT-IT-0001", assetTag: "AST-1101", stockId: itLaptop.id, status: "AVAILABLE", condition: "Good" },
    { serialNo: "LT-IT-0002", assetTag: "AST-1102", stockId: itLaptop.id, status: "ASSIGNED", condition: "Good" },
    { serialNo: "LT-IT-0003", assetTag: "AST-1103", stockId: itLaptop.id, status: "MAINTENANCE", condition: "Battery will not hold charge" },
    { serialNo: "LT-IT-0004", assetTag: "AST-1104", stockId: itLaptop.id, status: "RETIRED", condition: "Screen cracked, written off" },
    { serialNo: "MN-IT-0001", assetTag: "AST-2101", stockId: itMonitor.id, status: "AVAILABLE", condition: "Good" },
  ]) {
    assets[asset.serialNo] = await upsertAsset(asset);
  }
  console.log("inventory    4 items, 9 stocks (4 central), 11 assets across all 5 statuses");

  // Requests, replenishments, movements and the open assignment have no natural
  // key between them, so they are guarded as one block — the same shape used
  // for comments and notifications above.
  if ((await prisma.inventoryRequest.count()) === 0) {
    // -- department requests: all 5 InventoryRequestStatus values ------------
    await prisma.inventoryRequest.create({
      data: {
        requesterId: somying.id,
        fromDepartmentId: hr.id,
        reason: "The printer on the HR floor is out of paper.",
        status: "PENDING",
        lines: { create: [{ stockId: hrPaper.id, quantity: 2 }] },
      },
    });
    // Holds itLaptop.reserved = 1. Serialized items are requested one at a
    // time (inventory.service.js:682), so quantity is 1, never more.
    await prisma.inventoryRequest.create({
      data: {
        requesterId: staff.krit.id,
        fromDepartmentId: it.id,
        reason: "Replacement laptop for the new starter joining IT next week.",
        status: "APPROVED",
        reviewedById: anucha.id,
        reviewedAt: at(-2, 10),
        lines: { create: [{ stockId: itLaptop.id, quantity: 1 }] },
      },
    });
    const fulfilled = await prisma.inventoryRequest.create({
      data: {
        requesterId: staff.pensri.id,
        fromDepartmentId: hr.id,
        reason: "Paper for the new-hire induction packs.",
        status: "FULFILLED",
        reviewedById: nid.id,
        reviewedAt: at(-6, 9),
        fulfilledAt: at(-5, 14),
        lines: { create: [{ stockId: hrPaper.id, quantity: 5 }] },
      },
      include: { lines: true },
    });
    await prisma.inventoryRequest.create({
      data: {
        requesterId: staff.wanida.id,
        fromDepartmentId: hr.id,
        reason: "Pens for the recruitment fair.",
        status: "REJECTED",
        reviewedById: nid.id,
        reviewedAt: at(-3, 11),
        // The reject branch on the detail page renders an empty box without it.
        rejectionReason:
          "Ten boxes is close to a year of stock for one team, and HR is down to four. Take two now and raise a fresh request after the fair.",
        lines: { create: [{ stockId: hrPen.id, quantity: 10 }] },
      },
    });
    await prisma.inventoryRequest.create({
      data: {
        requesterId: staff.natthapong.id,
        fromDepartmentId: it.id,
        reason: "Second monitor for the support desk.",
        status: "CANCELLED",
        lines: { create: [{ stockId: itMonitor.id, quantity: 1 }] },
      },
    });

    // -- replenishments: all 6 ReplenishmentStatus values --------------------
    // Central warehouse to department, approved by a System Admin
    // (replenishment.service.js:99).
    await prisma.inventoryReplenishment.create({
      data: {
        sourceStockId: centralPaper.id,
        departmentId: it.id,
        requesterId: anucha.id,
        quantity: 5,
        reason: "IT is down to 12 reams against a minimum of 20.",
        status: "PENDING",
      },
    });
    // Holds centralLaptop.reserved = 2.
    await prisma.inventoryReplenishment.create({
      data: {
        sourceStockId: centralLaptop.id,
        departmentId: it.id,
        requesterId: anucha.id,
        quantity: 2,
        reason: "Two starters in IT next month and only one spare laptop left.",
        status: "APPROVED",
        reviewedById: purachaet.id,
        reviewedAt: at(-1, 15),
      },
    });
    // Dispatched: the serial is IN_TRANSIT and pinned to this shipment, which
    // is what RECEIVED later reads back (replenishment.service.js:145).
    await prisma.inventoryReplenishment.create({
      data: {
        sourceStockId: centralMonitor.id,
        departmentId: hr.id,
        requesterId: nid.id,
        quantity: 1,
        reason: "Monitor for the HR interview room.",
        status: "DISPATCHED",
        reviewedById: purachaet.id,
        reviewedAt: at(-4, 9),
        dispatchedAt: at(-2, 11),
        assets: { create: [{ assetId: assets["MN-C-0003"].id }] },
      },
    });
    await prisma.inventoryReplenishment.create({
      data: {
        sourceStockId: centralPaper.id,
        departmentId: hr.id,
        requesterId: nid.id,
        quantity: 20,
        reason: "Quarterly paper top-up for HR.",
        status: "RECEIVED",
        reviewedById: purachaet.id,
        reviewedAt: at(-10, 10),
        dispatchedAt: at(-9, 9),
        receivedById: nid.id,
        receivedAt: at(-8, 14),
      },
    });
    await prisma.inventoryReplenishment.create({
      data: {
        sourceStockId: centralPen.id,
        departmentId: it.id,
        requesterId: anucha.id,
        quantity: 50,
        reason: "Pens for the IT open day.",
        status: "REJECTED",
        reviewedById: purachaet.id,
        reviewedAt: at(-7, 16),
        // The service requires a note on REJECTED and CANCELLED, so both
        // seeded rows carry one (replenishment.service.js:113).
        decisionNote: "Fifty boxes is most of the central supply. Ten is approved — resubmit at that quantity.",
      },
    });
    await prisma.inventoryReplenishment.create({
      data: {
        sourceStockId: centralPen.id,
        departmentId: hr.id,
        requesterId: nid.id,
        quantity: 3,
        reason: "Pens for the induction packs.",
        status: "CANCELLED",
        reviewedById: nid.id,
        reviewedAt: at(-5, 10),
        decisionNote: "Covered by the stationery order Facilities had already placed.",
      },
    });

    // -- the open assignment --------------------------------------------------
    // LT-IT-0002 is ASSIGNED above; this is the row that says to whom. No
    // requestLineId: it was handed out directly, not through a request.
    await prisma.assetAssignment.create({
      data: {
        assetId: assets["LT-IT-0002"].id,
        userId: anucha.id,
        assignedAt: at(-30, 9),
        conditionOut: "Good",
      },
    });

    // -- movement history -----------------------------------------------------
    // Enough rows that the movement log has something to show. Deltas mirror
    // what the service would have written on each transition.
    await prisma.stockMovement.createMany({
      data: [
        { stockId: centralLaptop.id, actorId: purachaet.id, type: "IN", onHandDelta: 3, note: "Opening stock: 3 laptops received from the supplier" },
        { stockId: centralMonitor.id, actorId: purachaet.id, type: "IN", onHandDelta: 3, note: "Opening stock: 3 monitors received from the supplier" },
        { stockId: centralPaper.id, actorId: purachaet.id, type: "IN", onHandDelta: 220, note: "Opening stock: quarterly paper delivery" },
        { stockId: centralPen.id, actorId: purachaet.id, type: "IN", onHandDelta: 80, note: "Opening stock: stationery delivery" },
        { stockId: hrPaper.id, actorId: nid.id, type: "RESERVE", reservedDelta: 5, requestLineId: fulfilled.lines[0].id, note: "Induction packs: approved" },
        { stockId: hrPaper.id, actorId: nid.id, type: "OUT", onHandDelta: -5, reservedDelta: -5, requestLineId: fulfilled.lines[0].id, note: "Induction packs: handed over" },
        { stockId: itLaptop.id, actorId: anucha.id, type: "OUT", onHandDelta: -1, note: "Asset LT-IT-0002 assigned to Anucha Thongchai" },
        { stockId: itLaptop.id, actorId: anucha.id, type: "ADJUST", onHandDelta: -1, note: "Asset LT-IT-0003: status AVAILABLE -> MAINTENANCE | battery will not hold charge" },
        { stockId: itLaptop.id, actorId: anucha.id, type: "ADJUST", onHandDelta: -1, note: "Asset LT-IT-0004: status AVAILABLE -> RETIRED | screen cracked, written off" },
        { stockId: itMonitor.id, actorId: anucha.id, type: "RETURN", onHandDelta: 1, note: "Asset MN-IT-0001 returned from a departing contractor" },
      ],
    });
    console.log("             5 requests + 6 replenishments (every status), 1 open assignment, 10 movements");
  } else {
    console.log("             requests and replenishments already present, left alone");
  }

  await syncReserved([
    centralLaptop, centralMonitor, centralPaper, centralPen,
    itLaptop, itMonitor, itPaper, hrPaper, hrPen,
  ]);

  await assertInventoryConsistent();
  await assertDepartmentsPopulated([hr, it, facilities, finance, marketing]);
  console.log("checks       inventory balances and department coverage consistent");

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
