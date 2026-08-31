export function errorHandler(err, req, res, next) {
  console.log("err", err);
  console.log("err.status", err.status);
  res.status(err.status || 500);
  res.json({
    status: "Error",
    message: err.message || "Internal Server Error",
    ...(err.errors ? { err: err.errors } : {}),
  });
}
