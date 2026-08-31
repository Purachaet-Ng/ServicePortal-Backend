import z from "zod";
import { positiveId, requiredText } from "./common.validator.js";

export const createTicketSchema = z.object({
  requestTypeId: positiveId("Invalid request type id"),
  title: requiredText("title"),
  description: z.string().trim().nullish(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  customFields: z.record(z.string(), z.unknown()),
});

export const updateTicketStatusSchema = z.object({
  status: z.enum([
    "SUBMITTED",
    "UNDER_REVIEW",
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
    "REJECTED",
  ]),
});

export const assignTicketSchema = z.object({
  assignedToId: positiveId("Invalid assigned user id").nullable(),
});
