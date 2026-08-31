import createHttpError from "http-errors";
import {
  findAllDepartments,
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