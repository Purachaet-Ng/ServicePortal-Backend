import z from "zod";
import { requiredText } from "./common.validator.js";

export const createEventSchema = z
  .object({
    title: requiredText("title"),
    description: z.string().trim().nullish(),
    startTime: z.coerce.date({ error: "Invalid start time" }),
    endTime: z.coerce.date({ error: "Invalid end time" }),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

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
  rsvpStatus: z.enum(["invited", "accepted", "declined"]),
});
