import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';

import { InventoryMovementType } from '../../core/models/inventory-movement.model';
import { InventoryAdjustmentRequest } from '../../core/models/inventory.model';
import { ProductListItem } from '../../core/models/product.model';
import { Warehouse } from '../../core/models/warehouse.model';
import { InventoryMovementsService } from '../../core/services/inventory-movements';
import { InventoryService } from '../../core/services/inventory';
import { NotificationsService } from '../../core/services/notifications';
import { ProductsService } from '../../core/services/products';
import { WarehousesService } from '../../core/services/warehouses';

@Component({
  selector: 'app-inventory-adjustments',
  imports: [ReactiveFormsModule],
  templateUrl: './inventory-adjustments.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryAdjustments implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly inventoryService = inject(InventoryService);
  private readonly movementsService = inject(InventoryMovementsService);
  private readonly warehousesService = inject(WarehousesService);
  private readonly productsService = inject(ProductsService);
  private readonly notifications = inject(NotificationsService);

  readonly warehouses = signal<Warehouse[]>([]);
  readonly products = signal<ProductListItem[]>([]);
  readonly movementTypes = signal<InventoryMovementType[]>([]);
  readonly cargandoCatalogos = signal(false);
  readonly guardando = signal(false);
  readonly mensajeCatalogos = signal('');
  readonly mensajeFormulario = signal('');

  readonly adjustmentForm = this.fb.nonNullable.group({
    warehouseId: ['', [Validators.required]],
    productId: ['', [Validators.required]],
    inventoryMovementTypeId: ['', [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(0.0001)]],
    reference: ['', [Validators.maxLength(150)]],
    notes: ['', [Validators.maxLength(500)]],
  });

  ngOnInit(): void {
    this.loadCatalogs();
  }

  loadCatalogs(): void {
    this.cargandoCatalogos.set(true);
    this.mensajeCatalogos.set('');

    forkJoin({
      warehouses: this.warehousesService.getAll({ active: true }),
      products: this.productsService.getAll({ active: true, tracksInventory: true }),
      movementTypes: this.movementsService.getTypes(),
    })
      .pipe(finalize(() => this.cargandoCatalogos.set(false)))
      .subscribe({
        next: ({ warehouses, products, movementTypes }) => {
          if (!warehouses.success) {
            this.warehouses.set([]);
            this.mensajeCatalogos.set(warehouses.message || 'No se pudieron cargar los almacenes.');
            this.notifications.error(warehouses.message || 'No se pudieron cargar los almacenes.');
          } else {
            this.warehouses.set(warehouses.data ?? []);
          }

          if (!products.success) {
            this.products.set([]);
            this.mensajeCatalogos.set(products.message || 'No se pudieron cargar los productos.');
            this.notifications.error(products.message || 'No se pudieron cargar los productos.');
          } else {
            this.products.set(products.data ?? []);
          }

          if (!movementTypes.success) {
            this.movementTypes.set([]);
            this.mensajeCatalogos.set(movementTypes.message || 'No se pudieron cargar los tipos de movimiento.');
            this.notifications.error(movementTypes.message || 'No se pudieron cargar los tipos de movimiento.');
          } else {
            this.movementTypes.set(movementTypes.data ?? []);
          }
        },
        error: () => {
          const message = 'No se pudieron cargar los catálogos para ajustes.';
          this.warehouses.set([]);
          this.products.set([]);
          this.movementTypes.set([]);
          this.mensajeCatalogos.set(message);
          this.notifications.error(message);
        },
      });
  }

  guardarAjuste(): void {
    this.mensajeFormulario.set('');

    if (this.adjustmentForm.invalid) {
      this.adjustmentForm.markAllAsTouched();
      this.mensajeFormulario.set('Revisa los campos obligatorios del ajuste.');
      return;
    }

    this.guardando.set(true);
    this.inventoryService
      .createAdjustment(this.buildRequest())
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = this.getResponseMessage(response.message, response.errors, 'No se pudo registrar el ajuste.');
            this.mensajeFormulario.set(message);
            this.notifications.error(message, { title: 'No se pudo guardar' });
            return;
          }

          this.resetForm();
          this.notifications.success(response.message || 'Ajuste registrado correctamente.');
        },
        error: () => {
          const message = 'No se pudo registrar el ajuste.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  limpiarFormulario(): void {
    this.mensajeFormulario.set('');
    this.resetForm();
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

  campoInvalido(controlName: string): boolean {
    const control = this.adjustmentForm.get(controlName);
    return Boolean(control?.invalid && (control.dirty || control.touched));
  }

  private buildRequest(): InventoryAdjustmentRequest {
    const formValue = this.adjustmentForm.getRawValue();

    return {
      warehouseId: this.parseRequiredNumber(formValue.warehouseId),
      productId: this.parseRequiredNumber(formValue.productId),
      inventoryMovementTypeId: this.parseRequiredNumber(formValue.inventoryMovementTypeId),
      quantity: this.parseRequiredNumber(formValue.quantity),
      reference: this.cleanOptionalValue(formValue.reference),
      notes: this.cleanOptionalValue(formValue.notes),
    };
  }

  private resetForm(): void {
    this.adjustmentForm.reset({
      warehouseId: '',
      productId: '',
      inventoryMovementTypeId: '',
      quantity: 1,
      reference: '',
      notes: '',
    });
  }

  private cleanOptionalValue(value: string): string | null {
    const trimmedValue = value.trim();
    return trimmedValue || null;
  }

  private parseRequiredNumber(value: string | number): number {
    const numberValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private getResponseMessage(message: string, errors: string[] | null, fallback: string): string {
    return errors?.length ? errors.join(' ') : message || fallback;
  }
}
