import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { MeasurementUnit, MeasurementUnitFilters, MeasurementUnitSaveRequest } from '../models/measurement-unit.model';

@Injectable({
  providedIn: 'root',
})
export class MeasurementUnitsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/MeasurementUnits`;

  getAll(filters: MeasurementUnitFilters = {}): Observable<ApiResponse<MeasurementUnit[]>> {
    let params = new HttpParams();

    if (filters.search) {
      params = params.set('Search', filters.search);
    }

    if (filters.active !== undefined) {
      params = params.set('Active', String(filters.active));
    }

    return this.http.get<ApiResponse<MeasurementUnit[]>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<ApiResponse<MeasurementUnit>> {
    return this.http.get<ApiResponse<MeasurementUnit>>(`${this.apiUrl}/${id}`);
  }

  create(request: MeasurementUnitSaveRequest): Observable<ApiResponse<MeasurementUnit>> {
    return this.http.post<ApiResponse<MeasurementUnit>>(this.apiUrl, request);
  }

  update(id: number, request: MeasurementUnitSaveRequest): Observable<ApiResponse<MeasurementUnit>> {
    return this.http.put<ApiResponse<MeasurementUnit>>(`${this.apiUrl}/${id}`, request);
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
