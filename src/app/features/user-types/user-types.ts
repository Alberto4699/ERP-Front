import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { UserType, UserTypeFilters, UserTypeSaveRequest } from '../../core/models/user-type.model';
import { NotificationsService } from '../../core/services/notifications';
import { UserTypesService } from '../../core/services/user-types';

type UserTypeModalMode = 'create' | 'view' | 'edit' | 'delete' | 'activate' | 'deactivate';

@Component({
  selector: 'app-user-types',
  imports: [ReactiveFormsModule],
  templateUrl: './user-types.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cerrarModalConEscape()' },
})
export class UserTypes implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly userTypesService = inject(UserTypesService);
  private readonly notifications = inject(NotificationsService);
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly newButton = viewChild<ElementRef<HTMLButtonElement>>('newButton');
  private lastFocusedElement: HTMLElement | null = null;

  readonly userTypes = signal<UserType[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly mostrandoFormulario = signal(false);
  readonly modalMode = signal<UserTypeModalMode>('create');
  readonly selectedUserType = signal<UserType | null>(null);
  readonly mensajeError = signal('');
  readonly mensajeFormulario = signal('');

  readonly filterForm = this.fb.nonNullable.group({ search: [''], active: [''] });
  readonly userTypeForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
    description: ['', [Validators.maxLength(255)]],
  });

  ngOnInit(): void {
    this.listenSearchChanges();
    this.loadUserTypes();
  }

  ngOnDestroy(): void { this.setModalState(false); }

  loadUserTypes(): void {
    this.cargando.set(true);
    this.mensajeError.set('');
    this.userTypesService.getAll(this.buildFilters()).pipe(finalize(() => this.cargando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          const message = response.message || 'No se pudieron cargar los tipos de usuario.';
          this.userTypes.set([]);
          this.mensajeError.set(message);
          this.notifications.error(message);
          return;
        }
        this.userTypes.set(response.data ?? []);
      },
      error: () => {
        const message = 'No se pudieron cargar los tipos de usuario.';
        this.userTypes.set([]);
        this.mensajeError.set(message);
        this.notifications.error(message);
      },
    });
  }

  buscar(): void { this.loadUserTypes(); }
  limpiarFiltros(): void { this.filterForm.reset({ search: '', active: '' }, { emitEvent: false }); this.loadUserTypes(); }

  nuevoTipo(): void { this.recordFocusedElement(); this.resetForm(); this.modalMode.set('create'); this.selectedUserType.set(null); this.openModal(); }
  verTipo(userType: UserType): void { this.openItemModal(userType, 'view'); }
  eliminarTipo(userType: UserType): void { this.openItemModal(userType, 'delete'); }
  cambiarEstadoTipo(userType: UserType): void { this.openItemModal(userType, this.isActive(userType) ? 'deactivate' : 'activate'); }

  editarTipo(userType: UserType): void {
    this.recordFocusedElement();
    this.modalMode.set('edit');
    this.selectedUserType.set(userType);
    this.userTypeForm.reset({ name: userType.name, description: userType.description ?? '' });
    this.openModal();
  }

  guardarTipo(): void {
    this.mensajeFormulario.set('');
    if (this.userTypeForm.invalid) {
      this.userTypeForm.markAllAsTouched();
      this.mensajeFormulario.set('Revisa los campos del tipo de usuario.');
      return;
    }
    const request = this.buildSaveRequest();
    if (this.modalMode() === 'edit') {
      this.updateUserType(request);
      return;
    }
    this.guardando.set(true);
    this.userTypesService.create(request).pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => this.handleSaveResponse(response, 'Tipo de usuario creado correctamente.', 'No se pudo crear el tipo de usuario.'),
      error: () => this.handleSaveError('No se pudo crear el tipo de usuario.'),
    });
  }

  confirmarEliminacion(): void {
    const id = this.getUserTypeId(this.selectedUserType());
    if (id === null) return;
    this.guardando.set(true);
    this.userTypesService.remove(id).pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo eliminar el tipo de usuario.'), { title: 'No se pudo eliminar' });
          return;
        }
        this.cerrarModal();
        this.notifications.success(response.message || 'Tipo de usuario eliminado correctamente.');
        this.loadUserTypes();
      },
      error: () => this.notifications.error('No se pudo eliminar el tipo de usuario.', { title: 'No se pudo eliminar' }),
    });
  }

  confirmarCambioEstado(): void {
    const id = this.getUserTypeId(this.selectedUserType());
    if (id === null) return;
    const activating = this.modalMode() === 'activate';
    const request = activating ? this.userTypesService.activate(id) : this.userTypesService.deactivate(id);
    this.guardando.set(true);
    request.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo actualizar el tipo de usuario.'), { title: 'No se pudo actualizar' });
          return;
        }
        this.cerrarModal();
        this.notifications.success(response.message || (activating ? 'Tipo de usuario activado correctamente.' : 'Tipo de usuario desactivado correctamente.'));
        this.loadUserTypes();
      },
      error: () => this.notifications.error('No se pudo actualizar el tipo de usuario.', { title: 'No se pudo actualizar' }),
    });
  }

  cerrarModal(): void { this.mostrandoFormulario.set(false); this.mensajeFormulario.set(''); this.selectedUserType.set(null); this.modalMode.set('create'); this.resetForm(); this.setModalState(false); this.restoreFocus(); }
  cerrarModalConEscape(): void { if (this.mostrandoFormulario() && !this.guardando()) this.cerrarModal(); }
  cerrarModalDesdeBackdrop(event: MouseEvent): void { if (event.target === event.currentTarget && !this.guardando()) this.cerrarModal(); }

  modalTitle(): string {
    switch (this.modalMode()) {
      case 'view': return 'Detalle de tipo de usuario';
      case 'edit': return 'Editar tipo de usuario';
      case 'delete': return 'Eliminar tipo de usuario';
      case 'activate': return 'Activar tipo de usuario';
      case 'deactivate': return 'Desactivar tipo de usuario';
      case 'create': return 'Nuevo tipo de usuario';
    }
  }

  trackUserType(index: number, userType: UserType): number | string { return userType.id ?? userType.userTypeId ?? userType.name ?? index; }
  isActive(userType: UserType): boolean { return userType.active ?? true; }
  campoInvalido(controlName: string): boolean { const control = this.userTypeForm.get(controlName); return Boolean(control?.invalid && (control.dirty || control.touched)); }

  private updateUserType(request: UserTypeSaveRequest): void {
    const id = this.getUserTypeId(this.selectedUserType());
    if (id === null) return;
    this.guardando.set(true);
    this.userTypesService.update(id, request).pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => this.handleSaveResponse(response, 'Tipo de usuario actualizado correctamente.', 'No se pudo actualizar el tipo de usuario.'),
      error: () => this.handleSaveError('No se pudo actualizar el tipo de usuario.'),
    });
  }

  private handleSaveResponse(response: { success: boolean; message: string; errors: string[] | null }, successMessage: string, fallback: string): void {
    if (!response.success) {
      const message = this.getResponseMessage(response.message, response.errors, fallback);
      this.mensajeFormulario.set(message);
      this.notifications.error(message, { title: 'No se pudo guardar' });
      return;
    }
    this.cerrarModal();
    this.notifications.success(response.message || successMessage);
    this.loadUserTypes();
  }

  private handleSaveError(message: string): void { this.mensajeFormulario.set(message); this.notifications.error(message, { title: 'No se pudo guardar' }); }
  private openItemModal(userType: UserType, mode: UserTypeModalMode): void { this.recordFocusedElement(); this.modalMode.set(mode); this.selectedUserType.set(userType); this.openModal(); }
  private openModal(): void { this.mostrandoFormulario.set(true); this.mensajeFormulario.set(''); this.setModalState(true); setTimeout(() => this.nameInput()?.nativeElement.focus()); }
  private resetForm(): void { this.userTypeForm.reset({ name: '', description: '' }); }
  private buildFilters(): UserTypeFilters { const value = this.filterForm.getRawValue(); return { search: value.search.trim() || undefined, active: value.active === '' ? undefined : value.active === 'true' }; }
  private buildSaveRequest(): UserTypeSaveRequest { const value = this.userTypeForm.getRawValue(); return { name: value.name.trim(), description: this.cleanOptionalValue(value.description) }; }
  private getUserTypeId(userType: UserType | null): number | null { return userType?.id ?? userType?.userTypeId ?? null; }
  private cleanOptionalValue(value: string): string | null { const trimmed = value.trim(); return trimmed || null; }
  private getResponseMessage(message: string, errors: string[] | null, fallback: string): string { return errors?.length ? errors.join(' ') : message || fallback; }
  private listenSearchChanges(): void { this.filterForm.controls.search.valueChanges.pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadUserTypes()); }
  private recordFocusedElement(): void { const active = this.document.activeElement; this.lastFocusedElement = active instanceof HTMLElement ? active : this.newButton()?.nativeElement ?? null; }
  private restoreFocus(): void { setTimeout(() => { const target = this.lastFocusedElement ?? this.newButton()?.nativeElement; target?.focus(); this.lastFocusedElement = null; }); }
  private setModalState(open: boolean): void { this.document.body.classList.toggle('modal-open', open); this.document.body.style.overflow = open ? 'hidden' : ''; }
}
