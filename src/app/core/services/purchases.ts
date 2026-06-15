import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { Purchase, PurchaseCreateRequest, PurchaseFilters } from '../models/purchase.model';

@Injectable({
  providedIn: 'root',
})
export class PurchasesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Purchases`;

  getAll(filters: PurchaseFilters = {}): Observable<ApiResponse<Purchase[]>> {
    let params = new HttpParams();

    if (filters.search) {
      params = params.set('Search', filters.search);
    }

    if (filters.supplierId !== undefined) {
      params = params.set('SupplierId', String(filters.supplierId));
    }

    if (filters.branchId !== undefined) {
      params = params.set('BranchId', String(filters.branchId));
    }

    if (filters.warehouseId !== undefined) {
      params = params.set('WarehouseId', String(filters.warehouseId));
    }

    if (filters.status) {
      params = params.set('Status', filters.status);
    }

    if (filters.fromDate) {
      params = params.set('FromDate', filters.fromDate);
    }

    if (filters.toDate) {
      params = params.set('ToDate', filters.toDate);
    }

    return this.http.get<ApiResponse<Purchase[]>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<ApiResponse<Purchase>> {
    return this.http.get<ApiResponse<Purchase>>(`${this.apiUrl}/${id}`);
  }

  create(request: PurchaseCreateRequest): Observable<ApiResponse<Purchase>> {
    return this.http.post<ApiResponse<Purchase>>(this.apiUrl, request);
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
