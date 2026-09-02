import z from "zod";
import { positiveId, requiredDate, requiredText } from "./common.validator.js";

//Room
export const roomSchema = z.object({
  name: requiredText("name"),
  location: z.string().trim().nullish(),
  capacity: positiveId("Invalid capacity"),
});

export const createRoomSchema = roomSchema;

export const updateRoomSchema = roomSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

//Room Booking
export const roomBookingSchema = z.object({
  roomId: positiveId("Invalid room id"),
  startTime: requiredDate("startTime"),
  endTime: requiredDate("endTime"),
});

export const createRoomBookingSchema = roomBookingSchema.refine(
  (data) => data.endTime > data.startTime,
  {
    message: "endTime must be after startTime",
    path: ["endTime"],
  },
);

export const updateRoomBookingSchema = roomBookingSchema
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

export const updateRoomBookingStatusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]),
});
