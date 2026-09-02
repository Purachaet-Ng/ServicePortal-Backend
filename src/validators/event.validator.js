import z from "zod";
import { requiredDate, requiredText } from "./common.validator.js";

export const eventSchema = z.object({
  title: requiredText("title"),
  description: z.string().trim().nullish(),
  status: z.enum([
    "PENDING",
    "APPROVE",
    "IN_PROGRESS",
    "LIVE",
    "CLOSED",
    "CANCEL",
  ])
  .optional(),
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
  status: z.enum([
    "PENDING",
    "APPROVE",
    "IN_PROGRESS",
    "LIVE",
    "CLOSED",
    "CANCEL",
  ]),
});

export const updateRsvpSchema = z.object({
  rsvpStatus: z.enum(["ACCEPTED", "DECLINED", "ATTENDED", "ABSENT"]),
});
