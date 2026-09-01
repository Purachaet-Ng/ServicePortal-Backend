import express from 'express'
import {getCars, createCar, updateCar} from '../controllers/car.controller.js'
import  {getRooms, createBooking, updateBooking } from '../controllers/room.controller.js'
import { validate } from '../middlewares/validate.js'
import { createBookingSchema } from '../validators/room.validator.js'
import { authenticate } from '../middlewares/auth.middleware.js'


const reserveRoute = express.Router()

reserveRoute.use(authenticate)
// Cars
// reserveRoute.use('/', getCars)
// reserveRoute.post('/cars', createCar)
// reserveRoute.patch('/carId', updateCar)

// Rooms
reserveRoute.get('/rooms', getRooms)
// reserveRoute.post('/rooms', )
reserveRoute.post('/rooms/bookings', validate({body:createBookingSchema }) ,createBooking)
reserveRoute.patch('/rooms/:bookingId', updateBooking)

export default reserveRoute