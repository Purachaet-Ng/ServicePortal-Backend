import bcrypt from "bcrypt";
import {
  createUser,
  findPublicUserById,
  findUserByEmail,
} from "../services/users.service.js";
import {
  createAdminDeptToken,
  createAdminSystemToken,
  createStaffToken,
} from "../utils/jwt.js";
import createHttpError from "http-errors";

export async function register(req, res, next) {
  try {
    const existingUser = await findUserByEmail(req.body.email);

    if (existingUser) {
      throw createHttpError(409, "Email already exists");
    }

    const passwordHash = await bcrypt.hash(req.body.password, 12);

    const user = await createUser({
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      email: req.body.email,
      passwordHash: passwordHash,
      departmentId: Number(req.body.departmentId),
      role: "STAFF",
    });

    return res.status(201).json({
      message: "Registration successful",
      user: user,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const userWithPassword = await findUserByEmail(req.body.email);
    let isMatch = false;

    if (userWithPassword) {
      try {
        isMatch = await bcrypt.compare(
          req.body.password,
          userWithPassword.passwordHash,
        );
      } catch {
        isMatch = false;
      }
    }

    if (!userWithPassword || !isMatch) {
      throw createHttpError(401, "Invalid credentials");
    }

    let token;

    if (userWithPassword.role === "STAFF") {
      token = await createStaffToken(userWithPassword);
    }

    if (userWithPassword.role === "ADMIN_DEPT") {
      token = await createAdminDeptToken(userWithPassword);
    }

    if (userWithPassword.role === "ADMIN_SYSTEM") {
      token = await createAdminSystemToken(userWithPassword);
    }

    const user = await findPublicUserById(userWithPassword.id);

    return res.status(200).json({
      token: token,
      user: user,
    });
  } catch (error) {
    next(error);
  }
}
