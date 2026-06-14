import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { InventoryMovementsService } from '../../core/services/inventory-movements';
import { NotificationsService } from '../../core/services/notifications';
import { ProductsService } from '../../core/services/products';
import { WarehousesService } from '../../core/services/warehouses';
import { InventoryMovements } from './inventory-movements';

describe('InventoryMovements', () => {
  let component: InventoryMovements;
  let fixture: ComponentFixture<InventoryMovements>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InventoryMovements],
      providers: [
        {
          provide: InventoryMovementsService,
          useValue: {
            getAll: () =>
              of({
                success: true,
                message: '',
                data: [
                  {
                    id: 1,
                    warehouseId: 1,
                    warehouseName: 'Almacén principal',
                    branchName: 'Sucursal matriz',
                    productId: 1,
                    productCode: 'PROD-001',
                    productName: 'Producto prueba',
                    inventoryMovementTypeId: 1,
                    inventoryMovementTypeName: 'Entrada',
                    quantity: 5,
                    reference: 'AJ-001',
                    movementDate: '2026-06-13T10:00:00',
                  },
                ],
                errors: null,
              }),
            getTypes: () =>
              of({
                success: true,
                message: '',
                data: [
                  {
                    id: 1,
                    name: 'Entrada',
                    code: 'IN',
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
                    code: 'ALM-001',
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

    fixture = TestBed.createComponent(InventoryMovements);
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

  it('should render loaded movements', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Producto prueba');
    expect(text).toContain('PROD-001');
    expect(text).toContain('Entrada');
  });
});
