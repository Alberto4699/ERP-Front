import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { ProductFilters, ProductListItem, ProductResponse, ProductSaveRequest } from '../models/product.model';

@Injectable({
  providedIn: 'root',
})
export class ProductsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Products`;

  getAll(filters: ProductFilters = {}): Observable<ApiResponse<ProductListItem[]>> {
    let params = new HttpParams();

    if (filters.search) {
      params = params.set('Search', filters.search);
    }

    if (filters.categoryId !== undefined) {
      params = params.set('CategoryId', String(filters.categoryId));
    }

    if (filters.brandId !== undefined) {
      params = params.set('BrandId', String(filters.brandId));
    }

    if (filters.active !== undefined) {
      params = params.set('Active', String(filters.active));
    }

    if (filters.tracksInventory !== undefined) {
      params = params.set('TracksInventory', String(filters.tracksInventory));
    }

    return this.http.get<ApiResponse<ProductListItem[]>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<ApiResponse<ProductResponse>> {
    return this.http.get<ApiResponse<ProductResponse>>(`${this.apiUrl}/${id}`);
  }

  create(request: ProductSaveRequest): Observable<ApiResponse<ProductResponse>> {
    return this.http.post<ApiResponse<ProductResponse>>(this.apiUrl, request);
  }

  update(id: number, request: ProductSaveRequest): Observable<ApiResponse<ProductResponse>> {
    return this.http.put<ApiResponse<ProductResponse>>(`${this.apiUrl}/${id}`, request);
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
