import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { CustomerAccountsService } from '../../core/services/customer-accounts';
import { CustomersService } from '../../core/services/customers';
import { NotificationsService } from '../../core/services/notifications';
import { SalesService } from '../../core/services/sales';
import { CustomerAccounts } from './customer-accounts';

describe('CustomerAccounts', () => {
  let component: CustomerAccounts;
  let fixture: ComponentFixture<CustomerAccounts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerAccounts],
      providers: [
        { provide: CustomerAccountsService, useValue: { getAll: () => of({ success: true, message: '', data: [{ id: 1, customerId: 1, customerName: 'Cliente prueba', creditLimit: 1000, creditActive: true, balance: 250, availableCredit: 750 }], errors: null }), getMovements: () => of({ success: true, message: '', data: [], errors: null }) } },
        { provide: CustomersService, useValue: { getAll: () => of({ success: true, message: '', data: [{ id: 1, name: 'Cliente prueba', customerType: 'General', active: true }], errors: null }) } },
        { provide: SalesService, useValue: { getAll: () => of({ success: true, message: '', data: [], errors: null }) } },
        { provide: NotificationsService, useValue: { success: () => undefined, error: () => undefined } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomerAccounts);
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

  it('should render loaded customer accounts', () => {
    expect(fixture.nativeElement.textContent).toContain('Cliente prueba');
  });
});
