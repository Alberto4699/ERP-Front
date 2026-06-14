import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { InventoryMovementsService } from '../../core/services/inventory-movements';
import { InventoryService } from '../../core/services/inventory';
import { NotificationsService } from '../../core/services/notifications';
import { ProductsService } from '../../core/services/products';
import { WarehousesService } from '../../core/services/warehouses';
import { InventoryAdjustments } from './inventory-adjustments';

describe('InventoryAdjustments', () => {
  let component: InventoryAdjustments;
  let fixture: ComponentFixture<InventoryAdjustments>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InventoryAdjustments],
      providers: [
        {
          provide: InventoryService,
          useValue: {
            createAdjustment: () =>
              of({
                success: true,
                message: 'Ajuste registrado correctamente.',
                data: null,
                errors: null,
              }),
          },
        },
        {
          provide: InventoryMovementsService,
          useValue: {
            getTypes: () =>
              of({
                success: true,
                message: '',
                data: [
                  {
                    id: 1,
                    name: 'Ajuste de entrada',
                    code: 'ADJ-IN',
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

    fixture = TestBed.createComponent(InventoryAdjustments);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render adjustment catalogs', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Almacén principal');
    expect(text).toContain('Producto prueba');
    expect(text).toContain('Ajuste de entrada');
  });
});
