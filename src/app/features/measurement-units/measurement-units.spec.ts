import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { MeasurementUnitsService } from '../../core/services/measurement-units';
import { NotificationsService } from '../../core/services/notifications';
import { MeasurementUnits } from './measurement-units';

describe('MeasurementUnits', () => {
  let component: MeasurementUnits;
  let fixture: ComponentFixture<MeasurementUnits>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeasurementUnits],
      providers: [
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

    fixture = TestBed.createComponent(MeasurementUnits);
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

  it('should render loaded measurement units', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Kilogramo');
    expect(text).toContain('kg');
    expect(text).toContain('Sí');
  });
});
