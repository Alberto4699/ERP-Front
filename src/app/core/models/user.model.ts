export interface User {
  id?: number;
  userId?: number;
  userTypeId?: number;
  userTypeName?: string | null;
  roleId?: number;
  roleName?: string | null;
  name: string;
  middleName?: string | null;
  paternalLastName: string;
  maternalLastName?: string | null;
  email: string;
  phone?: string | null;
  username: string;
  active?: boolean;
}

export interface UserFilters {
  search?: string;
  roleId?: number;
  userTypeId?: number;
  active?: boolean;
}

export interface UserCreateRequest {
  userTypeId: number;
  roleId: number;
  name: string;
  middleName?: string | null;
  paternalLastName: string;
  maternalLastName?: string | null;
  email: string;
  phone?: string | null;
  username: string;
  password: string;
}

export interface UserUpdateRequest {
  userTypeId: number;
  roleId: number;
  name: string;
  middleName?: string | null;
  paternalLastName: string;
  maternalLastName?: string | null;
  email: string;
  phone?: string | null;
  username: string;
}
