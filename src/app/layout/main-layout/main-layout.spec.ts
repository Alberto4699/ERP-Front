import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { Auth } from '../../core/services/auth';
import { MainLayout } from './main-layout';

describe('MainLayout', () => {
  let component: MainLayout;
  let fixture: ComponentFixture<MainLayout>;
  let auth: Auth;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MainLayout);
    component = fixture.componentInstance;
    auth = TestBed.inject(Auth);
    await fixture.whenStable();
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-sidenav-size');
    document.documentElement.classList.remove('sidebar-enable');
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle the desktop side menu', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1200,
    });
    document.documentElement.setAttribute('data-sidenav-size', 'default');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.button-toggle-menu') as HTMLButtonElement;

    button.click();
    expect(document.documentElement.getAttribute('data-sidenav-size')).toBe('condensed');

    button.click();
    expect(document.documentElement.getAttribute('data-sidenav-size')).toBe('default');
  });

  it('should display user name and role from the token claims', () => {
    fixture.destroy();
    auth.guardarToken(
      createToken({
        Name: 'Alberto',
        Surname: 'Ramirez',
        Role: 'Administrador',
      }),
      true
    );

    fixture = TestBed.createComponent(MainLayout);
    component = fixture.componentInstance;

    fixture.detectChanges();

    const userName = fixture.nativeElement.querySelector('.nav-user h5') as HTMLElement;
    const userRole = fixture.nativeElement.querySelector('.nav-user h6') as HTMLElement;

    expect(userName.textContent?.trim()).toBe('Alberto Ramirez');
    expect(userRole.textContent?.trim()).toBe('Administrador');
  });

  it('should display user name and role from .NET claim URIs', () => {
    fixture.destroy();
    auth.guardarToken(
      createToken({
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Alberto',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname': 'Ramirez',
        'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'Administrador',
      }),
      true
    );

    fixture = TestBed.createComponent(MainLayout);
    component = fixture.componentInstance;

    fixture.detectChanges();

    const userName = fixture.nativeElement.querySelector('.nav-user h5') as HTMLElement;
    const userRole = fixture.nativeElement.querySelector('.nav-user h6') as HTMLElement;

    expect(userName.textContent?.trim()).toBe('Alberto Ramirez');
    expect(userRole.textContent?.trim()).toBe('Administrador');
  });
});

function createToken(payload: Record<string, unknown>): string {
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `header.${encodedPayload}.signature`;
}
