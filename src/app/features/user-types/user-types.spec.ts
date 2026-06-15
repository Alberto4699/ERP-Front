import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { NotificationsService } from '../../core/services/notifications';
import { UserTypesService } from '../../core/services/user-types';
import { UserTypes } from './user-types';

describe('UserTypes', () => {
  let component: UserTypes;
  let fixture: ComponentFixture<UserTypes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserTypes],
      providers: [
        { provide: UserTypesService, useValue: { getAll: () => of({ success: true, message: '', data: [{ id: 1, name: 'Interno', description: 'Usuario interno', active: true }], errors: null }) } },
        { provide: NotificationsService, useValue: { success: () => undefined, error: () => undefined } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserTypes);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
  });

  it('should create', () => { expect(component).toBeTruthy(); });

  it('should render loaded user types', () => {
    expect(fixture.nativeElement.textContent).toContain('Interno');
  });
});
