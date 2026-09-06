import createHttpError from "http-errors";

import {
  createRequestType,
  deleteRequestTypeById,
  findRequestTypeById,
  findRequestTypeUsageById,
  findRequestTypesByDepartment,
  updateRequestTypeById,
} from "../services/requestType.service.js";
import { findDepartmentById } from "../services/departments.service.js";

function assertCanManageDepartment(user, departmentId) {
  if (user.role === "ADMIN_DEPT" && user.departmentId !== departmentId) {
    throw createHttpError(
      403,
      "You can only manage your own department's request types",
    );
  }
}

export async function listRequestTypesByDepartment(req, res, next) {
  try {
    const departmentId = req.valid.params.deptId;

    const department = await findDepartmentById(departmentId);
    if (!department) throw createHttpError(404, "Department not found");

    const data = await findRequestTypesByDepartment(departmentId);

    return res.status(200).json({
      data,
      meta: { page: 1, limit: 20, total: data.length },
    });
  } catch (err) {
    next(err);
  }
}

export async function createRequestTypeByDepartment(req, res, next) {
  try {
    const departmentId = req.valid.params.deptId;
    const body = req.valid.body;

    assertCanManageDepartment(req.user, departmentId);

    const department = await findDepartmentById(departmentId);
    if (!department) throw createHttpError(404, "Department not found");

    const requestType = await createRequestType({
      ...body,
      departmentId,
    });

    return res.status(201).json({ data: requestType });
  } catch (err) {
    next(err);
  }
}

export async function getRequestType(req, res, next) {
  try {
    const id = req.valid.params.id;
    const requestType = await findRequestTypeById(id);

    if (!requestType) throw createHttpError(404, "Request type not found");

    return res.status(200).json({ data: requestType });
  } catch (err) {
    next(err);
  }
}

export async function updateRequestType(req, res, next) {
  try {
    const id = req.valid.params.id;
    const body = req.valid.body;

    const existing = await findRequestTypeById(id);
    if (!existing) throw createHttpError(404, "Request type not found");

    assertCanManageDepartment(req.user, existing.departmentId);

    const requestType = await updateRequestTypeById(id, body);

    return res.status(200).json({ data: requestType });
  } catch (err) {
    next(err);
  }
}

export async function deleteRequestType(req, res, next) {
  try {
    const id = req.valid.params.id;

    const existing = await findRequestTypeUsageById(id);
    if (!existing) throw createHttpError(404, "Request type not found");

    assertCanManageDepartment(req.user, existing.departmentId);

    if (existing._count.tickets > 0) {
      throw createHttpError(
        409,
        "Request type is in use and cannot be deleted",
      );
    }

    const requestType = await deleteRequestTypeById(id);

    return res.status(200).json({
      message: "Request type deleted successfully",
      data: requestType,
    });
  } catch (err) {
    if (err.code === "P2003") {
      return next(
        createHttpError(409, "Request type is in use and cannot be deleted"),
      );
    }
    next(err);
  }
}
