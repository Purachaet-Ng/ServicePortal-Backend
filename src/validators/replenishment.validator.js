import z from "zod";
import { positiveId, requiredText } from "./common.validator.js";
export const centralStockSchema = z
  .object({
    itemId: positiveId("Select an item"),
    quantity: z.coerce.number().int().positive().max(1000000).optional(),
    note: z.string().trim().max(1000).optional(),
    serialNo: z.string().trim().min(1).max(120).optional(),
    assetTag: z.string().trim().max(120).optional(),
  })
  .refine((data) => data.quantity !== undefined || data.serialNo, {
    message: "Quantity or serial number is required",
  });
export const replenishmentSchema = z.object({
  sourceStockId: positiveId("Select central stock"),
  departmentId: positiveId("Select a department").optional(),
  quantity: z.coerce.number().int().positive().max(1000000),
  reason: requiredText("reason").max(1000),
});
export const replenishmentActionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "CANCELLED", "DISPATCHED", "RECEIVED"]),
  note: z.string().trim().max(1000).optional(),
  assetIds: z.array(positiveId("Invalid asset id")).max(1000).optional(),
  confirmReceipt: z.boolean().optional(),
});
