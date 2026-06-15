export interface PurchaseDetail {
  id?: number;
  purchaseDetailId?: number;
  productId?: number;
  productCode?: string | null;
  productName?: string | null;
  quantity?: number;
  unitPrice?: number;
  vatPercentage?: number | null;
  subtotal?: number;
  vatAmount?: number;
  total?: number;
}

export interface Purchase {
  id?: number;
  purchaseId?: number;
  supplierId?: number;
  supplierName?: string | null;
  branchId?: number;
  branchName?: string | null;
  warehouseId?: number;
  warehouseName?: string | null;
  folio?: string | null;
  purchaseDate?: string | null;
  status?: string | null;
  vatPercentage?: number;
  subtotal?: number;
  vatAmount?: number;
  total?: number;
  notes?: string | null;
  details?: PurchaseDetail[] | null;
  createdAt?: string | null;
  createdByUserId?: number | null;
  createdByUserName?: string | null;
}

export interface PurchaseFilters {
  search?: string;
  supplierId?: number;
  branchId?: number;
  warehouseId?: number;
  status?: string;
  fromDate?: string;
  toDate?: string;
}

export interface PurchaseDetailRequest {
  productId: number;
  quantity: number;
  unitPrice: number;
  vatPercentage?: number | null;
}

export interface PurchaseCreateRequest {
  supplierId: number;
  branchId: number;
  warehouseId: number;
  folio?: string | null;
  purchaseDate?: string | null;
  vatPercentage: number;
  notes?: string | null;
  details: PurchaseDetailRequest[];
}
