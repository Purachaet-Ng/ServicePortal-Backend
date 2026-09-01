import {prisma} from '../lib/prisma.js'


// ดึงข้อมูลห้องทั้งหมด
export const getRooms = async () => {
    const rooms = await prisma.room.findMany();
    
    return rooms;
};

export const addRoom = async (data) => {
    const { name, location, capacity } = data;

    const room = await prisma.room.create({
        data: {
            name: name,
            location: location || null,
            capacity: Number(capacity),
        },
    });
    return room
}
// export const addRoom = async (data) => {
//     return await createRoom(data)
// };



export const createBooking = async (data) => {
  const { status } = data;

  const booking = await prisma.roomBooking.create({
    data: {
      roomId: parsedRoomId,
      userId: user.id,
      startTime: start,
      endTime: end,
      status: status && status.trim() !== "" ? status : "confirmed",
    },
   data
  });
  return booking;
};

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
// แก้ไขการจอง
export const updateBooking = async (id, data) => {
  const bookingId = Number(id);
  if (isNaN(bookingId)) {
    throw new Error("The booking code must be numbers only.");
  }

  // เตรียม object สำหรับ update
  const updateData = {};

  if (data.roomId) updateData.roomId = Number(data.roomId);
  if (data.status) updateData.status = data.status;
  
  // แปลง Date หากมีการส่งมาแก้ไข
  if (data.startTime) updateData.startTime = new Date(data.startTime);
  if (data.endTime) updateData.endTime = new Date(data.endTime);
  
  const booking = await prisma.roomBooking.update({
    where: {
      id: bookingId,
    },
    data: updateData,
});

return booking;
};

export default {
    getRooms,
    addRoom,
    createBooking,
    updateBooking
}