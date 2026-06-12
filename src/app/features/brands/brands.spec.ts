import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { BrandsService } from '../../core/services/brands';
import { NotificationsService } from '../../core/services/notifications';
import { Brands } from './brands';

describe('Brands', () => {
  let component: Brands;
  let fixture: ComponentFixture<Brands>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Brands],
      providers: [
        {
          provide: BrandsService,
          useValue: {
            getAll: () =>
              of({
                success: true,
                message: '',
                data: [{ id: 1, name: 'Marca prueba', description: 'Descripción prueba', active: true }],
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

    fixture = TestBed.createComponent(Brands);
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

  it('should render loaded brands', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Marca prueba');
    expect(text).toContain('Descripción prueba');
  });
});
