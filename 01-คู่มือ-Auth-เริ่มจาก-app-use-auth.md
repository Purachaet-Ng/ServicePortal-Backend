# 01 — คู่มือทำ Auth เริ่มจาก `app.use("/auth")`

คู่มือนี้ทำเฉพาะ `/auth` เท่านั้น ไม่รวม `/users` และไม่ใช้ Zod หรือ Validation Middleware

เป้าหมาย:

```js
app.use("/auth", authRouter);
```

เส้นทางที่จะได้:

```text
POST /auth/register
POST /auth/login
```

โครงสร้างการทำงาน:

```text
app.js → auth.route.js → auth.controller.js → auth.service.js
                                             → Prisma/PostgreSQL
                                             → bcrypt
                                             → JWT
```

---

# STEP 1 — เริ่มที่ `src/app.js`

ใส่ import ด้านบน:

```js
import authRouter from "./routes/auth.route.js";
```

วางบรรทัดนี้หลัง `express.json()` และ CORS:

```js
app.use("/auth", authRouter);
```

ไฟล์เต็ม:

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

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/auth", authRouter);

export default app;
```

ตอนนี้ยังไม่รัน Server เพราะ `auth.route.js` ยังไม่ได้สร้าง ให้ทำ STEP 2 ต่อทันที

---

# STEP 2 — ทำ Register Route

สร้าง `src/routes/auth.route.js`:

```js
import { Router } from "express";
import { register } from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", register);

export default router;
```

Express นำ path มาต่อกัน:

```text
/auth + /register = /auth/register
```

ยังไม่รัน Server เพราะ Controller ยังไม่ได้สร้าง

---

# STEP 3 — ทำ Register Controller

สร้าง `src/controllers/auth.controller.js`:

```js
import { registerUser } from "../services/auth.service.js";

export async function register(req, res, next) {
  try {
    const user = await registerUser(req.body);

    return res.status(201).json({
      message: "สมัครสมาชิกสำเร็จ",
      user: user,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    next(error);
  }
}
```

Controller ทำเพียงสามอย่าง:

1. รับ `req.body`
2. ส่งให้ Service
3. ตอบ HTTP `201`

ยังไม่รัน Server เพราะ Service ยังไม่ได้สร้าง

---

# STEP 4 — ทำ Register Service

สร้าง `src/services/auth.service.js`:

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
```

Service ทำงานตามลำดับ:

```text
หา Email → Hash Password → สร้าง STAFF → คืนข้อมูลที่ไม่มี Password
```

`src/lib/prisma.js` เป็น Prisma กลางของโปรเจกต์ งาน Auth เพียง import มาใช้ ไม่สร้าง Prisma Client ซ้ำ

### CHECKPOINT 1 — Register Syntax

```powershell
node --check src/services/auth.service.js
node --check src/controllers/auth.controller.js
node --check src/routes/auth.route.js
node --check src/app.js
```

ทุกคำสั่งต้องไม่มี SyntaxError

### CHECKPOINT 2 — เปิด Server

```powershell
npm run dev
```

เปิด:

```text
GET http://localhost:8000/api/health
```

ต้องได้:

```json
{ "status": "ok" }
```

### CHECKPOINT 3 — Postman Register

```text
POST http://localhost:8000/auth/register
```

Body → raw → JSON:

```json
{
  "name": "Test User",
  "email": "test@example.com",
  "password": "Password123",
  "departmentId": null
}
```

ต้องได้ `201 Created`, role เป็น `STAFF` และ Response ไม่มี `passwordHash`

ส่ง Email เดิมซ้ำต้องได้ `409 Conflict`

**หยุดตรงนี้:** ถ้า Register ยังไม่ผ่าน ห้ามทำ Login

---

# STEP 5 — ทำ JWT หลัง Register ผ่าน

ใส่เต็มไฟล์ `src/utils/jwt.js`:

```js
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
```

เพิ่มใน `.env`:

```env
JWT_SECRET_KEY="ข้อความสุ่มยาวอย่างน้อย-32-ตัวอักษร"
JWT_EXPIRES_IN="1d"
```

### CHECKPOINT 4 — JWT Syntax

```powershell
node --check src/utils/jwt.js
```

---

# STEP 6 — เพิ่ม Login ใน Service

เพิ่ม import ด้านบนของ `src/services/auth.service.js`:

```js
import { signAccessToken } from "../utils/jwt.js";
```

เพิ่ม function นี้ท้ายไฟล์:

```js
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
```

Service ทำงานตามลำดับ:

```text
หา User → bcrypt เปรียบเทียบ Password → สร้าง JWT → คืน Token/User
```

---

# STEP 7 — เพิ่ม Login Controller

แก้ import ด้านบนของ `src/controllers/auth.controller.js`:

```js
import {
  loginUser,
  registerUser,
} from "../services/auth.service.js";
```

เพิ่ม function นี้ท้ายไฟล์:

```js
export async function login(req, res, next) {
  try {
    const result = await loginUser(req.body);

    return res.status(200).json({
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    next(error);
  }
}
```

---

# STEP 8 — เพิ่ม Login Route

แก้ import ใน `src/routes/auth.route.js`:

```js
import {
  login,
  register,
} from "../controllers/auth.controller.js";
```

เพิ่ม Route ต่อจาก Register:

```js
router.post("/login", login);
```

ไฟล์ Router สุดท้าย:

```js
import { Router } from "express";
import {
  login,
  register,
} from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);

export default router;
```

### CHECKPOINT 5 — Login Syntax

```powershell
node --check src/utils/jwt.js
node --check src/services/auth.service.js
node --check src/controllers/auth.controller.js
node --check src/routes/auth.route.js
```

ต้องไม่มี SyntaxError และ Server ต้องยังเปิดได้

### CHECKPOINT 6 — Postman Login

```text
POST http://localhost:8000/auth/login
```

```json
{
  "email": "test@example.com",
  "password": "Password123"
}
```

ต้องได้ `200 OK` พร้อม `token`

Password ผิดต้องได้ `401 Unauthorized`

Post-response Script สำหรับเก็บ Token:

```js
const body = pm.response.json();
pm.environment.set("token", body.token);
pm.environment.set("userId", body.user.id);
```

---

# CHECKPOINT ปิดงาน Auth

| รายการ | ผลที่ต้องได้ |
|---|---|
| `GET /api/health` | `200` |
| `POST /auth/register` | `201` |
| Register Email ซ้ำ | `409` |
| User ใหม่ | Role `STAFF` |
| `POST /auth/login` | `200` + JWT |
| Login Password ผิด | `401` |
| Response | ไม่มี `passwordHash` |

ผ่านครบแล้วจึงถือว่า `/auth` เสร็จ และค่อยเริ่มคู่มือ `/users` แยกอีกไฟล์
