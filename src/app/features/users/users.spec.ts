import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NotificationsService } from '../../core/services/notifications';
import { RolesService } from '../../core/services/roles';
import { UserTypesService } from '../../core/services/user-types';
import { UsersService } from '../../core/services/users';
import { Users } from './users';

describe('Users', () => {
  let component: Users;
  let fixture: ComponentFixture<Users>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Users], providers: [
      { provide: UsersService, useValue: { getAll: () => of({ success: true, message: '', data: [{ id: 1, userTypeId: 1, roleId: 1, name: 'Admin', paternalLastName: 'Sistema', email: 'admin@test.com', username: 'admin', active: true }], errors: null }) } },
      { provide: RolesService, useValue: { getAll: () => of({ success: true, message: '', data: [{ id: 1, name: 'Administrador', active: true }], errors: null }) } },
      { provide: UserTypesService, useValue: { getAll: () => of({ success: true, message: '', data: [{ id: 1, name: 'Interno', active: true }], errors: null }) } },
      { provide: NotificationsService, useValue: { success: () => undefined, error: () => undefined } },
    ] }).compileComponents();
    fixture = TestBed.createComponent(Users); component = fixture.componentInstance; fixture.detectChanges(); await fixture.whenStable();
  });
  afterEach(() => { document.body.classList.remove('modal-open'); document.body.style.overflow = ''; });
  it('should create', () => { expect(component).toBeTruthy(); });
  it('should render loaded users', () => { expect(fixture.nativeElement.textContent).toContain('admin'); });
});
