import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { InventoryAdjustmentRequest, InventoryFilters, InventoryStock } from '../models/inventory.model';

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Inventory`;

  getAll(filters: InventoryFilters = {}): Observable<ApiResponse<InventoryStock[]>> {
    let params = new HttpParams();

    if (filters.search) {
      params = params.set('Search', filters.search);
    }

    if (filters.warehouseId !== undefined) {
      params = params.set('WarehouseId', String(filters.warehouseId));
    }

    if (filters.productId !== undefined) {
      params = params.set('ProductId', String(filters.productId));
    }

    if (filters.lowStock !== undefined) {
      params = params.set('LowStock', String(filters.lowStock));
    }

    return this.http.get<ApiResponse<InventoryStock[]>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<ApiResponse<InventoryStock>> {
    return this.http.get<ApiResponse<InventoryStock>>(`${this.apiUrl}/${id}`);
  }

  createAdjustment(request: InventoryAdjustmentRequest): Observable<ApiResponse<null>> {
    return this.http.post<ApiResponse<null>>(`${this.apiUrl}/adjustments`, request);
  }
}
