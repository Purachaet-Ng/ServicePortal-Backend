import z from "zod";
import {
  bookingStatusSchema,
  optionalNote,
  positiveId,
  requiredDate,
  requiredText,
} from "./common.validator.js";

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
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]),
  startTime: requiredDate("startTime"),
  endTime: requiredDate("endTime"),
  // Optional on purpose. A required free-text box collects the word "meeting"
  // from everyone in a week and tells the approver nothing; an optional one is
  // filled by the people who have something worth saying.
  purpose: optionalNote(),
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

// The rule about rejections needing a reason is identical for rooms and cars,
// so it is defined once — see bookingStatusSchema in common.validator.js.
export const updateCarBookingStatusSchema = bookingStatusSchema;
