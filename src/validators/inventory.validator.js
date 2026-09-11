import z from "zod";
import {
  InventoryAssetStatus,
  InventoryRequestStatus,
  StockMovementType,
} from "../../generated/prisma/index.js";
import { positiveId, requiredText } from "./common.validator.js";

const INVENTORY_ASSET_STATUSES = Object.values(InventoryAssetStatus).filter(
  (status) => status !== "ASSIGNED" && status !== "IN_TRANSIT",
);
const INVENTORY_REQUEST_ACTIONS = Object.values(InventoryRequestStatus).filter(
  (status) => status !== "PENDING",
);
const STOCK_MOVEMENT_TYPES = Object.values(StockMovementType);

const allToUndefined = (schema) =>
  z.preprocess(
    (value) =>
      value === "ALL" || value === "__all__" || value === ""
        ? undefined
        : value,
    schema,
  );

const itemFields = {
  sku: requiredText("sku").max(64),
  name: requiredText("name").max(200),
  unit: requiredText("unit").max(50),
  isSerialized: z.boolean(),
};

export const createItemSchema = z.object({
  ...itemFields,
  isSerialized: itemFields.isSerialized.default(false),
});

export const updateItemSchema = z
  .object(itemFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const createStockSchema = z.object({
  departmentId: positiveId("Invalid department id"),
  itemId: positiveId("Invalid item id"),
  minStock: z.coerce.number().int().nonnegative().default(0),
});

export const updateStockSchema = z
  .object({
    minStock: z.coerce.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const adjustStockSchema = z
  .object({
    quantity: z.coerce
      .number()
      .int()
      .refine((value) => value !== 0, "Quantity cannot be zero"),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((data, context) => {
    if (data.quantity < 0 && !data.note) {
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "Note is required when reducing stock",
      });
    }
  });

export const createAssetSchema = z.object({
  stockId: positiveId("Invalid stock id"),
  serialNo: requiredText("serial number").max(120),
  assetTag: z
    .string()
    .trim()
    .max(120)
    .transform((value) => value || null)
    .nullish(),
  condition: z.string().trim().max(500).nullish(),
});


export const updateAssetSchema = z
  .object({
    serialNo: requiredText("serial number").max(120).optional(),
    assetTag: z
      .string()
      .trim()
      .max(120)
      .transform((value) => value || null)
      .nullish(),
    condition: z.string().trim().max(500).nullish(),
    status: z.enum(INVENTORY_ASSET_STATUSES).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const createRequestSchema = z.object({
  fromDepartmentId: positiveId("Invalid department id"),
  reason: z.string().trim().max(1000).optional(),
  lines: z
    .array(
      z.object({
        stockId: positiveId("Invalid stock id"),
        quantity: z.coerce.number().int().positive(),
      }),
    )
    .min(1, "At least one item is required"),
});

export const updateRequestStatusSchema = z.object({
  status: z.enum(INVENTORY_REQUEST_ACTIONS),
  rejectionReason: z.string().trim().max(1000).optional(),
  assetSelections: z
    .array(
      z.object({
        requestLineId: positiveId("Invalid request line id"),
        assetId: positiveId("Invalid asset id"),
      }),
    )
    .optional(),
});

export const returnAssetSchema = z.object({
  conditionIn: z
    .string()
    .trim()
    .min(1, "Return condition is required")
    .max(500),
  outcome: z.enum(INVENTORY_ASSET_STATUSES),
});

export const issueAssetSchema = z.object({
  assetId: positiveId("Invalid asset id"),
  userId: positiveId("Invalid user id"),
  conditionOut: z.string().trim().max(500).optional(),
  note: requiredText("issue reason").max(500),
});

export const inventoryReportQuerySchema = z.object({
  departmentId: allToUndefined(positiveId("Invalid department id").optional()),
  type: allToUndefined(z.enum(STOCK_MOVEMENT_TYPES).optional()),
});
