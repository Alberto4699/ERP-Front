import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { InventoryMovement, InventoryMovementFilters, InventoryMovementType } from '../models/inventory-movement.model';

@Injectable({
  providedIn: 'root',
})
export class InventoryMovementsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/inventory-movements`;

  getAll(filters: InventoryMovementFilters = {}): Observable<ApiResponse<InventoryMovement[]>> {
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

    if (filters.inventoryMovementTypeId !== undefined) {
      params = params.set('InventoryMovementTypeId', String(filters.inventoryMovementTypeId));
    }

    if (filters.fromDate) {
      params = params.set('FromDate', filters.fromDate);
    }

    if (filters.toDate) {
      params = params.set('ToDate', filters.toDate);
    }

    return this.http.get<ApiResponse<InventoryMovement[]>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<ApiResponse<InventoryMovement>> {
    return this.http.get<ApiResponse<InventoryMovement>>(`${this.apiUrl}/${id}`);
  }

  getTypes(): Observable<ApiResponse<InventoryMovementType[]>> {
    return this.http.get<ApiResponse<InventoryMovementType[]>>(`${this.apiUrl}/types`);
  }
}
