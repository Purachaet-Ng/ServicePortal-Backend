import bcrypt from "bcrypt";
import { signAccessToken } from "../utils/jwt.js";
import { prisma } from "../lib/prisma.js";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  departmentId: true,
  createdAt: true,
};

function createServiceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function registerUser(data) {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: data.email,
    },
  });

  if (existingUser) {
    throw createServiceError(409, "Email นี้ถูกใช้งานแล้ว");
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash: passwordHash,
      departmentId: data.departmentId,
      role: "STAFF",
    },
    select: publicUserSelect,
  });

  return user;
}

export async function loginUser(data) {
  const userWithPassword = await prisma.user.findUnique({
    where: {
      email: data.email,
    },
  });

  if (!userWithPassword) {
    throw createServiceError(401, "Email หรือ password ไม่ถูกต้อง");
  }

  const passwordMatches = await bcrypt.compare(
    data.password,
    userWithPassword.passwordHash,
  );

  if (!passwordMatches) {
    throw createServiceError(401, "Email หรือ password ไม่ถูกต้อง");
  }

  const token = signAccessToken(userWithPassword);

  const user = await prisma.user.findUnique({
    where: {
      id: userWithPassword.id,
    },
    select: publicUserSelect,
  });

  return {
    token: token,
    user: user,
  };
}