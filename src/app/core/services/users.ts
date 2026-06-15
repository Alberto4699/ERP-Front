import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { User, UserCreateRequest, UserFilters, UserUpdateRequest } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Users`;

  getAll(filters: UserFilters = {}): Observable<ApiResponse<User[]>> {
    let params = new HttpParams();
    if (filters.search) params = params.set('Search', filters.search);
    if (filters.roleId !== undefined) params = params.set('RoleId', String(filters.roleId));
    if (filters.userTypeId !== undefined) params = params.set('UserTypeId', String(filters.userTypeId));
    if (filters.active !== undefined) params = params.set('Active', String(filters.active));
    return this.http.get<ApiResponse<User[]>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<ApiResponse<User>> { return this.http.get<ApiResponse<User>>(`${this.apiUrl}/${id}`); }
  create(request: UserCreateRequest): Observable<ApiResponse<User>> { return this.http.post<ApiResponse<User>>(this.apiUrl, request); }
  update(id: number, request: UserUpdateRequest): Observable<ApiResponse<User>> { return this.http.put<ApiResponse<User>>(`${this.apiUrl}/${id}`, request); }
  remove(id: number): Observable<ApiResponse<null>> { return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`); }
  activate(id: number): Observable<ApiResponse<null>> { return this.http.patch<ApiResponse<null>>(`${this.apiUrl}/${id}/activate`, null); }
  deactivate(id: number): Observable<ApiResponse<null>> { return this.http.patch<ApiResponse<null>>(`${this.apiUrl}/${id}/deactivate`, null); }
}
