import createHttpError from "http-errors";

/**
 * Validates request params, query, and body using Zod schemas.
 * Use this middleware in a router before the controller.
 * Validated and converted data is stored in `req.valid`.
 *
 * Example:
 * router.patch("/:id",
 *   validate({ params: idSchema, body: updateTicketSchema }),
 *   updateTicket,
 * );
 */
export const validate = (schemas) => (req, res, next) => {
  req.valid = req.valid ?? {};

  for (const source of ["params", "query", "body"]) {
    const schema = schemas[source];
    if (!schema) continue;

    const result = schema.safeParse(req[source] ?? {});

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join(".") || source,
        message: issue.message,
      }));

      return next(createHttpError(400, errors[0].message, { errors }));
    }

    req.valid[source] = result.data;
  }

  next();
};
