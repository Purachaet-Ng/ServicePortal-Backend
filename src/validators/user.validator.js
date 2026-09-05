import z, { coerce } from "zod";
import { emptyToUndefined, positiveId, requiredText } from "./common.validator.js";
import { buildOrderBy, DEFAULT_LIMIT, MAX_LIMIT } from "../utils/query.js";
import { Role } from "../../generated/prisma/index.js";

const phoneRegex = /^(?:\+66|0)[689]\d[- ]?\d{3}[- ]?\d{4}$/;
const SORTABLE_FIELDS = ["createdAt", "firstname", "departmentId" ]
const USER_ROLES = Object.values(Role)

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

const role = z.enum(USER_ROLES,{error:`role must be one of ${USER_ROLES.join(", ")}`});

const departmentId = positiveId("Invalid department id").nullable().optional();

export const createUserSchema = z.object({
  firstname: requiredText("firstname"),
  lastname: requiredText("lastname"),
  phone,
  email,
  password,
  departmentId,
  // Omitted means the database default (STAFF) applies.
  role: role.optional(),
});

export const updateUserSchema = z
  .object({
    firstname: requiredText("firstname").optional(),
    lastname: requiredText("lastname").optional(),
    phone,
    departmentId,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const updateUserRoleSchema = z.object({
  role,
});

export const assignableUserQuery = z.object({
  department_id: positiveId("Invalid department id")
})

export const UserListQuery = z
  .object({
    // "" and junk fall back to the defaults instead of erroring
    page: emptyToUndefined(z.coerce.number().int().catch(1)),
    limit: emptyToUndefined(z.coerce.number().int().catch(DEFAULT_LIMIT)),
    sort: z.string().optional(),
    q: z.string().trim().optional(),
    role : emptyToUndefined(role.optional()),
    departmentId : emptyToUndefined(departmentId.optional())
  })
  .transform(({ page, limit, sort, ...rest }) => {
    // Out-of-range paging is clamped rather than rejected (APIs.md: max 100)
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(MAX_LIMIT, Math.max(1, limit));

    return {
      ...rest,
      page: safePage,
      limit: safeLimit,
      skip: (safePage - 1) * safeLimit,
      orderBy: buildOrderBy(sort, SORTABLE_FIELDS),
    };
  });