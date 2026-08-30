import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { idParams } from "../validators/common.validator.js";
import {
  updateUserRoleSchema,
  updateUserSchema,
} from "../validators/user.validator.js";
import {
  createUserByAdmin,
  getUser,
  listUsers,
  updateUser,
  updateUserRole,
  deleteUser
} from "../controllers/users.controller.js";

const router = Router();

router.get("/", listUsers);
router.get("/:id", validate({ params: idParams }), getUser);
router.patch(
  "/:id",
  validate({ params: idParams, body: updateUserSchema }),
  updateUser,
);
router.patch(
  "/:id/role",
  validate({ params: idParams, body: updateUserRoleSchema }),
  updateUserRole,
);
// ชั่วคราว
router.post("/", createUserByAdmin);
// รอ authenticate authorize("ADMIN_SYSTEM")
router.delete(
  "/:id",
  validate({ params: idParams }),
  deleteUser,
);




export default router;
