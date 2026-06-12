export interface Brand {
  id?: number;
  brandId?: number;
  name: string;
  description?: string | null;
  active?: boolean;
}

export interface BrandFilters {
  search?: string;
  active?: boolean;
}

export interface BrandSaveRequest {
  name: string;
  description?: string | null;
}
