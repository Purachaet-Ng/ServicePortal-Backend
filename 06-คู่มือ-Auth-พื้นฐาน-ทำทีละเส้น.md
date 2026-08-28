# 06 — Auth พื้นฐาน ทำทีละเส้น

คู่มือนี้ทำเฉพาะ `/api/auth` แบบพื้นฐานที่สุด

```text
JWT → Register → Postman Register → Login → Postman Login
```

ไม่มี Zod, Validation Middleware, Auth Middleware และไม่มีโค้ดดัก Body เหมาะสำหรับดู flow หลักก่อนนำระบบตรวจข้อมูลของเพื่อนมาต่อภายหลัง

ไฟล์ที่ใช้:

```text
src/utils/jwt.js
src/controllers/auth.controller.js
src/routes/auth.route.js
src/app.js
```

`src/lib/prisma.js` เกี่ยวกับงาน เพราะ Controller ใช้ติดต่อ PostgreSQL แต่ถ้าไฟล์เดิมเชื่อมต่อได้แล้วไม่ต้องแก้ เพียง import มาใช้

---

# STEP 0 — ตรวจของกลาง

`.env`:

```env
PORT=8000
DATABASE_URL="postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE_NAME?schema=public"
JWT_SECRET="ข้อความสุ่มยาวอย่างน้อย-32-ตัวอักษร"
JWT_EXPIRES_IN="1d"
CORS_ORIGIN="http://localhost:5173"
```

Prisma Role:

```prisma
enum Role {
  USER
  ADMIN
  SYSTEM_ADMIN
}
```

ใน `model User`:

```prisma
role Role @default(USER)
```

### CHECKPOINT 0

```powershell
npx prisma validate
npx prisma generate
node --check src/lib/prisma.js
```

ต้องผ่านก่อนเริ่ม JWT

---

# STEP 1 — ทำ JWT ก่อน

## 1.1 ใส่เต็มไฟล์ `src/utils/jwt.js`

```js
import jwt from "jsonwebtoken";

const getSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }
  return process.env.JWT_SECRET;
};

export const signAccessToken = (user) =>
  jwt.sign(
    { sub: String(user.id), role: user.role },
    getSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" },
  );
```

JWT ยังไม่ถูกใช้ใน Register แต่ต้องเตรียมก่อน เพราะ Login จะเรียก `signAccessToken`

- `sub` เก็บ User ID
- `role` เก็บ Role ตอน Login
- `expiresIn` กำหนดวันหมดอายุ
- Secret อ่านจาก `.env`

### CHECKPOINT 1

```powershell
node --check src/utils/jwt.js
```

ต้องไม่มี SyntaxError

---

# STEP 2 — ทำเฉพาะ Register

## 2.1 สร้าง `src/controllers/auth.controller.js`

ตอนนี้ใส่เฉพาะ Register:

```js
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  departmentId: true,
  createdAt: true,
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password, departmentId } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ message: "Email นี้ถูกใช้งานแล้ว" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        departmentId,
        role: "USER",
      },
      select: publicUserSelect,
    });

    return res.status(201).json({
      message: "สมัครสมาชิกสำเร็จ",
      user,
    });
  } catch (error) {
    next(error);
  }
};
```

### Register ทำงานตามลำดับ

```text
รับ Body
→ Prisma หา email เดิม
→ bcrypt hash password
→ Prisma สร้าง User role USER
→ ตอบ 201
```

`publicUserSelect` ทำให้ Response ไม่มี `passwordHash` และ Controller บังคับ `role: "USER"` โดยไม่อ่าน role จาก Postman

## 2.2 สร้าง `src/routes/auth.route.js`

ตอนนี้มีเฉพาะ Register:

```js
import { Router } from "express";
import { register } from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", register);

export default router;
```

## 2.3 ใส่เต็มไฟล์ `src/app.js`

```js
import "dotenv/config";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.route.js";

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  }),
);

const API = "/api";

app.get(`${API}/health`, (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(`${API}/auth`, authRouter);

export default app;
```

