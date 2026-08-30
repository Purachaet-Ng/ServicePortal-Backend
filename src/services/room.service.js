import {prisma} from '../lib/prisma.js'

// const prisma = require('../config/prisma')

const getRooms = async () => {
    return await prisma.room.findMany()
}

const createRoom = async (data) => {

    return await prisma.room.create({
        data
    })
}

const updateRoom = async (roomId, data) => {

    return await prisma.room.update({
        where: {
            id: Number(roomId)
        },
        data
    })
}

export default {
    getRooms,
    createRoom,
    updateRoom
}