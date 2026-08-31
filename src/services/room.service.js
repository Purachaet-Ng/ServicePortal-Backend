import {prisma} from '../lib/prisma.js'


// ดึงข้อมูลห้องทั้งหมด
export const getRooms = async () => {
    const rooms = await prisma.room.findMany();
    
    return rooms;
};

// หา user หรือสร้างใหม่
export const createBooking = async (data) => {
  const { email, roomId, startTime, endTime, status } = data;

  // 1. ตรวจสอบข้อมูลบังคับ
  if (!email || !roomId || !startTime || !endTime) {
    throw new Error("กรุณาระบุ email, roomId, startTime และ endTime ให้ครบถ้วน");
  }

  const parsedRoomId = parseInt(roomId, 10);
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(parsedRoomId)) {
    throw new Error("roomId ต้องเป็นตัวเลขเท่านั้น");
  }

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("startTime และ endTime ต้องเป็นรูปแบบวันที่ที่ถูกต้อง");
  }

  if (start >= end) {
    throw new Error("เวลาเริ่มต้น (startTime) ต้องเกิดขึ้นก่อนเวลาสิ้นสุด (endTime)");
  }

  // 2. ค้นหา User จาก Email หรือสร้างใหม่หากยังไม่มีในระบบ
  let user = await prisma.user.findUnique({
    where: { email },
  select: {
      id: true,
      email: true,
      role: true,
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: email,
        passwordHash: "$2b$10$defaultDummyPasswordHashValue",
        role: "EMPLOYEE",
      },
      select: {
        id: true,
        email: true,
      },
    });
  }

  // 3. บันทึกข้อมูลการจองห้อง
  const booking = await prisma.roomBooking.create({
    data: {
      roomId: parsedRoomId,
      userId: user.id,
      startTime: start,
      endTime: end,
      status: status && status.trim() !== "" ? status : "confirmed",
    },
   
  });

  return booking;
};

// แก้ไขการจอง
export const updateBooking = async (id, data) => {
  const bookingId = Number(id);
  if (isNaN(bookingId)) {
    throw new Error("ID ของการจองต้องเป็นตัวเลขเท่านั้น");
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
    createBooking,
    updateBooking
}