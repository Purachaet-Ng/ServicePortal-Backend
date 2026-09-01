import createHttpError from "http-errors";
import roomService, { addRoomBooking } from "../services/room.service.js"

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

// export  const createRoom = async (req, res, next) => {
//     try {
//         const {id} = req.user
//         const {data} = req.valid.body;
//         const room = await addRoom(data, id)

//         res.status(201).json({
//       success: true,
//       message: "Room reservation successfully created.",
//       data: room,
//     });
//   } catch (error) {
//     next(error)
//     }
// }

export const createBooking = async (req, res,next) => {
  try {
    const {id} = req.user
    const data = req.valid.body;
    // console.log('data', data)
    const booking = await addRoomBooking(data, id)

    res.status(201).json({
      success: true,
      message: "Booking reservation successfully created.",
      data: booking,
    });
  } catch (error) {
    next(error)
  }
};

export const updateBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await roomService.updateBooking(
      Number(bookingId),
      req.body
    );

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
