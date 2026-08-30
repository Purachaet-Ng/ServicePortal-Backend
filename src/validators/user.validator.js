import z from "zod";
import { positiveId, requiredText } from "./common.validator.js";

const phoneRegex = /^(?:\+66|0)[689]\d[- ]?\d{3}[- ]?\d{4}$/;

export const updateUserSchema = z
  .object({
    firstname: requiredText("firstname").optional(),
    lastname: requiredText("lastname").optional(),

    phone: z
      .string()
      .trim()
      .regex(phoneRegex, "Invalid phone number format")
      .transform((value) => value.replace(/[- ]/g, ""))
      .nullish(),

    departmentId: positiveId("Invalid department id").nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const updateUserRoleSchema = z.object({
  role: z.enum(["ADMIN_SYSTEM", "ADMIN_DEPT", "STAFF"]),
});
