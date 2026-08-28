# 01 — Auth แบบแยก Layer สำหรับมือใหม่

## Code style ที่อิงจากโปรเจกต์ Fakebook

คู่มือนี้อิงเฉพาะวิธีจัดและเขียนโค้ดจาก `fakebookback` ไม่ได้เชื่อมต่อหรือคัดลอกระบบ Facebook:

- ใช้ single quote และไม่บังคับ semicolon
- Route อ่านง่ายและเรียก Controller ตรง ๆ
- Controller เป็นคนเรียง Business Flow, ใช้ bcrypt/JWT และกำหนด HTTP error
- Service มีเฉพาะฟังก์ชัน Prisma สำหรับอ่าน/เขียน Database
- ใช้ชื่อฟังก์ชันตรงความหมาย เช่น `getUserByEmail` และ `createUser`
- ใส่ comment ภาษาไทยเฉพาะจุดสำคัญเหมือนตัวอย่าง Fakebook
- Controller ตอบ HTTP error ด้วย `res.status()` โดยไม่ส่ง HTTP status เข้า Service

สิ่งที่ต่างจาก Fakebook และต้องยึดโปรเจกต์นี้:

- Database เป็น PostgreSQL ผ่าน `@prisma/adapter-pg`
- Role คือ `STAFF`, `ADMIN_DEPT`, `ADMIN_SYSTEM`
- JWT ใช้ Secret แยกสาม Role
- JWT payload ใช้ `id` เป็น User ID แบบเดียวกับตัวอย่าง

คำว่า “สไตล์ Facebook” ในคู่มือนี้หมายถึงโครงสร้างที่แบ่งหน้าที่ชัดเจน ไม่เกี่ยวข้องกับ Facebook API หรือ Facebook Login

```text
app.js
→ Route: กำหนด URL
→ Controller: Business Logic, bcrypt, JWT และ HTTP response
→ Service: `users.service.js` ติดต่อ Prisma/PostgreSQL เท่านั้น
→ lib/prisma.js: Prisma Client กลาง
```

ทำเฉพาะ:

```text
POST /auth/register
POST /auth/login
```

ยังไม่ใช้ Zod หรือ Validation Middleware

---

# STEP 1 — เริ่มจาก `app.use("/auth")`

ไฟล์ `src/app.js`:

```js
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

`express.json()` ต้องอยู่ก่อน Auth Router เพื่อให้ Controller อ่าน JSON Body ได้

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

URL สุดท้าย:

```text
/auth + /register = POST /auth/register
```

---

# STEP 3 — ทำ Service สำหรับ Register

Service มีหน้าที่ติดต่อข้อมูลเท่านั้น จึงไม่มี bcrypt, JWT, HTTP status หรือ `createServiceError()`

สร้าง `src/services/users.service.js`:

```js
// รวมคำสั่งที่ติดต่อกับตาราง User ไว้ที่เดียว
import { prisma } from '../lib/prisma.js'

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  departmentId: true,
  createdAt: true
}

export const findUserByEmail = async (email) => {
  return await prisma.user.findUnique({
    where: { email: email }
  })
}

