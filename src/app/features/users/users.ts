import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize, forkJoin } from 'rxjs';

import { Role } from '../../core/models/role.model';
import { UserType } from '../../core/models/user-type.model';
import { User, UserCreateRequest, UserFilters, UserUpdateRequest } from '../../core/models/user.model';
import { NotificationsService } from '../../core/services/notifications';
import { RolesService } from '../../core/services/roles';
import { UserTypesService } from '../../core/services/user-types';
import { UsersService } from '../../core/services/users';

type UserModalMode = 'create' | 'view' | 'edit' | 'delete' | 'activate' | 'deactivate';

@Component({ selector: 'app-users', imports: [ReactiveFormsModule], templateUrl: './users.html', changeDetection: ChangeDetectionStrategy.OnPush, host: { '(document:keydown.escape)': 'cerrarModalConEscape()' } })
export class Users implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly userTypesService = inject(UserTypesService);
  private readonly notifications = inject(NotificationsService);
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly newButton = viewChild<ElementRef<HTMLButtonElement>>('newButton');
  private lastFocusedElement: HTMLElement | null = null;

  readonly users = signal<User[]>([]);
  readonly roles = signal<Role[]>([]);
  readonly userTypes = signal<UserType[]>([]);
  readonly cargando = signal(false);
  readonly cargandoCatalogos = signal(false);
  readonly guardando = signal(false);
  readonly mostrandoFormulario = signal(false);
  readonly modalMode = signal<UserModalMode>('create');
  readonly selectedUser = signal<User | null>(null);
  readonly mensajeError = signal('');
  readonly mensajeFormulario = signal('');

  readonly filterForm = this.fb.nonNullable.group({ search: [''], roleId: [''], userTypeId: [''], active: [''] });
  readonly userForm = this.fb.nonNullable.group({
    userTypeId: ['', [Validators.required]], roleId: ['', [Validators.required]], name: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]], middleName: ['', [Validators.maxLength(100)]], paternalLastName: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]], maternalLastName: ['', [Validators.maxLength(100)]], email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]], phone: ['', [Validators.maxLength(20)]], username: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]], password: ['', [Validators.maxLength(255)]],
  });

  ngOnInit(): void { this.listenSearchChanges(); this.loadCatalogs(); this.loadUsers(); }
  ngOnDestroy(): void { this.setModalState(false); }

  loadUsers(): void {
    this.cargando.set(true); this.mensajeError.set('');
    this.usersService.getAll(this.buildFilters()).pipe(finalize(() => this.cargando.set(false))).subscribe({
      next: (response) => { if (!response.success) { const m = response.message || 'No se pudieron cargar los usuarios.'; this.users.set([]); this.mensajeError.set(m); this.notifications.error(m); return; } this.users.set(response.data ?? []); },
      error: () => { const m = 'No se pudieron cargar los usuarios.'; this.users.set([]); this.mensajeError.set(m); this.notifications.error(m); },
    });
  }

  buscar(): void { this.loadUsers(); }
  limpiarFiltros(): void { this.filterForm.reset({ search: '', roleId: '', userTypeId: '', active: '' }, { emitEvent: false }); this.loadUsers(); }
  nuevoUsuario(): void { this.recordFocusedElement(); this.resetForm(true); this.modalMode.set('create'); this.selectedUser.set(null); this.openModal(); }
  verUsuario(user: User): void { this.openUserModal(user, 'view'); }
  eliminarUsuario(user: User): void { this.openUserModal(user, 'delete'); }
  cambiarEstadoUsuario(user: User): void { this.openUserModal(user, this.isActive(user) ? 'deactivate' : 'activate'); }

  editarUsuario(user: User): void { this.recordFocusedElement(); this.modalMode.set('edit'); this.selectedUser.set(user); this.resetForm(false, user); this.openModal(); }

  guardarUsuario(): void {
    this.mensajeFormulario.set('');
    if (this.modalMode() === 'create') this.userForm.controls.password.addValidators([Validators.required, Validators.pattern(/\S/)]); else this.userForm.controls.password.clearValidators();
    this.userForm.controls.password.updateValueAndValidity();
    if (this.userForm.invalid) { this.userForm.markAllAsTouched(); this.mensajeFormulario.set('Revisa los campos del usuario.'); return; }
    if (this.modalMode() === 'edit') { this.actualizarUsuario(); return; }
    this.guardando.set(true);
    this.usersService.create(this.buildCreateRequest()).pipe(finalize(() => this.guardando.set(false))).subscribe({ next: (r) => this.handleSaveResponse(r, 'Usuario creado correctamente.', 'No se pudo crear el usuario.'), error: () => this.handleSaveError('No se pudo crear el usuario.') });
  }

  confirmarEliminacion(): void { const id = this.getUserId(this.selectedUser()); if (id === null) return; this.guardando.set(true); this.usersService.remove(id).pipe(finalize(() => this.guardando.set(false))).subscribe({ next: (r) => { if (!r.success) { this.notifications.error(this.getResponseMessage(r.message, r.errors, 'No se pudo eliminar el usuario.'), { title: 'No se pudo eliminar' }); return; } this.cerrarModal(); this.notifications.success(r.message || 'Usuario eliminado correctamente.'); this.loadUsers(); }, error: () => this.notifications.error('No se pudo eliminar el usuario.', { title: 'No se pudo eliminar' }) }); }

  confirmarCambioEstado(): void { const id = this.getUserId(this.selectedUser()); if (id === null) return; const activating = this.modalMode() === 'activate'; const req = activating ? this.usersService.activate(id) : this.usersService.deactivate(id); this.guardando.set(true); req.pipe(finalize(() => this.guardando.set(false))).subscribe({ next: (r) => { if (!r.success) { this.notifications.error(this.getResponseMessage(r.message, r.errors, 'No se pudo actualizar el usuario.'), { title: 'No se pudo actualizar' }); return; } this.cerrarModal(); this.notifications.success(r.message || (activating ? 'Usuario activado correctamente.' : 'Usuario desactivado correctamente.')); this.loadUsers(); }, error: () => this.notifications.error('No se pudo actualizar el usuario.', { title: 'No se pudo actualizar' }) }); }

  cerrarModal(): void { this.mostrandoFormulario.set(false); this.mensajeFormulario.set(''); this.selectedUser.set(null); this.modalMode.set('create'); this.resetForm(true); this.setModalState(false); this.restoreFocus(); }
  cerrarModalConEscape(): void { if (this.mostrandoFormulario() && !this.guardando()) this.cerrarModal(); }
  cerrarModalDesdeBackdrop(event: MouseEvent): void { if (event.target === event.currentTarget && !this.guardando()) this.cerrarModal(); }

  modalTitle(): string { switch (this.modalMode()) { case 'view': return 'Detalle de usuario'; case 'edit': return 'Editar usuario'; case 'delete': return 'Eliminar usuario'; case 'activate': return 'Activar usuario'; case 'deactivate': return 'Desactivar usuario'; case 'create': return 'Nuevo usuario'; } }
  trackUser(index: number, user: User): number | string { return user.id ?? user.userId ?? user.username ?? index; }
  trackRole(index: number, role: Role): number | string { return role.id ?? role.roleId ?? role.name ?? index; }
  trackUserType(index: number, userType: UserType): number | string { return userType.id ?? userType.userTypeId ?? userType.name ?? index; }
  isActive(user: User): boolean { return user.active ?? true; }
  fullName(user: User): string { return [user.name, user.middleName, user.paternalLastName, user.maternalLastName].filter(Boolean).join(' '); }
  roleName(user: User): string { return user.roleName || this.roles().find((r) => this.getRoleId(r) === user.roleId)?.name || '-'; }
  userTypeName(user: User): string { return user.userTypeName || this.userTypes().find((t) => this.getUserTypeId(t) === user.userTypeId)?.name || '-'; }
  getRoleId(role: Role | null): number | null { return role?.id ?? role?.roleId ?? null; }
  getUserTypeId(userType: UserType | null): number | null { return userType?.id ?? userType?.userTypeId ?? null; }
  campoInvalido(controlName: string): boolean { const c = this.userForm.get(controlName); return Boolean(c?.invalid && (c.dirty || c.touched)); }

  private loadCatalogs(): void { this.cargandoCatalogos.set(true); forkJoin({ roles: this.rolesService.getAll({ active: true }), userTypes: this.userTypesService.getAll({ active: true }) }).pipe(finalize(() => this.cargandoCatalogos.set(false))).subscribe({ next: ({ roles, userTypes }) => { this.roles.set(roles.success ? roles.data ?? [] : []); this.userTypes.set(userTypes.success ? userTypes.data ?? [] : []); }, error: () => { this.roles.set([]); this.userTypes.set([]); } }); }
  private actualizarUsuario(): void { const id = this.getUserId(this.selectedUser()); if (id === null) return; this.guardando.set(true); this.usersService.update(id, this.buildUpdateRequest()).pipe(finalize(() => this.guardando.set(false))).subscribe({ next: (r) => this.handleSaveResponse(r, 'Usuario actualizado correctamente.', 'No se pudo actualizar el usuario.'), error: () => this.handleSaveError('No se pudo actualizar el usuario.') }); }
  private handleSaveResponse(r: { success: boolean; message: string; errors: string[] | null }, success: string, fallback: string): void { if (!r.success) { const m = this.getResponseMessage(r.message, r.errors, fallback); this.mensajeFormulario.set(m); this.notifications.error(m, { title: 'No se pudo guardar' }); return; } this.cerrarModal(); this.notifications.success(r.message || success); this.loadUsers(); }
  private handleSaveError(message: string): void { this.mensajeFormulario.set(message); this.notifications.error(message, { title: 'No se pudo guardar' }); }
  private openUserModal(user: User, mode: UserModalMode): void { this.recordFocusedElement(); this.modalMode.set(mode); this.selectedUser.set(user); this.openModal(); }
  private openModal(): void { this.mostrandoFormulario.set(true); this.mensajeFormulario.set(''); this.setModalState(true); setTimeout(() => this.nameInput()?.nativeElement.focus()); }
  private resetForm(includePassword: boolean, user?: User): void { this.userForm.reset({ userTypeId: user?.userTypeId ? String(user.userTypeId) : '', roleId: user?.roleId ? String(user.roleId) : '', name: user?.name ?? '', middleName: user?.middleName ?? '', paternalLastName: user?.paternalLastName ?? '', maternalLastName: user?.maternalLastName ?? '', email: user?.email ?? '', phone: user?.phone ?? '', username: user?.username ?? '', password: '' }); if (includePassword) this.userForm.controls.password.setValidators([Validators.required, Validators.maxLength(255), Validators.pattern(/\S/)]); else this.userForm.controls.password.clearValidators(); this.userForm.controls.password.updateValueAndValidity(); }
  private buildFilters(): UserFilters { const v = this.filterForm.getRawValue(); return { search: v.search.trim() || undefined, roleId: this.parseOptionalNumber(v.roleId) ?? undefined, userTypeId: this.parseOptionalNumber(v.userTypeId) ?? undefined, active: v.active === '' ? undefined : v.active === 'true' }; }
  private buildCreateRequest(): UserCreateRequest { const v = this.userForm.getRawValue(); return { ...this.buildUpdateRequest(), password: v.password }; }
  private buildUpdateRequest(): UserUpdateRequest { const v = this.userForm.getRawValue(); return { userTypeId: this.parseRequiredNumber(v.userTypeId), roleId: this.parseRequiredNumber(v.roleId), name: v.name.trim(), middleName: this.cleanOptionalValue(v.middleName), paternalLastName: v.paternalLastName.trim(), maternalLastName: this.cleanOptionalValue(v.maternalLastName), email: v.email.trim(), phone: this.cleanOptionalValue(v.phone), username: v.username.trim() }; }
  private getUserId(user: User | null): number | null { return user?.id ?? user?.userId ?? null; }
  private cleanOptionalValue(value: string): string | null { const trimmed = value.trim(); return trimmed || null; }
  private parseRequiredNumber(value: string | number): number { return this.parseOptionalNumber(value) ?? 0; }
  private parseOptionalNumber(value: string | number | null | undefined): number | null { if (value === null || value === undefined || value === '') return null; const n = typeof value === 'number' ? value : Number(value); return Number.isFinite(n) ? n : null; }
  private getResponseMessage(message: string, errors: string[] | null, fallback: string): string { return errors?.length ? errors.join(' ') : message || fallback; }
  private listenSearchChanges(): void { this.filterForm.controls.search.valueChanges.pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadUsers()); }
  private recordFocusedElement(): void { const active = this.document.activeElement; this.lastFocusedElement = active instanceof HTMLElement ? active : this.newButton()?.nativeElement ?? null; }
  private restoreFocus(): void { setTimeout(() => { const target = this.lastFocusedElement ?? this.newButton()?.nativeElement; target?.focus(); this.lastFocusedElement = null; }); }
  private setModalState(open: boolean): void { this.document.body.classList.toggle('modal-open', open); this.document.body.style.overflow = open ? 'hidden' : ''; }
}
