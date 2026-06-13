export interface Supplier {
  id?: number;
  supplierId?: number;
  name: string;
  rfc?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  contact?: string | null;
  active?: boolean;
}

export interface SupplierFilters {
  search?: string;
  active?: boolean;
}

export interface SupplierSaveRequest {
  name: string;
  rfc?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  contact?: string | null;
}
