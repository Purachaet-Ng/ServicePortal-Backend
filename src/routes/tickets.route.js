// Fiat : Ticket
import express from "express";
import {
  ticketDashboard,
  ticketUpdate,
  ticketCreate,
} from "../controllers/tickets.controller.js";

const router = express.Router();

router.post("/new", ticketCreate);
router.get("/", ticketDashboard);
// router.get('/', import Middleware Auth User เข้ามา, ticketDashboard);

router.patch("/:id", ticketUpdate);

export default router;
