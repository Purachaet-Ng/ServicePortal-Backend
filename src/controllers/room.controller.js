import createHttpError from "http-errors";
import roomService, { addRoomBooking, addRoom, editBooking } from "../services/room.service.js"

export const 
getRooms = async (req, res) => {
  try {
    const rooms = await roomService.getRooms();

    res.status(200).json({
      success: true,
      data: rooms,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export  const createRoom = async (req, res, next) => {
    try {
    const body = req.valid ? req.valid.body : req.body;
    // console.log('body', body)
    // const { name, location, capacity } = req.body;
    const room = await addRoom(body);

        res.status(201).json({
      success: true,
      message: "Room reservation successfully created.",
      data: room,
    });
  } catch (error) {
    next(error)
    }
}

export const createBooking = async (req, res,next) => {
  try {
    const {id} = req.user
    const data = req.valid.body;
    // console.log('data', data)
    const booking = await addRoomBooking(data,id)

    res.status(201).json({
      success: true,
      message: "Booking reservation successfully created.",
      data: booking,
    });
  } catch (error) {
    next(error)
  }
};



export const updateBooking = async (req, res, next) => {
    const bookingId = req.valid.params.id;
  try {
    const data = req.valid.body;
    // console.log('data', data)
    const resultBooking = await editBooking(data, bookingId)
    
    res.status(201).json({
      status: "success",
      data: resultBooking,
    });
  } catch (error) {
    next(error)
  }
};
