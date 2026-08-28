# 06 — คู่มือทำ `/api/auth` และ `/api/users` ทีละก้อนจนทดสอบ Postman ได้

คู่มือนี้ต่อจากสถานะปัจจุบันของโปรเจกต์โดยตรง เมื่อทำครบจะได้ API ดังนี้

## ลำดับบังคับของคู่มือนี้

คู่มือนี้แบ่งเป็นสองงาน ห้ามทำข้ามช่วง:

```text
ช่วงที่ 1: Shared setup → /api/auth/register → /api/auth/login
         → mount เฉพาะ auth → Postman Auth → CHECKPOINT AUTH ผ่าน

ช่วงที่ 2: เริ่มได้หลัง Auth ผ่านเท่านั้น
         → /api/users/me → ADMIN/SYSTEM_ADMIN routes
         → mount users → Postman Users → CHECKPOINT USERS ผ่าน
```

เมื่อพบข้อความ **หยุดตรงนี้** ห้ามสร้างไฟล์ของช่วงถัดไป ให้เปิด Server และทดสอบ Postman ของช่วงปัจจุบันจนผลตรงทั้งหมดก่อน

## Technology stack ของทีม

คู่มือนี้อิงตาม stack ของโปรเจกต์เท่านั้น:

- **Express** — สร้าง HTTP Server, Middleware และ Routes
- **Prisma ORM** — ติดต่อฐานข้อมูล PostgreSQL ผ่าน `@prisma/adapter-pg`
- **PostgreSQL** — ฐานข้อมูลหลักของระบบ (`provider = "postgresql"`)
- **Zod** — ตรวจและแปลงข้อมูลจาก Body และ Params ก่อนเข้า Controller
- **JWT + bcrypt** — JWT สำหรับยืนยันตัวตน และ bcrypt สำหรับ hash/ตรวจรหัสผ่าน
- **Multer** — ใช้เมื่อเพิ่ม API อัปโหลดไฟล์ เช่น รูปโปรไฟล์หรือไฟล์แนบ
- **Nodemailer** — ใช้เมื่อเพิ่มระบบส่งอีเมล เช่น ลืมรหัสผ่านหรือแจ้งเตือน
- **Socket.IO** — ใช้เมื่อเพิ่มเหตุการณ์ realtime เช่น notification หรือสถานะ ticket

สำหรับ `/api/auth` และ `/api/users` ในคู่มือนี้ Express, Prisma/PostgreSQL, Zod, JWT และ bcrypt ถูกใช้งานโดยตรง ส่วน Multer, Nodemailer และ Socket.IO ยังไม่ถูกเรียกใช้ เพราะ schema `User` ปัจจุบันยังไม่มีรูปโปรไฟล์หรือ reset-token และสอง Route นี้ยังไม่มี requirement ส่งอีเมล/realtime ห้ามเพิ่มการเรียก library เปล่า ๆ เพียงเพื่อให้ครบชื่อ เพราะจะทำให้ API ซับซ้อนโดยไม่มีหน้าที่รองรับ

| Method | URL | สิทธิ์ | หน้าที่ |
|---|---|---|---|
| `POST` | `/api/auth/register` | ทุกคน | สมัครสมาชิก (บังคับ role เป็น `USER`) |
| `POST` | `/api/auth/login` | ทุกคน | เข้าสู่ระบบและรับ JWT |
| `GET` | `/api/users/me` | Login | ดูข้อมูลตัวเอง |
| `PATCH` | `/api/users/me` | Login | แก้ชื่อและแผนกของตัวเอง |
| `PATCH` | `/api/users/me/password` | Login | เปลี่ยนรหัสผ่านตัวเอง |
| `GET` | `/api/users` | ADMIN, SYSTEM_ADMIN | ดูผู้ใช้ทั้งหมด |
| `GET` | `/api/users/:id` | ADMIN, SYSTEM_ADMIN | ดูผู้ใช้หนึ่งคน |
| `PATCH` | `/api/users/:id/role` | SYSTEM_ADMIN | เปลี่ยน role |
| `DELETE` | `/api/users/:id` | SYSTEM_ADMIN | ลบผู้ใช้ |

> URL ทุกเส้นมี `/api` เพราะ `src/app.js` กำหนด `const API = "/api"` อยู่แล้ว

## กติกาก่อนเริ่ม

ทำจากบนลงล่าง ห้ามข้าม CHECKPOINT หากคำสั่งใด error ให้หยุดแก้ก่อน ไฟล์ที่ยังไม่มีให้สร้างตาม path ที่ระบุ

ตรวจ `.env` ให้มีอย่างน้อย:

```env
PORT=8000
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
JWT_SECRET="เปลี่ยนข้อความนี้เป็นข้อความสุ่มยาวอย่างน้อย-32-ตัวอักษร"
JWT_EXPIRES_IN="1d"
CORS_ORIGIN="http://localhost:5173"
```

`DATABASE_URL` ต้องเป็น PostgreSQL connection string และต้องสอดคล้องกับ `provider = "postgresql"` ใน `prisma/schema.prisma` ตัวอย่างรูปแบบ:

```text
postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE_NAME?schema=public
```

ตรวจ dependencies ที่ทีมกำหนดจาก root ของ Backend:

```powershell
npm ls express @prisma/client @prisma/adapter-pg zod jsonwebtoken bcrypt multer nodemailer socket.io
```

ต้องไม่มี `UNMET DEPENDENCY` ก่อนเริ่มทำ Route

ห้าม commit `.env` ขึ้น Git และห้ามใช้ `JWT_SECRET` ตัวอย่างในระบบจริง

---

