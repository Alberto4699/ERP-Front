import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize, forkJoin } from 'rxjs';

import { Branch } from '../../core/models/branch.model';
import { ProductListItem } from '../../core/models/product.model';
import { WarehouseTransfer, WarehouseTransferCreateRequest, WarehouseTransferDetail, WarehouseTransferFilters } from '../../core/models/warehouse-transfer.model';
import { Warehouse } from '../../core/models/warehouse.model';
import { BranchesService } from '../../core/services/branches';
import { NotificationsService } from '../../core/services/notifications';
import { ProductsService } from '../../core/services/products';
import { WarehouseTransfersService } from '../../core/services/warehouse-transfers';
import { WarehousesService } from '../../core/services/warehouses';

type TransferModalMode = 'create' | 'view' | 'delete' | 'confirm' | 'cancel';

@Component({
  selector: 'app-warehouse-transfers',
  imports: [ReactiveFormsModule],
  templateUrl: './warehouse-transfers.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'cerrarModalConEscape()',
  },
})
export class WarehouseTransfers implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly transfersService = inject(WarehouseTransfersService);
  private readonly branchesService = inject(BranchesService);
  private readonly warehousesService = inject(WarehousesService);
  private readonly productsService = inject(ProductsService);
  private readonly notifications = inject(NotificationsService);
  private readonly newTransferButton = viewChild<ElementRef<HTMLButtonElement>>('newTransferButton');
  private readonly modalCloseButton = viewChild<ElementRef<HTMLButtonElement>>('modalCloseButton');
  private readonly dateFormatter = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  private readonly quantityFormatter = new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 4,
  });
  private lastFocusedElement: HTMLElement | null = null;

  readonly transfers = signal<WarehouseTransfer[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly warehouses = signal<Warehouse[]>([]);
  readonly products = signal<ProductListItem[]>([]);
  readonly cargando = signal(false);
  readonly cargandoCatalogos = signal(false);
  readonly cargandoDetalle = signal(false);
  readonly guardando = signal(false);
  readonly mostrandoFormulario = signal(false);
  readonly modalMode = signal<TransferModalMode>('create');
  readonly selectedTransfer = signal<WarehouseTransfer | null>(null);
  readonly mensajeError = signal('');
  readonly mensajeFormulario = signal('');

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    branchId: [''],
    sourceWarehouseId: [''],
    destinationWarehouseId: [''],
    status: [''],
    fromDate: [''],
    toDate: [''],
  });

  readonly transferForm = this.fb.nonNullable.group({
    branchId: ['', [Validators.required]],
    sourceWarehouseId: ['', [Validators.required]],
    destinationWarehouseId: ['', [Validators.required]],
    folio: ['', [Validators.maxLength(50)]],
    transferDate: [''],
    notes: ['', [Validators.maxLength(500)]],
    details: this.fb.array([this.createDetailForm()]),
  });

  get transferDetails() {
    return this.transferForm.controls.details;
  }

  ngOnInit(): void {
    this.listenSearchChanges();
    this.loadCatalogs();
    this.loadTransfers();
  }

  ngOnDestroy(): void {
    this.setModalState(false);
  }

  loadTransfers(): void {
    this.cargando.set(true);
    this.mensajeError.set('');

    this.transfersService
      .getAll(this.buildFilters())
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = response.message || 'No se pudieron cargar los traspasos.';
            this.transfers.set([]);
            this.mensajeError.set(message);
            this.notifications.error(message);
            return;
          }

          this.transfers.set(response.data ?? []);
        },
        error: () => {
          const message = 'No se pudieron cargar los traspasos.';
          this.transfers.set([]);
          this.mensajeError.set(message);
          this.notifications.error(message);
        },
      });
  }

  buscar(): void {
    this.loadTransfers();
  }

  limpiarFiltros(): void {
    this.filterForm.reset(
      {
        search: '',
        branchId: '',
        sourceWarehouseId: '',
        destinationWarehouseId: '',
        status: '',
        fromDate: '',
        toDate: '',
      },
      { emitEvent: false }
    );
    this.loadTransfers();
  }

  nuevoTraspaso(): void {
    this.recordFocusedElement();
    this.resetTransferForm();
    this.modalMode.set('create');
    this.selectedTransfer.set(null);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.modalCloseButton()?.nativeElement.focus());
  }

  verTraspaso(transfer: WarehouseTransfer): void {
    this.recordFocusedElement();
    this.modalMode.set('view');
    this.selectedTransfer.set(transfer);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.modalCloseButton()?.nativeElement.focus());
    this.loadTransferDetail(transfer);
  }

  eliminarTraspaso(transfer: WarehouseTransfer): void {
    this.openActionModal(transfer, 'delete');
  }

  confirmarTraspaso(transfer: WarehouseTransfer): void {
    this.openActionModal(transfer, 'confirm');
  }

  cancelarTraspaso(transfer: WarehouseTransfer): void {
    this.openActionModal(transfer, 'cancel');
  }

  cerrarModal(): void {
    this.mostrandoFormulario.set(false);
    this.mensajeFormulario.set('');
    this.selectedTransfer.set(null);
    this.cargandoDetalle.set(false);
    this.modalMode.set('create');
    this.resetTransferForm();
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

  guardarTraspaso(): void {
    this.mensajeFormulario.set('');

    if (this.transferForm.invalid) {
      this.transferForm.markAllAsTouched();
      this.mensajeFormulario.set('Revisa los campos obligatorios del traspaso.');
      return;
    }

    if (this.sameWarehouses()) {
      this.mensajeFormulario.set('El almacén origen y destino deben ser diferentes.');
      return;
    }

    this.guardando.set(true);
    this.transfersService
      .create(this.buildCreateRequest())
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = this.getResponseMessage(response.message, response.errors, 'No se pudo crear el traspaso.');
            this.mensajeFormulario.set(message);
            this.notifications.error(message, { title: 'No se pudo guardar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Traspaso creado correctamente.');
          this.loadTransfers();
        },
        error: () => {
          const message = 'No se pudo crear el traspaso.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  confirmarEliminacion(): void {
    const id = this.getTransferId(this.selectedTransfer());

    if (id === null) {
      this.notifications.error('No se pudo identificar el traspaso.', { title: 'No se pudo eliminar' });
      return;
    }

    this.guardando.set(true);
    this.transfersService
      .remove(id)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo eliminar el traspaso.'), { title: 'No se pudo eliminar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Traspaso eliminado correctamente.');
          this.loadTransfers();
        },
        error: () => {
          this.notifications.error('No se pudo eliminar el traspaso.', { title: 'No se pudo eliminar' });
        },
      });
  }

  confirmarAccionEstado(): void {
    const id = this.getTransferId(this.selectedTransfer());
    const confirming = this.modalMode() === 'confirm';

    if (id === null) {
      this.notifications.error('No se pudo identificar el traspaso.', { title: 'No se pudo actualizar' });
      return;
    }

    this.guardando.set(true);
    const request = confirming ? this.transfersService.confirm(id) : this.transfersService.cancel(id);

    request.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo actualizar el traspaso.'), { title: 'No se pudo actualizar' });
          return;
        }

        this.cerrarModal();
        this.notifications.success(response.message || (confirming ? 'Traspaso confirmado correctamente.' : 'Traspaso cancelado correctamente.'));
        this.loadTransfers();
      },
      error: () => {
        this.notifications.error('No se pudo actualizar el traspaso.', { title: 'No se pudo actualizar' });
      },
    });
  }

  agregarDetalle(): void {
    this.transferDetails.push(this.createDetailForm());
  }

  eliminarDetalle(index: number): void {
    if (this.transferDetails.length === 1) {
      this.transferDetails.at(0).reset({
        productId: '',
        quantity: 1,
      });
      return;
    }

    this.transferDetails.removeAt(index);
  }

  modalTitle(): string {
    switch (this.modalMode()) {
      case 'view':
        return 'Detalle de traspaso';
      case 'delete':
        return 'Eliminar traspaso';
      case 'confirm':
        return 'Confirmar traspaso';
      case 'cancel':
        return 'Cancelar traspaso';
      case 'create':
        return 'Nuevo traspaso';
    }
  }

  trackTransfer(index: number, transfer: WarehouseTransfer): number | string {
    return transfer.id ?? transfer.warehouseTransferId ?? transfer.folio ?? index;
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

  trackTransferDetail(index: number, detail: WarehouseTransferDetail): number | string {
    return detail.id ?? detail.warehouseTransferDetailId ?? detail.productId ?? index;
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

  branchName(transfer: WarehouseTransfer): string {
    const branch = this.findBranch(transfer.branchId);
    return transfer.branchName || branch?.name || '-';
  }

  sourceWarehouseName(transfer: WarehouseTransfer): string {
    const warehouse = this.findWarehouse(transfer.sourceWarehouseId);
    return transfer.sourceWarehouseName || warehouse?.name || '-';
  }

  destinationWarehouseName(transfer: WarehouseTransfer): string {
    const warehouse = this.findWarehouse(transfer.destinationWarehouseId);
    return transfer.destinationWarehouseName || warehouse?.name || '-';
  }

  productName(detail: WarehouseTransferDetail): string {
    const product = this.findProduct(detail.productId);
    return detail.productName || product?.name || '-';
  }

  productCode(detail: WarehouseTransferDetail): string {
    const product = this.findProduct(detail.productId);
    return detail.productCode || product?.code || '-';
  }

  transferDate(transfer: WarehouseTransfer): string {
    const dateValue = transfer.transferDate ?? transfer.createdAt;

    if (!dateValue) {
      return '-';
    }

    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? '-' : this.dateFormatter.format(date);
  }

  statusText(transfer: WarehouseTransfer): string {
    return transfer.status || 'Pendiente';
  }

  isConfirmed(transfer: WarehouseTransfer): boolean {
    return ['confirmed', 'confirmado', 'confirmada'].includes(this.normalizedStatus(transfer));
  }

  isCancelled(transfer: WarehouseTransfer): boolean {
    return ['cancelled', 'canceled', 'cancelado', 'cancelada'].includes(this.normalizedStatus(transfer));
  }

  canConfirm(transfer: WarehouseTransfer): boolean {
    return !this.isConfirmed(transfer) && !this.isCancelled(transfer);
  }

  canCancel(transfer: WarehouseTransfer): boolean {
    return !this.isConfirmed(transfer) && !this.isCancelled(transfer);
  }

  formatQuantity(value: number | null | undefined): string {
    return value === null || value === undefined ? '-' : this.quantityFormatter.format(value);
  }

  totalQuantity(transfer: WarehouseTransfer): string {
    const total = (transfer.details ?? []).reduce((sum, detail) => sum + (detail.quantity ?? 0), 0);
    return this.formatQuantity(total);
  }

  campoInvalido(controlName: string): boolean {
    const control = this.transferForm.get(controlName);
    return Boolean(control?.invalid && (control.dirty || control.touched));
  }

  detalleCampoInvalido(index: number, controlName: string): boolean {
    const control = this.transferDetails.at(index).get(controlName);
    return Boolean(control?.invalid && (control.dirty || control.touched));
  }

  sameWarehouses(): boolean {
    const formValue = this.transferForm.getRawValue();
    const sourceWarehouseId = this.parseOptionalNumber(formValue.sourceWarehouseId);
    const destinationWarehouseId = this.parseOptionalNumber(formValue.destinationWarehouseId);
    return sourceWarehouseId !== null && sourceWarehouseId === destinationWarehouseId;
  }

  private loadCatalogs(): void {
    this.cargandoCatalogos.set(true);

    forkJoin({
      branches: this.branchesService.getAll({ active: true }),
      warehouses: this.warehousesService.getAll({ active: true }),
      products: this.productsService.getAll({ active: true, tracksInventory: true }),
    })
      .pipe(finalize(() => this.cargandoCatalogos.set(false)))
      .subscribe({
        next: ({ branches, warehouses, products }) => {
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
          this.branches.set([]);
          this.warehouses.set([]);
          this.products.set([]);
          this.notifications.error('No se pudieron cargar los catálogos de traspasos.');
        },
      });
  }

  private loadTransferDetail(transfer: WarehouseTransfer): void {
    const id = this.getTransferId(transfer);

    if (id === null) {
      return;
    }

    this.cargandoDetalle.set(true);
    this.transfersService
      .getById(id)
      .pipe(finalize(() => this.cargandoDetalle.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success || !response.data) {
            this.notifications.error(response.message || 'No se pudo cargar el detalle del traspaso.');
            return;
          }

          this.selectedTransfer.set(response.data);
        },
        error: () => {
          this.notifications.error('No se pudo cargar el detalle del traspaso.');
        },
      });
  }

  private openActionModal(transfer: WarehouseTransfer, mode: TransferModalMode): void {
    this.recordFocusedElement();
    this.modalMode.set(mode);
    this.selectedTransfer.set(transfer);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.modalCloseButton()?.nativeElement.focus());
  }

  private buildFilters(): WarehouseTransferFilters {
    const formValue = this.filterForm.getRawValue();
    const search = formValue.search.trim();
    const status = formValue.status.trim();

    return {
      search: search || undefined,
      branchId: this.parseOptionalNumber(formValue.branchId) ?? undefined,
      sourceWarehouseId: this.parseOptionalNumber(formValue.sourceWarehouseId) ?? undefined,
      destinationWarehouseId: this.parseOptionalNumber(formValue.destinationWarehouseId) ?? undefined,
      status: status || undefined,
      fromDate: this.toDateTime(formValue.fromDate, false),
      toDate: this.toDateTime(formValue.toDate, true),
    };
  }

  private buildCreateRequest(): WarehouseTransferCreateRequest {
    const formValue = this.transferForm.getRawValue();

    return {
      branchId: this.parseRequiredNumber(formValue.branchId),
      sourceWarehouseId: this.parseRequiredNumber(formValue.sourceWarehouseId),
      destinationWarehouseId: this.parseRequiredNumber(formValue.destinationWarehouseId),
      folio: this.cleanOptionalValue(formValue.folio),
      transferDate: formValue.transferDate || null,
      notes: this.cleanOptionalValue(formValue.notes),
      details: formValue.details.map((detail) => ({
        productId: this.parseRequiredNumber(detail.productId),
        quantity: this.parseRequiredNumber(detail.quantity),
      })),
    };
  }

  private listenSearchChanges(): void {
    this.filterForm.controls.search.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadTransfers());
  }

  private resetTransferForm(): void {
    this.transferForm.reset({
      branchId: '',
      sourceWarehouseId: '',
      destinationWarehouseId: '',
      folio: '',
      transferDate: '',
      notes: '',
    });
    this.transferDetails.clear();
    this.transferDetails.push(this.createDetailForm());
  }

  private createDetailForm() {
    return this.fb.nonNullable.group({
      productId: ['', [Validators.required]],
      quantity: [1, [Validators.required, Validators.min(0.0001)]],
    });
  }

  private getTransferId(transfer: WarehouseTransfer | null): number | null {
    return transfer?.id ?? transfer?.warehouseTransferId ?? null;
  }

  private normalizedStatus(transfer: WarehouseTransfer): string {
    return (transfer.status || '').trim().toLowerCase();
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
    this.lastFocusedElement = activeElement instanceof HTMLElement ? activeElement : this.newTransferButton()?.nativeElement ?? null;
  }

  private restoreFocus(): void {
    setTimeout(() => {
      const target = this.lastFocusedElement ?? this.newTransferButton()?.nativeElement;
      target?.focus();
      this.lastFocusedElement = null;
    });
  }

  private setModalState(open: boolean): void {
    this.document.body.classList.toggle('modal-open', open);
    this.document.body.style.overflow = open ? 'hidden' : '';
  }
}
