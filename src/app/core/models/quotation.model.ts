export interface QuotationDetail {
  id?: number;
  quotationDetailId?: number;
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

export interface Quotation {
  id?: number;
  quotationId?: number;
  customerId?: number | null;
  customerName?: string | null;
  branchId?: number;
  branchName?: string | null;
  salespersonUserId?: number;
  salespersonUserName?: string | null;
  folio?: string | null;
  quotationDate?: string | null;
  expirationDate?: string | null;
  status?: string | null;
  vatPercentage?: number;
  subtotal?: number;
  vatAmount?: number;
  total?: number;
  notes?: string | null;
  details?: QuotationDetail[] | null;
  createdAt?: string | null;
  createdByUserId?: number | null;
  createdByUserName?: string | null;
}

export interface QuotationFilters {
  search?: string;
  customerId?: number;
  branchId?: number;
  salespersonUserId?: number;
  status?: string;
  fromDate?: string;
  toDate?: string;
}

export interface QuotationDetailRequest {
  productId: number;
  quantity: number;
  unitPrice: number;
  vatPercentage?: number | null;
}

export interface QuotationCreateRequest {
  customerId?: number | null;
  branchId: number;
  salespersonUserId: number;
  folio?: string | null;
  quotationDate?: string | null;
  expirationDate?: string | null;
  vatPercentage: number;
  notes?: string | null;
  details: QuotationDetailRequest[];
}

export interface QuotationUpdateRequest {
  customerId?: number | null;
  branchId: number;
  salespersonUserId: number;
  quotationDate?: string | null;
  expirationDate?: string | null;
  vatPercentage: number;
  notes?: string | null;
  details: QuotationDetailRequest[];
}
