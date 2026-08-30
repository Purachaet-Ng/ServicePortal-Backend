import z from "zod";
import { positiveId } from "./common.validator.js";

const phoneRegex = /^(?:\+66|0)[689]\d[- ]?\d{3}[- ]?\d{4}$/;

const name = (field) =>
  z
    .string({ error: `${field} is required` })
    .trim()
    .min(1, `${field} must not be empty`);

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Invalid email format" }));

const password = z
  .string({ error: "password is required" })
  .min(6, "password must be at least 6 characters");

const phone = z
  .string()
  .trim()
  .regex(phoneRegex, "Invalid phone number format")
  .transform((val) => val.replace(/[- ]/g, ""))
  .nullish();

export const registerSchema = z.object({
  firstname: name("firstname"),
  lastname: name("lastname"),
  phone,
  email,
  password,
  departmentId: positiveId("Invalid department id").nullish(),
});

export const loginSchema = z.object({
  email,
  password,
});
