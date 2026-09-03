import z from "zod";

/**
 * `unread=true` narrows the list to what the bell badge counts.
 * Anything other than "true"/"false" is a typo worth a 400 rather than a
 * silent full list.
 *
 * `limit` is not in API.md, but the dropdown is a bounded list and this table
 * only grows: 20 by default, 100 at most.
 */
export const listNotificationsQuery = z.object({
  unread: z
    .enum(["true", "false"], { error: "unread must be true or false" })
    .optional()
    .transform((value) => value === "true"),

  limit: z.coerce
    .number({ error: "limit must be a number" })
    .int("limit must be a whole number")
    .min(1, "limit must be at least 1")
    .max(100, "limit must be at most 100")
    .default(20),
});
