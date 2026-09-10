import createHttpError from "http-errors";
import { prisma } from "../lib/prisma.js";

const itemSelect = {
  id: true,
  sku: true,
  name: true,
  unit: true,
  isSerialized: true,
  isActive: true,
};

function assertStockScope(user, stock) {
  if (user.role === "ADMIN_SYSTEM") return;
  if (user.role !== "ADMIN_DEPT" || user.departmentId !== stock.departmentId) {
    throw createHttpError(403, "Inventory department forbidden");
  }
}

function assertDepartmentAccount(user) {
  if (user.role === "ADMIN_DEPT" && !user.departmentId) {
    throw createHttpError(
      403,
      "Department admin account must belong to a department",
    );
  }
}

export async function serializableTransaction(work) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      const isWriteConflict =
        error?.code === "P2034" ||
        (error?.code === "P2010" &&
          error.meta?.driverAdapterError?.cause?.kind ===
            "TransactionWriteConflict");
      if (!isWriteConflict) throw error;
      if (attempt === 3)
        throw createHttpError(
          409,
          "Inventory was updated at the same time. Please try again",
          { code: "CONCURRENT_UPDATE" },
        );
    }
  }
}

export async function updateBalance(
  tx,
  stockId,
  { onHandDelta = 0, reservedDelta = 0 },
) {
  const rows = await tx.$queryRaw`
    UPDATE "department_stocks"
    SET
      "on_hand" = "on_hand" + ${onHandDelta},
      "reserved" = "reserved" + ${reservedDelta},
      "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${stockId}
      AND "on_hand" + ${onHandDelta} >= 0
      AND "reserved" + ${reservedDelta} >= 0
      AND "reserved" + ${reservedDelta} <= "on_hand" + ${onHandDelta}
    RETURNING "on_hand" AS "onHand", "reserved"
  `;
  if (!rows.length) {
    throw createHttpError(409, "Insufficient stock", {
      code: "INSUFFICIENT_STOCK",
    });
  }
  return rows[0];
}

function sumLinesByStock(lines) {
  const totals = new Map();
  for (const line of lines) {
    totals.set(line.stockId, (totals.get(line.stockId) ?? 0) + line.quantity);
  }
  return [...totals.entries()]
    .map(([stockId, quantity]) => ({ stockId, quantity }))
    .sort((left, right) => left.stockId - right.stockId);
}


async function createLowStockNotifications(tx, stockId) {
  const stock = await tx.departmentStock.findUnique({
    where: { id: stockId },
    include: { item: true, department: true },
  });
  const available = stock.onHand - stock.reserved;
  if (available > stock.minStock) return;
  const message = `Low stock: ${stock.item.name} / ${stock.department?.name ?? "Central warehouse"}: ${available} ${stock.item.unit}`;
  const users = await tx.user.findMany({
    where: {
      OR: [
        { role: "ADMIN_SYSTEM" },
        ...(stock.departmentId ? [{ role: "ADMIN_DEPT", departmentId: stock.departmentId }] : []),
      ],
    },
    select: { id: true },
  });
  const existing = await tx.notification.findMany({
    where: {
      userId: { in: users.map((user) => user.id) },
      message,
      readAt: null,
    },
    select: { userId: true },
  });
  const notified = new Set(existing.map((row) => row.userId));
  const data = users
    .filter((user) => !notified.has(user.id))
    .map((user) => ({ userId: user.id, message, link: "/inventory?view=manage" }));
  if (data.length) await tx.notification.createMany({ data });
}

export async function listCatalog() {
  return prisma.inventoryItem.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function createCatalogItem(data) {
  if (await prisma.inventoryItem.findUnique({ where: { sku: data.sku } }))
    throw createHttpError(409, "SKU already exists");
  return serializableTransaction(async (tx) => {
    const item = await tx.inventoryItem.create({ data });
    // Every catalog item belongs to the organisation-wide System Admin stock.
    // Quantity remains zero until a physical receipt is recorded.
    await tx.departmentStock.create({ data: { itemId: item.id } });
    return item;
  });
}

export async function updateCatalogItem(id, data) {
  const item = await findItem(id);
  if (
    data.sku &&
    data.sku !== item.sku &&
    (await prisma.inventoryItem.findUnique({ where: { sku: data.sku } }))
  )
    throw createHttpError(409, "SKU already exists");
  if (
    data.isSerialized !== undefined &&
    data.isSerialized !== item.isSerialized
  ) {
    const usedStock = await prisma.departmentStock.findFirst({
      where: {
        itemId: id,
        OR: [
          { onHand: { not: 0 } },
          { reserved: { not: 0 } },
          { assets: { some: {} } },
          { requestLines: { some: {} } },
          { movements: { some: {} } },
          { replenishments: { some: {} } },
        ],
      },
      select: { id: true },
    });
    if (usedStock)
      throw createHttpError(
        409,
        "Cannot change serial tracking after the item is used by a department",
      );
  }
  return prisma.inventoryItem.update({ where: { id }, data });
}

export async function deleteCatalogItem(id) {
  await findItem(id);
  return prisma.$transaction(async (tx) => {
    const stocks = await tx.departmentStock.findMany({
      where: { itemId: id },
      select: { id: true },
    });
    const stockIds = stocks.map((stock) => stock.id);
    const openTransfer = await tx.inventoryReplenishment.findFirst({
      where: { sourceStockId: { in: stockIds }, status: { in: ["PENDING", "APPROVED", "DISPATCHED"] } },
    });
    if (openTransfer) throw createHttpError(409, "Complete replenishments before removing this item");
    if (stockIds.length) {
      const stockBalances = await tx.departmentStock.findMany({
        where: { id: { in: stockIds } },
        select: { onHand: true, reserved: true },
      });
      const pendingRequests = await tx.inventoryRequestLine.count({
        where: {
          stockId: { in: stockIds },
          request: { status: { in: ["PENDING", "APPROVED"] } },
        },
      });
      const activeAssignments = await tx.assetAssignment.count({
        where: { returnedAt: null, asset: { stockId: { in: stockIds } } },
      });
      const hasBalance = stockBalances.some(
        (row) => row.onHand !== 0 || row.reserved !== 0,
      );
      if (hasBalance || pendingRequests || activeAssignments) {
        throw createHttpError(
          409,
          "Cannot remove an item that still has stock, pending requests, reservations, or assigned assets",
        );
      }
    }
    await tx.departmentStock.updateMany({
      where: { itemId: id },
      data: { isActive: false },
    });
    return tx.inventoryItem.update({
      where: { id },
      data: { isActive: false },
    });
  });
}

async function findItem(id) {
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) throw createHttpError(404, "Inventory item not found");
  return item;
}

export async function listStocks(user, includeCentral = false) {
  const rows = await prisma.departmentStock.findMany({
    where: {
      ...(!includeCentral ? { departmentId: { not: null } } : {}),
      item: { isActive: true },
      ...(user.role === "ADMIN_SYSTEM"
        ? {}
        : { departmentId: user.departmentId ?? -1 }),
    },
    include: {
      item: { select: itemSelect },
      department: { select: { id: true, name: true } },
      assets: { orderBy: { serialNo: "asc" } },
    },
    orderBy: [{ departmentId: "asc" }, { itemId: "asc" }],
  });
  return rows.map((row) => {
    return {
      ...row,
      department: row.department ?? { id: "central", name: "Central warehouse" },
      assets:
        user.role === "ADMIN_SYSTEM" ||
        (user.role === "ADMIN_DEPT" && user.departmentId === row.departmentId)
          ? row.assets
          : [],
      available: row.onHand - row.reserved,
    };
  });
}

export async function createDepartmentStock(data) {
  const item = await findItem(data.itemId);
  if (!item.isActive)
    throw createHttpError(
      409,
      "Cannot open stock for an inactive inventory item",
    );
  if (
    !(await prisma.department.findUnique({ where: { id: data.departmentId } }))
  )
    throw createHttpError(422, "Department does not exist");
  const existing = await prisma.departmentStock.findUnique({
    where: {
      departmentId_itemId: {
        departmentId: data.departmentId,
        itemId: data.itemId,
      },
    },
  });
  if (existing)
    throw createHttpError(409, "This item is already open for the department");
  return prisma.departmentStock.create({ data });
}

export async function updateDepartmentStock(id, data) {
  return serializableTransaction(async (tx) => {
  const stock = await findStock(id, tx);
  if (data.isActive && !stock.item.isActive)
    throw createHttpError(
      409,
      "Cannot reopen stock for an inactive inventory item",
    );
  if (data.isActive === false) {
    const shipment = await tx.inventoryReplenishment.findFirst({ where: {
      status: { in: ["PENDING", "APPROVED", "DISPATCHED"] },
      OR: [{ sourceStockId: id }, ...(stock.departmentId ? [{ departmentId: stock.departmentId, sourceStock: { itemId: stock.itemId } }] : [])],
    } });
    if (shipment) throw createHttpError(409, "Complete or cancel replenishments before closing this stock");
  }
  return tx.departmentStock.update({ where: { id }, data });
  });
}

