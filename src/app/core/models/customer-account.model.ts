export interface CustomerAccountMovement {
  id?: number;
  customerAccountMovementId?: number;
  customerAccountId?: number;
  saleId?: number | null;
  movementType?: string | null;
  amount?: number;
  balance?: number;
  notes?: string | null;
  createdAt?: string | null;
  createdByUserId?: number | null;
  createdByUserName?: string | null;
}

export interface CustomerAccount {
  id?: number;
  customerAccountId?: number;
  customerId?: number;
  customerName?: string | null;
  creditLimit?: number;
  creditActive?: boolean;
  balance?: number;
  availableCredit?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  movements?: CustomerAccountMovement[] | null;
}

export interface CustomerAccountFilters {
  search?: string;
  creditActive?: boolean;
  withBalance?: boolean;
}

export interface CustomerAccountSaveRequest {
  customerId?: number;
  creditLimit: number;
  creditActive: boolean;
}

export interface CustomerAccountMovementRequest {
  saleId?: number | null;
  amount: number;
  notes?: string | null;
}

export interface CustomerAccountMovementFilters {
  movementType?: string;
  fromDate?: string;
  toDate?: string;
}
