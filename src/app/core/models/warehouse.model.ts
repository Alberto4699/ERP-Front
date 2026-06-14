export interface Warehouse {
  id?: number;
  warehouseId?: number;
  branchId?: number;
  branchName?: string | null;
  name: string;
  code: string;
  description?: string | null;
  isPrimary?: boolean;
  active?: boolean;
}

export interface WarehouseFilters {
  search?: string;
  branchId?: number;
  active?: boolean;
  isPrimary?: boolean;
}

export interface WarehouseSaveRequest {
  branchId: number;
  name: string;
  code: string;
  description?: string | null;
  isPrimary: boolean;
}
