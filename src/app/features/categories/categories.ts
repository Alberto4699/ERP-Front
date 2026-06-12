import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { Category, CategoryFilters, CategorySaveRequest } from '../../core/models/category.model';
import { CategoriesService } from '../../core/services/categories';
import { NotificationsService } from '../../core/services/notifications';

type CategoryModalMode = 'create' | 'view' | 'edit' | 'delete';

@Component({
  selector: 'app-categories',
  imports: [ReactiveFormsModule],
  templateUrl: './categories.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'cerrarModalConEscape()',
  },
})
export class Categories implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly categoriesService = inject(CategoriesService);
  private readonly notifications = inject(NotificationsService);
  private readonly categoryNameInput = viewChild<ElementRef<HTMLInputElement>>('categoryNameInput');
  private readonly newCategoryButton = viewChild<ElementRef<HTMLButtonElement>>('newCategoryButton');

  readonly categories = signal<Category[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly mostrandoFormulario = signal(false);
  readonly modalMode = signal<CategoryModalMode>('create');
  readonly selectedCategory = signal<Category | null>(null);
  readonly mensajeError = signal('');
  readonly mensajeFormulario = signal('');

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    active: [''],
  });

  readonly categoryForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
    description: [''],
  });

  ngOnInit(): void {
    this.listenSearchChanges();
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.setModalState(false);
  }

  loadCategories(): void {
    this.cargando.set(true);
    this.mensajeError.set('');

    this.categoriesService
      .getAll(this.buildFilters())
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = response.message || 'No se pudieron cargar las categorías.';
            this.categories.set([]);
            this.mensajeError.set(message);
            this.notifications.error(message);
            return;
          }

          this.categories.set(response.data ?? []);
        },
        error: () => {
          const message = 'No se pudieron cargar las categorías.';
          this.categories.set([]);
          this.mensajeError.set(message);
          this.notifications.error(message);
        },
      });
  }

  buscar(): void {
    this.loadCategories();
  }

  limpiarFiltros(): void {
    this.filterForm.reset({
      search: '',
      active: '',
    }, { emitEvent: false });
    this.loadCategories();
  }

  nuevaCategoria(): void {
    this.categoryForm.reset({
      name: '',
      description: '',
    });
    this.modalMode.set('create');
    this.selectedCategory.set(null);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.categoryNameInput()?.nativeElement.focus());
  }

  cancelarNuevaCategoria(): void {
    this.mostrandoFormulario.set(false);
    this.mensajeFormulario.set('');
    this.categoryForm.reset({
      name: '',
      description: '',
    });
    this.selectedCategory.set(null);
    this.modalMode.set('create');
    this.setModalState(false);
    setTimeout(() => this.newCategoryButton()?.nativeElement.focus());
  }

  cerrarModalConEscape(): void {
    if (!this.mostrandoFormulario() || this.guardando()) {
      return;
    }

    this.cancelarNuevaCategoria();
  }

  cerrarModalDesdeBackdrop(event: MouseEvent): void {
    if (event.target !== event.currentTarget || this.guardando()) {
      return;
    }

    this.cancelarNuevaCategoria();
  }

  guardarCategoria(): void {
    this.mensajeFormulario.set('');

    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      this.mensajeFormulario.set('Ingresa el nombre de la categoría.');
      return;
    }

    const request = this.buildSaveRequest();

    if (this.modalMode() === 'edit') {
      this.actualizarCategoria(request);
      return;
    }

    this.guardando.set(true);
    this.categoriesService
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

          this.cancelarNuevaCategoria();
          this.notifications.success(response.message || 'Categoría creada correctamente.');
          this.loadCategories();
        },
        error: () => {
          const message = 'No se pudo crear la categoría.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  nombreCategoriaInvalido(): boolean {
    const control = this.categoryForm.controls.name;
    return control.invalid && (control.dirty || control.touched);
  }

  verCategoria(category: Category): void {
    this.modalMode.set('view');
    this.selectedCategory.set(category);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
  }

  editarCategoria(category: Category): void {
    this.modalMode.set('edit');
    this.selectedCategory.set(category);
    this.mensajeFormulario.set('');
    this.categoryForm.reset({
      name: category.name,
      description: category.description ?? '',
    });
    this.mostrandoFormulario.set(true);
    this.setModalState(true);
    setTimeout(() => this.categoryNameInput()?.nativeElement.focus());
  }

  eliminarCategoria(category: Category): void {
    this.modalMode.set('delete');
    this.selectedCategory.set(category);
    this.mensajeFormulario.set('');
    this.mostrandoFormulario.set(true);
    this.setModalState(true);
  }

  mostrarMasAcciones(category: Category): void {
    void category;
  }

  confirmarEliminacion(): void {
    const category = this.selectedCategory();
    const id = this.getCategoryId(category);

    if (id === null) {
      this.notifications.error('No se pudo identificar la categoría.', { title: 'No se pudo eliminar' });
      return;
    }

    this.guardando.set(true);
    this.categoriesService
      .remove(id)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            this.notifications.error(this.getResponseMessage(response.message, response.errors), { title: 'No se pudo eliminar' });
            return;
          }

          this.cancelarNuevaCategoria();
          this.notifications.success(response.message || 'Categoría eliminada correctamente.');
          this.loadCategories();
        },
        error: () => {
          this.notifications.error('No se pudo eliminar la categoría.', { title: 'No se pudo eliminar' });
        },
      });
  }

  modalTitle(): string {
    switch (this.modalMode()) {
      case 'view':
        return 'Detalle de categoría';
      case 'edit':
        return 'Editar categoría';
      case 'delete':
        return 'Eliminar categoría';
      case 'create':
        return 'Nueva categoría';
    }
  }

  trackCategory(index: number, category: Category): number | string {
    return category.id ?? category.categoryId ?? category.name ?? index;
  }

  isActive(category: Category): boolean {
    return category.active !== false;
  }

  private buildFilters(): CategoryFilters {
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
      .subscribe(() => this.loadCategories());
  }

  private buildSaveRequest(): CategorySaveRequest {
    const formValue = this.categoryForm.getRawValue();
    const description = formValue.description.trim();

    return {
      name: formValue.name.trim(),
      description: description || null,
    };
  }

  private actualizarCategoria(request: CategorySaveRequest): void {
    const id = this.getCategoryId(this.selectedCategory());

    if (id === null) {
      this.notifications.error('No se pudo identificar la categoría.', { title: 'No se pudo guardar' });
      return;
    }

    this.guardando.set(true);
    this.categoriesService
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

          this.cancelarNuevaCategoria();
          this.notifications.success(response.message || 'Categoría actualizada correctamente.');
          this.loadCategories();
        },
        error: () => {
          const message = 'No se pudo actualizar la categoría.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  private getCategoryId(category: Category | null): number | null {
    return category?.id ?? category?.categoryId ?? null;
  }

  private getResponseMessage(message: string, errors: string[] | null): string {
    return errors?.length ? errors.join(' ') : message || 'No se pudo crear la categoría.';
  }

  private setModalState(open: boolean): void {
    this.document.body.classList.toggle('modal-open', open);
    this.document.body.style.overflow = open ? 'hidden' : '';
  }
}
