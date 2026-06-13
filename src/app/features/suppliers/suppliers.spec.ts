import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { NotificationsService } from '../../core/services/notifications';
import { SuppliersService } from '../../core/services/suppliers';
import { Suppliers } from './suppliers';

describe('Suppliers', () => {
  let component: Suppliers;
  let fixture: ComponentFixture<Suppliers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Suppliers],
      providers: [
        {
          provide: SuppliersService,
          useValue: {
            getAll: () =>
              of({
                success: true,
                message: '',
                data: [
                  {
                    id: 1,
                    name: 'Proveedor prueba',
                    rfc: 'XAXX010101000',
                    phone: '5551234567',
                    email: 'proveedor@example.com',
                    address: 'Dirección prueba',
                    contact: 'Contacto prueba',
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

    fixture = TestBed.createComponent(Suppliers);
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

  it('should render loaded suppliers', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Proveedor prueba');
    expect(text).toContain('XAXX010101000');
    expect(text).toContain('Contacto prueba');
  });
});
