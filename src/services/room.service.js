import {prisma} from '../lib/prisma.js'


// ดึงข้อมูลห้องทั้งหมด
export const getRooms = async () => {
    const rooms = await prisma.room.findMany();
    
    return rooms;
};

export const addRoom = async (data) => {
    // const { name, location, capacity } = data;

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


// แก้ไขการจอง
export const editBooking = async (data,bookingId) => {
  return await prisma.roomBooking.update({
    where:{id:bookingId},
    data
})
}
export default {
    getRooms,
    addRoom,
    // createBooking,
    editBooking
}