import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { BranchesService } from '../../core/services/branches';
import { NotificationsService } from '../../core/services/notifications';
import { ProductsService } from '../../core/services/products';
import { WarehouseTransfersService } from '../../core/services/warehouse-transfers';
import { WarehousesService } from '../../core/services/warehouses';
import { WarehouseTransfers } from './warehouse-transfers';

describe('WarehouseTransfers', () => {
  let component: WarehouseTransfers;
  let fixture: ComponentFixture<WarehouseTransfers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WarehouseTransfers],
      providers: [
        {
          provide: WarehouseTransfersService,
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
                    sourceWarehouseId: 1,
                    sourceWarehouseName: 'Almacén origen',
                    destinationWarehouseId: 2,
                    destinationWarehouseName: 'Almacén destino',
                    folio: 'TR-001',
                    transferDate: '2026-06-13T10:00:00',
                    status: 'Pendiente',
                    details: [
                      {
                        productId: 1,
                        productCode: 'PROD-001',
                        productName: 'Producto prueba',
                        quantity: 3,
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
                    name: 'Almacén origen',
                    code: 'ORI',
                    isPrimary: true,
                    active: true,
                  },
                  {
                    id: 2,
                    branchId: 1,
                    branchName: 'Sucursal matriz',
                    name: 'Almacén destino',
                    code: 'DES',
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

    fixture = TestBed.createComponent(WarehouseTransfers);
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

  it('should render loaded transfers', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('TR-001');
    expect(text).toContain('Almacén origen');
    expect(text).toContain('Almacén destino');
  });
});
