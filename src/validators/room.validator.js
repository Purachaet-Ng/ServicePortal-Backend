import z from "zod";
import { positiveId, requiredText } from "./common.validator.js";

export const createRoomSchema = z.object({
  name: requiredText("name"),
  location: z.string().trim().nullish(),
  capacity: z.coerce.number().int().positive("Invalid capacity"),
});

export const createBookingSchema = z
  .object({
    roomId: positiveId("Invalid room id"),
    startTime: z.coerce.date({ error: "Invalid start time" }),
    endTime: z.coerce.date({ error: "Invalid end time" }),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });
