import createHttpError from "http-errors";
import jwt from "jsonwebtoken";
import {
  verifyAdminDeptToken,
  verifyAdminSystemToken,
  verifyStaffToken,
} from "../utils/jwt.js";
import { findPublicUserById } from "../services/users.service.js";

const verifierByRole = {
  STAFF: verifyStaffToken,
  ADMIN_DEPT: verifyAdminDeptToken,
  ADMIN_SYSTEM: verifyAdminSystemToken,
};

/**
 * Verifies the Bearer token and loads the current user into `req.user`.
 * Use this middleware in a router before authorize() and the controller.
 *
 * Example:
 * router.delete("/:id", authenticate, authorize("ADMIN_SYSTEM"), deleteUser);
 */
export async function authenticate(req, res, next) {
  try {
    const [scheme, token] = (req.headers.authorization ?? "").split(" ");

    if (scheme !== "Bearer" || !token) {
      throw createHttpError(401, "Missing or malformed Authorization header");
    }

    // Each role is signed with its own secret, so the claimed role decides
    // which verifier to use. A forged role just fails verification below,
    // because the attacker still cannot sign with that role's secret.
    const verify = verifierByRole[jwt.decode(token)?.role];

    if (!verify) {
      throw createHttpError(401, "Invalid token");
    }

    let payload;

    try {
      payload = await verify(token);
    } catch (error) {
      throw createHttpError(
        401,
        error.name === "TokenExpiredError" ? "Token expired" : "Invalid token",
      );
    }

    // Read the user back from the database so a deleted account or a role
    // changed through PATCH /users/:id/role takes effect immediately
    // instead of when the old token expires.
    const user = await findPublicUserById(payload.id);

    if (!user) {
      throw createHttpError(401, "Invalid token");
    }

    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Allows the request through only for the listed roles.
 * Must run after authenticate().
 */
export const authorize =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) {
      return next(createHttpError(401, "Authentication required"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(createHttpError(403, "Insufficient permission"));
    }

    next();
  };
