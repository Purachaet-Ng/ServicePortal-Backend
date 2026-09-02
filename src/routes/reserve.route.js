import express from 'express'
import {getCars, createCar, updateCar} from '../controllers/car.controller.js'
import  {getRooms, createBooking, updateBooking,createRoom } from '../controllers/room.controller.js'
import { validate } from '../middlewares/validate.js'
import { createBookingSchema, createRoomSchema, updateBookingSchema, updateBookingStatusSchema } from '../validators/room.validator.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { idParams } from '../validators/common.validator.js'


const reserveRoute = express.Router()

reserveRoute.use(authenticate)
// Cars
// reserveRoute.use('/', getCars)
// reserveRoute.post('/cars', createCar)
// reserveRoute.patch('/carId', updateCar)

// Rooms
reserveRoute.get('/rooms', getRooms)
reserveRoute.post('/rooms',validate({body:createRoomSchema}) ,createRoom)
reserveRoute.post('/rooms/bookings', validate({body:createBookingSchema }) ,createBooking)
// reserveRoute.patch('/rooms/:roomId', validate({body:updateRoomSchema}) ,updateRoom)
reserveRoute.patch('/rooms/bookings/:id', 
    validate({
        body:updateBookingSchema, 
        params:idParams
    }) ,
        updateBooking)


export default reserveRoute