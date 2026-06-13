export interface ProductListItem {
  id: number;
  code: string;
  barcode?: string | null;
  name: string;
  categoryName: string;
  brandName?: string | null;
  measurementUnitAbbreviation: string;
  salePrice: number;
  tracksInventory: boolean;
  active: boolean;
}

export interface ProductResponse extends ProductListItem {
  categoryId: number;
  brandId?: number | null;
  measurementUnitId: number;
  measurementUnitName: string;
  description?: string | null;
  purchasePrice: number;
  minimumStock: number;
  maximumStock?: number | null;
  createdByUserId: number;
  createdAt: string;
}

export interface ProductFilters {
  search?: string;
  categoryId?: number;
  brandId?: number;
  active?: boolean;
  tracksInventory?: boolean;
}

export interface ProductSaveRequest {
  categoryId: number;
  brandId?: number | null;
  measurementUnitId: number;
  code: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  purchasePrice: number;
  salePrice: number;
  minimumStock: number;
  maximumStock?: number | null;
  tracksInventory: boolean;
}
