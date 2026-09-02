import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import { idParams } from "../validators/common.validator.js";
import {
  getDepartment,
  listDepartments,
  deleteDepartment,
} from "../controllers/departments.controller.js";


const router = Router();

router.use(authenticate);

router.get("/", listDepartments);

router.get(
  "/:id",
  validate({ params: idParams }),
  getDepartment,
);


// เปิดใช้งาน route หลังจากเพิ่ม createDepartmentSchema
// และ import authorize/createDepartmentByAdmin ครบ

// router.post(
//   "/",
//   authorize("ADMIN_SYSTEM"),
//   validate({ body: createDepartmentSchema }),
//   createDepartmentByAdmin,
// );

// เปิดใช้งาน route หลังจากเพิ่ม createDepartmentSchema
// และ import authorize/updateDepartmentSchema ครบ

// router.patch(
//   "/:id",
//   authorize("ADMIN_SYSTEM"),
//   validate({ params: idParams, body: updateDepartmentSchema }),
//   updateDepartment,
// );

router.delete(
  "/:id",
  authorize("ADMIN_SYSTEM"),
  validate({ params: idParams }),
  deleteDepartment,
);



export default router;
