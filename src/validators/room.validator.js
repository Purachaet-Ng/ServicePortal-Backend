import z from "zod";
import {
  bookingStatusSchema,
  optionalNote,
  positiveId,
  requiredDate,
  requiredText,
} from "./common.validator.js";

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
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]),
  startTime: requiredDate("startTime"),
  endTime: requiredDate("endTime"),
  // Optional on purpose. A required free-text box collects the word "meeting"
  // from everyone in a week and tells the approver nothing; an optional one is
  // filled by the people who have something worth saying.
  purpose: optionalNote(),
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

/**
 * The availability query: one plain calendar day, "YYYY-MM-DD".
 *
 * A string rather than a coerced date, because the day WINDOW is built from it
 * on the server — accepting a full timestamp would let the caller and the
 * server disagree about where the day starts.
 *
 * Required, and checked for being a real day. A missing date previously reached
 * `new Date("undefinedT00:00:00.000Z")` and 500'd inside Prisma; and the
 * round-trip refine is what catches "2026-02-31", which Date silently rolls
 * forward to 3 March rather than rejecting.
 */
export const dayQuerySchema = z.object({
  date: z
    .string({ error: "date is required" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format")
    // Total by construction, and it has to be: zod v4 runs every check even
    // after an earlier one fails, so this refine still sees input the regex
    // just rejected. Without the NaN guard, "2026-09-01T00:00:00Z" reaches
    // toISOString() on an Invalid Date, throws a RangeError straight past
    // safeParse, and a malformed query answers 500 instead of 400.
    .refine((value) => {
      const day = new Date(`${value}T00:00:00.000Z`);
      // Round-trip, because Date rolls "2026-02-31" forward to 3 March rather
      // than refusing it — a nonsense day would otherwise return a real day's
      // bookings under the wrong heading.
      return (
        !Number.isNaN(day.getTime()) &&
        day.toISOString().slice(0, 10) === value
      );
    }, "date is not a real calendar day"),
});

// The rule about rejections needing a reason is identical for rooms and cars,
// so it is defined once — see bookingStatusSchema in common.validator.js.
export const updateRoomBookingStatusSchema = bookingStatusSchema;
