export interface Role {
  id?: number;
  roleId?: number;
  name: string;
  description?: string | null;
  active?: boolean;
}

export interface RoleFilters {
  search?: string;
  active?: boolean;
}

export interface RoleSaveRequest {
  name: string;
  description?: string | null;
}
