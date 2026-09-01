import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import { idParams } from "../validators/common.validator.js";
import {
  getDepartment,
  listDepartments,
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




export default router;
