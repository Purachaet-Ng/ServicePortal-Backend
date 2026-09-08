import fs from "node:fs/promises";
import path from "node:path";
import createHttpError from "http-errors";
import { prisma } from "../lib/prisma.js";
import { uploadDir } from "../middlewares/upload.js";

/** What a caller is allowed to see. storedName is deliberately absent — it is
 *  the disk name, and the only route that needs it is the download itself. */
export const attachmentSelect = {
  id: true,
  filename: true,
  mimeType: true,
  size: true,
  uploadedById: true,
  createdAt: true,
};

export async function createAttachments(ticketId, files, userId) {
  return prisma.attachment.createManyAndReturn({
    data: files.map((file) => ({
      ticketId,
      filename: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      uploadedById: userId,
    })),
    select: attachmentSelect,
  });
}

/**
 * Scoped by BOTH ids on purpose. Scoping by attachmentId alone would let
 * /tickets/1/attachments/99 hand over an attachment belonging to ticket 42 —
 * the caller proved access to ticket 1, and nothing more.
 *
 * The caller must already have run findTicketById(ticketId, user); this only
 * checks that the attachment lives on that ticket.
 */
export async function findAttachment(ticketId, attachmentId) {
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, ticketId },
  });

  if (!attachment) throw createHttpError(404, "Attachment not found");

  return attachment;
}

/**
 * Read the disk names BEFORE the ticket is deleted. The FK cascades, so once
 * the delete commits these rows no longer exist to be read — this must run
 * first or the files are orphaned forever.
 */
export const storedNamesForTicket = (ticketId) =>
  prisma.attachment.findMany({ where: { ticketId }, select: { storedName: true } });

/**
 * ...and unlink AFTER it commits. A failed unlink must not roll back a delete
 * that already succeeded, so every error here is swallowed.
 *
 * ponytail: files orphaned by a crash between the commit and this call are
 * never swept up. Add a cron over uploads/ if that shows up as disk use.
 */
export async function removeStoredFiles(rows) {
  await Promise.all(
    rows.map((row) =>
      fs.rm(path.join(uploadDir, row.storedName), { force: true }).catch(() => {}),
    ),
  );
}

/** Absolute path of a stored file, for res.download(). */
export const storedPath = (attachment) => path.join(uploadDir, attachment.storedName);
