import express from 'express'

const reserveRoute = express.Router()


// Cars
reserveRoute.use('/cars', (req, res)=>{res.send("getcars")} )
reserveRoute.post('/', (req, res)=>{res.send("postcars")})
reserveRoute.patch('/carId',(req, res)=>{res.send("carId")})

// Rooms
reserveRoute.use('/rooms', (req, res)=>{res.send("getrooms")})
reserveRoute.post('/rooms', (req, res)=>{res.send("postrooms")})
reserveRoute.patch('/roomId', (req, res)=>{res.send("roomId")})

export default reserveRoute