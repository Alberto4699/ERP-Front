import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { BranchesService } from '../../core/services/branches';
import { CustomersService } from '../../core/services/customers';
import { NotificationsService } from '../../core/services/notifications';
import { ProductsService } from '../../core/services/products';
import { SalesService } from '../../core/services/sales';
import { Session } from '../../core/services/session';
import { WarehousesService } from '../../core/services/warehouses';
import { Sales } from './sales';

describe('Sales', () => {
  let component: Sales;
  let fixture: ComponentFixture<Sales>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Sales],
      providers: [
        { provide: SalesService, useValue: { getAll: () => of({ success: true, message: '', data: [{ id: 1, customerId: 1, customerName: 'Cliente prueba', branchId: 1, branchName: 'Sucursal matriz', warehouseId: 1, warehouseName: 'Almacén principal', salespersonUserId: 1, folio: 'VTA-001', saleDate: '2026-06-14T10:00:00', paymentType: 'Contado', isCredit: false, status: 'Pendiente', vatPercentage: 16, total: 116, details: [{ productId: 1, productCode: 'PROD-001', productName: 'Producto prueba', quantity: 1, unitPrice: 100, vatPercentage: 16 }] }], errors: null }), getById: () => of({ success: true, message: '', data: null, errors: null }) } },
        { provide: CustomersService, useValue: { getAll: () => of({ success: true, message: '', data: [{ id: 1, name: 'Cliente prueba', customerType: 'General', active: true }], errors: null }) } },
        { provide: BranchesService, useValue: { getAll: () => of({ success: true, message: '', data: [{ id: 1, name: 'Sucursal matriz', code: 'MATRIZ', active: true }], errors: null }) } },
        { provide: WarehousesService, useValue: { getAll: () => of({ success: true, message: '', data: [{ id: 1, branchId: 1, branchName: 'Sucursal matriz', name: 'Almacén principal', code: 'PRIN', active: true }], errors: null }) } },
        { provide: ProductsService, useValue: { getAll: () => of({ success: true, message: '', data: [{ id: 1, code: 'PROD-001', name: 'Producto prueba', categoryName: 'Categoría prueba', measurementUnitAbbreviation: 'PZA', salePrice: 10, tracksInventory: true, active: true }], errors: null }) } },
        { provide: Session, useValue: { user: () => ({ idUsuario: 1 }) } },
        { provide: NotificationsService, useValue: { success: () => undefined, error: () => undefined } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Sales);
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

  it('should render loaded sales', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('VTA-001');
    expect(text).toContain('Cliente prueba');
  });
});
