import createHttpError from "http-errors";
import {
  createDepartment,
  findAllDepartments,
  findDepartmentById,
  findDepartmentByName,
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

export async function createDepartmentByAdmin(req, res, next) {
  try {
    const departmentData = req.valid.body;
    const departmentWithSameName = await findDepartmentByName(
      departmentData.name,
    );

    if (departmentWithSameName) {
      throw createHttpError(409, "Department name already exists");
    }

    const department = await createDepartment(departmentData);

    return res.status(201).json({
      message: "Department created successfully",
      department,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return next(createHttpError(409, "Department name already exists"));
    }

    next(error);
  }
}