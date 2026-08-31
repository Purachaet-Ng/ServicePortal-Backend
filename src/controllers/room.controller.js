import roomService from "../services/room.service.js"

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


export const createBooking = async (req, res) => {
  try {
    const booking = await roomService.createBooking(req.body);

    res.status(201).json({
      success: true,
      message: "สร้างการจองห้องสำเร็จ",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
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