export const createUser = async (userData) => {
  return await prisma.user.create({
    data: userData,
    select: publicUserSelect
  })
}
```

เหตุผลที่เอา `createServiceError()` ออก:

```js
function createServiceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
```

`statusCode` เป็นเรื่อง HTTP แต่ Service ของโครงสร้างนี้รับผิดชอบข้อมูลเท่านั้น การตัดสินใจว่าจะตอบ `409` หรือ `401` จึงอยู่ใน Controller

---

# STEP 4 — ทำ Register Controller

Controller รับผิดชอบ Business Logic, bcrypt และ HTTP response

สร้าง `src/controllers/auth.controller.js`:

```js
import bcrypt from "bcrypt";
import {
  createUser,
  findUserByEmail,
} from "../services/users.service.js";

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
```

Register flow:

```text
Controller → Service หา Email
→ Controller hash Password
→ Service สร้าง User ใน PostgreSQL
→ Controller ตอบ 201
```

### CHECKPOINT 1 — Register Syntax

```powershell
node --check src/services/users.service.js
node --check src/controllers/auth.controller.js
node --check src/routes/auth.route.js
node --check src/app.js
```

ทุกคำสั่งต้องไม่มี SyntaxError

### CHECKPOINT 2 — Postman Register

เปิด Server:

```powershell
npm run dev
```

ตรวจ Health:

```text
GET http://localhost:8000/api/health
```

Register:

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

ต้องได้ `201`, Role `STAFF` และไม่มี `passwordHash` ใน response ก่อนเริ่ม Login

---

# STEP 5 — JWT แยก Secret ตาม 3 Role

Environment ใช้สาม Keys:

```env
JWT_SECRET_KEY="secret-for-staff"
JWT_SECRET_KEY_ADMIN_DEPT="secret-for-department-admin"
JWT_SECRET_KEY_ADMIN_SYSTEM="secret-for-system-admin"
JWT_EXPIRES_IN="1d"
```

ไฟล์ `src/utils/jwt.js`:

```js
import jwt from 'jsonwebtoken'
import 'dotenv/config'

// STAFF
export const createStaffToken = async (STAFF) => {
  const payload = {
    id: STAFF.id,
    role: STAFF.role
  }

  const token = jwt.sign(payload, process.env.JWT_SECRET_KEY, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  })

  return token
}

export const verifyStaffToken = async (token) => {
  return jwt.verify(token, process.env.JWT_SECRET_KEY, {
    algorithms: ['HS256']
  })
}

// ADMIN_DEPT ใช้รูปแบบเดียวกัน แต่ใช้ JWT_SECRET_KEY_ADMIN_DEPT
export const createAdminDeptToken = async (ADMIN_DEPT) => {
  const payload = { id: ADMIN_DEPT.id, role: ADMIN_DEPT.role }
  return jwt.sign(payload, process.env.JWT_SECRET_KEY_ADMIN_DEPT, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  })
}

export const verifyAdminDeptToken = async (token) => {
  return jwt.verify(token, process.env.JWT_SECRET_KEY_ADMIN_DEPT, {
    algorithms: ['HS256']
  })
}

// ADMIN_SYSTEM ใช้ JWT_SECRET_KEY_ADMIN_SYSTEM
export const createAdminSystemToken = async (ADMIN_SYSTEM) => {
  const payload = { id: ADMIN_SYSTEM.id, role: ADMIN_SYSTEM.role }
  return jwt.sign(payload, process.env.JWT_SECRET_KEY_ADMIN_SYSTEM, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  })
}