async function findStock(id, tx = prisma) {
  const stock = await tx.departmentStock.findUnique({
    where: { id },
    include: { item: true },
  });
  if (!stock) throw createHttpError(404, "Department stock not found");
  return stock;
}

export async function adjustDepartmentStock(id, data, user) {
  return serializableTransaction(async (tx) => {
    const stock = await findStock(id, tx);
    assertStockScope(user, stock);
    if (!stock.isActive || !stock.item.isActive) throw createHttpError(409, "Stock is inactive");
    if (stock.item.isSerialized)
      throw createHttpError(
        422,
        "Serialized stock is changed by adding or updating serial assets",
      );
    const balance = await updateBalance(tx, id, {
      onHandDelta: data.quantity,
    });
    const before = balance.onHand - data.quantity;
    const auditNote = `${data.note || (data.quantity > 0 ? "รับสินค้าเข้าคลัง" : "ปรับยอดสินค้า")} | ยอดก่อน ${before} → หลัง ${balance.onHand}`;
    const movement = await tx.stockMovement.create({
      data: {
        stockId: id,
        actorId: user.id,
        type: data.quantity > 0 ? "IN" : "ADJUST",
        onHandDelta: data.quantity,
        note: auditNote,
      },
    });
    await createLowStockNotifications(tx, id);
    return movement;
  });
}

export async function createAsset(data, user) {
  return serializableTransaction(async (tx) => {
    const stock = await findStock(data.stockId, tx);
    assertStockScope(user, stock);
    if (!stock.isActive || !stock.item.isActive) throw createHttpError(409, "Stock is inactive");
    if (!stock.item.isSerialized)
      throw createHttpError(422, "This stock does not use serial numbers");
    if (
      await tx.inventoryAsset.findUnique({ where: { serialNo: data.serialNo } })
    )
      throw createHttpError(409, "Serial number already exists");
    if (
      data.assetTag &&
      (await tx.inventoryAsset.findUnique({
        where: { assetTag: data.assetTag },
      }))
    )
      throw createHttpError(409, "Asset tag already exists");
    const asset = await tx.inventoryAsset.create({ data });
    await updateBalance(tx, stock.id, { onHandDelta: 1 });
    await tx.stockMovement.create({
      data: {
        stockId: stock.id,
        actorId: user.id,
        type: "IN",
        onHandDelta: 1,
        note: `Added serial ${asset.serialNo}`,
      },
    });
    return asset;
  });
}

export async function updateAsset(id, data, user) {
  return serializableTransaction(async (tx) => {
    const asset = await tx.inventoryAsset.findUnique({
      where: { id },
      include: { stock: true },
    });
    if (!asset) throw createHttpError(404, "Serial asset not found");
    assertStockScope(user, asset.stock);
    if (asset.status === "ASSIGNED" || asset.status === "IN_TRANSIT")
      throw createHttpError(409, "Assigned or in-transit assets cannot be edited; complete their return or receipt first");
    const { note, ...assetData } = data;
    if (assetData.assetTag === "") assetData.assetTag = null;
    if (
      assetData.serialNo &&
      assetData.serialNo !== asset.serialNo &&
      (await tx.inventoryAsset.findFirst({
        where: { serialNo: assetData.serialNo, NOT: { id } },
      }))
    ) {
      throw createHttpError(409, "Serial number already exists");
    }
    if (
      assetData.assetTag &&
      assetData.assetTag !== asset.assetTag &&
      (await tx.inventoryAsset.findFirst({
        where: { assetTag: assetData.assetTag, NOT: { id } },
      }))
    ) {
      throw createHttpError(409, "Asset tag already exists");
    }
    const delta =
      assetData.status && assetData.status !== asset.status
        ? Number(assetData.status === "AVAILABLE") -
          Number(asset.status === "AVAILABLE")
        : 0;
    if (delta < 0) {
      if (!note?.trim())
        throw createHttpError(
          422,
          "Reason is required when removing an asset from available stock",
        );
    }
    if (delta) await updateBalance(tx, asset.stockId, { onHandDelta: delta });
    const changes = ["serialNo", "assetTag", "condition", "status"].filter(
      (field) =>
        assetData[field] !== undefined && assetData[field] !== asset[field],
    );
    const updated = await tx.inventoryAsset.update({
      where: { id },
      data: assetData,
    });
    if (changes.length) {
      const detail = changes
        .map(
          (field) =>
            `${field}: ${asset[field] ?? "-"} -> ${assetData[field] ?? "-"}`,
        )
        .join(", ");

      await tx.stockMovement.create({
        data: {
          stockId: asset.stockId,
          actorId: user.id,
          type: delta > 0 ? "RETURN" : "ADJUST",
          onHandDelta: delta,
          note: `Asset ${asset.serialNo}: ${detail}${note ? ` | ${note}` : ""}`.slice(
            0,
            500,
          ),
        },
      });
    }
    if (delta) await createLowStockNotifications(tx, asset.stockId);
    return updated;
  });
}

