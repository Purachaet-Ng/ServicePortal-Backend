import {prisma} from "../lib/prisma.js"

export const getAllCars = async () => {
    const cars = await prisma.car.findMany();

    return cars;
};

export const getCarById = async (carId) => {
  return await prisma.car.findUnique({
    where: {
      id: carId
    }
  })
}

export const getCarBookingById = async (carBookingId) => {
  return await prisma.carBooking.findUnique({
    where: {
      id: carBookingId
    }
  })
}

export const addCar = async (data) => {
    const car = await prisma.car.create({data});
    return car
}

export const addCarBooking = async (data,id) => {
    return await prisma.carBooking.create({
    data:{
        startTime: data.startTime,
        endTime:data.endTime,
        car:{
            connect:{
                id:data.carId
            }
        },
        user:{
            connect:{
                id
            }
        }
    }  
  });
}

export const editCar = async (data, carId) => {
  return await prisma.car.update({
    where:{id:carId},
    data
})
}

export const editCarBooking = async (data, carBookingId) => {
  return await prisma.carBooking.update({
    where:{id:carBookingId},
    data
})
}

export const deleteCar = async (carId) => {
  return await prisma.car.delete({
    where: {
        id: carId},
    //   data  
  })
}

export const getCarbookingByDay = async (carId, month) => {
 const startOfMonth = new Date(`${month}-01T00:00:00`)
   const endOfMonth = new Date(startOfMonth)
  endOfMonth.setMonth(endOfMonth.getMonth() + 1)
  endOfMonth.setMilliseconds(-1)
  return await prisma.carBooking.findMany({
    where: {
       carId: Number(carId),
    startTime: {
  lte: endOfMonth
},
endTime: {
  gte: startOfMonth
}
    },
    orderBy: {
      startTime: 'asc'
    }
  })
}

export const updateCarBookingStatusService = async (carBookingId, status) => {
  return await prisma.carBooking.update({
    where: {
      id: carBookingId
    },
    data: {
      status
    }
  })
}

export default {
}