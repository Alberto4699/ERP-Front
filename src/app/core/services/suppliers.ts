import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { Supplier, SupplierFilters, SupplierSaveRequest } from '../models/supplier.model';

@Injectable({
  providedIn: 'root',
})
export class SuppliersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Suppliers`;

  getAll(filters: SupplierFilters = {}): Observable<ApiResponse<Supplier[]>> {
    let params = new HttpParams();

    if (filters.search) {
      params = params.set('Search', filters.search);
    }

    if (filters.active !== undefined) {
      params = params.set('Active', String(filters.active));
    }

    return this.http.get<ApiResponse<Supplier[]>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<ApiResponse<Supplier>> {
    return this.http.get<ApiResponse<Supplier>>(`${this.apiUrl}/${id}`);
  }

  create(request: SupplierSaveRequest): Observable<ApiResponse<Supplier>> {
    return this.http.post<ApiResponse<Supplier>>(this.apiUrl, request);
  }

  update(id: number, request: SupplierSaveRequest): Observable<ApiResponse<Supplier>> {
    return this.http.put<ApiResponse<Supplier>>(`${this.apiUrl}/${id}`, request);
  }

  activate(id: number): Observable<ApiResponse<null>> {
    return this.http.patch<ApiResponse<null>>(`${this.apiUrl}/${id}/activate`, null);
  }

  deactivate(id: number): Observable<ApiResponse<null>> {
    return this.http.patch<ApiResponse<null>>(`${this.apiUrl}/${id}/deactivate`, null);
  }

  remove(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`);
  }
}
