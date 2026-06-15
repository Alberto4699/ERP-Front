import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { BranchesService } from '../../core/services/branches';
import { CustomersService } from '../../core/services/customers';
import { NotificationsService } from '../../core/services/notifications';
import { ProductsService } from '../../core/services/products';
import { QuotationsService } from '../../core/services/quotations';
import { Session } from '../../core/services/session';
import { Quotations } from './quotations';

describe('Quotations', () => {
  let component: Quotations;
  let fixture: ComponentFixture<Quotations>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Quotations],
      providers: [
        {
          provide: QuotationsService,
          useValue: {
            getAll: () =>
              of({
                success: true,
                message: '',
                data: [
                  {
                    id: 1,
                    customerId: 1,
                    customerName: 'Cliente prueba',
                    branchId: 1,
                    branchName: 'Sucursal matriz',
                    salespersonUserId: 1,
                    salespersonUserName: 'Vendedor prueba',
                    folio: 'COT-001',
                    quotationDate: '2026-06-14T10:00:00',
                    status: 'Borrador',
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
                    customerType: 'General',
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
          provide: Session,
          useValue: {
            user: () => ({ idUsuario: 1 }),
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

    fixture = TestBed.createComponent(Quotations);
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

  it('should render loaded quotations', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('COT-001');
    expect(text).toContain('Cliente prueba');
    expect(text).toContain('Vendedor prueba');
  });
});
