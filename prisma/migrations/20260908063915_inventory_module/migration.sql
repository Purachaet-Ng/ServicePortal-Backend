-- CreateEnum
CREATE TYPE "InventoryRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryAssetStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'RESERVE', 'RELEASE', 'OUT', 'RETURN', 'ADJUST');

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" SERIAL NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "is_serialized" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_stocks" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "on_hand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "min_stock" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_assets" (
    "id" SERIAL NOT NULL,
    "stock_id" INTEGER NOT NULL,
    "serial_no" TEXT NOT NULL,
    "asset_tag" TEXT,
    "condition" TEXT,
    "status" "InventoryAssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_requests" (
    "id" SERIAL NOT NULL,
    "requester_id" INTEGER NOT NULL,
    "from_department_id" INTEGER NOT NULL,
    "reason" TEXT,
    "rejection_reason" TEXT,
    "status" "InventoryRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "fulfilled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_request_lines" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "stock_id" INTEGER NOT NULL,
    "asset_id" INTEGER,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "inventory_request_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_assignments" (
    "id" SERIAL NOT NULL,
    "asset_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "request_line_id" INTEGER,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returned_at" TIMESTAMP(3),
    "condition_out" TEXT,
    "condition_in" TEXT,

    CONSTRAINT "asset_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" SERIAL NOT NULL,
    "stock_id" INTEGER NOT NULL,
    "request_line_id" INTEGER,
    "actor_id" INTEGER NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "on_hand_delta" INTEGER NOT NULL DEFAULT 0,
    "reserved_delta" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_sku_key" ON "inventory_items"("sku");

-- CreateIndex
CREATE INDEX "department_stocks_department_id_is_active_idx" ON "department_stocks"("department_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "department_stocks_department_id_item_id_key" ON "department_stocks"("department_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_assets_serial_no_key" ON "inventory_assets"("serial_no");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_assets_asset_tag_key" ON "inventory_assets"("asset_tag");

-- CreateIndex
CREATE INDEX "inventory_assets_stock_id_status_idx" ON "inventory_assets"("stock_id", "status");

-- CreateIndex
CREATE INDEX "inventory_requests_requester_id_status_idx" ON "inventory_requests"("requester_id", "status");

-- CreateIndex
CREATE INDEX "inventory_requests_from_department_id_status_idx" ON "inventory_requests"("from_department_id", "status");

-- CreateIndex
CREATE INDEX "inventory_request_lines_request_id_stock_id_idx" ON "inventory_request_lines"("request_id", "stock_id");

-- CreateIndex
CREATE INDEX "inventory_request_lines_stock_id_idx" ON "inventory_request_lines"("stock_id");

-- CreateIndex
CREATE INDEX "asset_assignments_asset_id_returned_at_idx" ON "asset_assignments"("asset_id", "returned_at");

-- CreateIndex
CREATE INDEX "asset_assignments_user_id_returned_at_idx" ON "asset_assignments"("user_id", "returned_at");

-- CreateIndex
CREATE INDEX "stock_movements_stock_id_created_at_idx" ON "stock_movements"("stock_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_request_line_id_idx" ON "stock_movements"("request_line_id");

-- AddForeignKey
ALTER TABLE "department_stocks" ADD CONSTRAINT "department_stocks_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_stocks" ADD CONSTRAINT "department_stocks_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_assets" ADD CONSTRAINT "inventory_assets_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "department_stocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_requests" ADD CONSTRAINT "inventory_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_requests" ADD CONSTRAINT "inventory_requests_from_department_id_fkey" FOREIGN KEY ("from_department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_requests" ADD CONSTRAINT "inventory_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_request_lines" ADD CONSTRAINT "inventory_request_lines_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "inventory_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_request_lines" ADD CONSTRAINT "inventory_request_lines_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "department_stocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_request_lines" ADD CONSTRAINT "inventory_request_lines_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "inventory_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "inventory_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_request_line_id_fkey" FOREIGN KEY ("request_line_id") REFERENCES "inventory_request_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "department_stocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_request_line_id_fkey" FOREIGN KEY ("request_line_id") REFERENCES "inventory_request_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
