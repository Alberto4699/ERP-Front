import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize, forkJoin } from 'rxjs';

import { InventoryMovement, InventoryMovementFilters, InventoryMovementType } from '../../core/models/inventory-movement.model';
import { ProductListItem } from '../../core/models/product.model';
import { Warehouse } from '../../core/models/warehouse.model';
import { InventoryMovementsService } from '../../core/services/inventory-movements';
import { NotificationsService } from '../../core/services/notifications';
import { ProductsService } from '../../core/services/products';
import { WarehousesService } from '../../core/services/warehouses';

@Component({
  selector: 'app-inventory-movements',
  imports: [ReactiveFormsModule],
  templateUrl: './inventory-movements.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'cerrarModalConEscape()',
  },
})
export class InventoryMovements implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly movementsService = inject(InventoryMovementsService);
  private readonly warehousesService = inject(WarehousesService);
  private readonly productsService = inject(ProductsService);
  private readonly notifications = inject(NotificationsService);
  private readonly modalCloseButton = viewChild<ElementRef<HTMLButtonElement>>('modalCloseButton');
  private readonly quantityFormatter = new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 4,
  });
  private readonly dateFormatter = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  private lastFocusedElement: HTMLElement | null = null;

  readonly movements = signal<InventoryMovement[]>([]);
  readonly warehouses = signal<Warehouse[]>([]);
  readonly products = signal<ProductListItem[]>([]);
  readonly movementTypes = signal<InventoryMovementType[]>([]);
  readonly cargando = signal(false);
  readonly cargandoCatalogos = signal(false);
  readonly mostrandoDetalle = signal(false);
  readonly selectedMovement = signal<InventoryMovement | null>(null);
  readonly mensajeError = signal('');

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    warehouseId: [''],
    productId: [''],
    inventoryMovementTypeId: [''],
    fromDate: [''],
    toDate: [''],
  });

  ngOnInit(): void {
    this.listenSearchChanges();
    this.loadCatalogs();
    this.loadMovements();
  }

  ngOnDestroy(): void {
    this.setModalState(false);
  }

  loadMovements(): void {
    this.cargando.set(true);
    this.mensajeError.set('');

    this.movementsService
      .getAll(this.buildFilters())
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = response.message || 'No se pudieron cargar los movimientos.';
            this.movements.set([]);
            this.mensajeError.set(message);
            this.notifications.error(message);
            return;
          }

          this.movements.set(response.data ?? []);
        },
        error: () => {
          const message = 'No se pudieron cargar los movimientos.';
          this.movements.set([]);
          this.mensajeError.set(message);
          this.notifications.error(message);
        },
      });
  }

  buscar(): void {
    this.loadMovements();
  }

  limpiarFiltros(): void {
    this.filterForm.reset(
      {
        search: '',
        warehouseId: '',
        productId: '',
        inventoryMovementTypeId: '',
        fromDate: '',
        toDate: '',
      },
      { emitEvent: false }
    );
    this.loadMovements();
  }

  verDetalle(movement: InventoryMovement): void {
    this.recordFocusedElement();
    this.selectedMovement.set(movement);
    this.mostrandoDetalle.set(true);
    this.setModalState(true);
    setTimeout(() => this.modalCloseButton()?.nativeElement.focus());
  }

  cerrarModal(): void {
    this.mostrandoDetalle.set(false);
    this.selectedMovement.set(null);
    this.setModalState(false);
    this.restoreFocus();
  }

  cerrarModalConEscape(): void {
    if (!this.mostrandoDetalle()) {
      return;
    }

    this.cerrarModal();
  }

  cerrarModalDesdeBackdrop(event: MouseEvent): void {
    if (event.target !== event.currentTarget) {
      return;
    }

    this.cerrarModal();
  }

  trackMovement(index: number, movement: InventoryMovement): number | string {
    return movement.id ?? movement.inventoryMovementId ?? `${movement.warehouseId ?? 'warehouse'}-${movement.productId ?? 'product'}-${this.movementDate(movement)}-${index}`;
  }

  trackWarehouse(index: number, warehouse: Warehouse): number | string {
    return this.getWarehouseId(warehouse) ?? warehouse.code ?? index;
  }

  trackProduct(index: number, product: ProductListItem): number | string {
    return product.id ?? product.code ?? index;
  }

  trackMovementType(index: number, movementType: InventoryMovementType): number | string {
    return this.getMovementTypeId(movementType) ?? movementType.code ?? movementType.name ?? index;
  }

  getWarehouseId(warehouse: Warehouse | null): number | null {
    return warehouse?.id ?? warehouse?.warehouseId ?? null;
  }

  getMovementTypeId(movementType: InventoryMovementType | null): number | null {
    return movementType?.id ?? movementType?.inventoryMovementTypeId ?? null;
  }

  warehouseLabel(warehouse: Warehouse): string {
    return warehouse.branchName ? `${warehouse.name} - ${warehouse.branchName}` : warehouse.name;
  }

  productLabel(product: ProductListItem): string {
    return `${product.code} - ${product.name}`;
  }

  movementTypeLabel(movementType: InventoryMovementType): string {
    return movementType.name || movementType.code || movementType.movementType || 'Tipo sin nombre';
  }

  productName(movement: InventoryMovement): string {
    const product = this.findProduct(movement.productId);
    return movement.productName || product?.name || '-';
  }

  productCode(movement: InventoryMovement): string {
    const product = this.findProduct(movement.productId);
    return movement.productCode || product?.code || '-';
  }

  warehouseName(movement: InventoryMovement): string {
    const warehouse = this.findWarehouse(movement.warehouseId);
    return movement.warehouseName || warehouse?.name || '-';
  }

  branchName(movement: InventoryMovement): string {
    const warehouse = this.findWarehouse(movement.warehouseId);
    return movement.branchName || warehouse?.branchName || '-';
  }

  movementTypeName(movement: InventoryMovement): string {
    const movementType = this.findMovementType(movement.inventoryMovementTypeId);
    return movement.inventoryMovementTypeName || movement.movementTypeName || movement.movementType || movementType?.name || movementType?.code || '-';
  }

  movementQuantity(movement: InventoryMovement): number {
    return movement.quantity ?? 0;
  }

  formatQuantity(value: number | null | undefined): string {
    return value === null || value === undefined ? '-' : this.quantityFormatter.format(value);
  }

  movementDate(movement: InventoryMovement): string {
    const dateValue = movement.movementDate ?? movement.createdAt;

    if (!dateValue) {
      return '-';
    }

    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? '-' : this.dateFormatter.format(date);
  }

  createdBy(movement: InventoryMovement): string {
    return movement.createdByUserName || (movement.createdByUserId ? String(movement.createdByUserId) : '-');
  }

  private loadCatalogs(): void {
    this.cargandoCatalogos.set(true);

    forkJoin({
      warehouses: this.warehousesService.getAll(),
      products: this.productsService.getAll(),
      movementTypes: this.movementsService.getTypes(),
    })
      .pipe(finalize(() => this.cargandoCatalogos.set(false)))
      .subscribe({
        next: ({ warehouses, products, movementTypes }) => {
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

          if (!movementTypes.success) {
            this.movementTypes.set([]);
            this.notifications.error(movementTypes.message || 'No se pudieron cargar los tipos de movimiento.');
          } else {
            this.movementTypes.set(movementTypes.data ?? []);
          }
        },
        error: () => {
          this.warehouses.set([]);
          this.products.set([]);
          this.movementTypes.set([]);
          this.notifications.error('No se pudieron cargar los catálogos de movimientos.');
        },
      });
  }

  private buildFilters(): InventoryMovementFilters {
    const formValue = this.filterForm.getRawValue();
    const search = formValue.search.trim();
    const warehouseId = this.parseOptionalNumber(formValue.warehouseId);
    const productId = this.parseOptionalNumber(formValue.productId);
    const inventoryMovementTypeId = this.parseOptionalNumber(formValue.inventoryMovementTypeId);

    return {
      search: search || undefined,
      warehouseId: warehouseId ?? undefined,
      productId: productId ?? undefined,
      inventoryMovementTypeId: inventoryMovementTypeId ?? undefined,
      fromDate: this.toDateTime(formValue.fromDate, false),
      toDate: this.toDateTime(formValue.toDate, true),
    };
  }

  private listenSearchChanges(): void {
    this.filterForm.controls.search.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadMovements());
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

  private findProduct(productId: number | undefined): ProductListItem | null {
    if (productId === undefined) {
      return null;
    }

    return this.products().find((product) => product.id === productId) ?? null;
  }

  private findWarehouse(warehouseId: number | undefined): Warehouse | null {
    if (warehouseId === undefined) {
      return null;
    }

    return this.warehouses().find((warehouse) => this.getWarehouseId(warehouse) === warehouseId) ?? null;
  }

  private findMovementType(movementTypeId: number | undefined): InventoryMovementType | null {
    if (movementTypeId === undefined) {
      return null;
    }

    return this.movementTypes().find((movementType) => this.getMovementTypeId(movementType) === movementTypeId) ?? null;
  }

  private recordFocusedElement(): void {
    const activeElement = this.document.activeElement;
    this.lastFocusedElement = activeElement instanceof HTMLElement ? activeElement : null;
  }

  private restoreFocus(): void {
    setTimeout(() => {
      this.lastFocusedElement?.focus();
      this.lastFocusedElement = null;
    });
  }

  private setModalState(open: boolean): void {
    this.document.body.classList.toggle('modal-open', open);
    this.document.body.style.overflow = open ? 'hidden' : '';
  }
}