const assignmentInclude = {
  asset: { include: { stock: { include: { item: true, department: true } } } },
  user: {
    select: { id: true, firstname: true, lastname: true, departmentId: true },
  },
  requestLine: { select: { id: true, requestId: true } },
};

export async function listAssignments(user) {
  assertDepartmentAccount(user);
  const where =
    user.role === "ADMIN_SYSTEM"
      ? {}
      : user.role === "ADMIN_DEPT"
        ? { asset: { stock: { departmentId: user.departmentId } } }
        : { userId: user.id };
  return prisma.assetAssignment.findMany({
    where,
    include: assignmentInclude,
    orderBy: { assignedAt: "desc" },
  });
}

export async function issueAssetDirectly(data, user) {
  return serializableTransaction(async (tx) => {
    const asset = await tx.inventoryAsset.findUnique({
      where: { id: data.assetId },
      include: {
        stock: { include: { item: true, department: true } },
      },
    });
    if (!asset) throw createHttpError(404, "Serial asset not found");
    assertStockScope(user, asset.stock);
    if (!asset.stock.isActive || !asset.stock.item.isActive)
      throw createHttpError(
        409,
        "Stock must be active before issuing an asset",
      );
    if (asset.status !== "AVAILABLE")
      throw createHttpError(409, "Serial asset is not available");

    const recipient = await tx.user.findUnique({
      where: { id: data.userId },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        role: true,
        departmentId: true,
      },
    });
    if (!recipient) throw createHttpError(422, "Recipient does not exist");
    if (
      user.role === "ADMIN_DEPT" &&
      (recipient.role !== "STAFF" ||
        recipient.departmentId !== user.departmentId)
    )
      throw createHttpError(
        403,
        "Department admins can only issue assets to staff in their department",
      );

    const assigned = await tx.inventoryAsset.updateMany({
      where: { id: asset.id, status: "AVAILABLE" },
      data: { status: "ASSIGNED" },
    });
    if (assigned.count !== 1)
      throw createHttpError(409, "Serial asset is no longer available");
    await updateBalance(tx, asset.stockId, { onHandDelta: -1 });
    const assignment = await tx.assetAssignment.create({
      data: {
        assetId: asset.id,
        userId: recipient.id,
        conditionOut: data.conditionOut || asset.condition,
      },
      include: assignmentInclude,
    });
    await tx.stockMovement.create({
      data: {
        stockId: asset.stockId,
        actorId: user.id,
        type: "OUT",
        onHandDelta: -1,
        note: `Direct issue ${asset.serialNo} to ${recipient.firstname} ${recipient.lastname}: ${data.note}`.slice(
          0,
          500,
        ),
      },
    });
    await createLowStockNotifications(tx, asset.stockId);
    await tx.notification.create({
      data: {
        userId: recipient.id,
        link: "/inventory?view=approvals",
        message: `ได้รับ ${asset.stock.item.name} (${asset.serialNo})`,
      },
    });
    return assignment;
  });
}

