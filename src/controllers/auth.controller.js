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

export async function register(req, res, next) {
  try {
    const existingUser = await findUserByEmail(req.body.email);

    if (existingUser) {
      return res.status(409).json({
        message: "Email is already in use",
      });
    }

    const passwordHash = await bcrypt.hash(req.body.password, 12);

    const user = await createUser({
      name: req.body.name,
      email: req.body.email,
      passwordHash: passwordHash,
      departmentId: req.body.departmentId,
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

    if (!userWithPassword) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const passwordMatches = await bcrypt.compare(
      req.body.password,
      userWithPassword.passwordHash,
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
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
