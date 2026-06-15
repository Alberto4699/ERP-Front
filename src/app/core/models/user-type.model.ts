export interface UserType {
  id?: number;
  userTypeId?: number;
  name: string;
  description?: string | null;
  active?: boolean;
}

export interface UserTypeFilters {
  search?: string;
  active?: boolean;
}

export interface UserTypeSaveRequest {
  name: string;
  description?: string | null;
}
