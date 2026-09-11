-- Additive warehouse support. Existing department stocks and balances are preserved.
ALTER TYPE "InventoryAssetStatus" ADD VALUE 'IN_TRANSIT';
CREATE TYPE "ReplenishmentStatus" AS ENUM ('PENDING', 'APPROVED', 'DISPATCHED', 'RECEIVED', 'REJECTED', 'CANCELLED');
ALTER TABLE "department_stocks" ALTER COLUMN "department_id" DROP NOT NULL;
-- PostgreSQL nullable compound uniqueness alone permits duplicate central stocks.
CREATE UNIQUE INDEX "department_stocks_central_item_key" ON "department_stocks" ("item_id") WHERE "department_id" IS NULL;

CREATE TABLE "inventory_replenishments" (
  "id" SERIAL PRIMARY KEY,
  "source_stock_id" INTEGER NOT NULL REFERENCES "department_stocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "department_id" INTEGER NOT NULL REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "requester_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
  "reason" TEXT NOT NULL,
  "status" "ReplenishmentStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "received_by_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "decision_note" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "dispatched_at" TIMESTAMP(3),
  "received_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "inventory_replenishments_department_id_status_idx" ON "inventory_replenishments"("department_id", "status");
CREATE INDEX "inventory_replenishments_source_stock_id_status_idx" ON "inventory_replenishments"("source_stock_id", "status");
CREATE TABLE "replenishment_assets" (
  "replenishment_id" INTEGER NOT NULL REFERENCES "inventory_replenishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "asset_id" INTEGER NOT NULL REFERENCES "inventory_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  PRIMARY KEY ("replenishment_id", "asset_id")
);
ALTER TABLE "stock_movements" ADD COLUMN "replenishment_id" INTEGER REFERENCES "inventory_replenishments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
