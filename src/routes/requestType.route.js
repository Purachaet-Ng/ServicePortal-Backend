import express from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import { createRequestTypeSchema } from "../validators/requestType.validator.js";

import {
  allRequestType,
  requestTypeCreate,
} from "../controllers/requestType.controller.js";

const router = express.Router();

router.use(authenticate);

router.get("/", allRequestType);

router.post(
  "/",
  validate({ body: createRequestTypeSchema }),
  requestTypeCreate,
);

export default router;
