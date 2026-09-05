import express from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import { idParams } from "../validators/common.validator.js";
import { updateRequestTypeSchema } from "../validators/requestType.validator.js";
import {
  deleteRequestType,
  getRequestType,
  updateRequestType,
} from "../controllers/requestType.controller.js";

const router = express.Router();

router.use(authenticate);

router.get("/:id", validate({ params: idParams }), getRequestType);

router.patch(
  "/:id",
  authorize("ADMIN_DEPT", "ADMIN_SYSTEM"),
  validate({ params: idParams, body: updateRequestTypeSchema }),
  updateRequestType,
);

router.delete(
  "/:id",
  authorize("ADMIN_DEPT", "ADMIN_SYSTEM"),
  validate({ params: idParams }),
  deleteRequestType,
);

export default router;