export async function returnAssignment(id, data, user) {
  return serializableTransaction(async (tx) => {
    const assignment = await tx.assetAssignment.findUnique({
      where: { id },
      include: assignmentInclude,
    });
    if (!assignment) throw createHttpError(404, "Asset assignment not found");
    assertStockScope(user, assignment.asset.stock);
    if (assignment.returnedAt)
      throw createHttpError(409, "This asset has already been returned");
    const returnedAt = new Date();
    await tx.assetAssignment.update({
      where: { id },
      data: { returnedAt, conditionIn: data.conditionIn },
    });
    await tx.inventoryAsset.update({
      where: { id: assignment.assetId },
      data: { status: data.outcome, condition: data.conditionIn },
    });
    if (data.outcome === "AVAILABLE") {
      await updateBalance(tx, assignment.asset.stockId, { onHandDelta: 1 });
    }
    await tx.stockMovement.create({
      data: {
        stockId: assignment.asset.stockId,
        requestLineId: assignment.requestLineId,
        actorId: user.id,
        type: "RETURN",
        onHandDelta: data.outcome === "AVAILABLE" ? 1 : 0,
        note: `Returned ${assignment.asset.serialNo}: ${data.outcome} - ${data.conditionIn}`,
      },
    });
    await createLowStockNotifications(tx, assignment.asset.stockId);
    await tx.notification.create({
      data: {
        userId: assignment.userId,
        link: "/inventory?view=approvals",
        message: `รับคืน ${assignment.asset.stock.item.name} (${assignment.asset.serialNo}) เรียบร้อยแล้ว`,
      },
    });
    return tx.assetAssignment.findUnique({
      where: { id },
      include: assignmentInclude,
    });
  });
}

const requestInclude = {
  requester: {
    select: {
      id: true,
      firstname: true,
      lastname: true,
      departmentId: true,
      role: true,
    },
  },
  fromDepartment: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, firstname: true, lastname: true } },
  lines: {
    include: {
      stock: { include: { item: { select: itemSelect } } },
      asset: true,
    },
  },
};