# ส่วน A — ปรับ Role ใน Prisma

ระบบนี้มี 3 ระดับสิทธิ์:

| Role | สิทธิ์ |
|---|---|
| `USER` | ใช้งานระบบและจัดการข้อมูลของตัวเอง |
| `ADMIN` | ใช้งานระบบและดูรายชื่อ/รายละเอียดผู้ใช้ |
| `SYSTEM_ADMIN` | สิทธิ์สูงสุด ดูและจัดการได้ทุกส่วนของระบบ เปลี่ยน role และลบได้ทั้งบัญชี USER และ ADMIN |

กติกาหลักของระบบคือ `SYSTEM_ADMIN` ผ่านการตรวจ Role ทุก Route อัตโนมัติ ดังนั้นในอนาคตแม้ Route จะเขียน `requireRole("USER")` หรือ `requireRole("ADMIN")` ผู้ใช้ `SYSTEM_ADMIN` ก็ยังเข้าได้ ส่วน Route ที่ต้องการเพียงผู้ Login ทุกคนให้ใช้ `requireAuth` ตามเดิม

`SYSTEM_ADMIN` จัดการบัญชี `USER` และ `ADMIN` ได้ทั้งหมด ได้แก่ ดูข้อมูล เปลี่ยน role และลบบัญชี ข้อห้ามเพียงอย่างเดียวใน Controller นี้คือห้ามลบบัญชี SYSTEM_ADMIN ที่กำลัง Login อยู่เอง เพื่อป้องกันการตัดสิทธิ์ผู้ดูแลกลาง session

## 1. แก้ `prisma/schema.prisma`

**ไฟล์ปลายทาง:** `prisma/schema.prisma`

**ตำแหน่งวาง:** ค้นหา `enum Role` แล้วแทนที่ enum เดิมทั้งก้อน จากนั้นค้นหา field `role` ภายใน `model User` และแก้เฉพาะค่า `@default(...)`

**ทำไมต้องแก้:** Prisma Schema เป็นต้นทางของชนิดข้อมูลทั้งใน PostgreSQL และ Prisma Client ถ้า Controller ใช้ `USER` หรือ `SYSTEM_ADMIN` แต่ enum ใน Schema ยังเป็น `EMPLOYEE`/`AGENT` คำสั่งสร้างหรือแก้ User จะล้มเหลวทันที

**ผลหลังทำ:** Database และ Prisma Client จะรู้จัก Role เพียงสามค่าเท่านั้น ค่าอื่น เช่น `SUPER_ADMIN` จะไม่สามารถบันทึกได้

แทนที่ enum `Role` เดิม:

```prisma
enum Role {
  USER
  ADMIN
  SYSTEM_ADMIN
}
```

จากนั้นแก้ค่าเริ่มต้นใน model `User`:

```prisma
role Role @default(USER)
```

### CHECKPOINT 1 — อัปเดต Database และ Prisma Client

หากยังเป็นฐานข้อมูลทดลองและไม่ต้องเก็บข้อมูลเดิม ใช้:

```powershell
npx prisma validate
npx prisma db push
npx prisma generate
```

หากมีข้อมูลจริงที่ต้องเก็บ ห้ามใช้คำสั่ง reset ให้สร้าง migration และตรวจ SQL ก่อนนำไปใช้:

```powershell
npx prisma validate
npx prisma migrate dev --name change-user-roles
npx prisma generate
```

ถ้า migration แจ้งว่าค่า role เดิม `AGENT` หรือ `EMPLOYEE` แปลงไม่ได้ ให้หยุดและสำรองข้อมูลก่อน แล้วกำหนดการแปลง `EMPLOYEE → USER` และ `AGENT → ADMIN` ใน migration SQL ให้เรียบร้อย

**ต้องผ่านครบก่อนทำข้อ 2:**

- `npx prisma validate` ต้องแสดงว่า Schema valid
- คำสั่งอัปเดต Database ต้องไม่มี `P1001`, `P1012` หรือข้อความ data loss ที่ยังไม่ได้ตรวจ
- `npx prisma generate` ต้องสร้าง Prisma Client สำเร็จ
- เปิด Prisma Studio แล้ว field `role` ต้องเลือกได้เฉพาะ `USER`, `ADMIN`, `SYSTEM_ADMIN`

---

# ส่วน B — Validation และ Middleware กลาง

## 2. ใส่โค้ดเต็มไฟล์ `src/validators/auth.validator.js`

**ไฟล์ปลายทาง:** `src/validators/auth.validator.js`

**ตำแหน่งวาง:** ไฟล์นี้มีอยู่แต่ยังว่าง ให้วางโค้ดทั้งก้อนเป็นเนื้อหาทั้งหมดของไฟล์

**หน้าที่ของไฟล์:** กำหนดรูปแบบข้อมูลที่อนุญาตสำหรับ Register และ Login ก่อนส่งให้ Controller ถ้าข้อมูลไม่ผ่าน Controller และ Database จะยังไม่ถูกเรียก

```js
import { z } from "zod";

const email = z.string().trim().email("รูปแบบ email ไม่ถูกต้อง").toLowerCase();
const password = z
  .string()
  .min(8, "password ต้องมีอย่างน้อย 8 ตัวอักษร")
  .max(72, "password ต้องไม่เกิน 72 ตัวอักษร");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email,
  password,
  departmentId: z.coerce.number().int().positive().nullable().optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "กรุณากรอก password"),
});
```

ไม่รับ `role` ตอนสมัคร เพื่อป้องกันผู้ใช้ส่ง `"role": "ADMIN"` หรือ `"SYSTEM_ADMIN"` มาเอง

### อธิบายโค้ดทีละส่วน

