import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { Branch, BranchFilters, BranchSaveRequest } from '../models/branch.model';

@Injectable({
  providedIn: 'root',
})
export class BranchesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Branches`;

  getAll(filters: BranchFilters = {}): Observable<ApiResponse<Branch[]>> {
    let params = new HttpParams();

    if (filters.search) {
      params = params.set('Search', filters.search);
    }

    if (filters.active !== undefined) {
      params = params.set('Active', String(filters.active));
    }

    return this.http.get<ApiResponse<Branch[]>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<ApiResponse<Branch>> {
    return this.http.get<ApiResponse<Branch>>(`${this.apiUrl}/${id}`);
  }

  create(request: BranchSaveRequest): Observable<ApiResponse<Branch>> {
    return this.http.post<ApiResponse<Branch>>(this.apiUrl, request);
  }

  update(id: number, request: BranchSaveRequest): Observable<ApiResponse<Branch>> {
    return this.http.put<ApiResponse<Branch>>(`${this.apiUrl}/${id}`, request);
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
