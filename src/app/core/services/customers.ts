import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { Customer, CustomerFilters, CustomerSaveRequest } from '../models/customer.model';

@Injectable({
  providedIn: 'root',
})
export class CustomersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Customers`;

  getAll(filters: CustomerFilters = {}): Observable<ApiResponse<Customer[]>> {
    let params = new HttpParams();

    if (filters.search) {
      params = params.set('Search', filters.search);
    }

    if (filters.customerType) {
      params = params.set('CustomerType', filters.customerType);
    }

    if (filters.creditActive !== undefined) {
      params = params.set('CreditActive', String(filters.creditActive));
    }

    if (filters.active !== undefined) {
      params = params.set('Active', String(filters.active));
    }

    return this.http.get<ApiResponse<Customer[]>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<ApiResponse<Customer>> {
    return this.http.get<ApiResponse<Customer>>(`${this.apiUrl}/${id}`);
  }

  create(request: CustomerSaveRequest): Observable<ApiResponse<Customer>> {
    return this.http.post<ApiResponse<Customer>>(this.apiUrl, request);
  }

  update(id: number, request: CustomerSaveRequest): Observable<ApiResponse<Customer>> {
    return this.http.put<ApiResponse<Customer>>(`${this.apiUrl}/${id}`, request);
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
