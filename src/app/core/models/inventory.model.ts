export interface InventoryStock {
  id?: number;
  inventoryId?: number;
  warehouseId?: number;
  warehouseName?: string | null;
  branchId?: number;
  branchName?: string | null;
  productId?: number;
  productCode?: string | null;
  productName?: string | null;
  productBarcode?: string | null;
  measurementUnitName?: string | null;
  measurementUnitAbbreviation?: string | null;
  quantity?: number;
  stock?: number;
  currentStock?: number;
  availableStock?: number;
  minimumStock?: number | null;
  maximumStock?: number | null;
  lowStock?: boolean;
  lastMovementAt?: string | null;
  updatedAt?: string | null;
}

export interface InventoryFilters {
  search?: string;
  warehouseId?: number;
  productId?: number;
  lowStock?: boolean;
}

export interface InventoryAdjustmentRequest {
  warehouseId: number;
  productId: number;
  inventoryMovementTypeId: number;
  quantity: number;
  reference?: string | null;
  notes?: string | null;
}
