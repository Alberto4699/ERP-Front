import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { BranchesService } from '../../core/services/branches';
import { NotificationsService } from '../../core/services/notifications';
import { ProductsService } from '../../core/services/products';
import { PurchasesService } from '../../core/services/purchases';
import { SuppliersService } from '../../core/services/suppliers';
import { WarehousesService } from '../../core/services/warehouses';
import { Purchases } from './purchases';

describe('Purchases', () => {
  let component: Purchases;
  let fixture: ComponentFixture<Purchases>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Purchases],
      providers: [
        {
          provide: PurchasesService,
          useValue: {
            getAll: () =>
              of({
                success: true,
                message: '',
                data: [
                  {
                    id: 1,
                    supplierId: 1,
                    supplierName: 'Proveedor prueba',
                    branchId: 1,
                    branchName: 'Sucursal matriz',
                    warehouseId: 1,
                    warehouseName: 'Almacén principal',
                    folio: 'COMP-001',
                    purchaseDate: '2026-06-14T10:00:00',
                    status: 'Pendiente',
                    vatPercentage: 16,
                    total: 116,
                    details: [
                      {
                        productId: 1,
                        productCode: 'PROD-001',
                        productName: 'Producto prueba',
                        quantity: 1,
                        unitPrice: 100,
                        vatPercentage: 16,
                      },
                    ],
                  },
                ],
                errors: null,
              }),
            getById: () =>
              of({
                success: true,
                message: '',
                data: null,
                errors: null,
              }),
          },
        },
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
                    active: true,
                  },
                ],
                errors: null,
              }),
          },
        },
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
                    active: true,
                  },
                ],
                errors: null,
              }),
          },
        },
        {
          provide: WarehousesService,
          useValue: {
            getAll: () =>
              of({
                success: true,
                message: '',
                data: [
                  {
                    id: 1,
                    branchId: 1,
                    branchName: 'Sucursal matriz',
                    name: 'Almacén principal',
                    code: 'PRIN',
                    isPrimary: true,
                    active: true,
                  },
                ],
                errors: null,
              }),
          },
        },
        {
          provide: ProductsService,
          useValue: {
            getAll: () =>
              of({
                success: true,
                message: '',
                data: [
                  {
                    id: 1,
                    code: 'PROD-001',
                    name: 'Producto prueba',
                    categoryName: 'Categoría prueba',
                    measurementUnitAbbreviation: 'PZA',
                    salePrice: 10,
                    tracksInventory: true,
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

    fixture = TestBed.createComponent(Purchases);
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

  it('should render loaded purchases', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('COMP-001');
    expect(text).toContain('Proveedor prueba');
    expect(text).toContain('Almacén principal');
  });
});
