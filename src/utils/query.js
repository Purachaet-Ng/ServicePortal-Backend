// Helpers for the standard list query params (APIs.md → Conventions):
//   ?page=1&limit=20&sort=-createdAt&q=foundation

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * "created_at:desc" (the documented form, API.md) or "-createdAt" → { createdAt: "desc" }.
 * snake_case is accepted because that is what the API contract and the frontend send.
 * Unknown field → default sort.
 */
export const buildOrderBy = (sort, sortableFields, defaultSort = "-createdAt") => {
  const value = sort || defaultSort;

  const [rawField, dir] = value.includes(":")
    ? value.split(":")
    : [value.replace(/^-/, ""), value.startsWith("-") ? "desc" : "asc"];

  const field = rawField.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

  if (!sortableFields.includes(field)) return { createdAt: "desc" };
  return { [field]: dir === "desc" ? "desc" : "asc" };
};

export const buildPagination = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});