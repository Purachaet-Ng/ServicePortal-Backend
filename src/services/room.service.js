import {prisma} from '../lib/prisma.js'


// ดึงข้อมูลห้องทั้งหมด
export const getAllRooms = async () => {
    const rooms = await prisma.room.findMany();
    
    return rooms;
};

export const getRoomById = async (roomId) => {
  return await prisma.room.findUnique({
    where: {
      id: roomId
    }
  })
}

export const getRoomBookingById = async (roomBookingId) => {
  return await prisma.roomBooking.findUnique({
    where: {
      id: roomBookingId
    }
  })
}

export const addRoom = async (data) => {
    const room = await prisma.room.create({data});
    return room
}


export const addRoomBooking = async (data,id) => {
    return await prisma.roomBooking.create({
    data:{
        startTime: data.startTime,
        endTime:data.endTime,
        room:{
            connect:{
                id:data.roomId
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

export const editRoom = async (data, roomId) => {
  return await prisma.room.update({
    where:{id:roomId},
    data
})
}

export const editBooking = async (data, roomBookingId) => {
  return await prisma.roomBooking.update({
    where:{id:roomBookingId},
    data
})
}

export const deleteRoom = async (roomId) => {
  return await prisma.room.delete({
    where: {
        id: roomId},
  })
}


export const getRoomBookingsByDay = async (roomId, date) => {
  const startOfDay = new Date(`${date}T00:00:00.000Z`)
  const endOfDay = new Date(`${date}T23:59:59.999Z`)

  return await prisma.roomBooking.findMany({
    where: {
      roomId: Number(roomId),
      startTime: {
        lte: endOfDay
      },
      endTime: {
        gte: startOfDay
      }
    },
    orderBy: {
      startTime: 'asc'
    }
  })
}

export const updateRoomBookingStatusService = async (roomBookingId, status) => {
  return await prisma.roomBooking.update({
    where: {
      id: roomBookingId
    },
    data: {
      status
    }
  })
}


export default {}