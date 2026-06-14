export interface Branch {
  id?: number;
  branchId?: number;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  rfc?: string | null;
  manager?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  active?: boolean;
}

export interface BranchFilters {
  search?: string;
  active?: boolean;
}

export interface BranchSaveRequest {
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  rfc?: string | null;
  manager?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}
