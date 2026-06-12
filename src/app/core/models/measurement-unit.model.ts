export interface MeasurementUnit {
  id?: number;
  measurementUnitId?: number;
  name: string;
  abbreviation: string;
  allowsDecimal?: boolean;
  active?: boolean;
}

export interface MeasurementUnitFilters {
  search?: string;
  active?: boolean;
}

export interface MeasurementUnitSaveRequest {
  name: string;
  abbreviation: string;
  allowsDecimal: boolean;
}
