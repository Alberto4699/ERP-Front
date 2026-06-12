import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { LoginRequest } from '../models/login-request.model';
import { LoginResponse } from '../models/login-response.model';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly apiUrl = `${environment.apiUrl}/Auth/login`;

  constructor(private http: HttpClient) {}

  login(datos: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    return this.http.post<ApiResponse<LoginResponse>>(this.apiUrl, datos);
  }

  guardarToken(token: string, recordar: boolean): void {
    if (recordar) {
      localStorage.setItem('token', token);
    } else {
      sessionStorage.setItem('token', token);
    }
  }

  obtenerToken(): string | null {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  cerrarSesion(): void {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
  }

  estaAutenticado(): boolean {
    return this.obtenerToken() !== null;
  }
}
