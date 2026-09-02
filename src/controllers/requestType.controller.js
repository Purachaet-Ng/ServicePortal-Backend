import createHttpError from "http-errors";

import {
  createRequestType,
  getAllRequestType,
} from "../services/requestType.service.js";
import { findDepartmentById } from "../services/departments.service.js";

export async function allRequestType(req, res, next) {
  try {
    const requestType = await getAllRequestType();

    return res.status(200).json({ requestType });
  } catch (err) {
    next(err);
  }
}

export async function requestTypeCreate(req, res, next) {
  try {
    const { departmentId, ...rest } = req.valid.body;

    const department = await findDepartmentById(departmentId);
    if (!department) throw createHttpError(404, "Department not found");

    const requestType = await createRequestType({ ...rest, departmentId });

    return res.status(201).json({ requestType });
  } catch (err) {
    next(err);
  }
}
