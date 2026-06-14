import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { Customer, CustomerFilters, CustomerSaveRequest } from '../../core/models/customer.model';
import { CustomersService } from '../../core/services/customers';
import { NotificationsService } from '../../core/services/notifications';

type CustomerModalMode = 'create' | 'view' | 'edit' | 'delete' | 'activate' | 'deactivate';

@Component({
  selector: 'app-customers',
  imports: [ReactiveFormsModule],
  templateUrl: './customers.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'cerrarModalConEscape()',
  },
})
export class Customers implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly customersService = inject(CustomersService);
  private readonly notifications = inject(NotificationsService);
  private readonly customerNameInput = viewChild<ElementRef<HTMLInputElement>>('customerNameInput');
  private readonly newCustomerButton = viewChild<ElementRef<HTMLButtonElement>>('newCustomerButton');
  private readonly moneyFormatter = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  });
  private lastFocusedElement: HTMLElement | null = null;

  readonly customers = signal<Customer[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly mostrandoFormulario = signal(false);
  readonly modalMode = signal<CustomerModalMode>('create');
  readonly selectedCustomer = signal<Customer | null>(null);
  readonly mensajeError = signal('');
  readonly mensajeFormulario = signal('');

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    customerType: [''],
    creditActive: [''],
    active: [''],
  });

  readonly customerForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200), Validators.pattern(/\S/)]],
    rfc: ['', [Validators.maxLength(20)]],
    phone: ['', [Validators.maxLength(20)]],
    email: ['', [Validators.email, Validators.maxLength(150)]],
    address: ['', [Validators.maxLength(255)]],
    city: ['', [Validators.maxLength(100)]],
    status: ['', [Validators.maxLength(100)]],
    postalCode: ['', [Validators.maxLength(10)]],
    customerType: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(/\S/)]],
    creditLimit: [0, [Validators.min(0)]],
    creditActive: [false],
  });

  ngOnInit(): void {
    this.listenSearchChanges();
    this.loadCustomers();
  }

  ngOnDestroy(): void {
    this.setModalState(false);
  }

  loadCustomers(): void {
    this.cargando.set(true);
    this.mensajeError.set('');

    this.customersService
      .getAll(this.buildFilters())
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = response.message || 'No se pudieron cargar los clientes.';
            this.customers.set([]);
            this.mensajeError.set(message);
            this.notifications.error(message);
            return;
          }

          this.customers.set(response.data ?? []);
        },
        error: () => {
          const message = 'No se pudieron cargar los clientes.';
          this.customers.set([]);
          this.mensajeError.set(message);
          this.notifications.error(message);
        },
      });
  }

  buscar(): void {
    this.loadCustomers();
  }

  limpiarFiltros(): void {
    this.filterForm.reset(
      {
        search: '',
        customerType: '',
        creditActive: '',
        active: '',
      },
      { emitEvent: false }
    );
    this.loadCustomers();
  }

  nuevoCliente(): void {
    this.recordFocusedElement();
    this.resetCustomerForm();
    this.modalMode.set('create');
    this.selectedCustomer.set(null);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.customerNameInput()?.nativeElement.focus());
  }

  cerrarModal(): void {
    this.mostrandoFormulario.set(false);
    this.mensajeFormulario.set('');
    this.resetCustomerForm();
    this.selectedCustomer.set(null);
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

  guardarCliente(): void {
    this.mensajeFormulario.set('');

    if (this.customerForm.invalid) {
      this.customerForm.markAllAsTouched();
      this.mensajeFormulario.set('Revisa los campos del cliente.');
      return;
    }

    const request = this.buildSaveRequest();

    if (this.modalMode() === 'edit') {
      this.actualizarCliente(request);
      return;
    }

    this.guardando.set(true);
    this.customersService
      .create(request)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = this.getResponseMessage(response.message, response.errors, 'No se pudo crear el cliente.');
            this.mensajeFormulario.set(message);
            this.notifications.error(message, { title: 'No se pudo guardar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Cliente creado correctamente.');
          this.loadCustomers();
        },
        error: () => {
          const message = 'No se pudo crear el cliente.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  verCliente(customer: Customer): void {
    this.recordFocusedElement();
    this.modalMode.set('view');
    this.selectedCustomer.set(customer);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
  }

  editarCliente(customer: Customer): void {
    this.recordFocusedElement();
    this.modalMode.set('edit');
    this.selectedCustomer.set(customer);
    this.mensajeFormulario.set('');
    this.customerForm.reset({
      name: customer.name,
      rfc: customer.rfc ?? '',
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      address: customer.address ?? '',
      city: customer.city ?? '',
      status: customer.status ?? '',
      postalCode: customer.postalCode ?? '',
      customerType: customer.customerType,
      creditLimit: customer.creditLimit ?? 0,
      creditActive: customer.creditActive === true,
    });
    this.mostrandoFormulario.set(true);
    this.setModalState(true);
    setTimeout(() => this.customerNameInput()?.nativeElement.focus());
  }

  eliminarCliente(customer: Customer): void {
    this.recordFocusedElement();
    this.modalMode.set('delete');
    this.selectedCustomer.set(customer);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
  }

  cambiarEstadoCliente(customer: Customer): void {
    this.recordFocusedElement();
    this.modalMode.set(this.isActive(customer) ? 'deactivate' : 'activate');
    this.selectedCustomer.set(customer);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
  }

  confirmarEliminacion(): void {
    const customer = this.selectedCustomer();
    const id = this.getCustomerId(customer);

    if (id === null) {
      this.notifications.error('No se pudo identificar el cliente.', { title: 'No se pudo eliminar' });
      return;
    }

    this.guardando.set(true);
    this.customersService
      .remove(id)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo eliminar el cliente.'), { title: 'No se pudo eliminar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Cliente eliminado correctamente.');
          this.loadCustomers();
        },
        error: () => {
          this.notifications.error('No se pudo eliminar el cliente.', { title: 'No se pudo eliminar' });
        },
      });
  }

  confirmarCambioEstado(): void {
    const customer = this.selectedCustomer();
    const id = this.getCustomerId(customer);
    const activating = this.modalMode() === 'activate';

    if (id === null) {
      this.notifications.error('No se pudo identificar el cliente.', { title: 'No se pudo actualizar' });
      return;
    }

    this.guardando.set(true);
    const request = activating ? this.customersService.activate(id) : this.customersService.deactivate(id);

    request.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo actualizar el cliente.'), { title: 'No se pudo actualizar' });
          return;
        }

        this.cerrarModal();
        this.notifications.success(response.message || (activating ? 'Cliente activado correctamente.' : 'Cliente desactivado correctamente.'));
        this.loadCustomers();
      },
      error: () => {
        this.notifications.error('No se pudo actualizar el cliente.', { title: 'No se pudo actualizar' });
      },
    });
  }

  modalTitle(): string {
    switch (this.modalMode()) {
      case 'view':
        return 'Detalle de cliente';
      case 'edit':
        return 'Editar cliente';
      case 'delete':
        return 'Eliminar cliente';
      case 'activate':
        return 'Activar cliente';
      case 'deactivate':
        return 'Desactivar cliente';
      case 'create':
        return 'Nuevo cliente';
    }
  }

  trackCustomer(index: number, customer: Customer): number | string {
    return customer.id ?? customer.customerId ?? customer.name ?? index;
  }

  isActive(customer: Customer): boolean {
    return customer.active !== false;
  }

  hasCredit(customer: Customer): boolean {
    return customer.creditActive === true;
  }

  campoInvalido(controlName: string): boolean {
    const control = this.customerForm.get(controlName);
    return Boolean(control?.invalid && (control.dirty || control.touched));
  }

  formatCurrency(value: number | null | undefined): string {
    return this.moneyFormatter.format(value ?? 0);
  }

  private buildFilters(): CustomerFilters {
    const formValue = this.filterForm.getRawValue();
    const search = formValue.search.trim();
    const customerType = formValue.customerType.trim();

    return {
      search: search || undefined,
      customerType: customerType || undefined,
      creditActive: formValue.creditActive === '' ? undefined : formValue.creditActive === 'true',
      active: formValue.active === '' ? undefined : formValue.active === 'true',
    };
  }

  private listenSearchChanges(): void {
    this.filterForm.controls.search.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadCustomers());
  }

  private buildSaveRequest(): CustomerSaveRequest {
    const formValue = this.customerForm.getRawValue();

    return {
      userId: this.selectedCustomer()?.userId ?? null,
      name: formValue.name.trim(),
      rfc: this.cleanOptionalValue(formValue.rfc),
      phone: this.cleanOptionalValue(formValue.phone),
      email: this.cleanOptionalValue(formValue.email),
      address: this.cleanOptionalValue(formValue.address),
      city: this.cleanOptionalValue(formValue.city),
      status: this.cleanOptionalValue(formValue.status),
      postalCode: this.cleanOptionalValue(formValue.postalCode),
      customerType: formValue.customerType.trim(),
      creditLimit: this.parseNumber(formValue.creditLimit),
      creditActive: formValue.creditActive,
    };
  }

  private actualizarCliente(request: CustomerSaveRequest): void {
    const id = this.getCustomerId(this.selectedCustomer());

    if (id === null) {
      this.notifications.error('No se pudo identificar el cliente.', { title: 'No se pudo guardar' });
      return;
    }

    this.guardando.set(true);
    this.customersService
      .update(id, request)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = this.getResponseMessage(response.message, response.errors, 'No se pudo actualizar el cliente.');
            this.mensajeFormulario.set(message);
            this.notifications.error(message, { title: 'No se pudo guardar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Cliente actualizado correctamente.');
          this.loadCustomers();
        },
        error: () => {
          const message = 'No se pudo actualizar el cliente.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  private resetCustomerForm(): void {
    this.customerForm.reset({
      name: '',
      rfc: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      status: '',
      postalCode: '',
      customerType: '',
      creditLimit: 0,
      creditActive: false,
    });
  }

  private cleanOptionalValue(value: string): string | null {
    const trimmedValue = value.trim();
    return trimmedValue || null;
  }

  private parseNumber(value: string | number): number {
    const numberValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private getCustomerId(customer: Customer | null): number | null {
    return customer?.id ?? customer?.customerId ?? null;
  }

  private getResponseMessage(message: string, errors: string[] | null, fallback: string): string {
    return errors?.length ? errors.join(' ') : message || fallback;
  }

  private recordFocusedElement(): void {
    const activeElement = this.document.activeElement;
    this.lastFocusedElement = activeElement instanceof HTMLElement ? activeElement : this.newCustomerButton()?.nativeElement ?? null;
  }

  private restoreFocus(): void {
    setTimeout(() => {
      const target = this.lastFocusedElement ?? this.newCustomerButton()?.nativeElement;
      target?.focus();
      this.lastFocusedElement = null;
    });
  }

  private setModalState(open: boolean): void {
    this.document.body.classList.toggle('modal-open', open);
    this.document.body.style.overflow = open ? 'hidden' : '';
  }
}
