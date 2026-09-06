import express from 'express'
import { getCars, createCar, updateCar, createCarBooking, updateCarBooking, removeCar, getCarByIdController, getCarBokingByIdController, getCarAvailability } from '../controllers/car.controller.js'
import { getRooms, createRoom, updateRoom, updateRoomBooking, removeRoom, getRoomByIdController, getRoomBokingByIdController, getRoomBookingsByDayController } from '../controllers/room.controller.js'
import { validate } from '../middlewares/validate.js'
import { createRoomBookingSchema, createRoomSchema, updateRoomBookingSchema, updateRoomBookingStatusSchema, updateRoomSchema } from '../validators/room.validator.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { idParams } from '../validators/common.validator.js'
import { createCarBookingSchema, createCarSchema, updateCarBookingSchema, updateCarSchema } from '../validators/car.validator.js'


const reserveRoute = express.Router()

reserveRoute.use(authenticate)
// Cars
reserveRoute.get('/cars', getCars)
reserveRoute.get('/cars/:id', validate({ params: idParams}), getCarByIdController)
reserveRoute.get('/cars/bookings/:id', validate({ params: idParams}), getCarBokingByIdController)
reserveRoute.post('/cars', validate({ body: createCarSchema}), createCar)
reserveRoute.post('/cars/bookings', validate({ body: createCarBookingSchema }), createCarBooking)
reserveRoute.patch('/cars/:id', validate({body:updateCarSchema, params: idParams}), updateCar)
reserveRoute.patch('/cars/bookings/:id',validate({body: updateCarBookingSchema, params: idParams}),updateCarBooking)
reserveRoute.delete('/cars/:id',validate({ params: idParams}), removeCar)
reserveRoute.get('/cars/:id/availability', validate({ params: idParams }), getCarAvailability)



// Rooms
reserveRoute.get('/rooms', getRooms)
reserveRoute.get('/rooms/:id', validate({ params: idParams}), getRoomByIdController)
reserveRoute.get('/rooms/bookings/:id', validate({ params: idParams}), getRoomBokingByIdController)
reserveRoute.post('/rooms', validate({ body: createRoomSchema }), createRoom)
reserveRoute.post('/rooms/bookings', validate({ body: createRoomBookingSchema }), createCarBooking)
reserveRoute.patch('/rooms/:id', validate({body:updateRoomSchema, params: idParams}) ,updateRoom)
reserveRoute.patch('/rooms/bookings/:id',validate({body: updateRoomBookingSchema,params: idParams}),updateRoomBooking)
reserveRoute.delete('/rooms/:id',validate({ params: idParams}), removeRoom)
reserveRoute.get('/rooms/:id/bookings', validate({ params: idParams }), getRoomBookingsByDayController)


export default reserveRoute