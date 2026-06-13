import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { BrandsService } from '../../core/services/brands';
import { CategoriesService } from '../../core/services/categories';
import { MeasurementUnitsService } from '../../core/services/measurement-units';
import { NotificationsService } from '../../core/services/notifications';
import { ProductsService } from '../../core/services/products';
import { Products } from './products';

describe('Products', () => {
  let component: Products;
  let fixture: ComponentFixture<Products>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Products],
      providers: [
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
                    code: 'MAT-001',
                    barcode: '750000000001',
                    name: 'Cemento gris',
                    categoryName: 'Materiales',
                    brandName: 'Marca prueba',
                    measurementUnitAbbreviation: 'kg',
                    salePrice: 120,
                    tracksInventory: true,
                    active: true,
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
          provide: CategoriesService,
          useValue: {
            getAll: () =>
              of({
                success: true,
                message: '',
                data: [{ id: 1, name: 'Materiales', description: null, active: true }],
                errors: null,
              }),
          },
        },
        {
          provide: BrandsService,
          useValue: {
            getAll: () =>
              of({
                success: true,
                message: '',
                data: [{ id: 1, name: 'Marca prueba', description: null, active: true }],
                errors: null,
              }),
          },
        },
        {
          provide: MeasurementUnitsService,
          useValue: {
            getAll: () =>
              of({
                success: true,
                message: '',
                data: [{ id: 1, name: 'Kilogramo', abbreviation: 'kg', allowsDecimal: true, active: true }],
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

    fixture = TestBed.createComponent(Products);
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

  it('should render loaded products', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('MAT-001');
    expect(text).toContain('Cemento gris');
    expect(text).toContain('Materiales');
  });
});
