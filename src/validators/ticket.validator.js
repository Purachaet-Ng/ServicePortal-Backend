import z from "zod";
import { emptyToUndefined, positiveId, requiredText } from "./common.validator.js";
import { buildOrderBy, DEFAULT_LIMIT, MAX_LIMIT } from "../utils/query.js";
import { Priority, TicketStatus } from "../../generated/prisma/index.js";

const TICKET_STATUSES = Object.values(TicketStatus)
const TICKET_PRIORITIES = Object.values(Priority)
const SORTABLE_FIELDS = ["createdAt", "updatedAt", "title", "status", "priority"];


const status = z.enum(TICKET_STATUSES, {
  error: `status must be one of ${TICKET_STATUSES.join(", ")}`,
});

const priority = z.enum(TICKET_PRIORITIES,{
  error: `priority must be one of ${TICKET_PRIORITIES.join(", ")}`,
})

export const ticketSchema = z.object({
  requestTypeId: positiveId("Invalid request type id"),
  title: requiredText("title"),
  description: z.string().trim().nullish(),
  status: emptyToUndefined(status.optional()),
  priority: emptyToUndefined(priority.optional()),
  assignedToId: positiveId("Invalid assigned user id").nullish(),
  customFields: z
    .record(z.string(), z.unknown())
    .refine((fields) => Object.keys(fields).length > 0, {
      message: "At least one custom field is required",
    }),
});

export const createTicketSchema = ticketSchema.omit({
  status: true,
  assignedToId: true,
});

export const updateTicketSchema = ticketSchema
  .omit({ requestTypeId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const updateTicketStatusSchema = z.object({ status });

export const assignTicketSchema = z.object({
  assignedToId: positiveId("Invalid assigned user id").nullable(),
});


export const ticketListQuery = z
  .object({
    // "" and junk fall back to the defaults instead of erroring
    page: emptyToUndefined(z.coerce.number().int().catch(1)),
    limit: emptyToUndefined(z.coerce.number().int().catch(DEFAULT_LIMIT)),
    sort: z.string().optional(),
    q: z.string().trim().optional(),
    status: emptyToUndefined(status.optional()),
    priority: emptyToUndefined(priority.optional()),
  })
  .transform(({ page, limit, sort, ...rest }) => {
    // Out-of-range paging is clamped rather than rejected (APIs.md: max 100)
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(MAX_LIMIT, Math.max(1, limit));

    return {
      ...rest,
      page: safePage,
      limit: safeLimit,
      skip: (safePage - 1) * safeLimit,
      orderBy: buildOrderBy(sort, SORTABLE_FIELDS),
    };
  });