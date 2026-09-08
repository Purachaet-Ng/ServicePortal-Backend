/**
 * multer, wired for ticket attachments.
 *
 * Two things here are load-bearing and easy to lose in a refactor:
 *
 *   1. The name on disk is random. The name the user chose is data — it goes
 *      in the database column, never into a path. "../../.env" is a perfectly
 *      legal filename and multer will hand it to us verbatim.
 *
 *   2. A raw MulterError has no `.status`, so errorHandler.js would treat
 *      "your file is too big" as a 500 bug and answer INTERNAL_ERROR. The
 *      wrapper below converts them before they get that far.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import multer from "multer";
import createHttpError from "http-errors";

export const uploadDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../uploads",
);

// At import, so a fresh clone works without anyone reading a README.
fs.mkdirSync(uploadDir, { recursive: true });

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILES = 5;

/** Allowlist, not a blocklist — a blocklist is a list of the extensions we
 *  happened to think of. API.md has no opinion here; these are the types a
 *  ticket actually needs. */
export const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  // extname() of an attacker-supplied name is still attacker-supplied, but it
  // is appended to a UUID inside a fixed directory, so the worst case is a
  // silly suffix, not a path.
  filename: (req, file, cb) =>
    cb(null, randomUUID() + path.extname(file.originalname).slice(0, 10)),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
  fileFilter: (req, file, cb) =>
    ALLOWED_MIME.has(file.mimetype)
      ? cb(null, true)
      : cb(
          createHttpError(400, `File type ${file.mimetype} is not allowed`, {
            code: "FILE_TYPE_NOT_ALLOWED",
          }),
        ),
});

/** MulterError → http-errors, so the API.md envelope carries a real message. */
const MULTER_ERRORS = {
  LIMIT_FILE_SIZE: [413, `Each file must be ${MAX_FILE_BYTES / 1024 / 1024}MB or smaller`, "FILE_TOO_LARGE"],
  LIMIT_FILE_COUNT: [400, `At most ${MAX_FILES} files per ticket`, "TOO_MANY_FILES"],
  LIMIT_UNEXPECTED_FILE: [400, 'Files must be sent under the field name "files"', "UNEXPECTED_FILE"],
};

/** Drop-in for `upload.array("files")` that never leaks a 500. */
export const uploadAttachments = (req, res, next) =>
  upload.array("files", MAX_FILES)(req, res, (err) => {
    if (!(err instanceof multer.MulterError)) return next(err);

    const [status, message, code] = MULTER_ERRORS[err.code] ?? [400, "Upload failed", "UPLOAD_FAILED"];
    next(createHttpError(status, message, { code }));
  });
