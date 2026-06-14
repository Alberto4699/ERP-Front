import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { BranchesService } from '../../core/services/branches';
import { NotificationsService } from '../../core/services/notifications';
import { WarehousesService } from '../../core/services/warehouses';
import { Warehouses } from './warehouses';

describe('Warehouses', () => {
  let component: Warehouses;
  let fixture: ComponentFixture<Warehouses>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Warehouses],
      providers: [
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
                    description: 'Almacén de prueba',
                    isPrimary: true,
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
          provide: NotificationsService,
          useValue: {
            success: () => undefined,
            error: () => undefined,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Warehouses);
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

  it('should render loaded warehouses', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Almacén principal');
    expect(text).toContain('ALM-001');
    expect(text).toContain('Sucursal matriz');
  });
});
