import carService from "../services/car.service.js"

export const getCars = async (req, res) => {
    try {
        const cars = await carService.getCars()

        res.status(200).json(cars)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const createCar = async (req, res) => {
    try {
        const car = await carService.createCar(req.body)

        res.status(201).json(car)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const updateCar = async (req, res) => {
    try {
        const { carId } = req.params

        const car = await carService.updateCar(
            carId,
            req.body
        )

        res.status(200).json(car)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

// module.exports = {
//     getCars,
//     createCar,
//     updateCar
// }