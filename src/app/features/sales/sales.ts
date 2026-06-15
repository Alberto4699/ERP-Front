import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize, forkJoin } from 'rxjs';

import { Branch } from '../../core/models/branch.model';
import { Customer } from '../../core/models/customer.model';
import { ProductListItem } from '../../core/models/product.model';
import { Sale, SaleCreateRequest, SaleDetail, SaleFilters } from '../../core/models/sale.model';
import { Warehouse } from '../../core/models/warehouse.model';
import { BranchesService } from '../../core/services/branches';
import { CustomersService } from '../../core/services/customers';
import { NotificationsService } from '../../core/services/notifications';
import { ProductsService } from '../../core/services/products';
import { SalesService } from '../../core/services/sales';
import { Session } from '../../core/services/session';
import { WarehousesService } from '../../core/services/warehouses';

type SaleModalMode = 'create' | 'view' | 'delete' | 'confirm' | 'cancel';

@Component({
  selector: 'app-sales',
  imports: [ReactiveFormsModule],
  templateUrl: './sales.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'cerrarModalConEscape()',
  },
})
export class Sales implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly salesService = inject(SalesService);
  private readonly customersService = inject(CustomersService);
  private readonly branchesService = inject(BranchesService);
  private readonly warehousesService = inject(WarehousesService);
  private readonly productsService = inject(ProductsService);
  private readonly session = inject(Session);
  private readonly notifications = inject(NotificationsService);
  private readonly newSaleButton = viewChild<ElementRef<HTMLButtonElement>>('newSaleButton');
  private readonly modalCloseButton = viewChild<ElementRef<HTMLButtonElement>>('modalCloseButton');
  private readonly dateFormatter = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  private readonly quantityFormatter = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });
  private readonly moneyFormatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
  private readonly percentFormatter = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
  private lastFocusedElement: HTMLElement | null = null;

  readonly sales = signal<Sale[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly warehouses = signal<Warehouse[]>([]);
  readonly products = signal<ProductListItem[]>([]);
  readonly cargando = signal(false);
  readonly cargandoCatalogos = signal(false);
  readonly cargandoDetalle = signal(false);
  readonly guardando = signal(false);
  readonly mostrandoFormulario = signal(false);
  readonly modalMode = signal<SaleModalMode>('create');
  readonly selectedSale = signal<Sale | null>(null);
  readonly mensajeError = signal('');
  readonly mensajeFormulario = signal('');

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    customerId: [''],
    branchId: [''],
    warehouseId: [''],
    salespersonUserId: [''],
    status: [''],
    paymentType: [''],
    isCredit: [''],
    fromDate: [''],
    toDate: [''],
  });

  readonly saleForm = this.fb.nonNullable.group({
    customerId: [''],
    branchId: ['', [Validators.required]],
    warehouseId: ['', [Validators.required]],
    folio: ['', [Validators.maxLength(50)]],
    saleDate: [''],
    paymentType: ['Contado', [Validators.required, Validators.maxLength(30)]],
    isCredit: [false],
    vatPercentage: [16, [Validators.required, Validators.min(0), Validators.max(100)]],
    notes: ['', [Validators.maxLength(500)]],
    details: this.fb.array([this.createDetailForm()]),
  });

  get saleDetails() {
    return this.saleForm.controls.details;
  }

  ngOnInit(): void {
    this.listenSearchChanges();
    this.loadCatalogs();
    this.loadSales();
  }

  ngOnDestroy(): void {
    this.setModalState(false);
  }

  loadSales(): void {
    this.cargando.set(true);
    this.mensajeError.set('');
    this.salesService.getAll(this.buildFilters()).pipe(finalize(() => this.cargando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          const message = response.message || 'No se pudieron cargar las ventas.';
          this.sales.set([]);
          this.mensajeError.set(message);
          this.notifications.error(message);
          return;
        }
        this.sales.set(response.data ?? []);
      },
      error: () => {
        const message = 'No se pudieron cargar las ventas.';
        this.sales.set([]);
        this.mensajeError.set(message);
        this.notifications.error(message);
      },
    });
  }

  buscar(): void {
    this.loadSales();
  }

  limpiarFiltros(): void {
    this.filterForm.reset({ search: '', customerId: '', branchId: '', warehouseId: '', salespersonUserId: '', status: '', paymentType: '', isCredit: '', fromDate: '', toDate: '' }, { emitEvent: false });
    this.loadSales();
  }

  nuevaVenta(): void {
    this.recordFocusedElement();
    this.resetSaleForm();
    this.modalMode.set('create');
    this.selectedSale.set(null);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.modalCloseButton()?.nativeElement.focus());
  }

  verVenta(sale: Sale): void {
    this.recordFocusedElement();
    this.modalMode.set('view');
    this.selectedSale.set(sale);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.modalCloseButton()?.nativeElement.focus());
    this.loadSaleDetail(sale);
  }

  eliminarVenta(sale: Sale): void { this.openActionModal(sale, 'delete'); }
  confirmarVenta(sale: Sale): void { this.openActionModal(sale, 'confirm'); }
  cancelarVenta(sale: Sale): void { this.openActionModal(sale, 'cancel'); }

  cerrarModal(): void {
    this.mostrandoFormulario.set(false);
    this.mensajeFormulario.set('');
    this.selectedSale.set(null);
    this.cargandoDetalle.set(false);
    this.modalMode.set('create');
    this.resetSaleForm();
    this.setModalState(false);
    this.restoreFocus();
  }

  cerrarModalConEscape(): void {
    if (!this.mostrandoFormulario() || this.guardando()) return;
    this.cerrarModal();
  }

  cerrarModalDesdeBackdrop(event: MouseEvent): void {
    if (event.target !== event.currentTarget || this.guardando()) return;
    this.cerrarModal();
  }

  guardarVenta(): void {
    this.mensajeFormulario.set('');
    if (this.saleForm.invalid) {
      this.saleForm.markAllAsTouched();
      this.mensajeFormulario.set('Revisa los campos obligatorios de la venta.');
      return;
    }
    const salespersonUserId = this.session.user()?.idUsuario ?? null;
    if (salespersonUserId === null) {
      this.mensajeFormulario.set('No se pudo identificar el vendedor de la venta.');
      return;
    }
    this.guardando.set(true);
    this.salesService.create(this.buildCreateRequest(salespersonUserId)).pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          const message = this.getResponseMessage(response.message, response.errors, 'No se pudo crear la venta.');
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
          return;
        }
        this.cerrarModal();
        this.notifications.success(response.message || 'Venta creada correctamente.');
        this.loadSales();
      },
      error: () => {
        const message = 'No se pudo crear la venta.';
        this.mensajeFormulario.set(message);
        this.notifications.error(message, { title: 'No se pudo guardar' });
      },
    });
  }

  confirmarEliminacion(): void {
    const id = this.getSaleId(this.selectedSale());
    if (id === null) {
      this.notifications.error('No se pudo identificar la venta.', { title: 'No se pudo eliminar' });
      return;
    }
    this.guardando.set(true);
    this.salesService.remove(id).pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo eliminar la venta.'), { title: 'No se pudo eliminar' });
          return;
        }
        this.cerrarModal();
        this.notifications.success(response.message || 'Venta eliminada correctamente.');
        this.loadSales();
      },
      error: () => this.notifications.error('No se pudo eliminar la venta.', { title: 'No se pudo eliminar' }),
    });
  }

  confirmarAccionEstado(): void {
    const id = this.getSaleId(this.selectedSale());
    if (id === null) {
      this.notifications.error('No se pudo identificar la venta.', { title: 'No se pudo actualizar' });
      return;
    }
    const confirming = this.modalMode() === 'confirm';
    const request = confirming ? this.salesService.confirm(id) : this.salesService.cancel(id);
    this.guardando.set(true);
    request.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo actualizar la venta.'), { title: 'No se pudo actualizar' });
          return;
        }
        this.cerrarModal();
        this.notifications.success(response.message || (confirming ? 'Venta confirmada correctamente.' : 'Venta cancelada correctamente.'));
        this.loadSales();
      },
      error: () => this.notifications.error('No se pudo actualizar la venta.', { title: 'No se pudo actualizar' }),
    });
  }

  agregarDetalle(): void { this.saleDetails.push(this.createDetailForm()); }

  eliminarDetalle(index: number): void {
    if (this.saleDetails.length === 1) {
      this.saleDetails.at(0).reset({ productId: '', quantity: 1, unitPrice: 0, vatPercentage: '' });
      return;
    }
    this.saleDetails.removeAt(index);
  }

  modalTitle(): string {
    switch (this.modalMode()) {
      case 'view': return 'Detalle de venta';
      case 'delete': return 'Eliminar venta';
      case 'confirm': return 'Confirmar venta';
      case 'cancel': return 'Cancelar venta';
      case 'create': return 'Nueva venta';
    }
  }

  trackSale(index: number, sale: Sale): number | string { return sale.id ?? sale.saleId ?? sale.folio ?? index; }
  trackCustomer(index: number, customer: Customer): number | string { return this.getCustomerId(customer) ?? customer.name ?? index; }
  trackBranch(index: number, branch: Branch): number | string { return this.getBranchId(branch) ?? branch.code ?? index; }
  trackWarehouse(index: number, warehouse: Warehouse): number | string { return this.getWarehouseId(warehouse) ?? warehouse.code ?? index; }
  trackProduct(index: number, product: ProductListItem): number | string { return product.id ?? product.code ?? index; }
  trackSaleDetail(index: number, detail: SaleDetail): number | string { return detail.id ?? detail.saleDetailId ?? detail.productId ?? index; }

  getCustomerId(customer: Customer | null): number | null { return customer?.id ?? customer?.customerId ?? null; }
  getBranchId(branch: Branch | null): number | null { return branch?.id ?? branch?.branchId ?? null; }
  getWarehouseId(warehouse: Warehouse | null): number | null { return warehouse?.id ?? warehouse?.warehouseId ?? null; }
  warehouseLabel(warehouse: Warehouse): string { return warehouse.branchName ? `${warehouse.name} - ${warehouse.branchName}` : warehouse.name; }
  productLabel(product: ProductListItem): string { return `${product.code} - ${product.name}`; }
  customerName(sale: Sale): string { return sale.customerName || this.findCustomer(sale.customerId)?.name || 'Mostrador'; }
  branchName(sale: Sale): string { return sale.branchName || this.findBranch(sale.branchId)?.name || '-'; }
  warehouseName(sale: Sale): string { return sale.warehouseName || this.findWarehouse(sale.warehouseId)?.name || '-'; }
  salespersonName(sale: Sale): string { return sale.salespersonUserName || (sale.salespersonUserId ? `Usuario ${sale.salespersonUserId}` : '-'); }
  productName(detail: SaleDetail): string { return detail.productName || this.findProduct(detail.productId)?.name || '-'; }
  productCode(detail: SaleDetail): string { return detail.productCode || this.findProduct(detail.productId)?.code || '-'; }

  saleDate(sale: Sale): string {
    const value = sale.saleDate ?? sale.createdAt;
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : this.dateFormatter.format(date);
  }

  statusText(sale: Sale): string { return sale.status || 'Pendiente'; }
  isConfirmed(sale: Sale): boolean { return ['confirmed', 'confirmado', 'confirmada'].includes(this.normalizedStatus(sale)); }
  isCancelled(sale: Sale): boolean { return ['cancelled', 'canceled', 'cancelado', 'cancelada'].includes(this.normalizedStatus(sale)); }
  canConfirm(sale: Sale): boolean { return !this.isConfirmed(sale) && !this.isCancelled(sale); }
  canCancel(sale: Sale): boolean { return !this.isConfirmed(sale) && !this.isCancelled(sale); }
  formatQuantity(value: number | null | undefined): string { return value === null || value === undefined ? '-' : this.quantityFormatter.format(value); }
  formatMoney(value: number | null | undefined): string { return value === null || value === undefined ? '-' : this.moneyFormatter.format(value); }
  formatVat(value: number | null | undefined): string { return value === null || value === undefined ? '-' : `${this.percentFormatter.format(value)}%`; }

  detailTotal(detail: SaleDetail, saleVatPercentage: number | undefined): number {
    const subtotal = detail.subtotal ?? (detail.quantity ?? 0) * (detail.unitPrice ?? 0);
    const vatPercentage = detail.vatPercentage ?? saleVatPercentage ?? 0;
    return detail.total ?? subtotal + (detail.vatAmount ?? subtotal * (vatPercentage / 100));
  }

  saleTotal(sale: Sale): string {
    if (sale.total !== undefined) return this.formatMoney(sale.total);
    return this.formatMoney((sale.details ?? []).reduce((sum, detail) => sum + this.detailTotal(detail, sale.vatPercentage), 0));
  }

  campoInvalido(controlName: string): boolean {
    const control = this.saleForm.get(controlName);
    return Boolean(control?.invalid && (control.dirty || control.touched));
  }

  detalleCampoInvalido(index: number, controlName: string): boolean {
    const control = this.saleDetails.at(index).get(controlName);
    return Boolean(control?.invalid && (control.dirty || control.touched));
  }

  private loadCatalogs(): void {
    this.cargandoCatalogos.set(true);
    forkJoin({
      customers: this.customersService.getAll({ active: true }),
      branches: this.branchesService.getAll({ active: true }),
      warehouses: this.warehousesService.getAll({ active: true }),
      products: this.productsService.getAll({ active: true, tracksInventory: true }),
    }).pipe(finalize(() => this.cargandoCatalogos.set(false))).subscribe({
      next: ({ customers, branches, warehouses, products }) => {
        this.customers.set(customers.success ? customers.data ?? [] : []);
        this.branches.set(branches.success ? branches.data ?? [] : []);
        this.warehouses.set(warehouses.success ? warehouses.data ?? [] : []);
        this.products.set(products.success ? products.data ?? [] : []);
        if (!customers.success || !branches.success || !warehouses.success || !products.success) this.notifications.error('No se pudieron cargar todos los catálogos de ventas.');
      },
      error: () => {
        this.customers.set([]);
        this.branches.set([]);
        this.warehouses.set([]);
        this.products.set([]);
        this.notifications.error('No se pudieron cargar los catálogos de ventas.');
      },
    });
  }

  private loadSaleDetail(sale: Sale): void {
    const id = this.getSaleId(sale);
    if (id === null) return;
    this.cargandoDetalle.set(true);
    this.salesService.getById(id).pipe(finalize(() => this.cargandoDetalle.set(false))).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.notifications.error(response.message || 'No se pudo cargar el detalle de la venta.');
          return;
        }
        this.selectedSale.set(response.data);
      },
      error: () => this.notifications.error('No se pudo cargar el detalle de la venta.'),
    });
  }

  private openActionModal(sale: Sale, mode: SaleModalMode): void {
    this.recordFocusedElement();
    this.modalMode.set(mode);
    this.selectedSale.set(sale);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.modalCloseButton()?.nativeElement.focus());
  }

  private buildFilters(): SaleFilters {
    const value = this.filterForm.getRawValue();
    return {
      search: value.search.trim() || undefined,
      customerId: this.parseOptionalNumber(value.customerId) ?? undefined,
      branchId: this.parseOptionalNumber(value.branchId) ?? undefined,
      warehouseId: this.parseOptionalNumber(value.warehouseId) ?? undefined,
      salespersonUserId: this.parseOptionalNumber(value.salespersonUserId) ?? undefined,
      status: value.status.trim() || undefined,
      paymentType: value.paymentType.trim() || undefined,
      isCredit: value.isCredit === '' ? undefined : value.isCredit === 'true',
      fromDate: this.toDateTime(value.fromDate, false),
      toDate: this.toDateTime(value.toDate, true),
    };
  }

  private buildCreateRequest(salespersonUserId: number): SaleCreateRequest {
    const value = this.saleForm.getRawValue();
    return {
      customerId: this.parseOptionalNumber(value.customerId),
      branchId: this.parseRequiredNumber(value.branchId),
      warehouseId: this.parseRequiredNumber(value.warehouseId),
      salespersonUserId,
      folio: this.cleanOptionalValue(value.folio),
      saleDate: value.saleDate || null,
      paymentType: value.paymentType.trim(),
      isCredit: value.isCredit,
      vatPercentage: this.parseRequiredNumber(value.vatPercentage),
      notes: this.cleanOptionalValue(value.notes),
      details: value.details.map((detail) => ({
        productId: this.parseRequiredNumber(detail.productId),
        quantity: this.parseRequiredNumber(detail.quantity),
        unitPrice: this.parseRequiredNumber(detail.unitPrice),
        vatPercentage: this.parseOptionalNumber(detail.vatPercentage),
      })),
    };
  }

  private listenSearchChanges(): void {
    this.filterForm.controls.search.valueChanges.pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadSales());
  }

  private resetSaleForm(): void {
    this.saleForm.reset({ customerId: '', branchId: '', warehouseId: '', folio: '', saleDate: '', paymentType: 'Contado', isCredit: false, vatPercentage: 16, notes: '' });
    this.saleDetails.clear();
    this.saleDetails.push(this.createDetailForm());
  }

  private createDetailForm() {
    return this.fb.nonNullable.group({
      productId: ['', [Validators.required]],
      quantity: [1, [Validators.required, Validators.min(0.0001)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      vatPercentage: ['', [Validators.min(0), Validators.max(100)]],
    });
  }

  private getSaleId(sale: Sale | null): number | null { return sale?.id ?? sale?.saleId ?? null; }
  private normalizedStatus(sale: Sale): string { return (sale.status || '').trim().toLowerCase(); }
  private cleanOptionalValue(value: string): string | null { const trimmed = value.trim(); return trimmed || null; }
  private parseRequiredNumber(value: string | number): number { return this.parseOptionalNumber(value) ?? 0; }
  private parseOptionalNumber(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numberValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }
  private toDateTime(value: string, endOfDay: boolean): string | undefined { return value ? `${value}T${endOfDay ? '23:59:59' : '00:00:00'}` : undefined; }
  private findCustomer(id: number | null | undefined): Customer | null { return id == null ? null : this.customers().find((customer) => this.getCustomerId(customer) === id) ?? null; }
  private findBranch(id: number | undefined): Branch | null { return id === undefined ? null : this.branches().find((branch) => this.getBranchId(branch) === id) ?? null; }
  private findWarehouse(id: number | undefined): Warehouse | null { return id === undefined ? null : this.warehouses().find((warehouse) => this.getWarehouseId(warehouse) === id) ?? null; }
  private findProduct(id: number | undefined): ProductListItem | null { return id === undefined ? null : this.products().find((product) => product.id === id) ?? null; }
  private getResponseMessage(message: string, errors: string[] | null, fallback: string): string { return errors?.length ? errors.join(' ') : message || fallback; }
  private recordFocusedElement(): void { const active = this.document.activeElement; this.lastFocusedElement = active instanceof HTMLElement ? active : this.newSaleButton()?.nativeElement ?? null; }
  private restoreFocus(): void { setTimeout(() => { const target = this.lastFocusedElement ?? this.newSaleButton()?.nativeElement; target?.focus(); this.lastFocusedElement = null; }); }
  private setModalState(open: boolean): void { this.document.body.classList.toggle('modal-open', open); this.document.body.style.overflow = open ? 'hidden' : ''; }
}
