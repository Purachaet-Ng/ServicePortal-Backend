import z from "zod";

export const positiveId = (message = "Invalid id") =>
  z.coerce.number({ error: message }).int(message).positive(message);

export const idParams = z.object({
  id: positiveId(),
});

export const requiredText = (field) =>
  z
    .string({ error: `${field} is required` })
    .trim()
    .min(1, `${field} must not be empty`);

export const requiredDate = (field) =>
  requiredText(field).pipe(z.coerce.date({ error: `Invalid ${field}` }));

export const emptyToUndefined = (schema) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema);

/** For nested routes like /tickets/:id/attachments/:attachmentId. */
export const attachmentParams = z.object({
  id: positiveId("Invalid ticket id"),
  attachmentId: positiveId("Invalid attachment id"),
});

/**
 * Free text somebody typed into a textarea: trimmed, capped, and empty-means-
 * absent. `""` from an untouched box must not be stored as an empty string that
 * every reader then has to distinguish from null.
 */
export const optionalNote = (max = 500) =>
  emptyToUndefined(z.string().trim().max(max, `Must be ${max} characters or fewer`).nullish());

/**
 * An admin settles a booking — the body of PATCH /reserves/{rooms,cars}/bookings/:id/status.
 *
 * ONE schema for both resources. room.validator.js and car.validator.js each
 * had their own byte-identical copy of this, and the refine below is exactly the
 * kind of rule that would have been added to one of them and not the other.
 *
 * A rejection must say why. That is the whole point of the column: an optional
 * box on a refusal screen is a box nobody fills, and the requester is left with
 * a bare REJECTED and no idea whether to ask again. Approving needs no
 * explanation, so the requirement is on the one transition that hurts.
 *
 * The reason is NOT required for CANCELLED — that route is the owner's own
 * /cancel and never reaches here — nor for PENDING, which a status PATCH never
 * sends.
 */
export const bookingStatusSchema = z
  .object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]),
    rejectionReason: optionalNote(),
  })
  .refine((data) => data.status !== "REJECTED" || Boolean(data.rejectionReason), {
    message: "Say why the booking is being rejected — the requester only sees this",
    path: ["rejectionReason"],
  });
