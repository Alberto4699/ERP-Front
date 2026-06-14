export interface Customer {
  id?: number;
  customerId?: number;
  userId?: number | null;
  name: string;
  rfc?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  status?: string | null;
  postalCode?: string | null;
  customerType: string;
  creditLimit?: number;
  creditActive?: boolean;
  active?: boolean;
}

export interface CustomerFilters {
  search?: string;
  customerType?: string;
  creditActive?: boolean;
  active?: boolean;
}

export interface CustomerSaveRequest {
  userId?: number | null;
  name: string;
  rfc?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  status?: string | null;
  postalCode?: string | null;
  customerType: string;
  creditLimit: number;
  creditActive: boolean;
}
