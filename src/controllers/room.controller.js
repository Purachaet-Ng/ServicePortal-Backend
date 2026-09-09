import createHttpError from "http-errors";
import { addRoomBooking, addRoom, editBooking, editRoom, deleteRoom, getRoomById, getRoomBookingById, getRoomBookingsByDay, updateRoomBookingStatusService, getAllRooms } from "../services/room.service.js"
import { notifyBookingCreated, notifyBookingStatusChanged } from "../services/notifications.service.js"

export const getRooms = async (req, res) => {
  try {
    const rooms = await getAllRooms();

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
    const room = await addRoom(body);

        res.status(201).json({
      success: true,
      message: "room reservation successfully created.",
      data: room,
    });
  } catch (error) {
    // rooms.name is @unique — same 409 the departments controller gives.
    if (error.code === "P2002") {
      return next(createHttpError(409, "Room name already exists"));
    }
    next(error)
    }
}

export const createRoomBooking = async (req, res,next) => {
  try {
    const {id} = req.user
    const data = req.valid.body;
    const booking = await addRoomBooking(data,id)

    // Notification must not turn a created booking into a 500.
    await notifyBookingCreated({
      type: "room",
      booking,
      resourceName: booking.room.name,
      actor: req.user,
    });

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
    const resultroomId = await editRoom(data, roomId)
    
    res.status(200).json({
      status: "success",
      data: resultroomId,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return next(createHttpError(409, "Room name already exists"));
    }
    next(error)
  }
};

export const updateRoomBooking = async (req, res, next) => {
    const roomBookingId = req.valid.params.id;
  try {
    const data = req.valid.body;
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

/**
 * Serves BOTH booking-by-day routes. /rooms/bookings has no :id and returns
 * every room's day; /rooms/:id/bookings narrows to one. The only difference is
 * whether params carry an id, so one handler covers both rather than two
 * near-identical copies that can drift apart.
 *
 * `date` comes from req.valid.query now, not req.query — it is validated, so a
 * missing or impossible date is a 400 here instead of a 500 inside Prisma.
 */
export const getRoomBookings = async (req, res, next) => {
  try {
    const { date } = req.valid.query
    const bookings = await getRoomBookingsByDay(date, {
      roomId: req.valid.params?.id
    })

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
      status,
      req.user.id
    )

    // The status write has already committed; a failed notification must not
    // turn it into a 500 (same reasoning as notifyTicketUpdated).
    await notifyBookingStatusChanged({
      type: "room",
      booking: roomBooking,
      resourceName: roomBooking.room.name,
      actorId: req.user.id,
    })

    res.status(200).json({
      success: true,
      data: roomBooking
    })
  } catch (error) {
    next(error)
  }
}
