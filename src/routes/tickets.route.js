// Fiat : Ticket
import express from 'express';
import {
  ticketDashboard,
  ticketById,
  ticketCreate,
} from '../controllers/tickets.controller.js';

const router = express.Router();

router.get('/', ticketDashboard);
// router.get('/', import Middleware Auth User เข้ามา, ticketDashboard);

router.post('/new', ticketCreate);

// router.patch('/:id', ticketById);

export default router;
