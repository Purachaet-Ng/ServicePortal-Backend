import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { loginSchema, registerSchema } from "../validators/auth.validator.js";
import { getMe, login, register } from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", validate({ body: registerSchema }), register);

router.post("/login", validate({ body: loginSchema }), login);

router.get("/me", authenticate, getMe);

export default router;
