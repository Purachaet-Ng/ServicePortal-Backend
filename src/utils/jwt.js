import jwt from "jsonwebtoken";

function getJwtSecret() {
  if (!process.env.JWT_SECRET_KEY) {
    throw new Error("JWT_SECRET_KEY is not configured");
  }

  return process.env.JWT_SECRET_KEY;
}

export function signAccessToken(user) {
  const payload = {
    sub: String(user.id),
    role: user.role,
  };

  const options = {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  };

  return jwt.sign(payload, getJwtSecret(), options);
}