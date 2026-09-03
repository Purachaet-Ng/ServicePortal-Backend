export const overlapWhere = (startTime, endTime) => ({
  status: { in: ["PENDING", "APPROVED"] },
  startTime: { lt: endTime },
  endTime: { gt: startTime },
});

// rooms.service.js — cars.service.js is the same with carBooking / carId
// const clash = await prisma.roomBooking.findFirst({
//   where: { roomId, ...overlapWhere(startTime, endTime) },
// });