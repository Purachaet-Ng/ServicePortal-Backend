/**
 * The single place an error becomes a response.
 *
 * Every failure leaves the API in the envelope from API.md §Error envelope:
 *
 *   { "error": { "code": "ROOM_UNAVAILABLE",
 *                "message": "Meeting Room B is already booked ...",
 *                "details": [ { "field": "...", "message": "..." } ] } }
 *
 * `details` is omitted unless there is something to put in it.
 *
 * Throw with http-errors and it lands here already shaped:
 *
 *   throw createHttpError(409, "Meeting Room B is already booked", {
 *     code: "ROOM_UNAVAILABLE",
 *     details: [{ bookingId: 88, startTime, endTime }],
 *   });
 *
 * Anything thrown WITHOUT a code still gets one, from the status (see
 * CODE_BY_STATUS). Prefer passing the specific code from API.md §Error codes —
 * the frontend switches on it — but a plain `createHttpError(404, "...")`
 * is never wrong, it just answers NOT_FOUND.
 */

/** Fallback when a thrower did not name a code. API.md §Error codes. */
const CODE_BY_STATUS = {
  400: "VALIDATION_FAILED",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION_FAILED",
};

/**
 * Only our own SCREAMING_SNAKE codes reach the client. Prisma ("P2002") and
 * Node ("ECONNREFUSED") also populate `err.code`, and leaking those would tell
 * a caller which database we run.
 */
const isOwnCode = (code) => typeof code === "string" && /^[A-Z][A-Z_]*$/.test(code);

export function errorHandler(err, req, res, next) {
  const status = Number(err.status ?? err.statusCode) || 500;

  // A 5xx is a bug, not a message to the user: log the real thing, return
  // nothing about it. 4xx is the caller's fault and is safe to describe.
  if (status >= 500) {
    console.error(`[500] ${req.method} ${req.originalUrl}`, err);

    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Internal Server Error" },
    });
  }

  console.warn(`[${status}] ${req.method} ${req.originalUrl} — ${err.message}`);

  // `details` is the API.md name; `errors` is what validate.js and
  // schemaValidator.js already emit. Accept both, answer in one.
  const details = err.details ?? err.errors;

  res.status(status).json({
    error: {
      code: isOwnCode(err.code) ? err.code : (CODE_BY_STATUS[status] ?? "ERROR"),
      message: err.message || "Request failed",
      ...(Array.isArray(details) && details.length ? { details } : {}),
    },
  });
}
