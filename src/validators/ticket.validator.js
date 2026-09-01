import z from "zod";
import { positiveId, requiredText } from "./common.validator.js";

export const ticketSchema = z.object({
  requestTypeId: positiveId("Invalid request type id"),
  title: requiredText("title"),
  description: z.string().trim().nullish(),
  status: z.enum([
    "SUBMITTED",
    "UNDER_REVIEW",
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
    "REJECTED",
  ]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assignedToId: positiveId("Invalid assiged user id").nullish(),
  customFields: z
    .record(z.string(), z.unknown())
    .refine((fields) => Object.keys(fields).length > 0, {
      message: "At least one custom field is required",
    }),
});

export const createTicketSchema = ticketSchema;

export const updateTicketSchema = ticketSchema
  .omit({ requestTypeId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
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
