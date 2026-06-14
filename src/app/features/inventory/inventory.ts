import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize, forkJoin } from 'rxjs';

import { ProductListItem } from '../../core/models/product.model';
import { InventoryFilters, InventoryStock } from '../../core/models/inventory.model';
import { Warehouse } from '../../core/models/warehouse.model';
import { InventoryService } from '../../core/services/inventory';
import { NotificationsService } from '../../core/services/notifications';
import { ProductsService } from '../../core/services/products';
import { WarehousesService } from '../../core/services/warehouses';

@Component({
  selector: 'app-inventory',
  imports: [ReactiveFormsModule],
  templateUrl: './inventory.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'cerrarModalConEscape()',
  },
})
export class Inventory implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly inventoryService = inject(InventoryService);
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

  readonly inventory = signal<InventoryStock[]>([]);
  readonly warehouses = signal<Warehouse[]>([]);
  readonly products = signal<ProductListItem[]>([]);
  readonly cargando = signal(false);
  readonly cargandoCatalogos = signal(false);
  readonly mostrandoDetalle = signal(false);
  readonly selectedStock = signal<InventoryStock | null>(null);
  readonly mensajeError = signal('');

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    warehouseId: [''],
    productId: [''],
    lowStock: [''],
  });

  ngOnInit(): void {
    this.listenSearchChanges();
    this.loadCatalogs();
    this.loadInventory();
  }

  ngOnDestroy(): void {
    this.setModalState(false);
  }

  loadInventory(): void {
    this.cargando.set(true);
    this.mensajeError.set('');

    this.inventoryService
      .getAll(this.buildFilters())
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = response.message || 'No se pudieron cargar las existencias.';
            this.inventory.set([]);
            this.mensajeError.set(message);
            this.notifications.error(message);
            return;
          }

          this.inventory.set(response.data ?? []);
        },
        error: () => {
          const message = 'No se pudieron cargar las existencias.';
          this.inventory.set([]);
          this.mensajeError.set(message);
          this.notifications.error(message);
        },
      });
  }

  buscar(): void {
    this.loadInventory();
  }

  limpiarFiltros(): void {
    this.filterForm.reset(
      {
        search: '',
        warehouseId: '',
        productId: '',
        lowStock: '',
      },
      { emitEvent: false }
    );
    this.loadInventory();
  }

  verDetalle(stock: InventoryStock): void {
    this.recordFocusedElement();
    this.selectedStock.set(stock);
    this.mostrandoDetalle.set(true);
    this.setModalState(true);
    setTimeout(() => this.modalCloseButton()?.nativeElement.focus());
  }

  cerrarModal(): void {
    this.mostrandoDetalle.set(false);
    this.selectedStock.set(null);
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

  trackStock(index: number, stock: InventoryStock): number | string {
    return stock.id ?? stock.inventoryId ?? `${stock.warehouseId ?? 'warehouse'}-${stock.productId ?? 'product'}-${index}`;
  }

  trackWarehouse(index: number, warehouse: Warehouse): number | string {
    return this.getWarehouseId(warehouse) ?? warehouse.code ?? index;
  }

  trackProduct(index: number, product: ProductListItem): number | string {
    return product.id ?? product.code ?? index;
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

  productName(stock: InventoryStock): string {
    const product = this.findProduct(stock.productId);
    return stock.productName || product?.name || '-';
  }

  productCode(stock: InventoryStock): string {
    const product = this.findProduct(stock.productId);
    return stock.productCode || product?.code || '-';
  }

  warehouseName(stock: InventoryStock): string {
    const warehouse = this.findWarehouse(stock.warehouseId);
    return stock.warehouseName || warehouse?.name || '-';
  }

  branchName(stock: InventoryStock): string {
    const warehouse = this.findWarehouse(stock.warehouseId);
    return stock.branchName || warehouse?.branchName || '-';
  }

  unitName(stock: InventoryStock): string {
    const product = this.findProduct(stock.productId);
    return stock.measurementUnitAbbreviation || stock.measurementUnitName || product?.measurementUnitAbbreviation || '-';
  }

  stockQuantity(stock: InventoryStock): number {
    return stock.quantity ?? stock.stock ?? stock.currentStock ?? stock.availableStock ?? 0;
  }

  minimumStock(stock: InventoryStock): number | null {
    return stock.minimumStock ?? null;
  }

  maximumStock(stock: InventoryStock): number | null {
    return stock.maximumStock ?? null;
  }

  isLowStock(stock: InventoryStock): boolean {
    if (stock.lowStock !== undefined) {
      return stock.lowStock;
    }

    const minimumStock = this.minimumStock(stock);
    return minimumStock !== null && this.stockQuantity(stock) <= minimumStock;
  }

  formatQuantity(value: number | null): string {
    return value === null ? '-' : this.quantityFormatter.format(value);
  }

  lastMovementDate(stock: InventoryStock): string {
    const dateValue = stock.lastMovementAt ?? stock.updatedAt;

    if (!dateValue) {
      return '-';
    }

    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? '-' : this.dateFormatter.format(date);
  }

  private loadCatalogs(): void {
    this.cargandoCatalogos.set(true);

    forkJoin({
      warehouses: this.warehousesService.getAll(),
      products: this.productsService.getAll(),
    })
      .pipe(finalize(() => this.cargandoCatalogos.set(false)))
      .subscribe({
        next: ({ warehouses, products }) => {
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
          this.warehouses.set([]);
          this.products.set([]);
          this.notifications.error('No se pudieron cargar los catálogos de inventario.');
        },
      });
  }

  private buildFilters(): InventoryFilters {
    const formValue = this.filterForm.getRawValue();
    const search = formValue.search.trim();
    const warehouseId = this.parseOptionalNumber(formValue.warehouseId);
    const productId = this.parseOptionalNumber(formValue.productId);

    return {
      search: search || undefined,
      warehouseId: warehouseId ?? undefined,
      productId: productId ?? undefined,
      lowStock: formValue.lowStock === '' ? undefined : formValue.lowStock === 'true',
    };
  }

  private listenSearchChanges(): void {
    this.filterForm.controls.search.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadInventory());
  }

  private parseOptionalNumber(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numberValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
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
