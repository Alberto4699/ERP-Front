import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { Brand, BrandFilters, BrandSaveRequest } from '../../core/models/brand.model';
import { BrandsService } from '../../core/services/brands';
import { NotificationsService } from '../../core/services/notifications';

type BrandModalMode = 'create' | 'view' | 'edit' | 'delete';

@Component({
  selector: 'app-brands',
  imports: [ReactiveFormsModule],
  templateUrl: './brands.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'cerrarModalConEscape()',
  },
})
export class Brands implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly brandsService = inject(BrandsService);
  private readonly notifications = inject(NotificationsService);
  private readonly brandNameInput = viewChild<ElementRef<HTMLInputElement>>('brandNameInput');
  private readonly newBrandButton = viewChild<ElementRef<HTMLButtonElement>>('newBrandButton');

  readonly brands = signal<Brand[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly mostrandoFormulario = signal(false);
  readonly modalMode = signal<BrandModalMode>('create');
  readonly selectedBrand = signal<Brand | null>(null);
  readonly mensajeError = signal('');
  readonly mensajeFormulario = signal('');

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    active: [''],
  });

  readonly brandForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
    description: [''],
  });

  ngOnInit(): void {
    this.listenSearchChanges();
    this.loadBrands();
  }

  ngOnDestroy(): void {
    this.setModalState(false);
  }

  loadBrands(): void {
    this.cargando.set(true);
    this.mensajeError.set('');

    this.brandsService
      .getAll(this.buildFilters())
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = response.message || 'No se pudieron cargar las marcas.';
            this.brands.set([]);
            this.mensajeError.set(message);
            this.notifications.error(message);
            return;
          }

          this.brands.set(response.data ?? []);
        },
        error: () => {
          const message = 'No se pudieron cargar las marcas.';
          this.brands.set([]);
          this.mensajeError.set(message);
          this.notifications.error(message);
        },
      });
  }

  buscar(): void {
    this.loadBrands();
  }

  limpiarFiltros(): void {
    this.filterForm.reset(
      {
        search: '',
        active: '',
      },
      { emitEvent: false }
    );
    this.loadBrands();
  }

  nuevaMarca(): void {
    this.brandForm.reset({
      name: '',
      description: '',
    });
    this.modalMode.set('create');
    this.selectedBrand.set(null);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.brandNameInput()?.nativeElement.focus());
  }

  cerrarModal(): void {
    this.mostrandoFormulario.set(false);
    this.mensajeFormulario.set('');
    this.brandForm.reset({
      name: '',
      description: '',
    });
    this.selectedBrand.set(null);
    this.modalMode.set('create');
    this.setModalState(false);
    setTimeout(() => this.newBrandButton()?.nativeElement.focus());
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

  guardarMarca(): void {
    this.mensajeFormulario.set('');

    if (this.brandForm.invalid) {
      this.brandForm.markAllAsTouched();
      this.mensajeFormulario.set('Ingresa el nombre de la marca.');
      return;
    }

    const request = this.buildSaveRequest();

    if (this.modalMode() === 'edit') {
      this.actualizarMarca(request);
      return;
    }

    this.guardando.set(true);
    this.brandsService
      .create(request)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = this.getResponseMessage(response.message, response.errors);
            this.mensajeFormulario.set(message);
            this.notifications.error(message, { title: 'No se pudo guardar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Marca creada correctamente.');
          this.loadBrands();
        },
        error: () => {
          const message = 'No se pudo crear la marca.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  nombreMarcaInvalido(): boolean {
    const control = this.brandForm.controls.name;
    return control.invalid && (control.dirty || control.touched);
  }

  verMarca(brand: Brand): void {
    this.modalMode.set('view');
    this.selectedBrand.set(brand);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
  }

  editarMarca(brand: Brand): void {
    this.modalMode.set('edit');
    this.selectedBrand.set(brand);
    this.mensajeFormulario.set('');
    this.brandForm.reset({
      name: brand.name,
      description: brand.description ?? '',
    });
    this.mostrandoFormulario.set(true);
    this.setModalState(true);
    setTimeout(() => this.brandNameInput()?.nativeElement.focus());
  }

  eliminarMarca(brand: Brand): void {
    this.modalMode.set('delete');
    this.selectedBrand.set(brand);
    this.mensajeFormulario.set('');
    this.mostrandoFormulario.set(true);
    this.setModalState(true);
  }

  mostrarMasAcciones(brand: Brand): void {
    void brand;
  }

  confirmarEliminacion(): void {
    const brand = this.selectedBrand();
    const id = this.getBrandId(brand);

    if (id === null) {
      this.notifications.error('No se pudo identificar la marca.', { title: 'No se pudo eliminar' });
      return;
    }

    this.guardando.set(true);
    this.brandsService
      .remove(id)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            this.notifications.error(this.getResponseMessage(response.message, response.errors), { title: 'No se pudo eliminar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Marca eliminada correctamente.');
          this.loadBrands();
        },
        error: () => {
          this.notifications.error('No se pudo eliminar la marca.', { title: 'No se pudo eliminar' });
        },
      });
  }

  modalTitle(): string {
    switch (this.modalMode()) {
      case 'view':
        return 'Detalle de marca';
      case 'edit':
        return 'Editar marca';
      case 'delete':
        return 'Eliminar marca';
      case 'create':
        return 'Nueva marca';
    }
  }

  trackBrand(index: number, brand: Brand): number | string {
    return brand.id ?? brand.brandId ?? brand.name ?? index;
  }

  isActive(brand: Brand): boolean {
    return brand.active !== false;
  }

  private buildFilters(): BrandFilters {
    const formValue = this.filterForm.getRawValue();
    const search = formValue.search.trim();

    return {
      search: search || undefined,
      active: formValue.active === '' ? undefined : formValue.active === 'true',
    };
  }

  private listenSearchChanges(): void {
    this.filterForm.controls.search.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadBrands());
  }

  private buildSaveRequest(): BrandSaveRequest {
    const formValue = this.brandForm.getRawValue();
    const description = formValue.description.trim();

    return {
      name: formValue.name.trim(),
      description: description || null,
    };
  }

  private actualizarMarca(request: BrandSaveRequest): void {
    const id = this.getBrandId(this.selectedBrand());

    if (id === null) {
      this.notifications.error('No se pudo identificar la marca.', { title: 'No se pudo guardar' });
      return;
    }

    this.guardando.set(true);
    this.brandsService
      .update(id, request)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = this.getResponseMessage(response.message, response.errors);
            this.mensajeFormulario.set(message);
            this.notifications.error(message, { title: 'No se pudo guardar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Marca actualizada correctamente.');
          this.loadBrands();
        },
        error: () => {
          const message = 'No se pudo actualizar la marca.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  private getBrandId(brand: Brand | null): number | null {
    return brand?.id ?? brand?.brandId ?? null;
  }

  private getResponseMessage(message: string, errors: string[] | null): string {
    return errors?.length ? errors.join(' ') : message || 'No se pudo crear la marca.';
  }

  private setModalState(open: boolean): void {
    this.document.body.classList.toggle('modal-open', open);
    this.document.body.style.overflow = open ? 'hidden' : '';
  }
}
