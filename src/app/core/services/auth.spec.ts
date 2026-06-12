import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { Auth } from './auth';

describe('Auth', () => {
  let service: Auth;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });
    service = TestBed.inject(Auth);
  });

  afterEach(() => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should clear stale session token when saving a remembered token', () => {
    sessionStorage.setItem('token', 'stale-session-token');

    service.guardarToken('fresh-local-token', true);

    expect(localStorage.getItem('token')).toBe('fresh-local-token');
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(service.obtenerToken()).toBe('fresh-local-token');
  });

  it('should clear stale local token when saving a session token', () => {
    localStorage.setItem('token', 'stale-local-token');

    service.guardarToken('fresh-session-token', false);

    expect(localStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBe('fresh-session-token');
    expect(service.obtenerToken()).toBe('fresh-session-token');
  });

  it('should expose session data from token claims', () => {
    service.guardarToken(
      createToken({
        Name: 'Alberto',
        Surname: 'Ramirez',
        Role: 'Administrador',
      }),
      true
    );

    expect(service.datosSesion()).toEqual({
      name: 'Alberto',
      surname: 'Ramirez',
      role: 'Administrador',
      nombreCompleto: 'Alberto Ramirez',
      claims: {
        Name: 'Alberto',
        Surname: 'Ramirez',
        Role: 'Administrador',
      },
    });
  });

  it('should expose session data from .NET claim URIs', () => {
    service.guardarToken(
      createToken({
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Alberto',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname': 'Ramirez',
        'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'Administrador',
      }),
      true
    );

    expect(service.datosSesion()?.nombreCompleto).toBe('Alberto Ramirez');
    expect(service.datosSesion()?.role).toBe('Administrador');
  });
});

function createToken(payload: Record<string, unknown>): string {
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `header.${encodedPayload}.signature`;
}
