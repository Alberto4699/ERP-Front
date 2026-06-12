import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { MeasurementUnit, MeasurementUnitFilters, MeasurementUnitSaveRequest } from '../../core/models/measurement-unit.model';
import { MeasurementUnitsService } from '../../core/services/measurement-units';
import { NotificationsService } from '../../core/services/notifications';

type MeasurementUnitModalMode = 'create' | 'view' | 'edit' | 'delete';

@Component({
  selector: 'app-measurement-units',
  imports: [ReactiveFormsModule],
  templateUrl: './measurement-units.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'cerrarModalConEscape()',
  },
})
export class MeasurementUnits implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly measurementUnitsService = inject(MeasurementUnitsService);
  private readonly notifications = inject(NotificationsService);
  private readonly measurementUnitNameInput = viewChild<ElementRef<HTMLInputElement>>('measurementUnitNameInput');
  private readonly newMeasurementUnitButton = viewChild<ElementRef<HTMLButtonElement>>('newMeasurementUnitButton');

  readonly measurementUnits = signal<MeasurementUnit[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly mostrandoFormulario = signal(false);
  readonly modalMode = signal<MeasurementUnitModalMode>('create');
  readonly selectedMeasurementUnit = signal<MeasurementUnit | null>(null);
  readonly mensajeError = signal('');
  readonly mensajeFormulario = signal('');

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    active: [''],
  });

  readonly measurementUnitForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
    abbreviation: ['', [Validators.required, Validators.pattern(/\S/)]],
    allowsDecimal: [false],
  });

  ngOnInit(): void {
    this.listenSearchChanges();
    this.loadMeasurementUnits();
  }

  ngOnDestroy(): void {
    this.setModalState(false);
  }

  loadMeasurementUnits(): void {
    this.cargando.set(true);
    this.mensajeError.set('');

    this.measurementUnitsService
      .getAll(this.buildFilters())
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = response.message || 'No se pudieron cargar las unidades de medida.';
            this.measurementUnits.set([]);
            this.mensajeError.set(message);
            this.notifications.error(message);
            return;
          }

          this.measurementUnits.set(response.data ?? []);
        },
        error: () => {
          const message = 'No se pudieron cargar las unidades de medida.';
          this.measurementUnits.set([]);
          this.mensajeError.set(message);
          this.notifications.error(message);
        },
      });
  }

  buscar(): void {
    this.loadMeasurementUnits();
  }

  limpiarFiltros(): void {
    this.filterForm.reset(
      {
        search: '',
        active: '',
      },
      { emitEvent: false }
    );
    this.loadMeasurementUnits();
  }

  nuevaUnidadMedida(): void {
    this.measurementUnitForm.reset({
      name: '',
      abbreviation: '',
      allowsDecimal: false,
    });
    this.modalMode.set('create');
    this.selectedMeasurementUnit.set(null);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.measurementUnitNameInput()?.nativeElement.focus());
  }

  cerrarModal(): void {
    this.mostrandoFormulario.set(false);
    this.mensajeFormulario.set('');
    this.measurementUnitForm.reset({
      name: '',
      abbreviation: '',
      allowsDecimal: false,
    });
    this.selectedMeasurementUnit.set(null);
    this.modalMode.set('create');
    this.setModalState(false);
    setTimeout(() => this.newMeasurementUnitButton()?.nativeElement.focus());
  }

  cerrarModalConEscape(): void {
    if (!this.mostrandoFormulario() || this.guardando()) {
      return;
    }

    this.cerrarModal();
  }

  cerrarModalDesdeBackdrop(event: MouseEvent): void {
    if (event.target !== event.currentTarget || this.guardando()) {
      return;
    }

    this.cerrarModal();
  }

  guardarUnidadMedida(): void {
    this.mensajeFormulario.set('');

    if (this.measurementUnitForm.invalid) {
      this.measurementUnitForm.markAllAsTouched();
      this.mensajeFormulario.set('Ingresa el nombre y la abreviatura.');
      return;
    }

    const request = this.buildSaveRequest();

    if (this.modalMode() === 'edit') {
      this.actualizarUnidadMedida(request);
      return;
    }

    this.guardando.set(true);
    this.measurementUnitsService
      .create(request)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = this.getResponseMessage(response.message, response.errors);
            this.mensajeFormulario.set(message);
            this.notifications.error(message, { title: 'No se pudo guardar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Unidad de medida creada correctamente.');
          this.loadMeasurementUnits();
        },
        error: () => {
          const message = 'No se pudo crear la unidad de medida.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  nombreUnidadMedidaInvalido(): boolean {
    const control = this.measurementUnitForm.controls.name;
    return control.invalid && (control.dirty || control.touched);
  }

  abreviaturaInvalida(): boolean {
    const control = this.measurementUnitForm.controls.abbreviation;
    return control.invalid && (control.dirty || control.touched);
  }

  verUnidadMedida(measurementUnit: MeasurementUnit): void {
    this.modalMode.set('view');
    this.selectedMeasurementUnit.set(measurementUnit);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
  }

  editarUnidadMedida(measurementUnit: MeasurementUnit): void {
    this.modalMode.set('edit');
    this.selectedMeasurementUnit.set(measurementUnit);
    this.mensajeFormulario.set('');
    this.measurementUnitForm.reset({
      name: measurementUnit.name,
      abbreviation: measurementUnit.abbreviation,
      allowsDecimal: measurementUnit.allowsDecimal === true,
    });
    this.mostrandoFormulario.set(true);
    this.setModalState(true);
    setTimeout(() => this.measurementUnitNameInput()?.nativeElement.focus());
  }

  eliminarUnidadMedida(measurementUnit: MeasurementUnit): void {
    this.modalMode.set('delete');
    this.selectedMeasurementUnit.set(measurementUnit);
    this.mensajeFormulario.set('');
    this.mostrandoFormulario.set(true);
    this.setModalState(true);
  }

  mostrarMasAcciones(measurementUnit: MeasurementUnit): void {
    void measurementUnit;
  }

  confirmarEliminacion(): void {
    const measurementUnit = this.selectedMeasurementUnit();
    const id = this.getMeasurementUnitId(measurementUnit);

    if (id === null) {
      this.notifications.error('No se pudo identificar la unidad de medida.', { title: 'No se pudo eliminar' });
      return;
    }

    this.guardando.set(true);
    this.measurementUnitsService
      .remove(id)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            this.notifications.error(this.getResponseMessage(response.message, response.errors), { title: 'No se pudo eliminar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Unidad de medida eliminada correctamente.');
          this.loadMeasurementUnits();
        },
        error: () => {
          this.notifications.error('No se pudo eliminar la unidad de medida.', { title: 'No se pudo eliminar' });
        },
      });
  }

  modalTitle(): string {
    switch (this.modalMode()) {
      case 'view':
        return 'Detalle de unidad de medida';
      case 'edit':
        return 'Editar unidad de medida';
      case 'delete':
        return 'Eliminar unidad de medida';
      case 'create':
        return 'Nueva unidad de medida';
    }
  }

  trackMeasurementUnit(index: number, measurementUnit: MeasurementUnit): number | string {
    return measurementUnit.id ?? measurementUnit.measurementUnitId ?? measurementUnit.name ?? index;
  }

  isActive(measurementUnit: MeasurementUnit): boolean {
    return measurementUnit.active !== false;
  }

  allowsDecimals(measurementUnit: MeasurementUnit): boolean {
    return measurementUnit.allowsDecimal === true;
  }

  private buildFilters(): MeasurementUnitFilters {
    const formValue = this.filterForm.getRawValue();
    const search = formValue.search.trim();

    return {
      search: search || undefined,
      active: formValue.active === '' ? undefined : formValue.active === 'true',
    };
  }

  private listenSearchChanges(): void {
    this.filterForm.controls.search.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadMeasurementUnits());
  }

  private buildSaveRequest(): MeasurementUnitSaveRequest {
    const formValue = this.measurementUnitForm.getRawValue();

    return {
      name: formValue.name.trim(),
      abbreviation: formValue.abbreviation.trim(),
      allowsDecimal: formValue.allowsDecimal,
    };
  }

  private actualizarUnidadMedida(request: MeasurementUnitSaveRequest): void {
    const id = this.getMeasurementUnitId(this.selectedMeasurementUnit());

    if (id === null) {
      this.notifications.error('No se pudo identificar la unidad de medida.', { title: 'No se pudo guardar' });
      return;
    }

    this.guardando.set(true);
    this.measurementUnitsService
      .update(id, request)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = this.getResponseMessage(response.message, response.errors);
            this.mensajeFormulario.set(message);
            this.notifications.error(message, { title: 'No se pudo guardar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Unidad de medida actualizada correctamente.');
          this.loadMeasurementUnits();
        },
        error: () => {
          const message = 'No se pudo actualizar la unidad de medida.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  private getMeasurementUnitId(measurementUnit: MeasurementUnit | null): number | null {
    return measurementUnit?.id ?? measurementUnit?.measurementUnitId ?? null;
  }

  private getResponseMessage(message: string, errors: string[] | null): string {
    return errors?.length ? errors.join(' ') : message || 'No se pudo crear la unidad de medida.';
  }

  private setModalState(open: boolean): void {
    this.document.body.classList.toggle('modal-open', open);
    this.document.body.style.overflow = open ? 'hidden' : '';
  }
}
