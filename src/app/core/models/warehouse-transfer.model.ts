export interface WarehouseTransferDetail {
  id?: number;
  warehouseTransferDetailId?: number;
  productId?: number;
  productCode?: string | null;
  productName?: string | null;
  quantity?: number;
}

export interface WarehouseTransfer {
  id?: number;
  warehouseTransferId?: number;
  branchId?: number;
  branchName?: string | null;
  sourceWarehouseId?: number;
  sourceWarehouseName?: string | null;
  destinationWarehouseId?: number;
  destinationWarehouseName?: string | null;
  folio?: string | null;
  transferDate?: string | null;
  status?: string | null;
  notes?: string | null;
  details?: WarehouseTransferDetail[] | null;
  createdAt?: string | null;
  createdByUserId?: number | null;
  createdByUserName?: string | null;
}

export interface WarehouseTransferFilters {
  search?: string;
  branchId?: number;
  sourceWarehouseId?: number;
  destinationWarehouseId?: number;
  status?: string;
  fromDate?: string;
  toDate?: string;
}

export interface WarehouseTransferDetailRequest {
  productId: number;
  quantity: number;
}

export interface WarehouseTransferCreateRequest {
  branchId: number;
  sourceWarehouseId: number;
  destinationWarehouseId: number;
  folio?: string | null;
  transferDate?: string | null;
  notes?: string | null;
  details: WarehouseTransferDetailRequest[];
}
