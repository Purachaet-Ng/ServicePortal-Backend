import createHttpError from "http-errors";
import {
  readTicket,
  createTicket,
  updateTicket,
} from "../services/ticket.service.js";

const VALID_ROLES = ["ADMIN_SYSTEM", "ADMIN_DEPT", "STAFF"];

export async function ticketCreate(req, res, next) {
  try {
    const ticket = await createTicket(req.body);
    return res.status(201).json({ message: ticket });
  } catch (err) {
    next(err);
  }
}

export async function ticketDashboard(req, res, next) {
  try {
    if (!req.body) {
      throw createHttpError(401, "ยังไม่มีการล็อกอิน");
    }

    const { userId, role, departmentId } = req.body;

    if (!userId && !role && !departmentId) {
      throw createHttpError(401, "ยังไม่มีการล็อกอิน");
    }

    if (!userId || !role) {
      throw createHttpError(
        400,
        "กรุณาส่ง userId และ role (departmentId จำเป็นสำหรับ ADMIN_DEPT และ STAFF)",
      );
    }

    const id = Number(userId);
    if (Number.isNaN(id)) {
      throw createHttpError(400, "userId ไม่ถูกต้อง");
    }

    if (!VALID_ROLES.includes(role)) {
      throw createHttpError(400, "role ไม่ถูกต้อง");
    }

    const deptId = departmentId ? Number(departmentId) : null;
    const needsDepartment = role === "ADMIN_DEPT" || role === "STAFF";

    if (needsDepartment && (departmentId == null || Number.isNaN(deptId))) {
      throw createHttpError(400, "กรุณาส่ง departmentId สำหรับ role นี้");
    }

    const user = { id, role, departmentId: deptId };
    const tickets = await readTicket(user);

    return res.status(200).json({ tickets });
  } catch (err) {
    next(err);
  }
}

export async function ticketUpdate(req, res, next) {
  try {
    const ticketId = Number(req.params.id);
    const { assignedToId } = req.body;

    const ticketData = updateTicket(ticketId, assignedToId);
    return res.status(200).json({ ticketData });
  } catch (err) {
    next(err);
  }
}
