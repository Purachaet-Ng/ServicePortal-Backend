import createHttpError from "http-errors";
import {
  findAllDepartments,
  findDepartmentById,
} from "../services/departments.service.js";

export async function listDepartments(req, res, next) {
  try {
    const departments = await findAllDepartments();

    return res.status(200).json({
      departments,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDepartment(req, res, next) {
  try {
    const departmentId = req.valid.params.id;
    const department = await findDepartmentById(departmentId);

    if (!department) {
      throw createHttpError(404, "Department not found");
    }

    return res.status(200).json({
      department,
    });
  } catch (error) {
    next(error);
  }
}