export const verifyAdminSystemToken = async (token) => {
  return jwt.verify(token, process.env.JWT_SECRET_KEY_ADMIN_SYSTEM, {
    algorithms: ['HS256']
  })
}
```

## ทำไม payload ใช้ `id` และ `role`

ใช้ชื่อตรงไปตรงมาเหมือนตัวอย่าง Doctor/User:

```text
id   = ID ของเจ้าของ Token
role = ระดับสิทธิ์ของเจ้าของ Token
```

สมมติข้อมูลจาก Database คือ:

```js
{
  id: 15,
  role: "STAFF"
}
```

เมื่อสร้าง payload:

```js
const payload = {
  id: user.id,
  role: user.role
}
```

ระบบจะได้:

```js
{
  id: 15,
  role: "STAFF"
}
```

### ลำดับตอน Login

```text
ผู้ใช้ Login สำเร็จ
→ Backend อ่าน id และ role ของ User
→ ใส่ลง JWT payload
→ เซ็น Token ด้วย Secret ตาม Role
→ ส่ง Token กลับไปให้ Frontend/Postman
```

### ลำดับตอนเรียก API ที่ต้อง Login

```text
Frontend/Postman ส่ง Bearer Token
→ Backend ตรวจลายเซ็น Token
→ อ่าน id เพื่อรู้ User ID
→ อ่าน role เพื่อรู้ระดับสิทธิ์
→ อนุญาตหรือปฏิเสธการใช้งาน Route
```

ตัวอย่าง เมื่ออ่าน `id` จาก Token:

```js
const userId = payload.id
```

ถ้า `payload.id` เป็น `15` ระบบจะนำเลขนี้ไปค้น User ใน Database ได้ ต้องตรวจ Token ด้วย `jwt.verify()` ก่อนเสมอ จึงจะเชื่อข้อมูล `id` และ `role` ได้

### CHECKPOINT 3 — JWT

```powershell
node --check src/utils/jwt.js
```

---

# STEP 6 — เพิ่ม Service สำหรับ Login

เพิ่มท้าย `src/services/users.service.js`:

```js
export const findPublicUserById = async (userId) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect
  })
}
```

Service ยังทำเฉพาะการอ่านข้อมูล ไม่ compare Password และไม่สร้าง JWT

---

# STEP 7 — เพิ่ม Login Controller

เพิ่ม imports ใน `src/controllers/auth.controller.js`:

```js
import {
  createAdminDeptToken,
  createAdminSystemToken,
  createStaffToken
} from '../utils/jwt.js'
```

เพิ่ม `findPublicUserById` ใน Service import แล้ววาง function นี้ท้าย Controller:

```js
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

    let token

    if (userWithPassword.role === 'STAFF') {
      token = await createStaffToken(userWithPassword)
    }

    if (userWithPassword.role === 'ADMIN_DEPT') {
      token = await createAdminDeptToken(userWithPassword)
    }

    if (userWithPassword.role === 'ADMIN_SYSTEM') {
      token = await createAdminSystemToken(userWithPassword)
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
```

Login flow:

```text
Controller → Service หา User
→ Controller bcrypt.compare
→ Controller สร้าง JWT ตาม Role
→ Service อ่าน Public User
→ Controller ตอบ 200
```

---

# STEP 8 — เพิ่ม Login Route

ไฟล์สุดท้าย `src/routes/auth.route.js`:

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

### CHECKPOINT 4 — Login Syntax

```powershell
node --check src/utils/jwt.js
node --check src/services/users.service.js
node --check src/controllers/auth.controller.js
node --check src/routes/auth.route.js
```

### CHECKPOINT 5 — Postman Login

```text
POST http://localhost:8000/auth/login
```

```json
{
  "email": "test@example.com",
  "password": "Password123"
}
```

ต้องได้ `200` พร้อม Token ส่วน Password ผิดต้องได้ `401` และข้อความอังกฤษ `Invalid email or password`

---

# STEP 9 — `.gitignore`

```gitignore
# Dependencies
node_modules/

# Environment variables
.env
.env.*
!.env.example

# Generated Prisma Client
generated/prisma/

# Build, coverage, and log files
dist/
coverage/
*.log

# Operating system files
.DS_Store
Thumbs.db
```

`.env` ต้องไม่ขึ้น Git เพราะเก็บ Database URL และ JWT Secrets ทั้งสาม Role ส่วน `.env.example` เก็บเฉพาะชื่อ Keys โดยไม่ใส่ Secret จริง

# CHECKPOINT ปิด Auth

| รายการ | ผลที่ต้องได้ |
|---|---|
| `GET /api/health` | `200` |
| `POST /auth/register` | `201`, Role `STAFF` |
| Email ซ้ำ | `409`, English message |
| `POST /auth/login` | `200` + JWT |
| Password ผิด | `401`, English message |
| JWT payload | มี `id` และ `role` |
| Service | มีเฉพาะ Prisma data access |
| `.gitignore` | ไม่เก็บ `.env`, generated files, logs |

ผ่านครบแล้วจึงเริ่ม `/users` ในคู่มือแยก
