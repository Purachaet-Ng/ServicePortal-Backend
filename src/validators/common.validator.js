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