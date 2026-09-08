import createHttpError from "http-errors";
import { addCar, addCarBooking, deleteCar, editCar, editCarBooking, getAllCars, getCarbookingByDay, getCarBookingById, getCarById, updateCarBookingStatusService } from "../services/car.service.js"

export const getCars = async (req, res) => {
try {
    const cars = await getAllCars();

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
    const car = await addCar(body);

        res.status(201).json({
      success: true,
      message: "car reservation successfully created.",
      data: car,
    });
  } catch (error) {
    // cars.plate is @unique — same 409 rooms and departments give.
    if (error.code === "P2002") {
      return next(createHttpError(409, "Plate already exists"));
    }
    next(error)
    }
}

export const createCarBooking = async (req, res,next) => {
  try {
    const {id} = req.user
    const data = req.valid.body;
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
    const resultcarId = await editCar(data, carId)
    
    res.status(200).json({
      status: "success",
      data: resultcarId,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return next(createHttpError(409, "Plate already exists"));
    }
    next(error)
  }
};

export const updateCarBooking = async (req, res, next) => {
    const carBookingId = req.valid.params.id;
  try {
    const data = req.valid.body;
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

    const bookings = await getCarbookingByDay(carId, date)

   res.status(200).json({
      success: true,
      data: bookings
    })
  } catch (error) {
    next(error)
  }
}

export const updateCarBookingStatus = async (req, res, next) => {
  try {
    const carBookingId = req.valid.params.id
    const { status } = req.valid.body

    const carBooking = await updateCarBookingStatusService(
      carBookingId,
      status,
      req.user.id
    )

    res.status(200).json({
      success: true,
      data: carBooking
    })
  } catch (error) {
    next(error)
  }
}