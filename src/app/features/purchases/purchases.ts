import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize, forkJoin } from 'rxjs';

import { Branch } from '../../core/models/branch.model';
import { ProductListItem } from '../../core/models/product.model';
import { Purchase, PurchaseCreateRequest, PurchaseDetail, PurchaseFilters } from '../../core/models/purchase.model';
import { Supplier } from '../../core/models/supplier.model';
import { Warehouse } from '../../core/models/warehouse.model';
import { BranchesService } from '../../core/services/branches';
import { NotificationsService } from '../../core/services/notifications';
import { ProductsService } from '../../core/services/products';
import { PurchasesService } from '../../core/services/purchases';
import { SuppliersService } from '../../core/services/suppliers';
import { WarehousesService } from '../../core/services/warehouses';

type PurchaseModalMode = 'create' | 'view' | 'delete' | 'confirm' | 'cancel';

@Component({
  selector: 'app-purchases',
  imports: [ReactiveFormsModule],
  templateUrl: './purchases.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'cerrarModalConEscape()',
  },
})
export class Purchases implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly purchasesService = inject(PurchasesService);
  private readonly suppliersService = inject(SuppliersService);
  private readonly branchesService = inject(BranchesService);
  private readonly warehousesService = inject(WarehousesService);
  private readonly productsService = inject(ProductsService);
  private readonly notifications = inject(NotificationsService);
  private readonly newPurchaseButton = viewChild<ElementRef<HTMLButtonElement>>('newPurchaseButton');
  private readonly modalCloseButton = viewChild<ElementRef<HTMLButtonElement>>('modalCloseButton');
  private readonly dateFormatter = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  private readonly quantityFormatter = new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 4,
  });
  private readonly moneyFormatter = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  });
  private readonly percentFormatter = new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 2,
  });
  private lastFocusedElement: HTMLElement | null = null;

  readonly purchases = signal<Purchase[]>([]);
  readonly suppliers = signal<Supplier[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly warehouses = signal<Warehouse[]>([]);
  readonly products = signal<ProductListItem[]>([]);
  readonly cargando = signal(false);
  readonly cargandoCatalogos = signal(false);
  readonly cargandoDetalle = signal(false);
  readonly guardando = signal(false);
  readonly mostrandoFormulario = signal(false);
  readonly modalMode = signal<PurchaseModalMode>('create');
  readonly selectedPurchase = signal<Purchase | null>(null);
  readonly mensajeError = signal('');
  readonly mensajeFormulario = signal('');

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    supplierId: [''],
    branchId: [''],
    warehouseId: [''],
    status: [''],
    fromDate: [''],
    toDate: [''],
  });

  readonly purchaseForm = this.fb.nonNullable.group({
    supplierId: ['', [Validators.required]],
    branchId: ['', [Validators.required]],
    warehouseId: ['', [Validators.required]],
    folio: ['', [Validators.maxLength(50)]],
    purchaseDate: [''],
    vatPercentage: [16, [Validators.required, Validators.min(0), Validators.max(100)]],
    notes: ['', [Validators.maxLength(500)]],
    details: this.fb.array([this.createDetailForm()]),
  });

  get purchaseDetails() {
    return this.purchaseForm.controls.details;
  }

  ngOnInit(): void {
    this.listenSearchChanges();
    this.loadCatalogs();
    this.loadPurchases();
  }

  ngOnDestroy(): void {
    this.setModalState(false);
  }

  loadPurchases(): void {
    this.cargando.set(true);
    this.mensajeError.set('');

    this.purchasesService
      .getAll(this.buildFilters())
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = response.message || 'No se pudieron cargar las compras.';
            this.purchases.set([]);
            this.mensajeError.set(message);
            this.notifications.error(message);
            return;
          }

          this.purchases.set(response.data ?? []);
        },
        error: () => {
          const message = 'No se pudieron cargar las compras.';
          this.purchases.set([]);
          this.mensajeError.set(message);
          this.notifications.error(message);
        },
      });
  }

  buscar(): void {
    this.loadPurchases();
  }

  limpiarFiltros(): void {
    this.filterForm.reset(
      {
        search: '',
        supplierId: '',
        branchId: '',
        warehouseId: '',
        status: '',
        fromDate: '',
        toDate: '',
      },
      { emitEvent: false }
    );
    this.loadPurchases();
  }

  nuevaCompra(): void {
    this.recordFocusedElement();
    this.resetPurchaseForm();
    this.modalMode.set('create');
    this.selectedPurchase.set(null);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.modalCloseButton()?.nativeElement.focus());
  }

  verCompra(purchase: Purchase): void {
    this.recordFocusedElement();
    this.modalMode.set('view');
    this.selectedPurchase.set(purchase);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.modalCloseButton()?.nativeElement.focus());
    this.loadPurchaseDetail(purchase);
  }

  eliminarCompra(purchase: Purchase): void {
    this.openActionModal(purchase, 'delete');
  }

  confirmarCompra(purchase: Purchase): void {
    this.openActionModal(purchase, 'confirm');
  }

  cancelarCompra(purchase: Purchase): void {
    this.openActionModal(purchase, 'cancel');
  }

  cerrarModal(): void {
    this.mostrandoFormulario.set(false);
    this.mensajeFormulario.set('');
    this.selectedPurchase.set(null);
    this.cargandoDetalle.set(false);
    this.modalMode.set('create');
    this.resetPurchaseForm();
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

  guardarCompra(): void {
    this.mensajeFormulario.set('');

    if (this.purchaseForm.invalid) {
      this.purchaseForm.markAllAsTouched();
      this.mensajeFormulario.set('Revisa los campos obligatorios de la compra.');
      return;
    }

    this.guardando.set(true);
    this.purchasesService
      .create(this.buildCreateRequest())
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = this.getResponseMessage(response.message, response.errors, 'No se pudo crear la compra.');
            this.mensajeFormulario.set(message);
            this.notifications.error(message, { title: 'No se pudo guardar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Compra creada correctamente.');
          this.loadPurchases();
        },
        error: () => {
          const message = 'No se pudo crear la compra.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  confirmarEliminacion(): void {
    const id = this.getPurchaseId(this.selectedPurchase());

    if (id === null) {
      this.notifications.error('No se pudo identificar la compra.', { title: 'No se pudo eliminar' });
      return;
    }

    this.guardando.set(true);
    this.purchasesService
      .remove(id)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo eliminar la compra.'), { title: 'No se pudo eliminar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Compra eliminada correctamente.');
          this.loadPurchases();
        },
        error: () => {
          this.notifications.error('No se pudo eliminar la compra.', { title: 'No se pudo eliminar' });
        },
      });
  }

  confirmarAccionEstado(): void {
    const id = this.getPurchaseId(this.selectedPurchase());
    const confirming = this.modalMode() === 'confirm';

    if (id === null) {
      this.notifications.error('No se pudo identificar la compra.', { title: 'No se pudo actualizar' });
      return;
    }

    this.guardando.set(true);
    const request = confirming ? this.purchasesService.confirm(id) : this.purchasesService.cancel(id);

    request.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo actualizar la compra.'), { title: 'No se pudo actualizar' });
          return;
        }

        this.cerrarModal();
        this.notifications.success(response.message || (confirming ? 'Compra confirmada correctamente.' : 'Compra cancelada correctamente.'));
        this.loadPurchases();
      },
      error: () => {
        this.notifications.error('No se pudo actualizar la compra.', { title: 'No se pudo actualizar' });
      },
    });
  }

  agregarDetalle(): void {
    this.purchaseDetails.push(this.createDetailForm());
  }

  eliminarDetalle(index: number): void {
    if (this.purchaseDetails.length === 1) {
      this.purchaseDetails.at(0).reset({
        productId: '',
        quantity: 1,
        unitPrice: 0,
        vatPercentage: '',
      });
      return;
    }

    this.purchaseDetails.removeAt(index);
  }

  modalTitle(): string {
    switch (this.modalMode()) {
      case 'view':
        return 'Detalle de compra';
      case 'delete':
        return 'Eliminar compra';
      case 'confirm':
        return 'Confirmar compra';
      case 'cancel':
        return 'Cancelar compra';
      case 'create':
        return 'Nueva compra';
    }
  }

  trackPurchase(index: number, purchase: Purchase): number | string {
    return purchase.id ?? purchase.purchaseId ?? purchase.folio ?? index;
  }

  trackSupplier(index: number, supplier: Supplier): number | string {
    return this.getSupplierId(supplier) ?? supplier.name ?? index;
  }

  trackBranch(index: number, branch: Branch): number | string {
    return this.getBranchId(branch) ?? branch.code ?? index;
  }

  trackWarehouse(index: number, warehouse: Warehouse): number | string {
    return this.getWarehouseId(warehouse) ?? warehouse.code ?? index;
  }

  trackProduct(index: number, product: ProductListItem): number | string {
    return product.id ?? product.code ?? index;
  }

  trackPurchaseDetail(index: number, detail: PurchaseDetail): number | string {
    return detail.id ?? detail.purchaseDetailId ?? detail.productId ?? index;
  }

  getSupplierId(supplier: Supplier | null): number | null {
    return supplier?.id ?? supplier?.supplierId ?? null;
  }

  getBranchId(branch: Branch | null): number | null {
    return branch?.id ?? branch?.branchId ?? null;
  }

  getWarehouseId(warehouse: Warehouse | null): number | null {
    return warehouse?.id ?? warehouse?.warehouseId ?? null;
  }

  warehouseLabel(warehouse: Warehouse): string {
    return warehouse.branchName ? `${warehouse.name} - ${warehouse.branchName}` : warehouse.name;
  }

  productLabel(product: ProductListItem): string {
    return `${product.code} - ${product.name}`;
  }

  supplierName(purchase: Purchase): string {
    const supplier = this.findSupplier(purchase.supplierId);
    return purchase.supplierName || supplier?.name || '-';
  }

  branchName(purchase: Purchase): string {
    const branch = this.findBranch(purchase.branchId);
    return purchase.branchName || branch?.name || '-';
  }

  warehouseName(purchase: Purchase): string {
    const warehouse = this.findWarehouse(purchase.warehouseId);
    return purchase.warehouseName || warehouse?.name || '-';
  }

  productName(detail: PurchaseDetail): string {
    const product = this.findProduct(detail.productId);
    return detail.productName || product?.name || '-';
  }

  productCode(detail: PurchaseDetail): string {
    const product = this.findProduct(detail.productId);
    return detail.productCode || product?.code || '-';
  }

  purchaseDate(purchase: Purchase): string {
    const dateValue = purchase.purchaseDate ?? purchase.createdAt;

    if (!dateValue) {
      return '-';
    }

    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? '-' : this.dateFormatter.format(date);
  }

  statusText(purchase: Purchase): string {
    return purchase.status || 'Pendiente';
  }

  isConfirmed(purchase: Purchase): boolean {
    return ['confirmed', 'confirmado', 'confirmada'].includes(this.normalizedStatus(purchase));
  }

  isCancelled(purchase: Purchase): boolean {
    return ['cancelled', 'canceled', 'cancelado', 'cancelada'].includes(this.normalizedStatus(purchase));
  }

  canConfirm(purchase: Purchase): boolean {
    return !this.isConfirmed(purchase) && !this.isCancelled(purchase);
  }

  canCancel(purchase: Purchase): boolean {
    return !this.isConfirmed(purchase) && !this.isCancelled(purchase);
  }

  formatQuantity(value: number | null | undefined): string {
    return value === null || value === undefined ? '-' : this.quantityFormatter.format(value);
  }

  formatMoney(value: number | null | undefined): string {
    return value === null || value === undefined ? '-' : this.moneyFormatter.format(value);
  }

  formatVat(value: number | null | undefined): string {
    return value === null || value === undefined ? '-' : `${this.percentFormatter.format(value)}%`;
  }

  detailTotal(detail: PurchaseDetail, purchaseVatPercentage: number | undefined): number {
    const subtotal = detail.subtotal ?? (detail.quantity ?? 0) * (detail.unitPrice ?? 0);
    const vatPercentage = detail.vatPercentage ?? purchaseVatPercentage ?? 0;
    const vatAmount = detail.vatAmount ?? subtotal * (vatPercentage / 100);
    return detail.total ?? subtotal + vatAmount;
  }

  purchaseTotal(purchase: Purchase): string {
    if (purchase.total !== undefined) {
      return this.formatMoney(purchase.total);
    }

    const total = (purchase.details ?? []).reduce((sum, detail) => sum + this.detailTotal(detail, purchase.vatPercentage), 0);
    return this.formatMoney(total);
  }

  campoInvalido(controlName: string): boolean {
    const control = this.purchaseForm.get(controlName);
    return Boolean(control?.invalid && (control.dirty || control.touched));
  }

  detalleCampoInvalido(index: number, controlName: string): boolean {
    const control = this.purchaseDetails.at(index).get(controlName);
    return Boolean(control?.invalid && (control.dirty || control.touched));
  }

  private loadCatalogs(): void {
    this.cargandoCatalogos.set(true);

    forkJoin({
      suppliers: this.suppliersService.getAll({ active: true }),
      branches: this.branchesService.getAll({ active: true }),
      warehouses: this.warehousesService.getAll({ active: true }),
      products: this.productsService.getAll({ active: true }),
    })
      .pipe(finalize(() => this.cargandoCatalogos.set(false)))
      .subscribe({
        next: ({ suppliers, branches, warehouses, products }) => {
          if (!suppliers.success) {
            this.suppliers.set([]);
            this.notifications.error(suppliers.message || 'No se pudieron cargar los proveedores.');
          } else {
            this.suppliers.set(suppliers.data ?? []);
          }

          if (!branches.success) {
            this.branches.set([]);
            this.notifications.error(branches.message || 'No se pudieron cargar las sucursales.');
          } else {
            this.branches.set(branches.data ?? []);
          }

          if (!warehouses.success) {
            this.warehouses.set([]);
            this.notifications.error(warehouses.message || 'No se pudieron cargar los almacenes.');
          } else {
            this.warehouses.set(warehouses.data ?? []);
          }

          if (!products.success) {
            this.products.set([]);
            this.notifications.error(products.message || 'No se pudieron cargar los productos.');
          } else {
            this.products.set(products.data ?? []);
          }
        },
        error: () => {
          this.suppliers.set([]);
          this.branches.set([]);
          this.warehouses.set([]);
          this.products.set([]);
          this.notifications.error('No se pudieron cargar los catálogos de compras.');
        },
      });
  }

  private loadPurchaseDetail(purchase: Purchase): void {
    const id = this.getPurchaseId(purchase);

    if (id === null) {
      return;
    }

    this.cargandoDetalle.set(true);
    this.purchasesService
      .getById(id)
      .pipe(finalize(() => this.cargandoDetalle.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success || !response.data) {
            this.notifications.error(response.message || 'No se pudo cargar el detalle de la compra.');
            return;
          }

          this.selectedPurchase.set(response.data);
        },
        error: () => {
          this.notifications.error('No se pudo cargar el detalle de la compra.');
        },
      });
  }

  private openActionModal(purchase: Purchase, mode: PurchaseModalMode): void {
    this.recordFocusedElement();
    this.modalMode.set(mode);
    this.selectedPurchase.set(purchase);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.modalCloseButton()?.nativeElement.focus());
  }

  private buildFilters(): PurchaseFilters {
    const formValue = this.filterForm.getRawValue();
    const search = formValue.search.trim();
    const status = formValue.status.trim();

    return {
      search: search || undefined,
      supplierId: this.parseOptionalNumber(formValue.supplierId) ?? undefined,
      branchId: this.parseOptionalNumber(formValue.branchId) ?? undefined,
      warehouseId: this.parseOptionalNumber(formValue.warehouseId) ?? undefined,
      status: status || undefined,
      fromDate: this.toDateTime(formValue.fromDate, false),
      toDate: this.toDateTime(formValue.toDate, true),
    };
  }

  private buildCreateRequest(): PurchaseCreateRequest {
    const formValue = this.purchaseForm.getRawValue();

    return {
      supplierId: this.parseRequiredNumber(formValue.supplierId),
      branchId: this.parseRequiredNumber(formValue.branchId),
      warehouseId: this.parseRequiredNumber(formValue.warehouseId),
      folio: this.cleanOptionalValue(formValue.folio),
      purchaseDate: formValue.purchaseDate || null,
      vatPercentage: this.parseRequiredNumber(formValue.vatPercentage),
      notes: this.cleanOptionalValue(formValue.notes),
      details: formValue.details.map((detail) => ({
        productId: this.parseRequiredNumber(detail.productId),
        quantity: this.parseRequiredNumber(detail.quantity),
        unitPrice: this.parseRequiredNumber(detail.unitPrice),
        vatPercentage: this.parseOptionalNumber(detail.vatPercentage),
      })),
    };
  }

  private listenSearchChanges(): void {
    this.filterForm.controls.search.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadPurchases());
  }

  private resetPurchaseForm(): void {
    this.purchaseForm.reset({
      supplierId: '',
      branchId: '',
      warehouseId: '',
      folio: '',
      purchaseDate: '',
      vatPercentage: 16,
      notes: '',
    });
    this.purchaseDetails.clear();
    this.purchaseDetails.push(this.createDetailForm());
  }

  private createDetailForm() {
    return this.fb.nonNullable.group({
      productId: ['', [Validators.required]],
      quantity: [1, [Validators.required, Validators.min(0.0001)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      vatPercentage: ['', [Validators.min(0), Validators.max(100)]],
    });
  }

  private getPurchaseId(purchase: Purchase | null): number | null {
    return purchase?.id ?? purchase?.purchaseId ?? null;
  }

  private normalizedStatus(purchase: Purchase): string {
    return (purchase.status || '').trim().toLowerCase();
  }

  private cleanOptionalValue(value: string): string | null {
    const trimmedValue = value.trim();
    return trimmedValue || null;
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

  private toDateTime(value: string, endOfDay: boolean): string | undefined {
    if (!value) {
      return undefined;
    }

    return `${value}T${endOfDay ? '23:59:59' : '00:00:00'}`;
  }

  private findSupplier(supplierId: number | undefined): Supplier | null {
    if (supplierId === undefined) {
      return null;
    }

    return this.suppliers().find((supplier) => this.getSupplierId(supplier) === supplierId) ?? null;
  }

  private findBranch(branchId: number | undefined): Branch | null {
    if (branchId === undefined) {
      return null;
    }

    return this.branches().find((branch) => this.getBranchId(branch) === branchId) ?? null;
  }

  private findWarehouse(warehouseId: number | undefined): Warehouse | null {
    if (warehouseId === undefined) {
      return null;
    }

    return this.warehouses().find((warehouse) => this.getWarehouseId(warehouse) === warehouseId) ?? null;
  }

  private findProduct(productId: number | undefined): ProductListItem | null {
    if (productId === undefined) {
      return null;
    }

    return this.products().find((product) => product.id === productId) ?? null;
  }

  private getResponseMessage(message: string, errors: string[] | null, fallback: string): string {
    return errors?.length ? errors.join(' ') : message || fallback;
  }

  private recordFocusedElement(): void {
    const activeElement = this.document.activeElement;
    this.lastFocusedElement = activeElement instanceof HTMLElement ? activeElement : this.newPurchaseButton()?.nativeElement ?? null;
  }

  private restoreFocus(): void {
    setTimeout(() => {
      const target = this.lastFocusedElement ?? this.newPurchaseButton()?.nativeElement;
      target?.focus();
      this.lastFocusedElement = null;
    });
  }

  private setModalState(open: boolean): void {
    this.document.body.classList.toggle('modal-open', open);
    this.document.body.style.overflow = open ? 'hidden' : '';
  }
}