export async function listRequests(user) {
  assertDepartmentAccount(user);
  const where =
    user.role === "ADMIN_SYSTEM"
      ? {}
      : user.role === "ADMIN_DEPT"
        ? {
            OR: [
              { requesterId: user.id },
              {
                fromDepartmentId: user.departmentId,
                requester: { departmentId: user.departmentId, role: "STAFF" },
              },
            ],
          }
        : { requesterId: user.id };
  return prisma.inventoryRequest.findMany({
    where,
    include: requestInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function createInventoryRequest(data, user) {
  if (
    user.role !== "ADMIN_SYSTEM" &&
    (!user.departmentId || data.fromDepartmentId !== user.departmentId)
  ) {
    throw createHttpError(
      403,
      "Inventory requests are limited to the account department",
    );
  }
  return serializableTransaction(async (tx) => {
    // Re-read inside the transaction so a concurrent department/role change
    // cannot create a request using the account scope from an earlier read.
    const requester = await tx.user.findUnique({ where: { id: user.id } });
    if (!requester) throw createHttpError(401, "Account no longer exists");
    if (requester.role !== "ADMIN_SYSTEM" &&
      (!requester.departmentId || requester.departmentId !== data.fromDepartmentId)) {
      throw createHttpError(403, "Inventory requests are limited to the account department");
    }
    const stockIds = [...new Set(data.lines.map((line) => line.stockId))];
    const actualStocks = await tx.departmentStock.findMany({
      where: { id: { in: stockIds } },
      include: { item: true },
    });
    if (
      actualStocks.length !== stockIds.length ||
      actualStocks.some(
        (stock) =>
          stock.departmentId !== data.fromDepartmentId ||
          !stock.isActive ||
          !stock.item.isActive,
      )
    ) {
      throw createHttpError(422, "Invalid or inactive department stock");
    }
    const totals = sumLinesByStock(data.lines);
    for (const { stockId, quantity } of totals) {
      const stock = actualStocks.find((row) => row.id === stockId);
      const matchingLines = data.lines.filter(
        (line) => line.stockId === stockId,
      );
      if (!stock.item.isSerialized && matchingLines.length > 1)
        throw createHttpError(422, "Duplicate stock line");
      if (
        stock.item.isSerialized &&
        matchingLines.some((line) => line.quantity !== 1)
      )
        throw createHttpError(
          422,
          "Serialized items must be requested one at a time",
        );
      if (stock.onHand - stock.reserved < quantity)
        throw createHttpError(409, `Insufficient stock: ${stock.item.name}`, {
          code: "INSUFFICIENT_STOCK",
        });

    }
    const created = await tx.inventoryRequest.create({
      data: {
        requesterId: user.id,
        fromDepartmentId: data.fromDepartmentId,
        reason: data.reason,
        lines: { create: data.lines },
      },
      include: requestInclude,
    });
    const approverWhere =
      user.role === "STAFF"
        ? {
            OR: [
              { role: "ADMIN_SYSTEM" },
              { role: "ADMIN_DEPT", departmentId: data.fromDepartmentId },
            ],
          }
        : { role: "ADMIN_SYSTEM" };
    const approvers = await tx.user.findMany({
      where: approverWhere,
      select: { id: true },
    });
    await tx.notification.createMany({
      data: approvers.map((approver) => ({
        userId: approver.id,
        link: "/inventory?view=approvals",
        message: `มีคำขอเบิกใหม่ #${created.id} รออนุมัติ`,
      })),
    });
    return created;
  });
}

export async function changeRequestStatus(id, data, user) {
  return serializableTransaction(async (tx) => {
    const request = await tx.inventoryRequest.findUnique({
      where: { id },
      include: {
        requester: { select: { departmentId: true, role: true } },
        lines: { include: { stock: { include: { item: true } } } },
      },
    });
    if (!request) throw createHttpError(404, "Inventory request not found");
    if (
      request.lines.some(
        (line) => line.stock.departmentId !== request.fromDepartmentId,
      )
    )
      throw createHttpError(
        409,
        "Request contains stock from another department",
      );
    const ownCancellation =
      data.status === "CANCELLED" && request.requesterId === user.id;
    if (data.status === "CANCELLED") {
      if (!ownCancellation)
        assertStockScope(user, { departmentId: request.fromDepartmentId });
      if (
        !ownCancellation &&
        user.role === "ADMIN_DEPT" &&
        (request.requester.departmentId !== user.departmentId ||
          request.requester.role !== "STAFF")
      )
        throw createHttpError(403, "Cannot cancel another department request");
      if (!["PENDING", "APPROVED"].includes(request.status))
        throw createHttpError(
          409,
          "Only pending or approved requests can be cancelled",
        );
      if (!data.rejectionReason?.trim())
        throw createHttpError(422, "Cancellation reason is required");
      if (request.status === "APPROVED") {
        for (const { stockId, quantity } of sumLinesByStock(request.lines)) {
          await updateBalance(tx, stockId, { reservedDelta: -quantity });
        }
        for (const line of request.lines)
          await tx.stockMovement.create({
            data: {
              stockId: line.stockId,
              requestLineId: line.id,
              actorId: user.id,
              type: "RELEASE",
              reservedDelta: -line.quantity,
              note: data.rejectionReason,
            },
          });
      }
      const cancelled = await tx.inventoryRequest.update({
        where: { id },
        data: {

          status: "CANCELLED",
          rejectionReason: data.rejectionReason,
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
        include: requestInclude,
      });
      await tx.notification.create({
        data: {
          userId: request.requesterId,
          link: "/inventory?view=approvals",
          message: `คำขอเบิก #${id} ยกเลิกแล้ว: ${data.rejectionReason}`,
        },
      });
      return cancelled;
    }
    assertStockScope(user, { departmentId: request.fromDepartmentId });
    if (
      user.role === "ADMIN_DEPT" &&
      (request.requester.departmentId !== user.departmentId ||
        request.requester.role !== "STAFF")
    ) {
      throw createHttpError(
        403,
        "Department admins can only process requests from users in their department",
      );
    }
    const now = new Date();
    if (data.status === "REJECTED") {
      if (request.status !== "PENDING")
        throw createHttpError(422, "Only pending requests can be rejected");
      if (!data.rejectionReason)
        throw createHttpError(422, "Rejection reason is required");
      const updated = await tx.inventoryRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectionReason: data.rejectionReason,
          reviewedById: user.id,
          reviewedAt: now,
        },
        include: requestInclude,
      });
      await tx.notification.create({
        data: {
          userId: request.requesterId,
          link: "/inventory?view=approvals",
          message: `คำขอเบิก #${id} ถูกปฏิเสธ: ${data.rejectionReason}`,
        },
      });
      return updated;
    }
    if (data.status === "APPROVED") {
      if (request.status !== "PENDING")
        throw createHttpError(422, "Only pending requests can be approved");
      if (
        request.lines.some(
          (line) => !line.stock.isActive || !line.stock.item.isActive,
        )
      )
        throw createHttpError(
          409,
          "Reopen every requested stock and item before approval",
        );
      for (const { stockId, quantity } of sumLinesByStock(request.lines)) {
        await updateBalance(tx, stockId, { reservedDelta: quantity });
      }
      for (const line of request.lines) {
        await tx.stockMovement.create({
          data: {
            stockId: line.stockId,
            requestLineId: line.id,
            actorId: user.id,
            type: "RESERVE",
            reservedDelta: line.quantity,
          },
        });
      }
      for (const { stockId } of sumLinesByStock(request.lines)) {
        await createLowStockNotifications(tx, stockId);
      }
      const updated = await tx.inventoryRequest.update({
        where: { id },
        data: { status: "APPROVED", reviewedById: user.id, reviewedAt: now },
        include: requestInclude,
      });
      await tx.notification.create({
        data: {
          userId: request.requesterId,
          link: "/inventory?view=approvals",
          message: `คำขอเบิก #${id} ได้รับอนุมัติแล้ว`,
        },
      });

            return updated;
    }
    if (request.status !== "APPROVED")
      throw createHttpError(422, "Only approved requests can be handed over");
    if (
      request.lines.some(
        (line) => !line.stock.isActive || !line.stock.item.isActive,
      )
    )
      throw createHttpError(
        409,
        "Reopen every requested stock and item before handover",
      );
    const serializedLines = request.lines.filter(
      (line) => line.stock.item.isSerialized,
    );
    const assetSelections = data.assetSelections ?? [];
    if (assetSelections.length !== serializedLines.length)
      throw createHttpError(
        422,
        "Select one serial asset for every serialized item",
      );
    if (
      new Set(assetSelections.map((selection) => selection.assetId)).size !==
      assetSelections.length
    )
      throw createHttpError(422, "Each serial asset can only be selected once");
    for (const { stockId, quantity } of sumLinesByStock(request.lines)) {
      await updateBalance(tx, stockId, {
        onHandDelta: -quantity,
        reservedDelta: -quantity,
      });
    }
    for (const line of request.lines) {
      let assetId;
      if (line.stock.item.isSerialized) {
        const selection = assetSelections.find(
          (row) => row.requestLineId === line.id,
        );
        if (!selection)
          throw createHttpError(
            422,
            `Select a serial asset: ${line.stock.item.name}`,
          );
        const asset = await tx.inventoryAsset.findFirst({
          where: {
            id: selection.assetId,
            stockId: line.stockId,
            status: "AVAILABLE",
          },
        });
        if (!asset)
          throw createHttpError(
            409,
            `Selected serial asset is no longer available: ${line.stock.item.name}`,
          );
        assetId = asset.id;
        const assigned = await tx.inventoryAsset.updateMany({
          where: { id: asset.id, status: "AVAILABLE" },
          data: { status: "ASSIGNED" },
        });
        if (assigned.count !== 1)
          throw createHttpError(
            409,
            `Selected serial asset is no longer available: ${line.stock.item.name}`,
          );
        await tx.inventoryRequestLine.update({
          where: { id: line.id },
          data: { assetId },
        });
        await tx.assetAssignment.create({
          data: {
            assetId,
            userId: request.requesterId,
            requestLineId: line.id,
            conditionOut: asset.condition,
          },
        });
      }
      await tx.stockMovement.create({
        data: {
          stockId: line.stockId,
          requestLineId: line.id,
          actorId: user.id,
          type: "OUT",
          onHandDelta: -line.quantity,
          reservedDelta: -line.quantity,
        },
      });
      await createLowStockNotifications(tx, line.stockId);

          }
    const updated = await tx.inventoryRequest.update({
      where: { id },
      data: { status: "FULFILLED", fulfilledAt: now },
      include: requestInclude,
    });
    await tx.notification.create({
      data: {
        userId: request.requesterId,
        link: "/inventory?view=approvals",
        message: `คำขอเบิก #${id} ส่งมอบเรียบร้อยแล้ว`,
      },
    });
    return updated;
  });
}

export async function listMovements(user) {
  assertDepartmentAccount(user);
  const scope =
    user.role === "ADMIN_SYSTEM"
      ? {}
      : user.role === "ADMIN_DEPT"
        ? { stock: { departmentId: user.departmentId } }
        : { requestLine: { request: { requesterId: user.id } } };
  const where = scope;
  const rows = await prisma.stockMovement.findMany({
    where,
    include: {
      stock: { include: { item: true, department: true } },
      actor: { select: { firstname: true, lastname: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({ ...row, stock: { ...row.stock,
    department: row.stock.department ?? { id: "central", name: "Central warehouse" },
  } }));
}
