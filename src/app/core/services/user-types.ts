import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { UserType, UserTypeFilters, UserTypeSaveRequest } from '../models/user-type.model';

@Injectable({ providedIn: 'root' })
export class UserTypesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/user-types`;

  getAll(filters: UserTypeFilters = {}): Observable<ApiResponse<UserType[]>> {
    let params = new HttpParams();
    if (filters.search) params = params.set('Search', filters.search);
    if (filters.active !== undefined) params = params.set('Active', String(filters.active));
    return this.http.get<ApiResponse<UserType[]>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<ApiResponse<UserType>> {
    return this.http.get<ApiResponse<UserType>>(`${this.apiUrl}/${id}`);
  }

  create(request: UserTypeSaveRequest): Observable<ApiResponse<UserType>> {
    return this.http.post<ApiResponse<UserType>>(this.apiUrl, request);
  }

  update(id: number, request: UserTypeSaveRequest): Observable<ApiResponse<UserType>> {
    return this.http.put<ApiResponse<UserType>>(`${this.apiUrl}/${id}`, request);
  }

  remove(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`);
  }

  activate(id: number): Observable<ApiResponse<null>> {
    return this.http.patch<ApiResponse<null>>(`${this.apiUrl}/${id}/activate`, null);
  }

  deactivate(id: number): Observable<ApiResponse<null>> {
    return this.http.patch<ApiResponse<null>>(`${this.apiUrl}/${id}/deactivate`, null);
  }
}
