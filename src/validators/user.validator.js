import z from "zod";
import { positiveId, requiredText } from "./common.validator.js";

const phoneRegex = /^(?:\+66|0)[689]\d[- ]?\d{3}[- ]?\d{4}$/;

const phone = z
  .string()
  .trim()
  .regex(phoneRegex, "Invalid phone number format")
  .transform((value) => value.replace(/[- ]/g, ""))
  .nullish();

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Invalid email format" }));

const password = z
  .string({ error: "password is required" })
  .min(6, "password must be at least 6 characters");

const role = z.enum(["ADMIN_SYSTEM", "ADMIN_DEPT", "STAFF"]);

export const createUserSchema = z.object({
  firstname: requiredText("firstname"),
  lastname: requiredText("lastname"),
  phone,
  email,
  password,
  departmentId: positiveId("Invalid department id").nullish(),
  // Omitted means the database default (STAFF) applies.
  role: role.optional(),
});

export const updateUserSchema = z
  .object({
    firstname: requiredText("firstname").optional(),
    lastname: requiredText("lastname").optional(),
    phone,
    departmentId: positiveId("Invalid department id").nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const updateUserRoleSchema = z.object({
  role,
});
