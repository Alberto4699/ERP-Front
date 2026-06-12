export interface Category {
  id?: number;
  categoryId?: number;
  name: string;
  description?: string | null;
  active?: boolean;
}

export interface CategoryFilters {
  search?: string;
  active?: boolean;
}

export interface CategorySaveRequest {
  name: string;
  description?: string | null;
}
