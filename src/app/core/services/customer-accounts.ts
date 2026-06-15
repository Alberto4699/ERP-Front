import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { CustomerAccount, CustomerAccountFilters, CustomerAccountMovement, CustomerAccountMovementFilters, CustomerAccountMovementRequest, CustomerAccountSaveRequest } from '../models/customer-account.model';

@Injectable({ providedIn: 'root' })
export class CustomerAccountsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/customer-accounts`;

  getAll(filters: CustomerAccountFilters = {}): Observable<ApiResponse<CustomerAccount[]>> {
    let params = new HttpParams();
    if (filters.search) params = params.set('Search', filters.search);
    if (filters.creditActive !== undefined) params = params.set('CreditActive', String(filters.creditActive));
    if (filters.withBalance !== undefined) params = params.set('WithBalance', String(filters.withBalance));
    return this.http.get<ApiResponse<CustomerAccount[]>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<ApiResponse<CustomerAccount>> {
    return this.http.get<ApiResponse<CustomerAccount>>(`${this.apiUrl}/${id}`);
  }

  getByCustomer(customerId: number): Observable<ApiResponse<CustomerAccount>> {
    return this.http.get<ApiResponse<CustomerAccount>>(`${this.apiUrl}/by-customer/${customerId}`);
  }

  create(request: CustomerAccountSaveRequest): Observable<ApiResponse<CustomerAccount>> {
    return this.http.post<ApiResponse<CustomerAccount>>(this.apiUrl, request);
  }

  update(id: number, request: CustomerAccountSaveRequest): Observable<ApiResponse<CustomerAccount>> {
    return this.http.put<ApiResponse<CustomerAccount>>(`${this.apiUrl}/${id}`, request);
  }

  remove(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`);
  }

  createCharge(id: number, request: CustomerAccountMovementRequest): Observable<ApiResponse<CustomerAccountMovement>> {
    return this.http.post<ApiResponse<CustomerAccountMovement>>(`${this.apiUrl}/${id}/charges`, request);
  }

  createPayment(id: number, request: CustomerAccountMovementRequest): Observable<ApiResponse<CustomerAccountMovement>> {
    return this.http.post<ApiResponse<CustomerAccountMovement>>(`${this.apiUrl}/${id}/payments`, request);
  }

  getMovements(id: number, filters: CustomerAccountMovementFilters = {}): Observable<ApiResponse<CustomerAccountMovement[]>> {
    let params = new HttpParams();
    if (filters.movementType) params = params.set('MovementType', filters.movementType);
    if (filters.fromDate) params = params.set('FromDate', filters.fromDate);
    if (filters.toDate) params = params.set('ToDate', filters.toDate);
    return this.http.get<ApiResponse<CustomerAccountMovement[]>>(`${this.apiUrl}/${id}/movements`, { params });
  }
}
