import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { Branch, BranchFilters, BranchSaveRequest } from '../../core/models/branch.model';
import { BranchesService } from '../../core/services/branches';
import { NotificationsService } from '../../core/services/notifications';

type BranchModalMode = 'create' | 'view' | 'edit' | 'delete' | 'activate' | 'deactivate';

@Component({
  selector: 'app-branches',
  imports: [ReactiveFormsModule],
  templateUrl: './branches.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'cerrarModalConEscape()',
  },
})
export class Branches implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly branchesService = inject(BranchesService);
  private readonly notifications = inject(NotificationsService);
  private readonly branchNameInput = viewChild<ElementRef<HTMLInputElement>>('branchNameInput');
  private readonly newBranchButton = viewChild<ElementRef<HTMLButtonElement>>('newBranchButton');
  private lastFocusedElement: HTMLElement | null = null;

  readonly branches = signal<Branch[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly mostrandoFormulario = signal(false);
  readonly modalMode = signal<BranchModalMode>('create');
  readonly selectedBranch = signal<Branch | null>(null);
  readonly mensajeError = signal('');
  readonly mensajeFormulario = signal('');

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    active: [''],
  });

  readonly branchForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]],
    code: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(/\S/)]],
    address: ['', [Validators.maxLength(255)]],
    phone: ['', [Validators.maxLength(20)]],
    email: ['', [Validators.email, Validators.maxLength(150)]],
    rfc: ['', [Validators.maxLength(20)]],
    manager: ['', [Validators.maxLength(150)]],
    city: ['', [Validators.maxLength(100)]],
    state: ['', [Validators.maxLength(100)]],
    postalCode: ['', [Validators.maxLength(10)]],
  });

  ngOnInit(): void {
    this.listenSearchChanges();
    this.loadBranches();
  }

  ngOnDestroy(): void {
    this.setModalState(false);
  }

  loadBranches(): void {
    this.cargando.set(true);
    this.mensajeError.set('');

    this.branchesService
      .getAll(this.buildFilters())
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = response.message || 'No se pudieron cargar las sucursales.';
            this.branches.set([]);
            this.mensajeError.set(message);
            this.notifications.error(message);
            return;
          }

          this.branches.set(response.data ?? []);
        },
        error: () => {
          const message = 'No se pudieron cargar las sucursales.';
          this.branches.set([]);
          this.mensajeError.set(message);
          this.notifications.error(message);
        },
      });
  }

  buscar(): void {
    this.loadBranches();
  }

  limpiarFiltros(): void {
    this.filterForm.reset(
      {
        search: '',
        active: '',
      },
      { emitEvent: false }
    );
    this.loadBranches();
  }

  nuevaSucursal(): void {
    this.recordFocusedElement();
    this.resetBranchForm();
    this.modalMode.set('create');
    this.selectedBranch.set(null);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.branchNameInput()?.nativeElement.focus());
  }

  cerrarModal(): void {
    this.mostrandoFormulario.set(false);
    this.mensajeFormulario.set('');
    this.resetBranchForm();
    this.selectedBranch.set(null);
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

  guardarSucursal(): void {
    this.mensajeFormulario.set('');

    if (this.branchForm.invalid) {
      this.branchForm.markAllAsTouched();
      this.mensajeFormulario.set('Revisa los campos obligatorios de la sucursal.');
      return;
    }

    const request = this.buildSaveRequest();

    if (this.modalMode() === 'edit') {
      this.actualizarSucursal(request);
      return;
    }

    this.guardando.set(true);
    this.branchesService
      .create(request)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = this.getResponseMessage(response.message, response.errors, 'No se pudo crear la sucursal.');
            this.mensajeFormulario.set(message);
            this.notifications.error(message, { title: 'No se pudo guardar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Sucursal creada correctamente.');
          this.loadBranches();
        },
        error: () => {
          const message = 'No se pudo crear la sucursal.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  verSucursal(branch: Branch): void {
    this.recordFocusedElement();
    this.modalMode.set('view');
    this.selectedBranch.set(branch);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
  }

  editarSucursal(branch: Branch): void {
    this.recordFocusedElement();
    this.modalMode.set('edit');
    this.selectedBranch.set(branch);
    this.mensajeFormulario.set('');
    this.branchForm.reset({
      name: branch.name,
      code: branch.code,
      address: branch.address ?? '',
      phone: branch.phone ?? '',
      email: branch.email ?? '',
      rfc: branch.rfc ?? '',
      manager: branch.manager ?? '',
      city: branch.city ?? '',
      state: branch.state ?? '',
      postalCode: branch.postalCode ?? '',
    });
    this.mostrandoFormulario.set(true);
    this.setModalState(true);
    setTimeout(() => this.branchNameInput()?.nativeElement.focus());
  }

  eliminarSucursal(branch: Branch): void {
    this.recordFocusedElement();
    this.modalMode.set('delete');
    this.selectedBranch.set(branch);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
  }

  cambiarEstadoSucursal(branch: Branch): void {
    this.recordFocusedElement();
    this.modalMode.set(this.isActive(branch) ? 'deactivate' : 'activate');
    this.selectedBranch.set(branch);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
  }

  confirmarEliminacion(): void {
    const branch = this.selectedBranch();
    const id = this.getBranchId(branch);

    if (id === null) {
      this.notifications.error('No se pudo identificar la sucursal.', { title: 'No se pudo eliminar' });
      return;
    }

    this.guardando.set(true);
    this.branchesService
      .remove(id)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo eliminar la sucursal.'), { title: 'No se pudo eliminar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Sucursal eliminada correctamente.');
          this.loadBranches();
        },
        error: () => {
          this.notifications.error('No se pudo eliminar la sucursal.', { title: 'No se pudo eliminar' });
        },
      });
  }

  confirmarCambioEstado(): void {
    const branch = this.selectedBranch();
    const id = this.getBranchId(branch);
    const activating = this.modalMode() === 'activate';

    if (id === null) {
      this.notifications.error('No se pudo identificar la sucursal.', { title: 'No se pudo actualizar' });
      return;
    }

    this.guardando.set(true);
    const request = activating ? this.branchesService.activate(id) : this.branchesService.deactivate(id);

    request.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo actualizar la sucursal.'), { title: 'No se pudo actualizar' });
          return;
        }

        this.cerrarModal();
        this.notifications.success(response.message || (activating ? 'Sucursal activada correctamente.' : 'Sucursal desactivada correctamente.'));
        this.loadBranches();
      },
      error: () => {
        this.notifications.error('No se pudo actualizar la sucursal.', { title: 'No se pudo actualizar' });
      },
    });
  }

  modalTitle(): string {
    switch (this.modalMode()) {
      case 'view':
        return 'Detalle de sucursal';
      case 'edit':
        return 'Editar sucursal';
      case 'delete':
        return 'Eliminar sucursal';
      case 'activate':
        return 'Activar sucursal';
      case 'deactivate':
        return 'Desactivar sucursal';
      case 'create':
        return 'Nueva sucursal';
    }
  }

  trackBranch(index: number, branch: Branch): number | string {
    return branch.id ?? branch.branchId ?? branch.code ?? index;
  }

  isActive(branch: Branch): boolean {
    return branch.active !== false;
  }

  campoInvalido(controlName: string): boolean {
    const control = this.branchForm.get(controlName);
    return Boolean(control?.invalid && (control.dirty || control.touched));
  }

  private buildFilters(): BranchFilters {
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
      .subscribe(() => this.loadBranches());
  }

  private buildSaveRequest(): BranchSaveRequest {
    const formValue = this.branchForm.getRawValue();

    return {
      name: formValue.name.trim(),
      code: formValue.code.trim(),
      address: this.cleanOptionalValue(formValue.address),
      phone: this.cleanOptionalValue(formValue.phone),
      email: this.cleanOptionalValue(formValue.email),
      rfc: this.cleanOptionalValue(formValue.rfc),
      manager: this.cleanOptionalValue(formValue.manager),
      city: this.cleanOptionalValue(formValue.city),
      state: this.cleanOptionalValue(formValue.state),
      postalCode: this.cleanOptionalValue(formValue.postalCode),
    };
  }

  private actualizarSucursal(request: BranchSaveRequest): void {
    const id = this.getBranchId(this.selectedBranch());

    if (id === null) {
      this.notifications.error('No se pudo identificar la sucursal.', { title: 'No se pudo guardar' });
      return;
    }

    this.guardando.set(true);
    this.branchesService
      .update(id, request)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = this.getResponseMessage(response.message, response.errors, 'No se pudo actualizar la sucursal.');
            this.mensajeFormulario.set(message);
            this.notifications.error(message, { title: 'No se pudo guardar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Sucursal actualizada correctamente.');
          this.loadBranches();
        },
        error: () => {
          const message = 'No se pudo actualizar la sucursal.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  private resetBranchForm(): void {
    this.branchForm.reset({
      name: '',
      code: '',
      address: '',
      phone: '',
      email: '',
      rfc: '',
      manager: '',
      city: '',
      state: '',
      postalCode: '',
    });
  }

  private cleanOptionalValue(value: string): string | null {
    const trimmedValue = value.trim();
    return trimmedValue || null;
  }

  private getBranchId(branch: Branch | null): number | null {
    return branch?.id ?? branch?.branchId ?? null;
  }

  private getResponseMessage(message: string, errors: string[] | null, fallback: string): string {
    return errors?.length ? errors.join(' ') : message || fallback;
  }

  private recordFocusedElement(): void {
    const activeElement = this.document.activeElement;
    this.lastFocusedElement = activeElement instanceof HTMLElement ? activeElement : this.newBranchButton()?.nativeElement ?? null;
  }

  private restoreFocus(): void {
    setTimeout(() => {
      const target = this.lastFocusedElement ?? this.newBranchButton()?.nativeElement;
      target?.focus();
      this.lastFocusedElement = null;
    });
  }

  private setModalState(open: boolean): void {
    this.document.body.classList.toggle('modal-open', open);
    this.document.body.style.overflow = open ? 'hidden' : '';
  }
}
