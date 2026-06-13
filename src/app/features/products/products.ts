import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize, forkJoin } from 'rxjs';

import { Brand } from '../../core/models/brand.model';
import { Category } from '../../core/models/category.model';
import { MeasurementUnit } from '../../core/models/measurement-unit.model';
import { ProductFilters, ProductListItem, ProductResponse, ProductSaveRequest } from '../../core/models/product.model';
import { BrandsService } from '../../core/services/brands';
import { CategoriesService } from '../../core/services/categories';
import { MeasurementUnitsService } from '../../core/services/measurement-units';
import { NotificationsService } from '../../core/services/notifications';
import { ProductsService } from '../../core/services/products';

type ProductModalMode = 'create' | 'view' | 'edit' | 'delete' | 'activate' | 'deactivate';

@Component({
  selector: 'app-products',
  imports: [ReactiveFormsModule],
  templateUrl: './products.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'cerrarModalConEscape()',
  },
})
export class Products implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly productsService = inject(ProductsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly brandsService = inject(BrandsService);
  private readonly measurementUnitsService = inject(MeasurementUnitsService);
  private readonly notifications = inject(NotificationsService);
  private readonly productNameInput = viewChild<ElementRef<HTMLInputElement>>('productNameInput');
  private readonly newProductButton = viewChild<ElementRef<HTMLButtonElement>>('newProductButton');
  private readonly moneyFormatter = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  });
  private lastFocusedElement: HTMLElement | null = null;

  readonly products = signal<ProductListItem[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly brands = signal<Brand[]>([]);
  readonly measurementUnits = signal<MeasurementUnit[]>([]);
  readonly cargando = signal(false);
  readonly cargandoDetalle = signal(false);
  readonly guardando = signal(false);
  readonly mostrandoFormulario = signal(false);
  readonly modalMode = signal<ProductModalMode>('create');
  readonly selectedProduct = signal<ProductListItem | null>(null);
  readonly detailProduct = signal<ProductResponse | null>(null);
  readonly mensajeError = signal('');
  readonly mensajeFormulario = signal('');

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    categoryId: [''],
    brandId: [''],
    active: [''],
    tracksInventory: [''],
  });

  readonly productForm = this.fb.nonNullable.group({
    categoryId: ['', [Validators.required]],
    brandId: [''],
    measurementUnitId: ['', [Validators.required]],
    code: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(/\S/)]],
    barcode: ['', [Validators.maxLength(100)]],
    name: ['', [Validators.required, Validators.maxLength(200), Validators.pattern(/\S/)]],
    description: ['', [Validators.maxLength(500)]],
    purchasePrice: [0, [Validators.min(0)]],
    salePrice: [0, [Validators.min(0)]],
    minimumStock: [0, [Validators.min(0)]],
    maximumStock: ['', [Validators.min(0)]],
    tracksInventory: [true],
  });

  ngOnInit(): void {
    this.listenSearchChanges();
    this.loadCatalogs();
    this.loadProducts();
  }

  ngOnDestroy(): void {
    this.setModalState(false);
  }

  loadProducts(): void {
    this.cargando.set(true);
    this.mensajeError.set('');

    this.productsService
      .getAll(this.buildFilters())
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = response.message || 'No se pudieron cargar los productos.';
            this.products.set([]);
            this.mensajeError.set(message);
            this.notifications.error(message);
            return;
          }

          this.products.set(response.data ?? []);
        },
        error: () => {
          const message = 'No se pudieron cargar los productos.';
          this.products.set([]);
          this.mensajeError.set(message);
          this.notifications.error(message);
        },
      });
  }

  buscar(): void {
    this.loadProducts();
  }

  limpiarFiltros(): void {
    this.filterForm.reset(
      {
        search: '',
        categoryId: '',
        brandId: '',
        active: '',
        tracksInventory: '',
      },
      { emitEvent: false }
    );
    this.loadProducts();
  }

  nuevoProducto(): void {
    this.recordFocusedElement();
    this.resetProductForm();
    this.modalMode.set('create');
    this.selectedProduct.set(null);
    this.detailProduct.set(null);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.productNameInput()?.nativeElement.focus());
  }

  cerrarModal(): void {
    this.mostrandoFormulario.set(false);
    this.mensajeFormulario.set('');
    this.resetProductForm();
    this.selectedProduct.set(null);
    this.detailProduct.set(null);
    this.cargandoDetalle.set(false);
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

  guardarProducto(): void {
    this.mensajeFormulario.set('');

    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      this.mensajeFormulario.set('Revisa los campos obligatorios del producto.');
      return;
    }

    const request = this.buildSaveRequest();

    if (this.modalMode() === 'edit') {
      this.actualizarProducto(request);
      return;
    }

    this.guardando.set(true);
    this.productsService
      .create(request)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = this.getResponseMessage(response.message, response.errors, 'No se pudo crear el producto.');
            this.mensajeFormulario.set(message);
            this.notifications.error(message, { title: 'No se pudo guardar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Producto creado correctamente.');
          this.loadProducts();
        },
        error: () => {
          const message = 'No se pudo crear el producto.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  verProducto(product: ProductListItem): void {
    this.openDetailModal(product, 'view');
  }

  editarProducto(product: ProductListItem): void {
    this.openDetailModal(product, 'edit');
  }

  eliminarProducto(product: ProductListItem): void {
    this.recordFocusedElement();
    this.modalMode.set('delete');
    this.selectedProduct.set(product);
    this.detailProduct.set(null);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
  }

  cambiarEstadoProducto(product: ProductListItem): void {
    this.recordFocusedElement();
    this.modalMode.set(this.isActive(product) ? 'deactivate' : 'activate');
    this.selectedProduct.set(product);
    this.detailProduct.set(null);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
  }

  confirmarEliminacion(): void {
    const product = this.selectedProduct();
    const id = this.getProductId(product);

    if (id === null) {
      this.notifications.error('No se pudo identificar el producto.', { title: 'No se pudo eliminar' });
      return;
    }

    this.guardando.set(true);
    this.productsService
      .remove(id)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo eliminar el producto.'), { title: 'No se pudo eliminar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Producto eliminado correctamente.');
          this.loadProducts();
        },
        error: () => {
          this.notifications.error('No se pudo eliminar el producto.', { title: 'No se pudo eliminar' });
        },
      });
  }

  confirmarCambioEstado(): void {
    const product = this.selectedProduct();
    const id = this.getProductId(product);
    const activating = this.modalMode() === 'activate';

    if (id === null) {
      this.notifications.error('No se pudo identificar el producto.', { title: 'No se pudo actualizar' });
      return;
    }

    this.guardando.set(true);
    const request = activating ? this.productsService.activate(id) : this.productsService.deactivate(id);

    request.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo actualizar el producto.'), { title: 'No se pudo actualizar' });
          return;
        }

        this.cerrarModal();
        this.notifications.success(response.message || (activating ? 'Producto activado correctamente.' : 'Producto desactivado correctamente.'));
        this.loadProducts();
      },
      error: () => {
        this.notifications.error('No se pudo actualizar el producto.', { title: 'No se pudo actualizar' });
      },
    });
  }

  modalTitle(): string {
    switch (this.modalMode()) {
      case 'view':
        return 'Detalle de producto';
      case 'edit':
        return 'Editar producto';
      case 'delete':
        return 'Eliminar producto';
      case 'activate':
        return 'Activar producto';
      case 'deactivate':
        return 'Desactivar producto';
      case 'create':
        return 'Nuevo producto';
    }
  }

  trackProduct(index: number, product: ProductListItem): number | string {
    return product.id ?? product.code ?? index;
  }

  trackCategory(index: number, category: Category): number | string {
    return category.id ?? category.categoryId ?? category.name ?? index;
  }

  trackBrand(index: number, brand: Brand): number | string {
    return brand.id ?? brand.brandId ?? brand.name ?? index;
  }

  trackMeasurementUnit(index: number, measurementUnit: MeasurementUnit): number | string {
    return measurementUnit.id ?? measurementUnit.measurementUnitId ?? measurementUnit.name ?? index;
  }

  isActive(product: ProductListItem): boolean {
    return product.active !== false;
  }

  tracksInventory(product: ProductListItem): boolean {
    return product.tracksInventory === true;
  }

  catalogCategoryId(category: Category): number {
    return category.id ?? category.categoryId ?? 0;
  }

  catalogBrandId(brand: Brand): number {
    return brand.id ?? brand.brandId ?? 0;
  }

  catalogMeasurementUnitId(measurementUnit: MeasurementUnit): number {
    return measurementUnit.id ?? measurementUnit.measurementUnitId ?? 0;
  }

  campoInvalido(controlName: string): boolean {
    const control = this.productForm.get(controlName);
    return Boolean(control?.invalid && (control.dirty || control.touched));
  }

  formatCurrency(value: number | null | undefined): string {
    return this.moneyFormatter.format(value ?? 0);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-MX');
  }

  private loadCatalogs(): void {
    forkJoin({
      categories: this.categoriesService.getAll({ active: true }),
      brands: this.brandsService.getAll({ active: true }),
      measurementUnits: this.measurementUnitsService.getAll({ active: true }),
    }).subscribe({
      next: ({ categories, brands, measurementUnits }) => {
        if (categories.success) {
          this.categories.set(categories.data ?? []);
        } else {
          this.notifications.error(categories.message || 'No se pudieron cargar las categorías.');
        }

        if (brands.success) {
          this.brands.set(brands.data ?? []);
        } else {
          this.notifications.error(brands.message || 'No se pudieron cargar las marcas.');
        }

        if (measurementUnits.success) {
          this.measurementUnits.set(measurementUnits.data ?? []);
        } else {
          this.notifications.error(measurementUnits.message || 'No se pudieron cargar las unidades de medida.');
        }
      },
      error: () => {
        this.notifications.error('No se pudieron cargar los catálogos del producto.');
      },
    });
  }

  private buildFilters(): ProductFilters {
    const formValue = this.filterForm.getRawValue();
    const search = formValue.search.trim();

    return {
      search: search || undefined,
      categoryId: this.parseOptionalNumber(formValue.categoryId) ?? undefined,
      brandId: this.parseOptionalNumber(formValue.brandId) ?? undefined,
      active: formValue.active === '' ? undefined : formValue.active === 'true',
      tracksInventory: formValue.tracksInventory === '' ? undefined : formValue.tracksInventory === 'true',
    };
  }

  private listenSearchChanges(): void {
    this.filterForm.controls.search.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadProducts());
  }

  private buildSaveRequest(): ProductSaveRequest {
    const formValue = this.productForm.getRawValue();
    const barcode = formValue.barcode.trim();
    const description = formValue.description.trim();

    return {
      categoryId: this.parseRequiredNumber(formValue.categoryId),
      brandId: this.parseOptionalNumber(formValue.brandId),
      measurementUnitId: this.parseRequiredNumber(formValue.measurementUnitId),
      code: formValue.code.trim(),
      barcode: barcode || null,
      name: formValue.name.trim(),
      description: description || null,
      purchasePrice: this.parseNumber(formValue.purchasePrice),
      salePrice: this.parseNumber(formValue.salePrice),
      minimumStock: this.parseNumber(formValue.minimumStock),
      maximumStock: this.parseOptionalNumber(formValue.maximumStock),
      tracksInventory: formValue.tracksInventory,
    };
  }

  private actualizarProducto(request: ProductSaveRequest): void {
    const id = this.getProductId(this.selectedProduct());

    if (id === null) {
      this.notifications.error('No se pudo identificar el producto.', { title: 'No se pudo guardar' });
      return;
    }

    this.guardando.set(true);
    this.productsService
      .update(id, request)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = this.getResponseMessage(response.message, response.errors, 'No se pudo actualizar el producto.');
            this.mensajeFormulario.set(message);
            this.notifications.error(message, { title: 'No se pudo guardar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Producto actualizado correctamente.');
          this.loadProducts();
        },
        error: () => {
          const message = 'No se pudo actualizar el producto.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  private openDetailModal(product: ProductListItem, mode: Extract<ProductModalMode, 'view' | 'edit'>): void {
    const id = this.getProductId(product);

    if (id === null) {
      this.notifications.error('No se pudo identificar el producto.');
      return;
    }

    this.recordFocusedElement();
    this.modalMode.set(mode);
    this.selectedProduct.set(product);
    this.detailProduct.set(null);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    this.cargandoDetalle.set(true);

    this.productsService
      .getById(id)
      .pipe(finalize(() => this.cargandoDetalle.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success || !response.data) {
            const message = response.message || 'No se pudo cargar el producto.';
            this.mensajeFormulario.set(message);
            this.notifications.error(message);
            return;
          }

          this.detailProduct.set(response.data);

          if (mode === 'edit') {
            this.fillProductForm(response.data);
            setTimeout(() => this.productNameInput()?.nativeElement.focus());
          }
        },
        error: () => {
          const message = 'No se pudo cargar el producto.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message);
        },
      });
  }

  private fillProductForm(product: ProductResponse): void {
    this.productForm.reset({
      categoryId: String(product.categoryId),
      brandId: product.brandId ? String(product.brandId) : '',
      measurementUnitId: String(product.measurementUnitId),
      code: product.code,
      barcode: product.barcode ?? '',
      name: product.name,
      description: product.description ?? '',
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
      minimumStock: product.minimumStock,
      maximumStock: product.maximumStock === null || product.maximumStock === undefined ? '' : String(product.maximumStock),
      tracksInventory: product.tracksInventory,
    });
  }

  private resetProductForm(): void {
    this.productForm.reset({
      categoryId: '',
      brandId: '',
      measurementUnitId: '',
      code: '',
      barcode: '',
      name: '',
      description: '',
      purchasePrice: 0,
      salePrice: 0,
      minimumStock: 0,
      maximumStock: '',
      tracksInventory: true,
    });
  }

  private getProductId(product: ProductListItem | null): number | null {
    return product?.id ?? null;
  }

  private getResponseMessage(message: string, errors: string[] | null, fallback: string): string {
    return errors?.length ? errors.join(' ') : message || fallback;
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

  private parseNumber(value: string | number): number {
    return this.parseOptionalNumber(value) ?? 0;
  }

  private recordFocusedElement(): void {
    const activeElement = this.document.activeElement;
    this.lastFocusedElement = activeElement instanceof HTMLElement ? activeElement : this.newProductButton()?.nativeElement ?? null;
  }

  private restoreFocus(): void {
    setTimeout(() => {
      const target = this.lastFocusedElement ?? this.newProductButton()?.nativeElement;
      target?.focus();
      this.lastFocusedElement = null;
    });
  }

  private setModalState(open: boolean): void {
    this.document.body.classList.toggle('modal-open', open);
    this.document.body.style.overflow = open ? 'hidden' : '';
  }
}
