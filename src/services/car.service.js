import {prisma} from "../lib/prisma.js"

export const getCars = async () => {
    return await prisma.car.findMany()
}

export const createCar = async (data) => {

    return await prisma.car.create({
        data
    })
}

export const updateCar = async (carId, data) => {

    return await prisma.car.update({
        where: {
            id: Number(carId)
        },
        data
    })
}

 export default {
}