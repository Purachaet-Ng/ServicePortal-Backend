import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import { idParams } from "../validators/common.validator.js";
import {
  getDepartment,
  listDepartments,
  deleteDepartment,
  createDepartmentByAdmin,
  updateDepartment,
} from "../controllers/departments.controller.js";
import {
  createRequestTypeByDepartment,
  listRequestTypesByDepartment,
} from "../controllers/requestType.controller.js";
import { departmentSchema } from "../validators/department.validator.js";
import {
  createRequestTypeSchema,
  deptIdParams,
} from "../validators/requestType.validator.js";

const router = Router();

router.use(authenticate);

router.get("/", listDepartments);

router.get(
  "/:deptId/request-types",
  validate({ params: deptIdParams }),
  listRequestTypesByDepartment,
);

router.post(
  "/:deptId/request-types",
  authorize("ADMIN_DEPT", "ADMIN_SYSTEM"),
  validate({ params: deptIdParams, body: createRequestTypeSchema }),
  createRequestTypeByDepartment,
);

router.get(
  "/:id",
  validate({ params: idParams }),
  getDepartment,
);


// เปิดใช้งาน route หลังจากเพิ่ม createDepartmentSchema
// และ import authorize/createDepartmentByAdmin ครบ

router.post(
  "/",
  authorize("ADMIN_SYSTEM"),
  validate({ body: departmentSchema }),
  createDepartmentByAdmin,
);

// เปิดใช้งาน route หลังจากเพิ่ม createDepartmentSchema
// และ import authorize/updateDepartmentSchema ครบ

router.patch(
  "/:id",
  authorize("ADMIN_SYSTEM"),
  validate({ params: idParams, body: departmentSchema }),
  updateDepartment,
);

router.delete(
  "/:id",
  authorize("ADMIN_SYSTEM"),
  validate({ params: idParams }),
  deleteDepartment,
);



export default router;
