import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { CustomerAccount, CustomerAccountFilters, CustomerAccountMovement } from '../../core/models/customer-account.model';
import { Customer } from '../../core/models/customer.model';
import { Sale } from '../../core/models/sale.model';
import { CustomerAccountsService } from '../../core/services/customer-accounts';
import { CustomersService } from '../../core/services/customers';
import { NotificationsService } from '../../core/services/notifications';
import { SalesService } from '../../core/services/sales';

type AccountModalMode = 'create' | 'edit' | 'delete' | 'charge' | 'payment' | 'movements';

@Component({
  selector: 'app-customer-accounts',
  imports: [ReactiveFormsModule],
  templateUrl: './customer-accounts.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cerrarModalConEscape()' },
})
export class CustomerAccounts implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly accountsService = inject(CustomerAccountsService);
  private readonly customersService = inject(CustomersService);
  private readonly salesService = inject(SalesService);
  private readonly notifications = inject(NotificationsService);
  private readonly newAccountButton = viewChild<ElementRef<HTMLButtonElement>>('newAccountButton');
  private readonly modalCloseButton = viewChild<ElementRef<HTMLButtonElement>>('modalCloseButton');
  private readonly moneyFormatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
  private readonly dateFormatter = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  private lastFocusedElement: HTMLElement | null = null;

  readonly accounts = signal<CustomerAccount[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly sales = signal<Sale[]>([]);
  readonly movements = signal<CustomerAccountMovement[]>([]);
  readonly cargando = signal(false);
  readonly cargandoCatalogos = signal(false);
  readonly cargandoMovimientos = signal(false);
  readonly guardando = signal(false);
  readonly mostrandoFormulario = signal(false);
  readonly modalMode = signal<AccountModalMode>('create');
  readonly selectedAccount = signal<CustomerAccount | null>(null);
  readonly mensajeError = signal('');
  readonly mensajeFormulario = signal('');

  readonly filterForm = this.fb.nonNullable.group({ search: [''], creditActive: [''], withBalance: [''] });
  readonly movementFilterForm = this.fb.nonNullable.group({ movementType: [''], fromDate: [''], toDate: [''] });
  readonly accountForm = this.fb.nonNullable.group({ customerId: ['', [Validators.required]], creditLimit: [0, [Validators.required, Validators.min(0)]], creditActive: [true] });
  readonly movementForm = this.fb.nonNullable.group({ saleId: [''], amount: [0, [Validators.required, Validators.min(0.01)]], notes: ['', [Validators.maxLength(500)]] });

  ngOnInit(): void {
    this.listenSearchChanges();
    this.loadCustomers();
    this.loadSalesCatalog();
    this.loadAccounts();
  }

  ngOnDestroy(): void { this.setModalState(false); }

  loadAccounts(): void {
    this.cargando.set(true);
    this.mensajeError.set('');
    this.accountsService.getAll(this.buildFilters()).pipe(finalize(() => this.cargando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          const message = response.message || 'No se pudieron cargar las cuentas.';
          this.accounts.set([]);
          this.mensajeError.set(message);
          this.notifications.error(message);
          return;
        }
        this.accounts.set(response.data ?? []);
      },
      error: () => {
        const message = 'No se pudieron cargar las cuentas.';
        this.accounts.set([]);
        this.mensajeError.set(message);
        this.notifications.error(message);
      },
    });
  }

  buscar(): void { this.loadAccounts(); }

  limpiarFiltros(): void {
    this.filterForm.reset({ search: '', creditActive: '', withBalance: '' }, { emitEvent: false });
    this.loadAccounts();
  }

  nuevaCuenta(): void {
    this.recordFocusedElement();
    this.accountForm.reset({ customerId: '', creditLimit: 0, creditActive: true });
    this.openModal('create', null);
  }

  editarCuenta(account: CustomerAccount): void {
    this.recordFocusedElement();
    this.accountForm.reset({ customerId: account.customerId ? String(account.customerId) : '', creditLimit: account.creditLimit ?? 0, creditActive: account.creditActive ?? false });
    this.openModal('edit', account);
  }

  eliminarCuenta(account: CustomerAccount): void { this.recordFocusedElement(); this.openModal('delete', account); }
  cargarCargo(account: CustomerAccount): void { this.openMovementModal(account, 'charge'); }
  cargarPago(account: CustomerAccount): void { this.openMovementModal(account, 'payment'); }

  verMovimientos(account: CustomerAccount): void {
    this.recordFocusedElement();
    this.movements.set([]);
    this.movementFilterForm.reset({ movementType: '', fromDate: '', toDate: '' });
    this.openModal('movements', account);
    this.loadMovements();
  }

  filtrarMovimientos(): void { this.loadMovements(); }

  guardarCuenta(): void {
    this.mensajeFormulario.set('');
    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();
      this.mensajeFormulario.set('Revisa los campos obligatorios de la cuenta.');
      return;
    }
    const id = this.getAccountId(this.selectedAccount());
    const formValue = this.accountForm.getRawValue();
    const request = { customerId: this.parseRequiredNumber(formValue.customerId), creditLimit: this.parseRequiredNumber(formValue.creditLimit), creditActive: formValue.creditActive };
    const saveRequest = this.modalMode() === 'edit' && id !== null ? this.accountsService.update(id, request) : this.accountsService.create(request);
    this.guardando.set(true);
    saveRequest.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          const message = this.getResponseMessage(response.message, response.errors, 'No se pudo guardar la cuenta.');
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
          return;
        }
        this.cerrarModal();
        this.notifications.success(response.message || 'Cuenta guardada correctamente.');
        this.loadAccounts();
      },
      error: () => {
        const message = 'No se pudo guardar la cuenta.';
        this.mensajeFormulario.set(message);
        this.notifications.error(message, { title: 'No se pudo guardar' });
      },
    });
  }

  guardarMovimiento(): void {
    this.mensajeFormulario.set('');
    if (this.movementForm.invalid) {
      this.movementForm.markAllAsTouched();
      this.mensajeFormulario.set('Revisa el importe del movimiento.');
      return;
    }
    const id = this.getAccountId(this.selectedAccount());
    if (id === null) return;
    const formValue = this.movementForm.getRawValue();
    const request = { saleId: this.parseOptionalNumber(formValue.saleId), amount: this.parseRequiredNumber(formValue.amount), notes: this.cleanOptionalValue(formValue.notes) };
    const saveRequest = this.modalMode() === 'charge' ? this.accountsService.createCharge(id, request) : this.accountsService.createPayment(id, request);
    this.guardando.set(true);
    saveRequest.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          const message = this.getResponseMessage(response.message, response.errors, 'No se pudo registrar el movimiento.');
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
          return;
        }
        this.cerrarModal();
        this.notifications.success(response.message || 'Movimiento registrado correctamente.');
        this.loadAccounts();
      },
      error: () => {
        const message = 'No se pudo registrar el movimiento.';
        this.mensajeFormulario.set(message);
        this.notifications.error(message, { title: 'No se pudo guardar' });
      },
    });
  }

  confirmarEliminacion(): void {
    const id = this.getAccountId(this.selectedAccount());
    if (id === null) return;
    this.guardando.set(true);
    this.accountsService.remove(id).pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo eliminar la cuenta.'), { title: 'No se pudo eliminar' });
          return;
        }
        this.cerrarModal();
        this.notifications.success(response.message || 'Cuenta eliminada correctamente.');
        this.loadAccounts();
      },
      error: () => this.notifications.error('No se pudo eliminar la cuenta.', { title: 'No se pudo eliminar' }),
    });
  }

  cerrarModal(): void {
    this.mostrandoFormulario.set(false);
    this.mensajeFormulario.set('');
    this.selectedAccount.set(null);
    this.movements.set([]);
    this.setModalState(false);
    this.restoreFocus();
  }

  cerrarModalConEscape(): void { if (this.mostrandoFormulario() && !this.guardando()) this.cerrarModal(); }
  cerrarModalDesdeBackdrop(event: MouseEvent): void { if (event.target === event.currentTarget && !this.guardando()) this.cerrarModal(); }

  modalTitle(): string {
    switch (this.modalMode()) {
      case 'edit': return 'Editar cuenta';
      case 'delete': return 'Eliminar cuenta';
      case 'charge': return 'Registrar cargo';
      case 'payment': return 'Registrar pago';
      case 'movements': return 'Movimientos de cuenta';
      case 'create': return 'Nueva cuenta';
    }
  }

  trackAccount(index: number, account: CustomerAccount): number | string { return account.id ?? account.customerAccountId ?? account.customerId ?? index; }
  trackCustomer(index: number, customer: Customer): number | string { return this.getCustomerId(customer) ?? customer.name ?? index; }
  trackSale(index: number, sale: Sale): number | string { return sale.id ?? sale.saleId ?? sale.folio ?? index; }
  trackMovement(index: number, movement: CustomerAccountMovement): number | string { return movement.id ?? movement.customerAccountMovementId ?? movement.createdAt ?? index; }
  getCustomerId(customer: Customer | null): number | null { return customer?.id ?? customer?.customerId ?? null; }
  getSaleId(sale: Sale | null): number | null { return sale?.id ?? sale?.saleId ?? null; }
  customerName(account: CustomerAccount): string { return account.customerName || this.customers().find((customer) => this.getCustomerId(customer) === account.customerId)?.name || '-'; }
  saleLabel(sale: Sale): string { return `${sale.folio || 'Venta'} - ${this.formatMoney(sale.total)}`; }
  formatMoney(value: number | null | undefined): string { return value === null || value === undefined ? '-' : this.moneyFormatter.format(value); }
  formatDate(value: string | null | undefined): string { if (!value) return '-'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '-' : this.dateFormatter.format(date); }
  campoCuentaInvalido(controlName: string): boolean { const control = this.accountForm.get(controlName); return Boolean(control?.invalid && (control.dirty || control.touched)); }
  campoMovimientoInvalido(controlName: string): boolean { const control = this.movementForm.get(controlName); return Boolean(control?.invalid && (control.dirty || control.touched)); }

  private loadCustomers(): void {
    this.cargandoCatalogos.set(true);
    this.customersService.getAll({ active: true }).pipe(finalize(() => this.cargandoCatalogos.set(false))).subscribe({
      next: (response) => this.customers.set(response.success ? response.data ?? [] : []),
      error: () => this.customers.set([]),
    });
  }

  private loadSalesCatalog(): void {
    this.salesService.getAll({ isCredit: true }).subscribe({
      next: (response) => this.sales.set(response.success ? response.data ?? [] : []),
      error: () => this.sales.set([]),
    });
  }

  private loadMovements(): void {
    const id = this.getAccountId(this.selectedAccount());
    if (id === null) return;
    const formValue = this.movementFilterForm.getRawValue();
    this.cargandoMovimientos.set(true);
    this.accountsService.getMovements(id, { movementType: formValue.movementType.trim() || undefined, fromDate: this.toDateTime(formValue.fromDate, false), toDate: this.toDateTime(formValue.toDate, true) }).pipe(finalize(() => this.cargandoMovimientos.set(false))).subscribe({
      next: (response) => this.movements.set(response.success ? response.data ?? [] : []),
      error: () => this.movements.set([]),
    });
  }

  private openMovementModal(account: CustomerAccount, mode: 'charge' | 'payment'): void {
    this.recordFocusedElement();
    this.movementForm.reset({ saleId: '', amount: 0, notes: '' });
    this.openModal(mode, account);
  }

  private openModal(mode: AccountModalMode, account: CustomerAccount | null): void {
    this.modalMode.set(mode);
    this.selectedAccount.set(account);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.modalCloseButton()?.nativeElement.focus());
  }

  private buildFilters(): CustomerAccountFilters {
    const value = this.filterForm.getRawValue();
    return { search: value.search.trim() || undefined, creditActive: value.creditActive === '' ? undefined : value.creditActive === 'true', withBalance: value.withBalance === '' ? undefined : value.withBalance === 'true' };
  }

  private listenSearchChanges(): void { this.filterForm.controls.search.valueChanges.pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadAccounts()); }
  private getAccountId(account: CustomerAccount | null): number | null { return account?.id ?? account?.customerAccountId ?? null; }
  private cleanOptionalValue(value: string): string | null { const trimmed = value.trim(); return trimmed || null; }
  private parseRequiredNumber(value: string | number): number { return this.parseOptionalNumber(value) ?? 0; }
  private parseOptionalNumber(value: string | number | null | undefined): number | null { if (value === null || value === undefined || value === '') return null; const numberValue = typeof value === 'number' ? value : Number(value); return Number.isFinite(numberValue) ? numberValue : null; }
  private toDateTime(value: string, endOfDay: boolean): string | undefined { return value ? `${value}T${endOfDay ? '23:59:59' : '00:00:00'}` : undefined; }
  private getResponseMessage(message: string, errors: string[] | null, fallback: string): string { return errors?.length ? errors.join(' ') : message || fallback; }
  private recordFocusedElement(): void { const active = this.document.activeElement; this.lastFocusedElement = active instanceof HTMLElement ? active : this.newAccountButton()?.nativeElement ?? null; }
  private restoreFocus(): void { setTimeout(() => { const target = this.lastFocusedElement ?? this.newAccountButton()?.nativeElement; target?.focus(); this.lastFocusedElement = null; }); }
  private setModalState(open: boolean): void { this.document.body.classList.toggle('modal-open', open); this.document.body.style.overflow = open ? 'hidden' : ''; }
}
