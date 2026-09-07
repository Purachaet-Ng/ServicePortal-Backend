import express from 'express'
import { getCars, createCar, updateCar, createCarBooking, updateCarBooking, removeCar, getCarByIdController, getCarBokingByIdController, getCarAvailability, updateCarBookingStatus } from '../controllers/car.controller.js'
import { getRooms, createRoom, updateRoom, updateRoomBooking, removeRoom, getRoomByIdController, getRoomBokingByIdController, updateRoomBookingStatus, getRoomAvailability, createRoomBooking } from '../controllers/room.controller.js'
import { validate } from '../middlewares/validate.js'
import { createRoomBookingSchema, createRoomSchema, updateRoomBookingSchema, updateRoomBookingStatusSchema, updateRoomSchema } from '../validators/room.validator.js'
import { authenticate, authorize } from '../middlewares/auth.middleware.js'
import { idParams } from '../validators/common.validator.js'
import { createCarBookingSchema, createCarSchema, updateCarBookingSchema, updateCarBookingStatusSchema, updateCarSchema } from '../validators/car.validator.js'


const reserveRoute = express.Router()

reserveRoute.use(authenticate)
// Cars
reserveRoute.get('/cars', getCars)
reserveRoute.get('/cars/:id', validate({ params: idParams}), getCarByIdController)
reserveRoute.get('/cars/bookings/:id', validate({ params: idParams}), getCarBokingByIdController)
reserveRoute.get('/cars/:id/availability', validate({ params: idParams }), getCarAvailability)
reserveRoute.post('/cars', authorize("ADMIN_SYSTEM"), validate({ body: createCarSchema}), createCar)
reserveRoute.post('/cars/bookings', validate({ body: createCarBookingSchema }), createCarBooking)
reserveRoute.patch('/cars/:id', authorize("ADMIN_SYSTEM"), validate({body:updateCarSchema, params: idParams}), updateCar)
reserveRoute.patch('/cars/bookings/:id', authorize("ADMIN_DEPT", "ADMIN_SYSTEM"), validate({body: updateCarBookingSchema, params: idParams}), updateCarBooking)
reserveRoute.patch('/cars/bookings/:id/status', authorize("ADMIN_DEPT", "ADMIN_SYSTEM"), validate({params: idParams,body: updateCarBookingStatusSchema}), updateCarBookingStatus)
reserveRoute.delete('/cars/:id', authorize("ADMIN_SYSTEM"), validate({ params: idParams}), removeCar)



// Rooms
reserveRoute.get('/rooms', getRooms)
reserveRoute.get('/rooms/:id', validate({ params: idParams}), getRoomByIdController)
reserveRoute.get('/rooms/bookings/:id', validate({ params: idParams}), getRoomBokingByIdController)
reserveRoute.get('/rooms/:id/bookings', validate({ params: idParams }), getRoomAvailability)
reserveRoute.post('/rooms', authorize("ADMIN_SYSTEM"), validate({ body: createRoomSchema }), createRoom)
reserveRoute.post('/rooms/bookings', validate({ body: createRoomBookingSchema }), createRoomBooking)
reserveRoute.patch('/rooms/:id', authorize("ADMIN_SYSTEM"), validate({body:updateRoomSchema, params: idParams}) ,updateRoom)
reserveRoute.patch('/rooms/bookings/:id', authorize("ADMIN_DEPT", "ADMIN_SYSTEM"), validate({body: updateRoomBookingSchema,params: idParams}),updateRoomBooking)
reserveRoute.patch('/rooms/bookings/:id/status', authorize("ADMIN_DEPT", "ADMIN_SYSTEM"), validate({params: idParams,body: updateRoomBookingStatusSchema}), updateRoomBookingStatus)
reserveRoute.delete('/rooms/:id', authorize("ADMIN_SYSTEM"), validate({ params: idParams}), removeRoom)


export default reserveRoute