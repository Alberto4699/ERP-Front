import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { Branch } from '../../core/models/branch.model';
import { Warehouse, WarehouseFilters, WarehouseSaveRequest } from '../../core/models/warehouse.model';
import { BranchesService } from '../../core/services/branches';
import { NotificationsService } from '../../core/services/notifications';
import { WarehousesService } from '../../core/services/warehouses';

type WarehouseModalMode = 'create' | 'view' | 'edit' | 'delete' | 'activate' | 'deactivate' | 'primary';

@Component({
  selector: 'app-warehouses',
  imports: [ReactiveFormsModule],
  templateUrl: './warehouses.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'cerrarModalConEscape()',
  },
})
export class Warehouses implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly warehousesService = inject(WarehousesService);
  private readonly branchesService = inject(BranchesService);
  private readonly notifications = inject(NotificationsService);
  private readonly warehouseNameInput = viewChild<ElementRef<HTMLInputElement>>('warehouseNameInput');
  private readonly newWarehouseButton = viewChild<ElementRef<HTMLButtonElement>>('newWarehouseButton');
  private lastFocusedElement: HTMLElement | null = null;

  readonly warehouses = signal<Warehouse[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly cargando = signal(false);
  readonly cargandoSucursales = signal(false);
  readonly guardando = signal(false);
  readonly mostrandoFormulario = signal(false);
  readonly modalMode = signal<WarehouseModalMode>('create');
  readonly selectedWarehouse = signal<Warehouse | null>(null);
  readonly mensajeError = signal('');
  readonly mensajeFormulario = signal('');

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    branchId: [''],
    active: [''],
    isPrimary: [''],
  });

  readonly warehouseForm = this.fb.nonNullable.group({
    branchId: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]],
    code: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(/\S/)]],
    description: ['', [Validators.maxLength(255)]],
    isPrimary: [false],
  });

  ngOnInit(): void {
    this.listenSearchChanges();
    this.loadBranches();
    this.loadWarehouses();
  }

  ngOnDestroy(): void {
    this.setModalState(false);
  }

  loadWarehouses(): void {
    this.cargando.set(true);
    this.mensajeError.set('');

    this.warehousesService
      .getAll(this.buildFilters())
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = response.message || 'No se pudieron cargar los almacenes.';
            this.warehouses.set([]);
            this.mensajeError.set(message);
            this.notifications.error(message);
            return;
          }

          this.warehouses.set(response.data ?? []);
        },
        error: () => {
          const message = 'No se pudieron cargar los almacenes.';
          this.warehouses.set([]);
          this.mensajeError.set(message);
          this.notifications.error(message);
        },
      });
  }

  buscar(): void {
    this.loadWarehouses();
  }

  limpiarFiltros(): void {
    this.filterForm.reset(
      {
        search: '',
        branchId: '',
        active: '',
        isPrimary: '',
      },
      { emitEvent: false }
    );
    this.loadWarehouses();
  }

  nuevoAlmacen(): void {
    this.recordFocusedElement();
    this.resetWarehouseForm();
    this.modalMode.set('create');
    this.selectedWarehouse.set(null);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.warehouseNameInput()?.nativeElement.focus());
  }

  cerrarModal(): void {
    this.mostrandoFormulario.set(false);
    this.mensajeFormulario.set('');
    this.resetWarehouseForm();
    this.selectedWarehouse.set(null);
    this.modalMode.set('create');
    this.setModalState(false);
    this.restoreFocus();
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

  guardarAlmacen(): void {
    this.mensajeFormulario.set('');

    if (this.warehouseForm.invalid) {
      this.warehouseForm.markAllAsTouched();
      this.mensajeFormulario.set('Revisa los campos obligatorios del almacén.');
      return;
    }

    const request = this.buildSaveRequest();

    if (this.modalMode() === 'edit') {
      this.actualizarAlmacen(request);
      return;
    }

    this.guardando.set(true);
    this.warehousesService
      .create(request)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = this.getResponseMessage(response.message, response.errors, 'No se pudo crear el almacén.');
            this.mensajeFormulario.set(message);
            this.notifications.error(message, { title: 'No se pudo guardar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Almacén creado correctamente.');
          this.loadWarehouses();
        },
        error: () => {
          const message = 'No se pudo crear el almacén.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  verAlmacen(warehouse: Warehouse): void {
    this.recordFocusedElement();
    this.modalMode.set('view');
    this.selectedWarehouse.set(warehouse);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
  }

  editarAlmacen(warehouse: Warehouse): void {
    this.recordFocusedElement();
    this.modalMode.set('edit');
    this.selectedWarehouse.set(warehouse);
    this.mensajeFormulario.set('');
    this.warehouseForm.reset({
      branchId: this.getWarehouseBranchId(warehouse) === null ? '' : String(this.getWarehouseBranchId(warehouse)),
      name: warehouse.name,
      code: warehouse.code,
      description: warehouse.description ?? '',
      isPrimary: this.isPrimary(warehouse),
    });
    this.mostrandoFormulario.set(true);
    this.setModalState(true);
    setTimeout(() => this.warehouseNameInput()?.nativeElement.focus());
  }

  eliminarAlmacen(warehouse: Warehouse): void {
    this.recordFocusedElement();
    this.modalMode.set('delete');
    this.selectedWarehouse.set(warehouse);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
  }

  cambiarEstadoAlmacen(warehouse: Warehouse): void {
    this.recordFocusedElement();
    this.modalMode.set(this.isActive(warehouse) ? 'deactivate' : 'activate');
    this.selectedWarehouse.set(warehouse);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
  }

  marcarPrincipalAlmacen(warehouse: Warehouse): void {
    this.recordFocusedElement();
    this.modalMode.set('primary');
    this.selectedWarehouse.set(warehouse);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
  }

  confirmarEliminacion(): void {
    const warehouse = this.selectedWarehouse();
    const id = this.getWarehouseId(warehouse);

    if (id === null) {
      this.notifications.error('No se pudo identificar el almacén.', { title: 'No se pudo eliminar' });
      return;
    }

    this.guardando.set(true);
    this.warehousesService
      .remove(id)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo eliminar el almacén.'), { title: 'No se pudo eliminar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Almacén eliminado correctamente.');
          this.loadWarehouses();
        },
        error: () => {
          this.notifications.error('No se pudo eliminar el almacén.', { title: 'No se pudo eliminar' });
        },
      });
  }

  confirmarCambioEstado(): void {
    const warehouse = this.selectedWarehouse();
    const id = this.getWarehouseId(warehouse);
    const activating = this.modalMode() === 'activate';

    if (id === null) {
      this.notifications.error('No se pudo identificar el almacén.', { title: 'No se pudo actualizar' });
      return;
    }

    this.guardando.set(true);
    const request = activating ? this.warehousesService.activate(id) : this.warehousesService.deactivate(id);

    request.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo actualizar el almacén.'), { title: 'No se pudo actualizar' });
          return;
        }

        this.cerrarModal();
        this.notifications.success(response.message || (activating ? 'Almacén activado correctamente.' : 'Almacén desactivado correctamente.'));
        this.loadWarehouses();
      },
      error: () => {
        this.notifications.error('No se pudo actualizar el almacén.', { title: 'No se pudo actualizar' });
      },
    });
  }

  confirmarPrincipal(): void {
    const warehouse = this.selectedWarehouse();
    const id = this.getWarehouseId(warehouse);

    if (id === null) {
      this.notifications.error('No se pudo identificar el almacén.', { title: 'No se pudo actualizar' });
      return;
    }

    this.guardando.set(true);
    this.warehousesService
      .markAsPrimary(id)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo marcar el almacén como principal.'), { title: 'No se pudo actualizar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Almacén marcado como principal correctamente.');
          this.loadWarehouses();
        },
        error: () => {
          this.notifications.error('No se pudo marcar el almacén como principal.', { title: 'No se pudo actualizar' });
        },
      });
  }

  modalTitle(): string {
    switch (this.modalMode()) {
      case 'view':
        return 'Detalle de almacén';
      case 'edit':
        return 'Editar almacén';
      case 'delete':
        return 'Eliminar almacén';
      case 'activate':
        return 'Activar almacén';
      case 'deactivate':
        return 'Desactivar almacén';
      case 'primary':
        return 'Marcar almacén principal';
      case 'create':
        return 'Nuevo almacén';
    }
  }

  trackWarehouse(index: number, warehouse: Warehouse): number | string {
    return warehouse.id ?? warehouse.warehouseId ?? warehouse.code ?? index;
  }

  trackBranch(index: number, branch: Branch): number | string {
    return this.getBranchId(branch) ?? branch.code ?? index;
  }

  getBranchId(branch: Branch | null): number | null {
    return branch?.id ?? branch?.branchId ?? null;
  }

  branchName(warehouse: Warehouse): string {
    const branchId = this.getWarehouseBranchId(warehouse);
    const branch = branchId === null ? null : this.branches().find((item) => this.getBranchId(item) === branchId);
    return warehouse.branchName || branch?.name || '-';
  }

  isActive(warehouse: Warehouse): boolean {
    return warehouse.active !== false;
  }

  isPrimary(warehouse: Warehouse): boolean {
    return warehouse.isPrimary === true;
  }

  campoInvalido(controlName: string): boolean {
    const control = this.warehouseForm.get(controlName);
    return Boolean(control?.invalid && (control.dirty || control.touched));
  }

  private loadBranches(): void {
    this.cargandoSucursales.set(true);

    this.branchesService
      .getAll()
      .pipe(finalize(() => this.cargandoSucursales.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            this.branches.set([]);
            this.notifications.error(response.message || 'No se pudieron cargar las sucursales.');
            return;
          }

          this.branches.set(response.data ?? []);
        },
        error: () => {
          this.branches.set([]);
          this.notifications.error('No se pudieron cargar las sucursales.');
        },
      });
  }

  private buildFilters(): WarehouseFilters {
    const formValue = this.filterForm.getRawValue();
    const search = formValue.search.trim();
    const branchId = this.parseOptionalNumber(formValue.branchId);

    return {
      search: search || undefined,
      branchId: branchId ?? undefined,
      active: formValue.active === '' ? undefined : formValue.active === 'true',
      isPrimary: formValue.isPrimary === '' ? undefined : formValue.isPrimary === 'true',
    };
  }

  private listenSearchChanges(): void {
    this.filterForm.controls.search.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadWarehouses());
  }

  private buildSaveRequest(): WarehouseSaveRequest {
    const formValue = this.warehouseForm.getRawValue();

    return {
      branchId: this.parseRequiredNumber(formValue.branchId),
      name: formValue.name.trim(),
      code: formValue.code.trim(),
      description: this.cleanOptionalValue(formValue.description),
      isPrimary: formValue.isPrimary,
    };
  }

  private actualizarAlmacen(request: WarehouseSaveRequest): void {
    const id = this.getWarehouseId(this.selectedWarehouse());

    if (id === null) {
      this.notifications.error('No se pudo identificar el almacén.', { title: 'No se pudo guardar' });
      return;
    }

    this.guardando.set(true);
    this.warehousesService
      .update(id, request)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = this.getResponseMessage(response.message, response.errors, 'No se pudo actualizar el almacén.');
            this.mensajeFormulario.set(message);
            this.notifications.error(message, { title: 'No se pudo guardar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Almacén actualizado correctamente.');
          this.loadWarehouses();
        },
        error: () => {
          const message = 'No se pudo actualizar el almacén.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  private resetWarehouseForm(): void {
    this.warehouseForm.reset({
      branchId: '',
      name: '',
      code: '',
      description: '',
      isPrimary: false,
    });
  }

  private cleanOptionalValue(value: string): string | null {
    const trimmedValue = value.trim();
    return trimmedValue || null;
  }

  private getWarehouseId(warehouse: Warehouse | null): number | null {
    return warehouse?.id ?? warehouse?.warehouseId ?? null;
  }

  private getWarehouseBranchId(warehouse: Warehouse | null): number | null {
    return warehouse?.branchId ?? null;
  }

  private getResponseMessage(message: string, errors: string[] | null, fallback: string): string {
    return errors?.length ? errors.join(' ') : message || fallback;
  }

  private parseRequiredNumber(value: string | number): number {
    return this.parseOptionalNumber(value) ?? 0;
  }

  private parseOptionalNumber(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numberValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private recordFocusedElement(): void {
    const activeElement = this.document.activeElement;
    this.lastFocusedElement = activeElement instanceof HTMLElement ? activeElement : this.newWarehouseButton()?.nativeElement ?? null;
  }

  private restoreFocus(): void {
    setTimeout(() => {
      const target = this.lastFocusedElement ?? this.newWarehouseButton()?.nativeElement;
      target?.focus();
      this.lastFocusedElement = null;
    });
  }

  private setModalState(open: boolean): void {
    this.document.body.classList.toggle('modal-open', open);
    this.document.body.style.overflow = open ? 'hidden' : '';
  }
}
