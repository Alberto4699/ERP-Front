export interface SaleDetail {
  id?: number;
  saleDetailId?: number;
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

export interface Sale {
  id?: number;
  saleId?: number;
  customerId?: number | null;
  customerName?: string | null;
  branchId?: number;
  branchName?: string | null;
  warehouseId?: number;
  warehouseName?: string | null;
  salespersonUserId?: number;
  salespersonUserName?: string | null;
  folio?: string | null;
  saleDate?: string | null;
  paymentType?: string | null;
  isCredit?: boolean;
  status?: string | null;
  vatPercentage?: number;
  subtotal?: number;
  vatAmount?: number;
  total?: number;
  notes?: string | null;
  details?: SaleDetail[] | null;
  createdAt?: string | null;
  createdByUserId?: number | null;
  createdByUserName?: string | null;
}

export interface SaleFilters {
  search?: string;
  customerId?: number;
  branchId?: number;
  warehouseId?: number;
  salespersonUserId?: number;
  status?: string;
  paymentType?: string;
  isCredit?: boolean;
  fromDate?: string;
  toDate?: string;
}

export interface SaleDetailRequest {
  productId: number;
  quantity: number;
  unitPrice: number;
  vatPercentage?: number | null;
}

export interface SaleCreateRequest {
  customerId?: number | null;
  branchId: number;
  warehouseId: number;
  salespersonUserId: number;
  folio?: string | null;
  saleDate?: string | null;
  paymentType: string;
  isCredit: boolean;
  vatPercentage: number;
  notes?: string | null;
  details: SaleDetailRequest[];
}
