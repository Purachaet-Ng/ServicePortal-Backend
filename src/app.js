import express from "express";
import cors from "cors";
import reserveRoute from "./routes/reserve.route.js";

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

// app.use("/auth");

// app.use("/users");

app.use("/reserves", reserveRoute);

// app.use("/tickets");

// app.use("/departments");

// app.use("/events");

// app.use("/inventories"); optional

// app.use(validater); all route

// app.use(pathNotFound);
// app.use(errorHandler);

export default app;
