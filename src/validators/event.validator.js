import z from "zod";
import { positiveId, requiredDate, requiredText } from "./common.validator.js";

const eventStatus = z.enum([
  "PENDING",
  "APPROVE",
  "IN_PROGRESS",
  "LIVE",
  "CLOSED",
  "CANCEL",
]);

export const eventSchema = z.object({
  title: requiredText("title"),
  description: z.string().trim().nullish(),
  status: eventStatus.optional(),
  startTime: requiredDate("startTime"),
  endTime: requiredDate("endTime"),
});

export const createEventSchema = eventSchema.refine(
  (data) => data.endTime > data.startTime,
  {
    message: "endTime must be after startTime",
    path: ["endTime"],
  },
);

export const updateEventSchema = eventSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  })
  .refine(
    (data) =>
      data.startTime === undefined ||
      data.endTime === undefined ||
      data.endTime > data.startTime,
    {
      message: "endTime must be after startTime",
      path: ["endTime"],
    },
  );

export const updateEventStatusSchema = z.object({
  status: eventStatus,
});

export const updateRsvpSchema = z.object({
  rsvpStatus: z.enum(["ACCEPTED", "DECLINED", "ATTENDED", "ABSENT"]),
});

/** GET /events filters. Absent means "no bound", not "now". */
export const listEventsQuery = z.object({
  from: requiredDate("from").optional(),
  to: requiredDate("to").optional(),
  status: eventStatus.optional(),
});

export const inviteAttendeesSchema = z.object({
  userIds: z.array(positiveId("Invalid userId")).min(1, "userIds must not be empty"),
});
