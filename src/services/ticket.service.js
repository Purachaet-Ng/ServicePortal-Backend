import createHttpError from "http-errors";
import { prisma } from "../lib/prisma.js";
import { buildPagination } from "../utils/query.js";

/** Every ticket response carries these, so there is one copy of the shape. */
const ticketInclude = {
  requestType: { select: { id: true, name: true, departmentId: true } },
  createdBy: { select: { id: true, firstname: true, lastname: true } },
  assignedTo: { select: { id: true, firstname: true, lastname: true } },
};

export async function createTicket(TicketRequestData) {
  const {
    requestTypeId,
    title,
    description,
    priority,
    customFields,
    createdById,
    assignedToId,
  } = TicketRequestData;

  return prisma.ticket.create({
    data: {
      requestTypeId,
      title,
      description,
      priority,
      customFields,
      createdById,
      assignedToId,
    },
    include: ticketInclude,
  });
}

export async function readTicket(user, { status, priority, q, skip, limit, page, orderBy } = {}) {
  const where = {
    AND: [
      roleCondition(user),
      ...(status ? [{ status }] : []),
      ...(priority ? [{ priority }] : []),
      ...(q
        ? [
            {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            },
          ]
        : []),
    ],
  };

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: orderBy ?? { createdAt: "desc" },
      skip,
      take: limit,
      include: ticketInclude,
    }),
    prisma.ticket.count({ where }),
  ]);

  return { tickets, meta: buildPagination({ page, limit, total }) };
}

// Exported for its test: an empty {} here would silently hand every ticket
// to everyone, and that is not a failure the happy path would show.
export function roleCondition(user) {
  switch (user?.role) {
    case "ADMIN_SYSTEM":
      return {};
    case "ADMIN_DEPT":
      return {
        requestType: {
          departmentId: user.departmentId,
        },
      };
    case "STAFF":
      return {
        OR: [{ createdById: user.id }, { assignedToId: user.id }],
      };
    default:
      throw createHttpError(403, "Forbidden");
  }
}

/**
 * The state machine from PLAN.md §6. Anything not in this table is refused.
 * `orAssignee` / `orCreator` are the row-dependent exceptions a plain role
 * matrix cannot express — they mirror TICKET_TRANSITIONS in the frontend's
 * lib/constants.js, which only HIDES the buttons. This is the real boundary.
 */
const ADMINS = ["ADMIN_DEPT", "ADMIN_SYSTEM"];

const TRANSITIONS = {
  SUBMITTED: {
    UNDER_REVIEW: { roles: ADMINS },
    REJECTED: { roles: ADMINS },
  },
  UNDER_REVIEW: {
    IN_PROGRESS: { roles: ADMINS, orAssignee: true },
    REJECTED: { roles: ADMINS },
  },
  IN_PROGRESS: {
    RESOLVED: { roles: ADMINS, orAssignee: true },
  },
  RESOLVED: {
    CLOSED: { roles: ADMINS, orCreator: true },
    IN_PROGRESS: { roles: ADMINS, orCreator: true },
  },
  REJECTED: {
    CLOSED: { roles: ADMINS },
  },
  CLOSED: {}, // terminal
};

/** Throws 422 for an illegal move, 403 for a legal move by the wrong person. */
export function assertTransition(ticket, nextStatus, user) {
  if (!nextStatus || nextStatus === ticket.status) return;

  const rule = TRANSITIONS[ticket.status]?.[nextStatus];
  if (!rule) {
    throw createHttpError(
      422,
      `Cannot move a ticket from ${ticket.status} directly to ${nextStatus}`,
      { code: "INVALID_TRANSITION" },
    );
  }

  const allowed =
    rule.roles.includes(user.role) ||
    (rule.orAssignee && ticket.assignedToId === user.id) ||
    (rule.orCreator && ticket.createdById === user.id);

  if (!allowed) {
    throw createHttpError(
      403,
      `Your role may not move this ticket to ${nextStatus}`,
      { code: "FORBIDDEN_TRANSITION" },
    );
  }
}

// Callers reach this only through findTicketById(), which has already proved
// the row exists AND belongs to the caller — no second, unscoped check here.
export async function updateTicket(ticketId, data) {
  return prisma.ticket.update({
    where: { id: ticketId },
    data,
    include: ticketInclude,
  });
}

export async function deleteTicket(ticketId, user) {
  await findTicketById(ticketId, user);   // 404 / 403 before anything is destroyed

  // comments.entity_id is polymorphic, so the database will NOT stop us from
  // orphaning a thread here — there is no FK to cascade. Clear it ourselves,
  // in the same transaction, or the rows outlive the ticket forever.
  const [, ticket] = await prisma.$transaction([
    prisma.comment.deleteMany({
      where: { entityType: "ticket", entityId: ticketId },
    }),
    prisma.ticket.delete({
      where: { id: ticketId },
      include: ticketInclude,
    }),
  ]);

  return ticket;
}

/**
 * One ticket, scoped exactly like the list. `user` is required: this is the
 * only thing standing between a STAFF user and another department's ticket,
 * and an optional argument is how that check goes missing.
 *
 * The scope is roleCondition() — the same predicate readTicket() uses — rather
 * than a second copy of the rules in JS, because two copies drift and the one
 * that drifts is the one nobody reads.
 *
 * 404 when it does not exist, 403 when it exists but is not yours (API.md
 * §Status codes). Telling those apart costs a COUNT, and only on the failure
 * path.
 */
export async function findTicketById(ticketId, user) {
  const ticket = await prisma.ticket.findFirst({
    where: { AND: [{ id: ticketId }, roleCondition(user)] },
    include: { requestType: true },
  });

  if (ticket) return ticket;

  if (await prisma.ticket.count({ where: { id: ticketId } })) {
    throw createHttpError(403, "You may not view this ticket");
  }

  throw createHttpError(404, "Ticket not found");
}
