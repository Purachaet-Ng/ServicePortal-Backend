import createHttpError from "http-errors";
import { prisma } from "../lib/prisma.js";
import { serializableTransaction, updateBalance } from "./inventory.service.js";

const include = {
  sourceStock: { include: { item: true } },
  department: true,
  requester: { select: { id: true, firstname: true, lastname: true } },
  assets: { include: { asset: true } },
};
function adminScope(user) {
  if (user.role === "ADMIN_SYSTEM") return {};
  if (user.role !== "ADMIN_DEPT" || !user.departmentId) throw createHttpError(403, "Department admin account required");
  return { departmentId: user.departmentId };
}
export async function centralStocks(user) {
  adminScope(user);
  const rows = await prisma.departmentStock.findMany({
    where: { departmentId: null, isActive: true, item: { isActive: true } },
    include: { item: true, assets: { where: { status: "AVAILABLE" } } },
    orderBy: { id: "asc" },
  });
  return rows.map((s) => ({ ...s, available: s.onHand - s.reserved }));
}
export async function receiveCentralStock(data, user) {
  return serializableTransaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({ where: { id: data.itemId } });
    if (!item?.isActive) throw createHttpError(422, "Select an active catalog item");
    const rows = await tx.$queryRaw`
      INSERT INTO "department_stocks" ("item_id", "department_id", "on_hand", "reserved", "min_stock", "is_active", "created_at", "updated_at")
      VALUES (${item.id}, NULL, 0, 0, 0, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("item_id") WHERE "department_id" IS NULL
      DO UPDATE SET "is_active" = TRUE, "updated_at" = CURRENT_TIMESTAMP
      RETURNING "id"
    `;
    const stockId = rows[0].id;
    if (item.isSerialized) {
      if (!data.serialNo) throw createHttpError(422, "Serial number is required for serialized items");
      if (data.quantity !== undefined && data.quantity !== 1) throw createHttpError(422, "Receive serialized devices one serial at a time");
      if (await tx.inventoryAsset.findUnique({ where: { serialNo: data.serialNo } })) throw createHttpError(409, "Serial number already exists");
      if (data.assetTag && await tx.inventoryAsset.findUnique({ where: { assetTag: data.assetTag } })) throw createHttpError(409, "Asset tag already exists");
      await tx.inventoryAsset.create({ data: { stockId, serialNo: data.serialNo, assetTag: data.assetTag || null } });
      await updateBalance(tx, stockId, { onHandDelta: 1 });
      await tx.stockMovement.create({ data: { stockId, actorId: user.id, type: "IN", onHandDelta: 1, note: `System Admin receipt · serial ${data.serialNo}${data.note ? ` · ${data.note}` : ""}` } });
    } else {
      if (!data.quantity) throw createHttpError(422, "Quantity is required for general supplies");
      if (!data.note?.trim()) throw createHttpError(422, "Receipt reference is required");
      await updateBalance(tx, stockId, { onHandDelta: data.quantity });
      await tx.stockMovement.create({ data: { stockId, actorId: user.id, type: "IN", onHandDelta: data.quantity, note: `System Admin receipt · ${data.note.trim()}` } });
    }
    const stock = await tx.departmentStock.findUnique({ where: { id: stockId }, include: { item: true, assets: { where: { status: "AVAILABLE" } } } });
    return { ...stock, available: stock.onHand - stock.reserved };
  });
}
export async function listReplenishments(user) {
  return prisma.inventoryReplenishment.findMany({ where: adminScope(user), include, orderBy: { id: "desc" } });
}
async function notify(tx, request, role, message) {
  const recipients = await tx.user.findMany({
    where: role === "ADMIN_SYSTEM" ? { role } : { role: "ADMIN_DEPT", departmentId: request.departmentId },
    select: { id: true },
  });
  if (recipients.length) await tx.notification.createMany({ data: recipients.map((u) => ({
    userId: u.id, message: `Replenishment #${request.id}: ${message}`, link: "/inventory?view=approvals",
  })) });
}
export async function requestReplenishment(data, user) {
  adminScope(user);
  return serializableTransaction(async (tx) => {
    const account = await tx.user.findUnique({ where: { id: user.id } });
    if (!account || !["ADMIN_DEPT", "ADMIN_SYSTEM"].includes(account.role)) throw createHttpError(403, "Admin account required");
    const departmentId = account.role === "ADMIN_SYSTEM" ? data.departmentId : account.departmentId;
    if (!departmentId || (account.role === "ADMIN_DEPT" && data.departmentId && data.departmentId !== departmentId))
      throw createHttpError(403, "Request stock for your own department only");
    if (!await tx.department.findUnique({ where: { id: departmentId } })) throw createHttpError(422, "Department not found");
    const source = await tx.departmentStock.findUnique({ where: { id: data.sourceStockId }, include: { item: true } });
    if (!source || source.departmentId !== null || !source.isActive || !source.item.isActive)
      throw createHttpError(422, "Select active central warehouse stock");
    if (source.onHand - source.reserved < data.quantity) throw createHttpError(409, "Insufficient central stock");
    if (source.item.isSerialized && data.quantity > 1000) throw createHttpError(422, "Request at most 1000 devices per shipment");
    const request = await tx.inventoryReplenishment.create({ data: {
      sourceStockId: source.id, departmentId, requesterId: user.id, quantity: data.quantity, reason: data.reason,
    }, include });
    await notify(tx, request, "ADMIN_SYSTEM", "awaiting approval");
    return request;
  });
}
export async function updateReplenishment(id, data, user) {
  adminScope(user);
  return serializableTransaction(async (tx) => {
    const account = await tx.user.findUnique({ where: { id: user.id } });
    if (!account) throw createHttpError(401, "Account no longer exists");
    adminScope(account);
    const request = await tx.inventoryReplenishment.findUnique({ where: { id }, include });
    if (!request) throw createHttpError(404, "Replenishment not found");
    const system = account.role === "ADMIN_SYSTEM";
    if (!system && account.departmentId !== request.departmentId) throw createHttpError(403, "Department forbidden");
    const action = data.status;
    if (["APPROVED", "REJECTED", "DISPATCHED"].includes(action) && !system) throw createHttpError(403, "System Admin approval required");
    const source = request.sourceStock;
    const movement = (stockId, type, onHandDelta, reservedDelta) => tx.stockMovement.create({ data: {
      stockId, actorId: user.id, type, onHandDelta, reservedDelta, replenishmentId: id,
      note: `Replenishment #${id}: ${action}${data.note ? ` - ${data.note}` : ""}`,
    } });
    const changes = { status: action };
    if (action === "APPROVED") {
      if (request.status !== "PENDING") throw createHttpError(409, "Only pending requests can be approved");
      if (!source.isActive || !source.item.isActive) throw createHttpError(409, "Central stock is inactive");
      await updateBalance(tx, source.id, { reservedDelta: request.quantity });
      await movement(source.id, "RESERVE", 0, request.quantity);
      Object.assign(changes, { reviewedById: user.id, reviewedAt: new Date() });
    } else if (["REJECTED", "CANCELLED"].includes(action)) {
      if (!data.note?.trim()) throw createHttpError(422, "A reason is required");
      if (!(action === "REJECTED" ? ["PENDING"] : ["PENDING", "APPROVED"]).includes(request.status))
        throw createHttpError(409, "Dispatched or completed requests cannot be cancelled or rejected");
      if (request.status === "APPROVED") {
        await updateBalance(tx, source.id, { reservedDelta: -request.quantity });
        await movement(source.id, "RELEASE", 0, -request.quantity);
      }
      Object.assign(changes, { decisionNote: data.note, reviewedById: user.id, reviewedAt: new Date() });
    } else if (action === "DISPATCHED") {
      if (request.status !== "APPROVED") throw createHttpError(409, "Approve before dispatching");
      if (!source.isActive || !source.item.isActive) throw createHttpError(409, "Central stock is inactive");
      const ids = data.assetIds ?? [];
      if (source.item.isSerialized) {
        if (ids.length !== request.quantity || new Set(ids).size !== ids.length) throw createHttpError(422, "Select one distinct serial per requested device");
        const count = await tx.inventoryAsset.updateMany({
          where: { id: { in: ids }, stockId: source.id, status: "AVAILABLE" }, data: { status: "IN_TRANSIT" },
        });
        if (count.count !== request.quantity) throw createHttpError(409, "A selected serial is no longer available in central stock");
        await tx.replenishmentAsset.createMany({ data: ids.map((assetId) => ({ replenishmentId: id, assetId })) });
      } else if (ids.length) throw createHttpError(422, "General supplies do not have serial numbers");
      await updateBalance(tx, source.id, { onHandDelta: -request.quantity, reservedDelta: -request.quantity });
      await movement(source.id, "OUT", -request.quantity, -request.quantity);
      changes.dispatchedAt = new Date();
    } else if (action === "RECEIVED") {
      if (request.status !== "DISPATCHED") throw createHttpError(409, "Only dispatched stock can be received");
      if (!data.confirmReceipt) throw createHttpError(422, "Confirm the full quantity and serials physically received");
      const destination = await tx.departmentStock.upsert({
        where: { departmentId_itemId: { departmentId: request.departmentId, itemId: source.itemId } },
        create: { departmentId: request.departmentId, itemId: source.itemId }, update: {},
      });
      if (!destination.isActive || !source.item.isActive) throw createHttpError(409, "Destination stock or item is inactive; contact System Admin");
      if (source.item.isSerialized) {
        const ids = request.assets.map((a) => a.assetId);
        if (ids.length !== request.quantity) throw createHttpError(409, "Shipment serial count does not match");
        const moved = await tx.inventoryAsset.updateMany({
          where: { id: { in: ids }, stockId: source.id, status: "IN_TRANSIT" }, data: { stockId: destination.id, status: "AVAILABLE" },
        });
        if (moved.count !== request.quantity) throw createHttpError(409, "Shipment serial state changed; contact System Admin");
      }
      await updateBalance(tx, destination.id, { onHandDelta: request.quantity });
      await movement(destination.id, "IN", request.quantity, 0);
      Object.assign(changes, { receivedById: user.id, receivedAt: new Date() });
    } else throw createHttpError(422, "Unsupported replenishment action");
    const updated = await tx.inventoryReplenishment.update({ where: { id }, data: changes, include });
    await notify(tx, updated, action === "RECEIVED" || (!system && action === "CANCELLED") ? "ADMIN_SYSTEM" : "ADMIN_DEPT", action.toLowerCase());
    return updated;
  });
}
