import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { Sale, SaleCreateRequest, SaleFilters } from '../models/sale.model';

@Injectable({
  providedIn: 'root',
})
export class SalesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Sales`;

  getAll(filters: SaleFilters = {}): Observable<ApiResponse<Sale[]>> {
    let params = new HttpParams();

    if (filters.search) params = params.set('Search', filters.search);
    if (filters.customerId !== undefined) params = params.set('CustomerId', String(filters.customerId));
    if (filters.branchId !== undefined) params = params.set('BranchId', String(filters.branchId));
    if (filters.warehouseId !== undefined) params = params.set('WarehouseId', String(filters.warehouseId));
    if (filters.salespersonUserId !== undefined) params = params.set('SalespersonUserId', String(filters.salespersonUserId));
    if (filters.status) params = params.set('Status', filters.status);
    if (filters.paymentType) params = params.set('PaymentType', filters.paymentType);
    if (filters.isCredit !== undefined) params = params.set('IsCredit', String(filters.isCredit));
    if (filters.fromDate) params = params.set('FromDate', filters.fromDate);
    if (filters.toDate) params = params.set('ToDate', filters.toDate);

    return this.http.get<ApiResponse<Sale[]>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<ApiResponse<Sale>> {
    return this.http.get<ApiResponse<Sale>>(`${this.apiUrl}/${id}`);
  }

  create(request: SaleCreateRequest): Observable<ApiResponse<Sale>> {
    return this.http.post<ApiResponse<Sale>>(this.apiUrl, request);
  }

  remove(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`);
  }

  confirm(id: number): Observable<ApiResponse<null>> {
    return this.http.patch<ApiResponse<null>>(`${this.apiUrl}/${id}/confirm`, null);
  }

  cancel(id: number): Observable<ApiResponse<null>> {
    return this.http.patch<ApiResponse<null>>(`${this.apiUrl}/${id}/cancel`, null);
  }
}
