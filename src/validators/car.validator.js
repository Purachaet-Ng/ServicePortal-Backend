import z from "zod";
import { positiveId, requiredDate, requiredText } from "./common.validator.js";

// Car
export const carSchema = z.object({
  name: requiredText("name"),
  plate: requiredText("plate"),
  seats: positiveId("Invalid number of seats"),
  location: z.string().trim().nullish(),
});

export const createCarSchema = carSchema;

export const updateCarSchema = carSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

// Car booking
export const carBookingSchema = z.object({
  carId: positiveId("Invalid car id"),
  startTime: requiredDate("startTime"),
  endTime: requiredDate("endTime"),
});

export const createCarBookingSchema = carBookingSchema.refine(
  (data) => data.endTime > data.startTime,
  {
    message: "endTime must be after startTime",
    path: ["endTime"],
  },
);

export const updateCarBookingSchema = carBookingSchema
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

export const updateCarBookingStatusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]),
});
