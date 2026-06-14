import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { BranchesService } from '../../core/services/branches';
import { NotificationsService } from '../../core/services/notifications';
import { Branches } from './branches';

describe('Branches', () => {
  let component: Branches;
  let fixture: ComponentFixture<Branches>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Branches],
      providers: [
        {
          provide: BranchesService,
          useValue: {
            getAll: () =>
              of({
                success: true,
                message: '',
                data: [
                  {
                    id: 1,
                    name: 'Sucursal matriz',
                    code: 'MATRIZ',
                    address: 'Dirección prueba',
                    phone: '5551234567',
                    email: 'matriz@example.com',
                    rfc: 'XAXX010101000',
                    manager: 'Responsable prueba',
                    city: 'Ciudad prueba',
                    state: 'Estado prueba',
                    postalCode: '01000',
                    active: true,
                  },
                ],
                errors: null,
              }),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            success: () => undefined,
            error: () => undefined,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Branches);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render loaded branches', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Sucursal matriz');
    expect(text).toContain('MATRIZ');
    expect(text).toContain('Responsable prueba');
  });
});
