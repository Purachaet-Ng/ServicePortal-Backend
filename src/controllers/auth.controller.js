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
    const newUserData = req.valid.body;
    const existingUser = await findUserByEmail(newUserData.email);

    if (existingUser) {
      throw createHttpError(409, "Email already exists");
    }

    const passwordHash = await bcrypt.hash(newUserData.password, 12);

    const user = await createUser({
      firstname: newUserData.firstname,
      lastname: newUserData.lastname,
      phone: newUserData.phone,
      email: newUserData.email,
      passwordHash: passwordHash,
      departmentId: newUserData.departmentId,
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
    const { email, password } = req.valid.body;
    const userWithPassword = await findUserByEmail(email);
    let isMatch = false;

    if (userWithPassword) {
      try {
        isMatch = await bcrypt.compare(password, userWithPassword.passwordHash);
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

export function getMe(req, res) {
  return res.status(200).json({
    user: req.user,
  });
}
