import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { NotificationsService } from '../../core/services/notifications';
import { RolesService } from '../../core/services/roles';
import { Roles } from './roles';

describe('Roles', () => {
  let component: Roles;
  let fixture: ComponentFixture<Roles>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Roles],
      providers: [
        { provide: RolesService, useValue: { getAll: () => of({ success: true, message: '', data: [{ id: 1, name: 'Administrador', description: 'Acceso total', active: true }], errors: null }) } },
        { provide: NotificationsService, useValue: { success: () => undefined, error: () => undefined } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Roles);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
  });

  it('should create', () => { expect(component).toBeTruthy(); });

  it('should render loaded roles', () => {
    expect(fixture.nativeElement.textContent).toContain('Administrador');
  });
});
