import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { Quotation, QuotationCreateRequest, QuotationFilters, QuotationUpdateRequest } from '../models/quotation.model';

@Injectable({
  providedIn: 'root',
})
export class QuotationsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Quotations`;

  getAll(filters: QuotationFilters = {}): Observable<ApiResponse<Quotation[]>> {
    let params = new HttpParams();

    if (filters.search) {
      params = params.set('Search', filters.search);
    }

    if (filters.customerId !== undefined) {
      params = params.set('CustomerId', String(filters.customerId));
    }

    if (filters.branchId !== undefined) {
      params = params.set('BranchId', String(filters.branchId));
    }

    if (filters.salespersonUserId !== undefined) {
      params = params.set('SalespersonUserId', String(filters.salespersonUserId));
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

    return this.http.get<ApiResponse<Quotation[]>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<ApiResponse<Quotation>> {
    return this.http.get<ApiResponse<Quotation>>(`${this.apiUrl}/${id}`);
  }

  create(request: QuotationCreateRequest): Observable<ApiResponse<Quotation>> {
    return this.http.post<ApiResponse<Quotation>>(this.apiUrl, request);
  }

  update(id: number, request: QuotationUpdateRequest): Observable<ApiResponse<Quotation>> {
    return this.http.put<ApiResponse<Quotation>>(`${this.apiUrl}/${id}`, request);
  }

  remove(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`);
  }

  send(id: number): Observable<ApiResponse<null>> {
    return this.http.patch<ApiResponse<null>>(`${this.apiUrl}/${id}/send`, null);
  }

  accept(id: number): Observable<ApiResponse<null>> {
    return this.http.patch<ApiResponse<null>>(`${this.apiUrl}/${id}/accept`, null);
  }

  reject(id: number): Observable<ApiResponse<null>> {
    return this.http.patch<ApiResponse<null>>(`${this.apiUrl}/${id}/reject`, null);
  }

  cancel(id: number): Observable<ApiResponse<null>> {
    return this.http.patch<ApiResponse<null>>(`${this.apiUrl}/${id}/cancel`, null);
  }
}