`express.json()` ต้องอยู่ก่อน Router เพื่อให้ Controller อ่าน `req.body` ได้

### CHECKPOINT 2 — Syntax และ Server

```powershell
node --check src/controllers/auth.controller.js
node --check src/routes/auth.route.js
node --check src/app.js
npm run dev
```

เปิด `GET http://localhost:8000/api/health` ต้องได้:

```json
{ "status": "ok" }
```

## 2.4 Postman Register

`POST http://localhost:8000/api/auth/register`

Body → raw → JSON:

```json
{
  "name": "Test User",
  "email": "test@example.com",
  "password": "Password123",
  "departmentId": null
}
```

ต้องได้ `201 Created`, role เป็น `USER` และไม่มี `passwordHash`

ยิง email เดิมซ้ำต้องได้ `409 Conflict`

### CHECKPOINT 3 — จบ Register

- Health ได้ `200`
- Register ได้ `201`
- User ถูกสร้างใน PostgreSQL
- password ใน Database เป็น hash
- Response ไม่มี passwordHash
- email ซ้ำได้ `409`

**หยุดตรงนี้:** ถ้ายังไม่ผ่าน ห้ามเพิ่ม Login

---

# STEP 3 — เพิ่ม Login หลัง Register ผ่าน

## 3.1 เพิ่ม import ใน `src/controllers/auth.controller.js`

วางต่อจาก import เดิม:

```js
import { signAccessToken } from "../utils/jwt.js";
```

## 3.2 เพิ่ม Login ท้าย `src/controllers/auth.controller.js`

```js
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const userWithPassword = await prisma.user.findUnique({
      where: { email },
    });

    if (!userWithPassword) {
      return res.status(401).json({
        message: "Email หรือ password ไม่ถูกต้อง",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      userWithPassword.passwordHash,
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Email หรือ password ไม่ถูกต้อง",
      });
    }

    const token = signAccessToken(userWithPassword);

    const user = await prisma.user.findUnique({
      where: { id: userWithPassword.id },
      select: publicUserSelect,
    });

    return res.status(200).json({ token, user });
  } catch (error) {
    next(error);
  }
};
```

### Login ทำงานตามลำดับ

```text
รับ email/password
→ Prisma หา User
→ bcrypt.compare กับ passwordHash
→ JWT sign token
→ ตอบ 200 พร้อม token
```

## 3.3 แก้ import ใน `src/routes/auth.route.js`

เปลี่ยนจาก:

```js
import { register } from "../controllers/auth.controller.js";
```

เป็น:

```js
import { login, register } from "../controllers/auth.controller.js";
```

## 3.4 เพิ่ม Login Route

วางต่อจาก Register Route:

```js
router.post("/login", login);
```

ไฟล์ Router สุดท้าย:

```js
import { Router } from "express";
import { login, register } from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);

export default router;
```

### CHECKPOINT 4 — Login Syntax

```powershell
node --check src/controllers/auth.controller.js
node --check src/routes/auth.route.js
```

ต้องไม่มี SyntaxError และ Server ต้องยังเปิดได้

## 3.5 Postman Login

`POST http://localhost:8000/api/auth/login`

```json
{
  "email": "test@example.com",
  "password": "Password123"
}
```

ต้องได้ `200 OK` พร้อม `token`

ทดลอง password ผิด:

```json
{
  "email": "test@example.com",
  "password": "WrongPassword"
}
```

ต้องได้ `401 Unauthorized`

### CHECKPOINT 5 — จบ `/api/auth`

- Register ยังได้ `201`
- Login ถูกได้ `200` พร้อม JWT
- Login ผิดได้ `401`
- Response ไม่มี passwordHash
- Terminal ไม่มี unhandled error

ผ่านแล้วจึงถือว่า Auth พื้นฐานเสร็จ ยังไม่เริ่ม `/api/users`