- `z.string().trim()` บังคับให้เป็นข้อความและตัดช่องว่างหัวท้าย
- `.email()` ปฏิเสธข้อความที่ไม่ใช่รูปแบบอีเมล
- `.toLowerCase()` ทำให้ `USER@EXAMPLE.COM` และ `user@example.com` ถูกเก็บเป็นรูปแบบเดียวกัน
- bcrypt รองรับ input ยาวได้จำกัด จึงกำหนด password ไม่เกิน 72 ตัวอักษร และกำหนดขั้นต่ำ 8 ตัว
- `departmentId` เป็น optional เพราะผู้สมัครอาจยังไม่สังกัดแผนก เป็น nullable เพื่ออนุญาต `null` และใช้ `z.coerce.number()` เพื่อแปลงค่าตัวเลขที่มาเป็น string
- Login ไม่ใช้กฎขั้นต่ำ 8 ตัว เพราะหน้าที่ของ Login คือรับค่าที่ผู้ใช้กรอกแล้วนำไปเทียบ hash ไม่ควรเปิดเผยผ่าน Validation ว่ารหัสเดิมมีรูปแบบอย่างไร

**ข้อมูลเข้า Register:** `name`, `email`, `password` และ `departmentId` ที่ไม่บังคับ

**ข้อมูลเข้า Login:** `email` และ `password`

**สิ่งที่จงใจไม่รับ:** `id`, `passwordHash`, `role`, `createdAt` เพราะ Server/Database เป็นผู้กำหนด

## 3. สร้าง `src/middlewares/validate.middleware.js`

**ไฟล์ปลายทาง:** `src/middlewares/validate.middleware.js`

**หน้าที่ของไฟล์:** เป็น Middleware กลางที่นำ Schema ไปใช้ได้ทั้ง `req.body` และ `req.params` โดยไม่ต้องเขียน Validation ซ้ำในทุก Route

```js
export const validate = (schema, source = "body") => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    return res.status(400).json({
      message: "ข้อมูลไม่ถูกต้อง",
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  req[source] = result.data;
  next();
};
```

### ลำดับการทำงาน

```text
Postman ส่ง request
→ validate(schema) อ่าน req.body หรือ req.params
→ safeParse ตรวจและแปลงข้อมูล
→ ไม่ผ่าน: ตอบ 400 และหยุด
→ ผ่าน: เขียนค่าที่ตรวจแล้วกลับเข้า req[source]
→ next() ส่งต่อไป Middleware/Controller ตัวถัดไป
```

ใช้ `safeParse` เพราะคืนผลสำเร็จ/ไม่สำเร็จโดยไม่ throw error ส่วน `issue.path.join(".")` ทำให้ Postman เห็นว่า field ใดผิด เช่น `email` หรือ `departmentId`

### CHECKPOINT 2 — ตรวจ syntax

```powershell
node --check src/validators/auth.validator.js
node --check src/middlewares/validate.middleware.js
```

ทั้งสองคำสั่งต้องไม่แสดง SyntaxError

ถ้าเห็น `Cannot find module 'zod'` ให้รัน `npm ls zod` ตรวจ dependency ก่อน ห้ามแก้ import เป็น path อื่น หาก SyntaxError ระบุบรรทัดใดให้กลับไปเทียบ code block ของไฟล์นั้นจนผ่านทั้งสามคำสั่ง

---

# ส่วน C — JWT และการตรวจสิทธิ์

## 4. ใส่โค้ดเต็มไฟล์ `src/utils/jwt.js`

**ไฟล์ปลายทาง:** `src/utils/jwt.js`

**ตำแหน่งวาง:** ไฟล์มีอยู่แต่ยังว่าง ให้วางโค้ดทั้งหมดแทนเนื้อหาเดิม

**หน้าที่ของไฟล์:** รวมการสร้างและตรวจ JWT ไว้จุดเดียว Controller จึงไม่ต้องรู้รายละเอียด secret หรือวันหมดอายุ

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

export const verifyAccessToken = (token) => jwt.verify(token, getSecret());
```

### JWT ก้อนนี้เก็บอะไร

- `sub` คือ Subject หรือ id ของเจ้าของ token เก็บเป็น string ตามรูปแบบ JWT
- `role` คือสิทธิ์ ณ เวลาที่ Login ใช้ช่วยระบุบริบทของ token
- `expiresIn` กำหนดอายุ token จาก `.env` หรือใช้ `1d`
- ไม่ใส่ password, passwordHash หรือข้อมูลส่วนตัวอื่นใน token เพราะ payload อ่านได้ด้วยการ decode แม้แก้ไขไม่ได้โดยไม่มี secret

`getSecret()` ทำให้ Server หยุดด้วย error ที่อ่านรู้เรื่องหากลืมตั้ง `JWT_SECRET` แทนการออก token ด้วย secret ว่าง

## 5. สร้าง `src/middlewares/auth.middleware.js`

**ไฟล์ปลายทาง:** `src/middlewares/auth.middleware.js`

**หน้าที่ของไฟล์:** `requireAuth` ตรวจว่า request เป็นของผู้ใช้ที่ Login และยังมีบัญชีอยู่จริง ส่วน `requireRole` ตรวจระดับสิทธิ์หลังจาก Authentication ผ่านแล้ว

```js
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../utils/jwt.js";

