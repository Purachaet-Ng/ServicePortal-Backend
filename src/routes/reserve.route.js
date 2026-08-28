import express from 'express'

const reserveRoute = express.Router()


// Cars
reserveRoute.use('/cars', (req, res)=>{res.send("getcars")} )
reserveRoute.post('/', (req, res)=>{res.send("postcars")})