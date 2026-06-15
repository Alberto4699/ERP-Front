import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { Role, RoleFilters, RoleSaveRequest } from '../../core/models/role.model';
import { NotificationsService } from '../../core/services/notifications';
import { RolesService } from '../../core/services/roles';

type RoleModalMode = 'create' | 'view' | 'edit' | 'delete' | 'activate' | 'deactivate';

@Component({
  selector: 'app-roles',
  imports: [ReactiveFormsModule],
  templateUrl: './roles.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cerrarModalConEscape()' },
})
export class Roles implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly rolesService = inject(RolesService);
  private readonly notifications = inject(NotificationsService);
  private readonly roleNameInput = viewChild<ElementRef<HTMLInputElement>>('roleNameInput');
  private readonly newRoleButton = viewChild<ElementRef<HTMLButtonElement>>('newRoleButton');
  private lastFocusedElement: HTMLElement | null = null;

  readonly roles = signal<Role[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly mostrandoFormulario = signal(false);
  readonly modalMode = signal<RoleModalMode>('create');
  readonly selectedRole = signal<Role | null>(null);
  readonly mensajeError = signal('');
  readonly mensajeFormulario = signal('');

  readonly filterForm = this.fb.nonNullable.group({ search: [''], active: [''] });
  readonly roleForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
    description: ['', [Validators.maxLength(255)]],
  });

  ngOnInit(): void {
    this.listenSearchChanges();
    this.loadRoles();
  }

  ngOnDestroy(): void { this.setModalState(false); }

  loadRoles(): void {
    this.cargando.set(true);
    this.mensajeError.set('');
    this.rolesService.getAll(this.buildFilters()).pipe(finalize(() => this.cargando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          const message = response.message || 'No se pudieron cargar los roles.';
          this.roles.set([]);
          this.mensajeError.set(message);
          this.notifications.error(message);
          return;
        }
        this.roles.set(response.data ?? []);
      },
      error: () => {
        const message = 'No se pudieron cargar los roles.';
        this.roles.set([]);
        this.mensajeError.set(message);
        this.notifications.error(message);
      },
    });
  }

  buscar(): void { this.loadRoles(); }

  limpiarFiltros(): void {
    this.filterForm.reset({ search: '', active: '' }, { emitEvent: false });
    this.loadRoles();
  }

  nuevoRol(): void {
    this.recordFocusedElement();
    this.resetRoleForm();
    this.modalMode.set('create');
    this.selectedRole.set(null);
    this.openModal();
  }

  verRol(role: Role): void { this.openRoleModal(role, 'view'); }

  editarRol(role: Role): void {
    this.recordFocusedElement();
    this.modalMode.set('edit');
    this.selectedRole.set(role);
    this.roleForm.reset({ name: role.name, description: role.description ?? '' });
    this.openModal();
  }

  eliminarRol(role: Role): void { this.openRoleModal(role, 'delete'); }
  cambiarEstadoRol(role: Role): void { this.openRoleModal(role, this.isActive(role) ? 'deactivate' : 'activate'); }

  guardarRol(): void {
    this.mensajeFormulario.set('');
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      this.mensajeFormulario.set('Revisa los campos del rol.');
      return;
    }
    const request = this.buildSaveRequest();
    if (this.modalMode() === 'edit') {
      this.actualizarRol(request);
      return;
    }
    this.guardando.set(true);
    this.rolesService.create(request).pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => this.handleSaveResponse(response, 'Rol creado correctamente.', 'No se pudo crear el rol.'),
      error: () => this.handleSaveError('No se pudo crear el rol.'),
    });
  }

  confirmarEliminacion(): void {
    const id = this.getRoleId(this.selectedRole());
    if (id === null) return;
    this.guardando.set(true);
    this.rolesService.remove(id).pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo eliminar el rol.'), { title: 'No se pudo eliminar' });
          return;
        }
        this.cerrarModal();
        this.notifications.success(response.message || 'Rol eliminado correctamente.');
        this.loadRoles();
      },
      error: () => this.notifications.error('No se pudo eliminar el rol.', { title: 'No se pudo eliminar' }),
    });
  }

  confirmarCambioEstado(): void {
    const role = this.selectedRole();
    const id = this.getRoleId(role);
    if (id === null) return;
    const activating = this.modalMode() === 'activate';
    const request = activating ? this.rolesService.activate(id) : this.rolesService.deactivate(id);
    this.guardando.set(true);
    request.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo actualizar el rol.'), { title: 'No se pudo actualizar' });
          return;
        }
        this.cerrarModal();
        this.notifications.success(response.message || (activating ? 'Rol activado correctamente.' : 'Rol desactivado correctamente.'));
        this.loadRoles();
      },
      error: () => this.notifications.error('No se pudo actualizar el rol.', { title: 'No se pudo actualizar' }),
    });
  }

  cerrarModal(): void {
    this.mostrandoFormulario.set(false);
    this.mensajeFormulario.set('');
    this.selectedRole.set(null);
    this.modalMode.set('create');
    this.resetRoleForm();
    this.setModalState(false);
    this.restoreFocus();
  }

  cerrarModalConEscape(): void { if (this.mostrandoFormulario() && !this.guardando()) this.cerrarModal(); }
  cerrarModalDesdeBackdrop(event: MouseEvent): void { if (event.target === event.currentTarget && !this.guardando()) this.cerrarModal(); }

  modalTitle(): string {
    switch (this.modalMode()) {
      case 'view': return 'Detalle de rol';
      case 'edit': return 'Editar rol';
      case 'delete': return 'Eliminar rol';
      case 'activate': return 'Activar rol';
      case 'deactivate': return 'Desactivar rol';
      case 'create': return 'Nuevo rol';
    }
  }

  trackRole(index: number, role: Role): number | string { return role.id ?? role.roleId ?? role.name ?? index; }
  isActive(role: Role): boolean { return role.active ?? true; }
  campoInvalido(controlName: string): boolean { const control = this.roleForm.get(controlName); return Boolean(control?.invalid && (control.dirty || control.touched)); }

  private actualizarRol(request: RoleSaveRequest): void {
    const id = this.getRoleId(this.selectedRole());
    if (id === null) return;
    this.guardando.set(true);
    this.rolesService.update(id, request).pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => this.handleSaveResponse(response, 'Rol actualizado correctamente.', 'No se pudo actualizar el rol.'),
      error: () => this.handleSaveError('No se pudo actualizar el rol.'),
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
    this.loadRoles();
  }

  private handleSaveError(message: string): void {
    this.mensajeFormulario.set(message);
    this.notifications.error(message, { title: 'No se pudo guardar' });
  }

  private openRoleModal(role: Role, mode: RoleModalMode): void { this.recordFocusedElement(); this.modalMode.set(mode); this.selectedRole.set(role); this.openModal(); }
  private openModal(): void { this.mostrandoFormulario.set(true); this.mensajeFormulario.set(''); this.setModalState(true); setTimeout(() => this.roleNameInput()?.nativeElement.focus()); }
  private resetRoleForm(): void { this.roleForm.reset({ name: '', description: '' }); }
  private buildFilters(): RoleFilters { const value = this.filterForm.getRawValue(); return { search: value.search.trim() || undefined, active: value.active === '' ? undefined : value.active === 'true' }; }
  private buildSaveRequest(): RoleSaveRequest { const value = this.roleForm.getRawValue(); return { name: value.name.trim(), description: this.cleanOptionalValue(value.description) }; }
  private getRoleId(role: Role | null): number | null { return role?.id ?? role?.roleId ?? null; }
  private cleanOptionalValue(value: string): string | null { const trimmed = value.trim(); return trimmed || null; }
  private getResponseMessage(message: string, errors: string[] | null, fallback: string): string { return errors?.length ? errors.join(' ') : message || fallback; }
  private listenSearchChanges(): void { this.filterForm.controls.search.valueChanges.pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadRoles()); }
  private recordFocusedElement(): void { const active = this.document.activeElement; this.lastFocusedElement = active instanceof HTMLElement ? active : this.newRoleButton()?.nativeElement ?? null; }
  private restoreFocus(): void { setTimeout(() => { const target = this.lastFocusedElement ?? this.newRoleButton()?.nativeElement; target?.focus(); this.lastFocusedElement = null; }); }
  private setModalState(open: boolean): void { this.document.body.classList.toggle('modal-open', open); this.document.body.style.overflow = open ? 'hidden' : ''; }
}
