import createHttpError from "http-errors";
import { findTicketById } from "../services/ticket.service.js";
import {
  createAttachments,
  findAttachment,
  storedPath,
} from "../services/attachment.service.js";

/**
 * Both handlers call findTicketById(ticketId, req.user) FIRST. That is the
 * whole access check — it is the same predicate the list and GET /:id use, and
 * it already answers 404 for an unknown ticket and 403 for someone else's.
 * There is no authorize() on these routes because access depends on the row
 * (creator / assignee), not on the role alone.
 */
/**
 * Runs BEFORE multer on the upload route, not after. multer streams bytes to
 * disk as it parses; checking access in the handler would mean a user with no
 * right to the ticket still got to write 25MB into uploads/ first.
 */
export async function requireTicketAccess(req, res, next) {
  try {
    await findTicketById(req.valid.params.id, req.user);
    next();
  } catch (err) {
    next(err);
  }
}

export async function attachmentUpload(req, res, next) {
  try {
    const ticketId = req.valid.params.id;

    if (!req.files?.length) throw createHttpError(400, "No files uploaded");

    const attachments = await createAttachments(ticketId, req.files, req.user.id);

    return res.status(201).json(attachments);
  } catch (err) {
    next(err);
  }
}

export async function attachmentDownload(req, res, next) {
  try {
    const { id, attachmentId } = req.valid.params;

    await findTicketById(id, req.user);
    const attachment = await findAttachment(id, attachmentId);

    // res.download sets Content-Disposition: attachment, so the browser saves
    // the file instead of rendering it. That matters: these are caller-supplied
    // bytes, and an inline text/html one would run on our origin.
    return res.download(storedPath(attachment), attachment.filename);
  } catch (err) {
    next(err);
  }
}
