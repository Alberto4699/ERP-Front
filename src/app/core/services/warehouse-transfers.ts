import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { WarehouseTransfer, WarehouseTransferCreateRequest, WarehouseTransferFilters } from '../models/warehouse-transfer.model';

@Injectable({
  providedIn: 'root',
})
export class WarehouseTransfersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/warehouse-transfers`;

  getAll(filters: WarehouseTransferFilters = {}): Observable<ApiResponse<WarehouseTransfer[]>> {
    let params = new HttpParams();

    if (filters.search) {
      params = params.set('Search', filters.search);
    }

    if (filters.branchId !== undefined) {
      params = params.set('BranchId', String(filters.branchId));
    }

    if (filters.sourceWarehouseId !== undefined) {
      params = params.set('SourceWarehouseId', String(filters.sourceWarehouseId));
    }

    if (filters.destinationWarehouseId !== undefined) {
      params = params.set('DestinationWarehouseId', String(filters.destinationWarehouseId));
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

    return this.http.get<ApiResponse<WarehouseTransfer[]>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<ApiResponse<WarehouseTransfer>> {
    return this.http.get<ApiResponse<WarehouseTransfer>>(`${this.apiUrl}/${id}`);
  }

  create(request: WarehouseTransferCreateRequest): Observable<ApiResponse<WarehouseTransfer>> {
    return this.http.post<ApiResponse<WarehouseTransfer>>(this.apiUrl, request);
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
