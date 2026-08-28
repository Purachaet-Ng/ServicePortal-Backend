import createHttpError from "http-errors";

export function pathNotFound(req, res, next) {
  next(createHttpError(404, `Cannot ${req.method} ${req.originalUrl}`));
}
