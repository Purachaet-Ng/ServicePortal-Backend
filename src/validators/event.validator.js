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
      data.status === undefined ||
      ["LIVE", "CLOSED"].includes(data.status),
    {
      message: "status must be LIVE or CLOSED",
      path: ["status"],
    },
  )
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

/** Staff answer invitations here; check-in and event closure own attendance states. */
export const updateRsvpSchema = z.object({
  rsvpStatus: z.enum(["ACCEPTED", "DECLINED"]),
});

/** A QR scan supplies a token; an authorized manual check-in supplies a userId. */
export const checkInSchema = z
  .object({
    token: z.string().trim().min(1).optional(),
    userId: positiveId("Invalid userId").optional(),
  })
  .refine((data) => Boolean(data.token) !== Boolean(data.userId), {
    message: "Provide either token or userId",
  });

/** GET /events filters. Absent means "no bound", not "now". */
export const listEventsQuery = z.object({
  from: requiredDate("from").optional(),
  to: requiredDate("to").optional(),
  status: eventStatus.optional(),
});

export const inviteAttendeesSchema = z.object({
  userIds: z.array(positiveId("Invalid userId"))
  .min(1, "userIds must not be empty")
  .refine((id) => new Set(id).size === id.length, {
    message: "userIds must not contain duplicates",
  } )
});
