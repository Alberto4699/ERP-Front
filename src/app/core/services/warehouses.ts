import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { Warehouse, WarehouseFilters, WarehouseSaveRequest } from '../models/warehouse.model';

@Injectable({
  providedIn: 'root',
})
export class WarehousesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Warehouses`;

  getAll(filters: WarehouseFilters = {}): Observable<ApiResponse<Warehouse[]>> {
    let params = new HttpParams();

    if (filters.search) {
      params = params.set('Search', filters.search);
    }

    if (filters.branchId !== undefined) {
      params = params.set('BranchId', String(filters.branchId));
    }

    if (filters.active !== undefined) {
      params = params.set('Active', String(filters.active));
    }

    if (filters.isPrimary !== undefined) {
      params = params.set('IsPrimary', String(filters.isPrimary));
    }

    return this.http.get<ApiResponse<Warehouse[]>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<ApiResponse<Warehouse>> {
    return this.http.get<ApiResponse<Warehouse>>(`${this.apiUrl}/${id}`);
  }

  create(request: WarehouseSaveRequest): Observable<ApiResponse<Warehouse>> {
    return this.http.post<ApiResponse<Warehouse>>(this.apiUrl, request);
  }

  update(id: number, request: WarehouseSaveRequest): Observable<ApiResponse<Warehouse>> {
    return this.http.put<ApiResponse<Warehouse>>(`${this.apiUrl}/${id}`, request);
  }

  activate(id: number): Observable<ApiResponse<null>> {
    return this.http.patch<ApiResponse<null>>(`${this.apiUrl}/${id}/activate`, null);
  }

  deactivate(id: number): Observable<ApiResponse<null>> {
    return this.http.patch<ApiResponse<null>>(`${this.apiUrl}/${id}/deactivate`, null);
  }

  markAsPrimary(id: number): Observable<ApiResponse<null>> {
    return this.http.patch<ApiResponse<null>>(`${this.apiUrl}/${id}/primary`, null);
  }

  remove(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`);
  }
}