export const requireAuth = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "กรุณาส่ง Bearer token" });
    }

    const token = authorization.slice(7).trim();
    const payload = verifyAccessToken(token);
    const userId = Number(payload.sub);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ message: "Token ไม่ถูกต้อง" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return res.status(401).json({ message: "ไม่พบผู้ใช้ของ token นี้" });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token หมดอายุ" });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Token ไม่ถูกต้อง" });
    }
    next(error);
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "กรุณาเข้าสู่ระบบ" });
  }

  // SYSTEM_ADMIN เป็นสิทธิ์สูงสุด ผ่าน Role Guard ทุก Route อัตโนมัติ
  if (req.user.role === "SYSTEM_ADMIN") {
    return next();
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "ไม่มีสิทธิ์ใช้งานเส้นทางนี้" });
  }
  next();
};
```

### อธิบาย `requireAuth` ตามลำดับ

1. อ่าน Header `Authorization`
2. บังคับรูปแบบ `Bearer TOKEN`
3. ตัดคำว่า `Bearer ` ออกแล้วตรวจ signature และวันหมดอายุด้วย `verifyAccessToken`
4. อ่าน user id จาก `payload.sub`
5. Query User จาก PostgreSQL อีกครั้ง จึงปฏิเสธ token ของบัญชีที่ถูกลบ และได้ role ล่าสุดจากฐานข้อมูล
6. เก็บ `{ id, role }` ใน `req.user` เพื่อให้ Controller ถัดไปใช้งาน
7. Token หมดอายุตอบ `401`; Token ปลอมหรือเสียตอบ `401`; error Database ส่งให้ Error Handler

### อธิบาย `requireRole`

ต้องวางหลัง `requireAuth` เพราะใช้ `req.user` หากเป็น `SYSTEM_ADMIN` จะ `next()` ทันทีตามกติกาสิทธิ์สูงสุด ถ้าไม่ใช่จึงตรวจว่า role อยู่ในรายการที่ Route อนุญาตหรือไม่

ความหมายของสถานะต่างกัน:

- `401 Unauthorized` = ยังพิสูจน์ตัวตนไม่ได้ เช่น ไม่มี token
- `403 Forbidden` = Login แล้ว แต่ role ไม่มีสิทธิ์

### CHECKPOINT 3 — ตรวจ syntax

```powershell
node --check src/utils/jwt.js
node --check src/middlewares/auth.middleware.js
```

**ผลที่ต้องได้:** Terminal คืน prompt โดยไม่มีข้อความ SyntaxError ทั้งสองคำสั่ง และ `.env` ต้องมี `JWT_SECRET` จริง จากนั้นจึงไป Controller

---

# ส่วน D — Auth Controller และ Route

## 6. สร้าง `src/controllers/auth.controller.js`

**ไฟล์ปลายทาง:** `src/controllers/auth.controller.js`

**หน้าที่ของไฟล์:** รับข้อมูลที่ผ่าน Zod แล้ว ทำ Business Logic กับ bcrypt/JWT และอ่านเขียน User ผ่าน Prisma

```js
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../utils/jwt.js";

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

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: "Email นี้ถูกใช้งานแล้ว" });
    }

    if (departmentId != null) {
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true },
      });
      if (!department) {
        return res.status(400).json({ message: "ไม่พบ departmentId ที่ระบุ" });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, departmentId, role: "USER" },
      select: publicUserSelect,
    });

    return res.status(201).json({ message: "สมัครสมาชิกสำเร็จ", user });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const userWithPassword = await prisma.user.findUnique({ where: { email } });

    if (!userWithPassword) {
      return res.status(401).json({ message: "Email หรือ password ไม่ถูกต้อง" });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      userWithPassword.passwordHash,
    );
    if (!passwordMatches) {
      return res.status(401).json({ message: "Email หรือ password ไม่ถูกต้อง" });
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

### อธิบาย Register ทีละช่วง

1. รับค่าจาก `req.body` ซึ่งผ่าน `registerSchema` แล้ว
2. ค้น email ก่อน ถ้ามีอยู่ตอบ `409 Conflict`
3. ถ้าส่ง `departmentId` ให้ตรวจว่ามี Department จริงก่อน เพื่อคืน error ที่เข้าใจง่าย
4. `bcrypt.hash(password, 12)` สร้าง salted hash; Database เก็บเฉพาะ `passwordHash`
5. Prisma สร้าง User โดย Server บังคับ `role: "USER"`
6. `select: publicUserSelect` จำกัด response ไม่ให้ `passwordHash` หลุดออกไป
7. สำเร็จตอบ `201 Created`

### อธิบาย Login ทีละช่วง

1. ค้น User ด้วย email
2. ถ้าไม่พบหรือ password ไม่ตรง ตอบข้อความเดียวกัน เพื่อไม่บอกผู้โจมตีว่า email ใดมีบัญชี
3. `bcrypt.compare()` เปรียบเทียบ password กับ hash โดยไม่ถอดรหัส hash
4. `signAccessToken()` ออก token หลังตรวจรหัสสำเร็จเท่านั้น
5. ตอบ `200` พร้อม `token` และข้อมูล User ที่ปลอดภัย

ทุก function ครอบ `try/catch` และเรียก `next(error)` เพื่อให้ Error Handler กลางเป็นผู้ตอบ error ที่ไม่คาดคิด

## 7. สร้าง `src/routes/auth.route.js`

**ไฟล์ปลายทาง:** `src/routes/auth.route.js`

**หน้าที่ของไฟล์:** จับคู่ Method/URL กับ Validation และ Controller โดย Route นี้ยังไม่ใช้ `requireAuth` เพราะผู้สมัครและผู้ Login ยังไม่มี token

```js
import { Router } from "express";
import { login, register } from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { loginSchema, registerSchema } from "../validators/auth.validator.js";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);

export default router;
```

ลำดับสำคัญคือ `validate(...)` ต้องอยู่ก่อน Controller:

```text
POST /register → registerSchema → register Controller
POST /login    → loginSchema    → login Controller
```

### CHECKPOINT 4 — ตรวจ Auth

```powershell
node --check src/controllers/auth.controller.js
node --check src/routes/auth.route.js
```

**ต้องผ่าน:** ไม่มี SyntaxError, ชื่อ export/import ตรงกันทุกตัว และยังไม่รัน Postman ตอนนี้เพราะ Route ยังไม่ได้ mount ใน `app.js`

## 8. Mount เฉพาะ `/api/auth` ใน `src/app.js`

**หยุดทำเฉพาะ Auth ก่อน:** ขั้นนี้ยังไม่ import หรือ mount `userRouter`

แทนที่ `src/app.js` ด้วยฉบับ Auth-only นี้:

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

### CHECKPOINT 5 — เปิด Server สำหรับ Auth

```powershell
node --check src/app.js
npm run dev
```

ต้องเห็น `Server is running on: http://localhost:8000` และ `GET http://localhost:8000/api/health` ต้องได้ `200` ห้ามเริ่มไฟล์ `/users` หาก Server เปิดไม่ได้

## 9. ทดสอบ `/api/auth` ด้วย Postman ให้จบ

สร้าง Environment variables:

| Variable | Value |
|---|---|
| `baseUrl` | `http://localhost:8000/api` |
| `token` | เว้นว่าง |
| `userId` | เว้นว่าง |

### 9.1 Register

`POST {{baseUrl}}/auth/register` เลือก Body → raw → JSON:

```json
{
  "name": "Somchai User",
  "email": "somchai@example.com",
  "password": "Password123"
}
```

ต้องได้ `201`, role ต้องเป็น `USER` และ Response ต้องไม่มี `passwordHash` ยิง email เดิมซ้ำต้องได้ `409` และ password สั้นต้องได้ `400`

### 9.2 Login

`POST {{baseUrl}}/auth/login`:

```json
{
  "email": "somchai@example.com",
  "password": "Password123"
}
```

ต้องได้ `200` พร้อม `token` ใน Post-response Script ใส่:

```js
const body = pm.response.json();
if (body.token) pm.environment.set("token", body.token);
if (body.user?.id) pm.environment.set("userId", body.user.id);
```

Login password ผิดต้องได้ `401`

### CHECKPOINT 6 — ประตูจบ Auth

| รายการ | ผลบังคับ |
|---|---|
| Health | `200` |
| Register สำเร็จ | `201` และ role `USER` |
| Register email ซ้ำ | `409` |
| Register body ผิด | `400` |
| Login สำเร็จ | `200` และได้ token |
| Login password ผิด | `401` |
| ความลับใน Response | ไม่มี `password`/`passwordHash` |

เมื่อผ่านครบและ Postman Environment มี `token` กับ `userId` แล้วเท่านั้น จึงเริ่มส่วน Users ด้านล่าง

---

# ส่วน E — เริ่ม `/api/users` หลัง Auth ผ่านแล้วเท่านั้น

## 10. สร้าง `src/validators/user.validator.js`

**ไฟล์ปลายทาง:** `src/validators/user.validator.js`

```js
import { z } from "zod";

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    departmentId: z.coerce.number().int().positive().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "ต้องส่งอย่างน้อยหนึ่ง field",
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

export const userIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateRoleSchema = z.object({
  role: z.enum(["USER", "ADMIN", "SYSTEM_ADMIN"]),
});
```

### อธิบายทีละ Schema

- `updateMeSchema` ให้แก้เฉพาะชื่อ/แผนกและปฏิเสธ `{}`
- `changePasswordSchema` บังคับรหัสเดิมก่อนตั้งรหัสใหม่
- `userIdSchema` แปลง id จาก URL string เป็นจำนวนเต็มบวก
- `updateRoleSchema` รับเฉพาะ Role ที่ Prisma รองรับ

### CHECKPOINT 7 — User Validation

```powershell
node --check src/validators/user.validator.js
```

ต้องไม่มี SyntaxError จึงสร้าง User Controller

## 11. สร้าง `src/controllers/user.controller.js`

**ไฟล์ปลายทาง:** `src/controllers/user.controller.js`

**หน้าที่ของไฟล์:** จัดการข้อมูล User หลัง `requireAuth` ยืนยันตัวตนแล้ว แยกงานของเจ้าของบัญชีออกจากงานผู้ดูแลระบบ

```js
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  departmentId: true,
  department: { select: { id: true, name: true } },
  createdAt: true,
};

export const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: userSelect,
    });
    return res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (req, res, next) => {
  try {
    const { name, departmentId } = req.body;

    if (departmentId != null) {
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true },
      });
      if (!department) {
        return res.status(400).json({ message: "ไม่พบ departmentId ที่ระบุ" });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(departmentId !== undefined && { departmentId }),
      },
      select: userSelect,
    });
    return res.status(200).json({ message: "แก้ไขข้อมูลสำเร็จ", user });
  } catch (error) {
    next(error);
  }
};

export const changeMyPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      currentUser.passwordHash,
    );
    if (!passwordMatches) {
      return res.status(400).json({ message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash },
    });
    return res.status(200).json({ message: "เปลี่ยนรหัสผ่านสำเร็จ" });
  } catch (error) {
    next(error);
  }
};

export const listUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: userSelect,
      orderBy: { id: "asc" },
    });
    return res.status(200).json({ users });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: userSelect,
    });
    if (!user) return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    return res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (req, res, next) => {
  try {
    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!target) return res.status(404).json({ message: "ไม่พบผู้ใช้" });

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: req.body.role },
      select: userSelect,
    });
    return res.status(200).json({ message: "เปลี่ยน role สำเร็จ", user });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: "SYSTEM_ADMIN ลบบัญชีตัวเองไม่ได้" });
    }

    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!target) return res.status(404).json({ message: "ไม่พบผู้ใช้" });

    await prisma.user.delete({ where: { id: req.params.id } });
    return res.status(200).json({ message: "ลบผู้ใช้สำเร็จ" });
  } catch (error) {
    next(error);
  }
};
```

### อธิบายแต่ละ Controller

- `getMe` ใช้ `req.user.id` จาก token ไม่รับ id จาก Body ผู้ใช้จึงดูข้อมูลตัวเองเท่านั้น
- `updateMe` อัปเดตเฉพาะ field ที่ส่งมา การใช้ spread แบบมีเงื่อนไขทำให้ field ที่ไม่ส่งไม่ถูกเขียนทับ
- `changeMyPassword` ตรวจรหัสเดิมก่อน hash รหัสใหม่ด้วย cost 12 และไม่คืน hash ใน response
- `listUsers` คืนรายการเรียงตาม id และใช้ `userSelect` ที่ไม่มี passwordHash
- `getUserById` ใช้ id ที่ Zod แปลงเป็น number แล้ว ไม่พบตอบ `404`
- `updateUserRole` ตรวจว่าบัญชีเป้าหมายมีจริงก่อนเปลี่ยน role
- `deleteUser` อนุญาต SYSTEM_ADMIN ลบ USER หรือ ADMIN แต่ป้องกันการลบบัญชีที่กำลังใช้ token ของตัวเอง

`userSelect` ถูกประกาศครั้งเดียวเพื่อให้ทุก response ใช้มาตรฐานเดียวกัน และ include ชื่อ Department โดยไม่ดึงข้อมูลทั้งตาราง

> การลบ user ที่มี Ticket, Comment, Booking หรือข้อมูลสัมพันธ์อยู่ อาจได้ `409` จาก Foreign Key ตาม Error Handler ด้านล่าง นี่เป็นพฤติกรรมที่ปลอดภัยกว่าการลบข้อมูลลูกทั้งหมดอัตโนมัติ

## 12. สร้าง `src/routes/user.route.js`

ลำดับ `/me` ต้องอยู่ก่อน `/:id` เพื่ออ่านคำว่า `me` เป็น route คงที่

```js
import { Router } from "express";
import {
  changeMyPassword,
  deleteUser,
  getMe,
  getUserById,
  listUsers,
  updateMe,
  updateUserRole,
} from "../controllers/user.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  changePasswordSchema,
  updateMeSchema,
  updateRoleSchema,
  userIdSchema,
} from "../validators/user.validator.js";

const router = Router();

router.use(requireAuth);

router.get("/me", getMe);
router.patch("/me", validate(updateMeSchema), updateMe);
router.patch(
  "/me/password",
  validate(changePasswordSchema),
  changeMyPassword,
);

router.get("/", requireRole("ADMIN"), listUsers);
router.get(
  "/:id",
  requireRole("ADMIN"),
  validate(userIdSchema, "params"),
  getUserById,
);
router.patch(
  "/:id/role",
  requireRole("SYSTEM_ADMIN"),
  validate(userIdSchema, "params"),
  validate(updateRoleSchema),
  updateUserRole,
);
router.delete(
  "/:id",
  requireRole("SYSTEM_ADMIN"),
  validate(userIdSchema, "params"),
  deleteUser,
);

export default router;
```

### อ่านลำดับ Middleware ของ Route

`router.use(requireAuth)` ทำให้ทุกเส้นด้านล่างต้อง Login โดยไม่ต้องเขียนซ้ำ จากนั้นแต่ละเส้นจึงเพิ่ม Validation และ Role Guard ตามหน้าที่

ตัวอย่างการเปลี่ยน Role:

```text
PATCH /:id/role
→ requireAuth ตรวจ token และสร้าง req.user
→ requireRole ตรวจว่าต้องเป็น SYSTEM_ADMIN
→ validate params แปลง id เป็น number
→ validate body ตรวจ role
→ updateUserRole เขียน Database
```

Route `/me` ต้องประกาศก่อน `/:id` เพื่อให้ Express ไม่ตีความคำว่า `me` เป็นค่า id

### CHECKPOINT 8 — ตรวจไฟล์ Users

```powershell
node --check src/controllers/user.controller.js
node --check src/routes/user.route.js
```

**ต้องผ่าน:** ไม่มี SyntaxError และตรวจด้วยตาว่า `router.use(requireAuth)` อยู่ก่อน Route ทุกเส้น หากวางไว้ท้ายไฟล์ Route ก่อนหน้าจะไม่ถูกป้องกัน

---

# ส่วน F — Error Handler และประกอบเข้า `app.js`

## 13. สร้าง `src/middlewares/error.middleware.js`

**ไฟล์ปลายทาง:** `src/middlewares/error.middleware.js`

**หน้าที่ของไฟล์:** ตอบ Route ที่ไม่มีจริงและรวม error ที่ Controller ส่งผ่าน `next(error)` ให้มีรูปแบบเดียวกัน

```js
export const notFound = (req, res) => {
  res.status(404).json({ message: `ไม่พบ ${req.method} ${req.originalUrl}` });
};

export const errorHandler = (error, req, res, next) => {
  console.error(error);

  if (error.code === "P2002") {
    return res.status(409).json({ message: "ข้อมูล unique นี้มีอยู่แล้ว" });
  }
  if (error.code === "P2003") {
    return res.status(409).json({
      message: "ลบหรือแก้ไขไม่ได้ เพราะข้อมูลนี้ถูกใช้งานโดยข้อมูลอื่น",
    });
  }

  return res.status(500).json({ message: "เกิดข้อผิดพลาดภายใน Server" });
};
```

- `notFound` ต้องอยู่หลัง Route ทั้งหมด มิฉะนั้นทุก request จะถูกตอบ 404 ก่อนถึง Route
- `errorHandler` ต้องมี parameter 4 ตัว Express จึงรู้ว่าเป็น Error Middleware
- `P2002` คือ unique constraint เช่น email ซ้ำในจังหวะ request พร้อมกัน
- `P2003` คือ foreign key constraint เช่นลบ User ที่ Ticket ยังอ้างอิง
- Production ไม่ส่ง stack trace หรือรายละเอียด Database กลับไปยังผู้ใช้

## 14. ประกอบ `/api/users` เพิ่มใน `src/app.js`

**ไฟล์ปลายทาง:** `src/app.js`

**หน้าที่ของไฟล์:** ประกอบ Middleware และ Router ทั้งหมดตามลำดับ ส่วน `server.js` มีหน้าที่เรียก `app.listen()` อยู่แล้วจึงไม่ต้องแก้

สองบรรทัด comment เดิมจะกลายเป็นการ mount route จริงที่ `${API}/auth` และ `${API}/users`

```js
import "dotenv/config";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.route.js";
import userRouter from "./routes/user.route.js";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";

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
app.use(`${API}/users`, userRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
```

### ทำไมลำดับใน `app.js` สำคัญ

1. `express.json()` ต้องมาก่อน Route เพื่ออ่าน JSON Body
2. `cors()` กำหนด Frontend origin
3. Health Route ใช้ตรวจว่า Server เปิดได้โดยไม่แตะ Authentication
4. Auth/Users Router ถูก mount ใต้ `/api`
5. `notFound` รับเฉพาะ request ที่ไม่ตรง Route ด้านบน
6. `errorHandler` อยู่ท้ายสุดเพื่อรับ error จากทุกชั้น

เมื่อ mount `${API}/auth` กับ path `/login` ภายใน Router URL สุดท้ายจึงเป็น `/api/auth/login` ไม่ใช่ `/auth/login`

### CHECKPOINT 9 — เปิด Server ฉบับ Auth + Users

```powershell
node --check src/app.js
node --check src/middlewares/error.middleware.js
npx prisma validate
npx prisma generate
npm run dev
```

ต้องเห็น:

```text
Server is running on: http://localhost:8000
```

เปิด `GET http://localhost:8000/api/health` ต้องได้ `200`:

```json
{ "status": "ok" }
```

**ห้ามไป Postman หากยังไม่ผ่านทั้งหมด:**

- `node --check` ต้องไม่มี SyntaxError
- Prisma validate/generate ต้องสำเร็จ
- Server ต้องไม่ปิดตัวเองหลังเริ่ม
- Health ต้องตอบภายในไม่กี่วินาที
- Terminal ต้องไม่มี `JWT_SECRET is not configured`, Prisma connection error หรือ import error

ปล่อย Terminal ที่รัน Server เปิดไว้ตลอดการทดสอบ Postman ถ้าแก้ `.env` ให้หยุดด้วย `Ctrl+C` แล้วเริ่ม `npm run dev` ใหม่

---

# ส่วน G — ทดสอบ `/api/users` หลังประกอบ Route แล้ว

ใช้ Environment `Service Portal Local` และค่า `token` ที่ได้จาก CHECKPOINT Auth ห้ามย้อนกลับไป Register/Login ใหม่โดยไม่จำเป็น

## 15. ตั้ง Authorization สำหรับ Users requests

ในแต่ละ request ของ `/users` เลือก `Authorization` → Type `Bearer Token` → Token:

```text
{{token}}
```

### 15.1 ดูตัวเอง

`GET {{baseUrl}}/users/me` ต้องได้ `200` และไม่มี `passwordHash`

### 15.2 แก้ชื่อตัวเอง

`PATCH {{baseUrl}}/users/me`

```json
{
  "name": "Somchai Updated"
}
```

ต้องได้ `200` และชื่อใหม่ หากส่ง `{}` ต้องได้ `400`

### 15.3 เปลี่ยนรหัสผ่าน

`PATCH {{baseUrl}}/users/me/password`

```json
{
  "currentPassword": "Password123",
  "newPassword": "NewPassword456"
}
```

ต้องได้ `200` จากนั้น login ด้วยรหัสเก่าต้องได้ `401` และรหัสใหม่ต้องได้ `200`

### CHECKPOINT 10 — Route ของเจ้าของบัญชี

ทดสอบ `GET /users/me` หนึ่งครั้งโดยเอา Authorization ออก ต้องได้ `401` จากนั้นใส่ `Bearer {{token}}` กลับแล้วต้องได้ `200` การแก้ชื่อและเปลี่ยนรหัสผ่านต้องผ่านครบ หากได้ `500` ให้ดู error จริงใน Terminal และหยุดแก้ก่อนสร้าง SYSTEM_ADMIN

## 16. สร้าง SYSTEM_ADMIN สำหรับทดสอบ

ระบบตั้งใจไม่ให้สมัครเป็น SYSTEM_ADMIN ผ่าน API ให้เปลี่ยนผู้ใช้ทดสอบหนึ่งคนใน Prisma Studio:

```powershell
npx prisma studio
```

เปิดตาราง `User` → เลือก user → เปลี่ยน `role` จาก `USER` เป็น `SYSTEM_ADMIN` → Save แล้วปิด Studioด้วย `Ctrl+C`

**ต้อง Login ใหม่หลังเปลี่ยน role** เพื่อรับ token ใหม่ที่ payload เป็น SYSTEM_ADMIN แล้วให้ Postmanเก็บ `token` ใหม่จากข้อ 15

## 17. ทดสอบสิทธิ์ ADMIN และ SYSTEM_ADMIN

### 17.1 ดูผู้ใช้ทั้งหมด

`GET {{baseUrl}}/users` ต้องได้ `200`

ทั้ง ADMIN และ SYSTEM_ADMIN ต้องได้ `200`; ถ้าใช้ token ของ USER ต้องได้ `403 Forbidden`

เพราะ `SYSTEM_ADMIN` ผ่าน `requireRole` ทุกครั้ง หลักเดียวกันนี้จะใช้กับโมดูลอื่นในอนาคต เช่น Tickets, Departments, Events, Reserves และ Inventories ด้วย จึงสามารถดูและจัดการทุกส่วนได้โดยไม่ต้องเพิ่มชื่อ SYSTEM_ADMIN ซ้ำในแต่ละ Route

### 17.2 ดูผู้ใช้ตาม id

`GET {{baseUrl}}/users/{{userId}}` ต้องได้ `200`

ลอง id ที่ไม่มี เช่น `/users/999999` ต้องได้ `404`

### 17.3 เปลี่ยน role — เฉพาะ SYSTEM_ADMIN

`PATCH {{baseUrl}}/users/{{userId}}/role`

```json
{
  "role": "ADMIN"
}
```

ต้องได้ `200` และ role เป็น `ADMIN`; ถ้าใช้ token ของ ADMIN ต้องได้ `403` และถ้าส่ง role อื่นนอกเหนือจาก 3 ค่าที่กำหนดต้องได้ `400`

### 17.4 ลบผู้ใช้ — เฉพาะ SYSTEM_ADMIN

สมัคร USER ทดสอบใหม่อีกคนก่อน แล้วใช้ id ของคนนั้น:

`DELETE {{baseUrl}}/users/ID_ของ_user_ทดสอบ`

ต้องได้ `200`; ยิงซ้ำต้องได้ `404`

จากนั้นสร้างบัญชีทดสอบอีกบัญชี เปลี่ยน role เป็น `ADMIN` และทดลองลบด้วย token ของ SYSTEM_ADMIN ต้องได้ `200` เช่นกัน จึงยืนยันว่า SYSTEM_ADMIN ลบได้ทั้ง USER และ ADMIN

ถ้าพยายามลบ id ของ SYSTEM_ADMIN ที่กำลัง Login ต้องได้ `400`; ถ้าใช้ token ของ ADMIN ลบบัญชีใด ๆ ต้องได้ `403`

### CHECKPOINT 11 — ตารางสิทธิ์สุดท้าย

ใช้ token ของแต่ละ Role ทดสอบให้ครบ:

| การทำงาน | USER | ADMIN | SYSTEM_ADMIN |
|---|---:|---:|---:|
| `/users/me` | 200 | 200 | 200 |
| ดูผู้ใช้ทั้งหมด | 403 | 200 | 200 |
| ดูผู้ใช้ตาม id | 403 | 200 | 200 |
| เปลี่ยน role | 403 | 403 | 200 |
| ลบ USER | 403 | 403 | 200 |
| ลบ ADMIN | 403 | 403 | 200 |

ถ้าผลไม่ตรงตาราง ห้ามถือว่างานผ่าน ให้ตรวจ token ว่า Login ใหม่หลังเปลี่ยน Role แล้ว และตรวจลำดับ `requireAuth`/`requireRole` ใน `user.route.js`

---

# QC ปิดงาน

ถือว่าสอง route สมบูรณ์เมื่อผ่านทั้งหมด:

- `GET /api/health` ได้ `200`
- Register ได้ `201`, email ซ้ำได้ `409`, body ผิดได้ `400`
- Login ถูกได้ `200`, password ผิดได้ `401`
- ไม่ส่ง token เข้า `/api/users/me` ได้ `401`
- USER ใช้ `/api/users` ได้ `403`
- ADMIN ใช้ list/get ได้ แต่ change role/delete ได้ `403`
- SYSTEM_ADMIN ใช้ list/get/change role/delete ได้ และลบได้ทั้ง USER กับ ADMIN
- SYSTEM_ADMIN ผ่าน Role Guard ของทุกโมดูล และเข้าถึง Route ที่ต้อง Login ด้วย `requireAuth` ได้ทั้งหมด
- Response ทุกเส้นไม่มี `passwordHash`
- Terminal ไม่มี unhandled error และคำสั่ง `npx prisma validate` ผ่าน

## ปัญหาที่พบบ่อย

| อาการ | จุดตรวจ |
|---|---|
| `404 POST /auth/login` | URL ที่ถูกคือ `/api/auth/login` |
| `401 กรุณาส่ง Bearer token` | Authorization ต้องเป็น `Bearer {{token}}` |
| เปลี่ยน role แล้วยังได้สิทธิ์เดิม | Login ใหม่เพื่อออก token ใหม่ |
| `JWT_SECRET is not configured` | เพิ่มค่าใน `.env` แล้ว restart server |
| `P1001` หรือ connect database ไม่ได้ | ตรวจ PostgreSQL และ `DATABASE_URL` |
| `ไม่พบ departmentId` | ไม่ส่ง field นี้ หรือสร้าง Department ก่อน |
| ลบ user แล้วได้ `409` | user มีข้อมูลอื่นอ้างอิงอยู่ ต้องจัดการข้อมูลสัมพันธ์ก่อน |
