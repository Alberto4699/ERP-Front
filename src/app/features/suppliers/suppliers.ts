import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { Supplier, SupplierFilters, SupplierSaveRequest } from '../../core/models/supplier.model';
import { NotificationsService } from '../../core/services/notifications';
import { SuppliersService } from '../../core/services/suppliers';

type SupplierModalMode = 'create' | 'view' | 'edit' | 'delete' | 'activate' | 'deactivate';

@Component({
  selector: 'app-suppliers',
  imports: [ReactiveFormsModule],
  templateUrl: './suppliers.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'cerrarModalConEscape()',
  },
})
export class Suppliers implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly suppliersService = inject(SuppliersService);
  private readonly notifications = inject(NotificationsService);
  private readonly supplierNameInput = viewChild<ElementRef<HTMLInputElement>>('supplierNameInput');
  private readonly newSupplierButton = viewChild<ElementRef<HTMLButtonElement>>('newSupplierButton');
  private lastFocusedElement: HTMLElement | null = null;

  readonly suppliers = signal<Supplier[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly mostrandoFormulario = signal(false);
  readonly modalMode = signal<SupplierModalMode>('create');
  readonly selectedSupplier = signal<Supplier | null>(null);
  readonly mensajeError = signal('');
  readonly mensajeFormulario = signal('');

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    active: [''],
  });

  readonly supplierForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200), Validators.pattern(/\S/)]],
    rfc: ['', [Validators.maxLength(20)]],
    phone: ['', [Validators.maxLength(20)]],
    email: ['', [Validators.email, Validators.maxLength(150)]],
    address: ['', [Validators.maxLength(255)]],
    contact: ['', [Validators.maxLength(150)]],
  });

  ngOnInit(): void {
    this.listenSearchChanges();
    this.loadSuppliers();
  }

  ngOnDestroy(): void {
    this.setModalState(false);
  }

  loadSuppliers(): void {
    this.cargando.set(true);
    this.mensajeError.set('');

    this.suppliersService
      .getAll(this.buildFilters())
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = response.message || 'No se pudieron cargar los proveedores.';
            this.suppliers.set([]);
            this.mensajeError.set(message);
            this.notifications.error(message);
            return;
          }

          this.suppliers.set(response.data ?? []);
        },
        error: () => {
          const message = 'No se pudieron cargar los proveedores.';
          this.suppliers.set([]);
          this.mensajeError.set(message);
          this.notifications.error(message);
        },
      });
  }

  buscar(): void {
    this.loadSuppliers();
  }

  limpiarFiltros(): void {
    this.filterForm.reset(
      {
        search: '',
        active: '',
      },
      { emitEvent: false }
    );
    this.loadSuppliers();
  }

  nuevoProveedor(): void {
    this.recordFocusedElement();
    this.resetSupplierForm();
    this.modalMode.set('create');
    this.selectedSupplier.set(null);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.supplierNameInput()?.nativeElement.focus());
  }

  cerrarModal(): void {
    this.mostrandoFormulario.set(false);
    this.mensajeFormulario.set('');
    this.resetSupplierForm();
    this.selectedSupplier.set(null);
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

  guardarProveedor(): void {
    this.mensajeFormulario.set('');

    if (this.supplierForm.invalid) {
      this.supplierForm.markAllAsTouched();
      this.mensajeFormulario.set('Revisa los campos del proveedor.');
      return;
    }

    const request = this.buildSaveRequest();

    if (this.modalMode() === 'edit') {
      this.actualizarProveedor(request);
      return;
    }

    this.guardando.set(true);
    this.suppliersService
      .create(request)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = this.getResponseMessage(response.message, response.errors, 'No se pudo crear el proveedor.');
            this.mensajeFormulario.set(message);
            this.notifications.error(message, { title: 'No se pudo guardar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Proveedor creado correctamente.');
          this.loadSuppliers();
        },
        error: () => {
          const message = 'No se pudo crear el proveedor.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  verProveedor(supplier: Supplier): void {
    this.recordFocusedElement();
    this.modalMode.set('view');
    this.selectedSupplier.set(supplier);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
  }

  editarProveedor(supplier: Supplier): void {
    this.recordFocusedElement();
    this.modalMode.set('edit');
    this.selectedSupplier.set(supplier);
    this.mensajeFormulario.set('');
    this.supplierForm.reset({
      name: supplier.name,
      rfc: supplier.rfc ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
      contact: supplier.contact ?? '',
    });
    this.mostrandoFormulario.set(true);
    this.setModalState(true);
    setTimeout(() => this.supplierNameInput()?.nativeElement.focus());
  }

  eliminarProveedor(supplier: Supplier): void {
    this.recordFocusedElement();
    this.modalMode.set('delete');
    this.selectedSupplier.set(supplier);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
  }

  cambiarEstadoProveedor(supplier: Supplier): void {
    this.recordFocusedElement();
    this.modalMode.set(this.isActive(supplier) ? 'deactivate' : 'activate');
    this.selectedSupplier.set(supplier);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
  }

  confirmarEliminacion(): void {
    const supplier = this.selectedSupplier();
    const id = this.getSupplierId(supplier);

    if (id === null) {
      this.notifications.error('No se pudo identificar el proveedor.', { title: 'No se pudo eliminar' });
      return;
    }

    this.guardando.set(true);
    this.suppliersService
      .remove(id)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo eliminar el proveedor.'), { title: 'No se pudo eliminar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Proveedor eliminado correctamente.');
          this.loadSuppliers();
        },
        error: () => {
          this.notifications.error('No se pudo eliminar el proveedor.', { title: 'No se pudo eliminar' });
        },
      });
  }

  confirmarCambioEstado(): void {
    const supplier = this.selectedSupplier();
    const id = this.getSupplierId(supplier);
    const activating = this.modalMode() === 'activate';

    if (id === null) {
      this.notifications.error('No se pudo identificar el proveedor.', { title: 'No se pudo actualizar' });
      return;
    }

    this.guardando.set(true);
    const request = activating ? this.suppliersService.activate(id) : this.suppliersService.deactivate(id);

    request.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo actualizar el proveedor.'), { title: 'No se pudo actualizar' });
          return;
        }

        this.cerrarModal();
        this.notifications.success(response.message || (activating ? 'Proveedor activado correctamente.' : 'Proveedor desactivado correctamente.'));
        this.loadSuppliers();
      },
      error: () => {
        this.notifications.error('No se pudo actualizar el proveedor.', { title: 'No se pudo actualizar' });
      },
    });
  }

  modalTitle(): string {
    switch (this.modalMode()) {
      case 'view':
        return 'Detalle de proveedor';
      case 'edit':
        return 'Editar proveedor';
      case 'delete':
        return 'Eliminar proveedor';
      case 'activate':
        return 'Activar proveedor';
      case 'deactivate':
        return 'Desactivar proveedor';
      case 'create':
        return 'Nuevo proveedor';
    }
  }

  trackSupplier(index: number, supplier: Supplier): number | string {
    return supplier.id ?? supplier.supplierId ?? supplier.name ?? index;
  }

  isActive(supplier: Supplier): boolean {
    return supplier.active !== false;
  }

  campoInvalido(controlName: string): boolean {
    const control = this.supplierForm.get(controlName);
    return Boolean(control?.invalid && (control.dirty || control.touched));
  }

  private buildFilters(): SupplierFilters {
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
      .subscribe(() => this.loadSuppliers());
  }

  private buildSaveRequest(): SupplierSaveRequest {
    const formValue = this.supplierForm.getRawValue();

    return {
      name: formValue.name.trim(),
      rfc: this.cleanOptionalValue(formValue.rfc),
      phone: this.cleanOptionalValue(formValue.phone),
      email: this.cleanOptionalValue(formValue.email),
      address: this.cleanOptionalValue(formValue.address),
      contact: this.cleanOptionalValue(formValue.contact),
    };
  }

  private actualizarProveedor(request: SupplierSaveRequest): void {
    const id = this.getSupplierId(this.selectedSupplier());

    if (id === null) {
      this.notifications.error('No se pudo identificar el proveedor.', { title: 'No se pudo guardar' });
      return;
    }

    this.guardando.set(true);
    this.suppliersService
      .update(id, request)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = this.getResponseMessage(response.message, response.errors, 'No se pudo actualizar el proveedor.');
            this.mensajeFormulario.set(message);
            this.notifications.error(message, { title: 'No se pudo guardar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Proveedor actualizado correctamente.');
          this.loadSuppliers();
        },
        error: () => {
          const message = 'No se pudo actualizar el proveedor.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  private resetSupplierForm(): void {
    this.supplierForm.reset({
      name: '',
      rfc: '',
      phone: '',
      email: '',
      address: '',
      contact: '',
    });
  }

  private cleanOptionalValue(value: string): string | null {
    const trimmedValue = value.trim();
    return trimmedValue || null;
  }

  private getSupplierId(supplier: Supplier | null): number | null {
    return supplier?.id ?? supplier?.supplierId ?? null;
  }

  private getResponseMessage(message: string, errors: string[] | null, fallback: string): string {
    return errors?.length ? errors.join(' ') : message || fallback;
  }

  private recordFocusedElement(): void {
    const activeElement = this.document.activeElement;
    this.lastFocusedElement = activeElement instanceof HTMLElement ? activeElement : this.newSupplierButton()?.nativeElement ?? null;
  }

  private restoreFocus(): void {
    setTimeout(() => {
      const target = this.lastFocusedElement ?? this.newSupplierButton()?.nativeElement;
      target?.focus();
      this.lastFocusedElement = null;
    });
  }

  private setModalState(open: boolean): void {
    this.document.body.classList.toggle('modal-open', open);
    this.document.body.style.overflow = open ? 'hidden' : '';
  }
}
