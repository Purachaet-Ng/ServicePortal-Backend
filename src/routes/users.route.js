import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { idParams } from "../validators/common.validator.js";
import {
  assignableUserQuery,
  createUserSchema,
  updateUserRoleSchema,
  updateUserSchema,
  UserListQuery,
} from "../validators/user.validator.js";
import {
  createUserByAdmin,
  getUser,
  listUsers,
  updateUser,
  updateUserRole,
  deleteUser,
  getAssignableUser,
} from "../controllers/users.controller.js";

const router = Router();

// Every route below is admin-only. Self-service (a user reading or editing
// their own profile) still needs an owner check and is not covered here.
router.use(authenticate);

router.get(
  "/assignable",
  authorize("ADMIN_SYSTEM", "ADMIN_DEPT"),
  validate({ query: assignableUserQuery }),
  getAssignableUser,
);

router.get("/", authorize("ADMIN_SYSTEM", "ADMIN_DEPT"),validate({query:UserListQuery}), listUsers);

router.get(
  "/:id",
  authorize("ADMIN_SYSTEM", "ADMIN_DEPT"),
  validate({ params: idParams }),
  getUser,
);

router.post(
  "/",
  authorize("ADMIN_SYSTEM"),
  validate({ body: createUserSchema }),
  createUserByAdmin,
);

router.patch(
  "/:id",
  authorize("ADMIN_SYSTEM", "ADMIN_DEPT"),
  validate({ params: idParams, body: updateUserSchema }),
  updateUser,
);

router.patch(
  "/:id/role",
  authorize("ADMIN_SYSTEM"),
  validate({ params: idParams, body: updateUserRoleSchema }),
  updateUserRole,
);

router.delete(
  "/:id",
  authorize("ADMIN_SYSTEM"),
  validate({ params: idParams }),
  deleteUser,
);


export default router;
