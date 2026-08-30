import roomService from "../services/room.service.js"

export const getRooms = async (req, res) => {
    try {
        const rooms = await roomService.getRooms()

        res.status(200).json(rooms)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const createRoom = async (req, res) => {
    try {
        const room = await roomService.createRoom(req.body)

        res.status(201).json(room)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const updateRoom = async (req, res) => {
    try {
        const { roomId } = req.params

        const room = await roomService.updateRoom(
            roomId,
            req.body
        )

        res.status(200).json(room)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

