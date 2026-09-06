import createHttpError from "http-errors";
import roomService, { addRoomBooking, addRoom, editBooking, editRoom, deleteRoom, getRoomById, getRoomBookingById, getRoomBookingsByDay, updateRoomBookingStatusService } from "../services/room.service.js"

export const getRooms = async (req, res) => {
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

export const getRoomByIdController = async (req, res, next) => {
  try {
    const roomId = req.valid.params.id

    const room = await getRoomById(roomId)

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      })
    }

    res.status(200).json({
      success: true,
      data: room
    })
  } catch (error) {
    next(error)
  }
}

export const getRoomBokingByIdController = async (req, res, next) => {
  try {
    const bookingId = req.valid.params.id

    const roomBooking = await getRoomBookingById(bookingId)

    if (!roomBooking) {
      return res.status(404).json({
        success: false,
        message: "RoomBooking not found"
      })
    }

    res.status(200).json({
      success: true,
      data: roomBooking
    })
  } catch (error) {
    next(error)
  }
}


export  const createRoom = async (req, res, next) => {
    try {
    const body = req.valid ? req.valid.body : req.body;
    // console.log('body', body)
    // const { name, location, capacity } = req.body;
    const room = await addRoom(body);

        res.status(201).json({
      success: true,
      message: "room reservation successfully created.",
      data: room,
    });
  } catch (error) {
    next(error)
    }
}

export const createCarBooking = async (req, res,next) => {
  try {
    const {id} = req.user
    const data = req.valid.body;
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


export const updateRoom = async (req, res, next) => {
    const roomId = req.valid.params.id;
  try {
    const data = req.valid.body;
    // console.log('data', data)
    const resultroomId = await editRoom(data, roomId)
    
    res.status(200).json({
      status: "success",
      data: resultroomId,
    });
  } catch (error) {
    next(error)
  }
};




export const updateRoomBooking = async (req, res, next) => {
    const roomBookingId = req.valid.params.id;
  try {
    const data = req.valid.body;
    // console.log('data', data)
    const resultRoomBooking = await editBooking(data, roomBookingId)
    
    res.status(200).json({
      status: "success",
      data: resultRoomBooking,
    });
  } catch (error) {
    next(error)
  }
};

export const removeRoom = async (req, res, next) => {
  try {
    const roomId = req.valid.params.id

    const room = await deleteRoom(roomId)

    res.status(200).json({
      success: true,
      message: "Room deleted successfully",
      data: room
    })
  } catch (error) {
    if (error.code === "P2003") {
          return next(
            createHttpError(409, "room is in booking and cannot be deleted"),
          );
        }
    next(error)
  }
}

export const getCarAvailability = async (req, res, next) => {
  try {
    const roomId = req.valid.params.id
    const { date } = req.query

    const bookings = await getRoomBookingsByDay(roomId, date)
    res.status(200).json({
      success: true,
      data: bookings
    })
  } catch (error) {
    next(error)
  }
}

export const updateRoomBookingStatus = async (req, res, next) => {
  try {
    const roomBookingId = req.valid.params.id
    const { status } = req.valid.body

    const roomBooking = await updateRoomBookingStatusService(
      roomBookingId,
      status
    )

    res.status(200).json({
      success: true,
      data: roomBooking
    })
  } catch (error) {
    next(error)
  }
}
