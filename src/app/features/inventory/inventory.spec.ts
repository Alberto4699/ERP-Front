import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { InventoryService } from '../../core/services/inventory';
import { NotificationsService } from '../../core/services/notifications';
import { ProductsService } from '../../core/services/products';
import { WarehousesService } from '../../core/services/warehouses';
import { Inventory } from './inventory';

describe('Inventory', () => {
  let component: Inventory;
  let fixture: ComponentFixture<Inventory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Inventory],
      providers: [
        {
          provide: InventoryService,
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
                    measurementUnitAbbreviation: 'PZA',
                    quantity: 12,
                    minimumStock: 5,
                    lowStock: false,
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

    fixture = TestBed.createComponent(Inventory);
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

  it('should render loaded inventory', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Producto prueba');
    expect(text).toContain('PROD-001');
    expect(text).toContain('Almacén principal');
  });
});
