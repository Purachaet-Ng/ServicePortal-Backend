import express from 'express'
import {getCars, createCar, updateCar} from '../controllers/car.controller.js'
import  {getRooms, createRoom, updateRoom } from '../controllers/room.controller.js'


const reserveRoute = express.Router()


// Cars
reserveRoute.use('/cars', getCars)
reserveRoute.post('/cars', createCar)
reserveRoute.patch('/carId', updateCar)

// Rooms
reserveRoute.use('/rooms', getRooms)
reserveRoute.post('/rooms', createRoom)
reserveRoute.patch('/roomId', updateRoom)

export default reserveRoute