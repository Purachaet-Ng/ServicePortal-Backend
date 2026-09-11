import express from "express";
import { getCentralStocks, postCentralStock, getReplenishments, postReplenishment, patchReplenishment } from "../controllers/replenishment.controller.js";
import { centralStockSchema, replenishmentSchema, replenishmentActionSchema } from "../validators/replenishment.validator.js";
import { getInventoryReport } from "../controllers/inventory-report.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import { idParams } from "../validators/common.validator.js";
import {
  adjustStockSchema,
  createAssetSchema,
  createItemSchema,
  createRequestSchema,
  createStockSchema,
  inventoryReportQuerySchema,
  issueAssetSchema,
  returnAssetSchema,
  updateAssetSchema,
  updateItemSchema,
  updateRequestStatusSchema,
  updateStockSchema,
} from "../validators/inventory.validator.js";
import {
  deleteItem,
  getAssignments,
  getItems,
  getMovements,
  getRequests,
  getStocks,
  patchAsset,
  patchItem,
  patchRequestStatus,
  patchStock,
  postAdjustment,
  postAsset,
  postAssignment,
  postAssignmentReturn,
  postItem,
  postRequest,
  postStock,
} from "../controllers/inventory.controller.js";

const router = express.Router();

router.use(authenticate);
router.get("/central-stocks", authorize("ADMIN_SYSTEM", "ADMIN_DEPT"), getCentralStocks);
router.post("/central-stocks", authorize("ADMIN_SYSTEM"), validate({ body: centralStockSchema }), postCentralStock);
router.get("/replenishments", authorize("ADMIN_SYSTEM", "ADMIN_DEPT"), getReplenishments);
router.post("/replenishments", authorize("ADMIN_SYSTEM", "ADMIN_DEPT"), validate({ body: replenishmentSchema }), postReplenishment);
router.patch("/replenishments/:id", authorize("ADMIN_SYSTEM", "ADMIN_DEPT"), validate({ params: idParams, body: replenishmentActionSchema }), patchReplenishment);

router.get("/items", getItems);
router.post(
  "/items",
  authorize("ADMIN_SYSTEM"),
  validate({ body: createItemSchema }),
  postItem,
);
router.patch(
  "/items/:id",
  authorize("ADMIN_SYSTEM"),
  validate({ params: idParams, body: updateItemSchema }),
  patchItem,
);
router.delete(
  "/items/:id",
  authorize("ADMIN_SYSTEM"),
  validate({ params: idParams }),
  deleteItem,
);

router.get("/stocks", getStocks);
router.post(
  "/stocks",
  authorize("ADMIN_SYSTEM"),
  validate({ body: createStockSchema }),
  postStock,
);
router.patch(
  "/stocks/:id",
  authorize("ADMIN_SYSTEM"),
  validate({ params: idParams, body: updateStockSchema }),
  patchStock,
);
router.post(
  "/stocks/:id/adjustments",
  authorize("ADMIN_DEPT", "ADMIN_SYSTEM"),
  validate({ params: idParams, body: adjustStockSchema }),
  postAdjustment,
);

router.post(
  "/assets",
  authorize("ADMIN_DEPT", "ADMIN_SYSTEM"),
  validate({ body: createAssetSchema }),
  postAsset,
);
router.patch(
  "/assets/:id",
  authorize("ADMIN_DEPT", "ADMIN_SYSTEM"),
  validate({ params: idParams, body: updateAssetSchema }),
  patchAsset,
);

router.get("/requests", getRequests);
router.post("/requests", validate({ body: createRequestSchema }), postRequest);
router.patch(
  "/requests/:id/status",
  validate({ params: idParams, body: updateRequestStatusSchema }),
  patchRequestStatus,
);

router.get("/movements", getMovements);
router.get(
  "/report.pdf",
  authorize("ADMIN_DEPT", "ADMIN_SYSTEM"),
  validate({ query: inventoryReportQuerySchema }),
  getInventoryReport,
);

router.get("/assignments", getAssignments);
router.post(
  "/assignments",
  authorize("ADMIN_DEPT", "ADMIN_SYSTEM"),
  validate({ body: issueAssetSchema }),
  postAssignment,
);
router.post(
  "/assignments/:id/return",
  authorize("ADMIN_DEPT", "ADMIN_SYSTEM"),
  validate({ params: idParams, body: returnAssetSchema }),
  postAssignmentReturn,
);

export default router;
