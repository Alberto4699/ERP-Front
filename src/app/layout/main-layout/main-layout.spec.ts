import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MainLayout } from './main-layout';

describe('MainLayout', () => {
  let component: MainLayout;
  let fixture: ComponentFixture<MainLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MainLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-sidenav-size');
    document.documentElement.classList.remove('sidebar-enable');
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
});
