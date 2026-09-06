import createHttpError from "http-errors";
import carService, { addCar, addCarBooking, deleteCar, editCar, editCarBooking, getCarBookingById, getCarbookingBymonth, getCarById } from "../services/car.service.js"

export const getCars = async (req, res) => {
try {
    const cars = await carService.getCars();

    res.status(200).json({
      success: true,
      data: cars,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getCarByIdController = async (req, res, next) => {
  try {
    const carId = req.valid.params.id

    const car = await getCarById(carId)

    if (!car) {
      return res.status(404).json({
        success: false,
        message: "Car not found"
      })
    }

    res.status(200).json({
      success: true,
      data: car
    })
  } catch (error) {
    next(error)
  }
}

export const getCarBokingByIdController = async (req, res, next) => {
  try {
    const carBookingId = req.valid.params.id

    const carBooking = await getCarBookingById(carBookingId)

    if (!carBooking) {
      return res.status(404).json({
        success: false,
        message: "Carbooking not found"
      })
    }

    res.status(200).json({
      success: true,
      data: carBooking
    })
  } catch (error) {
    next(error)
  }
}



export  const createCar = async (req, res, next) => {
    try {
    const body = req.valid ? req.valid.body : req.body;
    // console.log('body', body)
    // const { name, location, capacity } = req.body;
    const car = await addCar(body);

        res.status(201).json({
      success: true,
      message: "car reservation successfully created.",
      data: car,
    });
  } catch (error) {
    next(error)
    }
}


export const createCarBooking = async (req, res,next) => {
  try {
    const {id} = req.user
    const data = req.valid.body;
    // console.log('data', data)
    const booking = await addCarBooking(data,id)

    res.status(201).json({
      success: true,
      message: "Booking reservation successfully created.",
      data: booking,
    });
  } catch (error) {
    next(error)
  }
};


export const updateCar = async (req, res, next) => {
    const carId = req.valid.params.id;
  try {
    const data = req.valid.body;
    // console.log('data', data)
    const resultcarId = await editCar(data, carId)
    
    res.status(200).json({
      status: "success",
      data: resultcarId,
    });
  } catch (error) {
    next(error)
  }
};

export const updateCarBooking = async (req, res, next) => {
    const carBookingId = req.valid.params.id;
  try {
    const data = req.valid.body;
    // console.log('data', data)
    const resultCarBooking = await editCarBooking(data, carBookingId)
    
    res.status(200).json({
      status: "success",
      data: resultCarBooking,
    });
  } catch (error) {
    next(error)
  }
};

export const removeCar = async (req, res, next) => {
  try {
    const carId = req.valid.params.id

    const car = await deleteCar(carId)

    res.status(200).json({
      success: true,
      message: "Car deleted successfully",
      data: car
    })
  } catch (error) {
    if (error.code === "P2003") {
          return next(
            createHttpError(409, "car is in booking and cannot be deleted"),
          );
        }
    next(error)
  }
}

export const getCarAvailability = async (req, res, next) => {
  try {
    const  carId  = req.valid.params.id
    const { date } = req.query

    const bookings = await getCarbookingBymonth(carId, date)

   res.status(200).json({
      success: true,
      data: bookings
    })
  } catch (error) {
    next(error)
  }
}
