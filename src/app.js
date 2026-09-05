import express from "express";
import cors from "cors";
import reserveRoute from "./routes/reserve.route.js";

import authRouter from "./routes/auth.route.js";
import userRouter from "./routes/users.route.js";
import ticketsRoute from "./routes/tickets.route.js";
import requestTypeRouter from "./routes/requestType.route.js";
import { pathNotFound } from "./middlewares/pathNotFound.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import departmentRouter from "./routes/departments.route.js";

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

app.use(`${API}/reserves`, reserveRoute);

app.use(`${API}/tickets`, ticketsRoute);

app.use(`${API}/departments`, departmentRouter);

app.use(`${API}/request-types`, requestTypeRouter);

// app.use("/events");

// app.use("/inventories"); optional

// app.use(validater); all route

app.use(pathNotFound);
app.use(errorHandler);

export default app;
