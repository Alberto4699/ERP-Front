import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { CustomersService } from '../../core/services/customers';
import { NotificationsService } from '../../core/services/notifications';
import { Customers } from './customers';

describe('Customers', () => {
  let component: Customers;
  let fixture: ComponentFixture<Customers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Customers],
      providers: [
        {
          provide: CustomersService,
          useValue: {
            getAll: () =>
              of({
                success: true,
                message: '',
                data: [
                  {
                    id: 1,
                    name: 'Cliente prueba',
                    rfc: 'XAXX010101000',
                    phone: '5551234567',
                    email: 'cliente@example.com',
                    address: 'Dirección prueba',
                    city: 'Ciudad prueba',
                    status: 'Frecuente',
                    postalCode: '01000',
                    customerType: 'General',
                    creditLimit: 5000,
                    creditActive: true,
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

    fixture = TestBed.createComponent(Customers);
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

  it('should render loaded customers', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Cliente prueba');
    expect(text).toContain('General');
    expect(text).toContain('XAXX010101000');
  });
});
