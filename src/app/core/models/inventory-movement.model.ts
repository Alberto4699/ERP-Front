export interface InventoryMovement {
  id?: number;
  inventoryMovementId?: number;
  warehouseId?: number;
  warehouseName?: string | null;
  branchId?: number;
  branchName?: string | null;
  productId?: number;
  productCode?: string | null;
  productName?: string | null;
  inventoryMovementTypeId?: number;
  inventoryMovementTypeName?: string | null;
  movementType?: string | null;
  movementTypeName?: string | null;
  quantity?: number;
  previousQuantity?: number | null;
  newQuantity?: number | null;
  reference?: string | null;
  notes?: string | null;
  movementDate?: string | null;
  createdAt?: string | null;
  createdByUserId?: number | null;
  createdByUserName?: string | null;
}

export interface InventoryMovementType {
  id?: number;
  inventoryMovementTypeId?: number;
  name?: string | null;
  code?: string | null;
  description?: string | null;
  movementType?: string | null;
}

export interface InventoryMovementFilters {
  search?: string;
  warehouseId?: number;
  productId?: number;
  inventoryMovementTypeId?: number;
  fromDate?: string;
  toDate?: string;
}
