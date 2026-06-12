import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { AuthenticatedUser } from '../models/authenticated-user.model';
import { AuthenticatedUserPermission } from '../models/authenticated-user-permission.model';
import { LoginRequest } from '../models/login-request.model';
import { LoginResponse } from '../models/login-response.model';

type JwtClaims = Record<string, unknown>;

export interface DatosSesionJwt {
  name: string;
  surname: string;
  role: string;
  nombreCompleto: string;
  claims: JwtClaims;
}

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Auth`;
  private readonly tokenSignal = signal<string | null>(this.obtenerTokenDesdeStorage());

  readonly datosSesion = computed<DatosSesionJwt | null>(() => {
    const claims = this.decodeTokenClaims(this.tokenSignal());

    if (!claims) {
      return null;
    }

    const name = this.readClaim(claims, ['Name', 'name']);
    const surname = this.readClaim(claims, ['Surname', 'surname']);
    const role = this.readClaim(claims, ['Role', 'role']);
    const nombreCompleto = [name, surname].filter(Boolean).join(' ');

    return {
      name,
      surname,
      role,
      nombreCompleto,
      claims,
    };
  });

  login(datos: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    return this.http.post<ApiResponse<LoginResponse>>(`${this.apiUrl}/login`, datos);
  }

  me(): Observable<ApiResponse<AuthenticatedUser>> {
    return this.http.get<ApiResponse<AuthenticatedUser>>(`${this.apiUrl}/me`);
  }

  permissions(): Observable<ApiResponse<AuthenticatedUserPermission[]>> {
    return this.http.get<ApiResponse<AuthenticatedUserPermission[]>>(`${this.apiUrl}/permissions`);
  }

  guardarToken(token: string, recordar: boolean): void {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');

    if (recordar) {
      localStorage.setItem('token', token);
    } else {
      sessionStorage.setItem('token', token);
    }

    this.tokenSignal.set(token);
  }

  obtenerToken(): string | null {
    return this.tokenSignal();
  }

  cerrarSesion(): void {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    this.tokenSignal.set(null);
  }

  estaAutenticado(): boolean {
    return this.obtenerToken() !== null;
  }

  private obtenerTokenDesdeStorage(): string | null {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  private decodeTokenClaims(token: string | null): JwtClaims | null {
    const payload = token?.split('.')[1];

    if (!payload) {
      return null;
    }

    try {
      const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padding = normalizedPayload.length % 4 ? '='.repeat(4 - (normalizedPayload.length % 4)) : '';
      const decodedPayload = atob(`${normalizedPayload}${padding}`);
      const bytes = Uint8Array.from(decodedPayload, (character) => character.charCodeAt(0));
      const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));

      return this.isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private readClaim(claims: JwtClaims, keys: string[]): string {
    const normalizedKeys = new Set(keys.map((key) => this.normalizeClaimKey(key)));

    for (const key of keys) {
      const claimValue = this.readClaimValue(claims[key]);

      if (claimValue) {
        return claimValue;
      }
    }

    for (const [key, value] of Object.entries(claims)) {
      if (!normalizedKeys.has(this.normalizeClaimKey(key))) {
        continue;
      }

      const claimValue = this.readClaimValue(value);

      if (claimValue) {
        return claimValue;
      }
    }

    return '';
  }

  private readClaimValue(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const itemValue = this.readClaimValue(item);

        if (itemValue) {
          return itemValue;
        }
      }
    }

    if (this.isRecord(value)) {
      return this.readClaimValue(value['value']);
    }

    return '';
  }

  private normalizeClaimKey(key: string): string {
    return key.split('/').pop()?.toLowerCase().replace(/[_-]/g, '') || key.toLowerCase();
  }

  private isRecord(value: unknown): value is JwtClaims {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
