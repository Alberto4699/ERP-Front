import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { Category, CategoryFilters, CategorySaveRequest } from '../../core/models/category.model';
import { CategoriesService } from '../../core/services/categories';

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
  private readonly fb = inject(FormBuilder);
  private readonly categoriesService = inject(CategoriesService);
  private readonly categoryNameInput = viewChild<ElementRef<HTMLInputElement>>('categoryNameInput');
  private readonly newCategoryButton = viewChild<ElementRef<HTMLButtonElement>>('newCategoryButton');

  readonly categories = signal<Category[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly mostrandoFormulario = signal(false);
  readonly mensajeError = signal('');
  readonly mensajeFormulario = signal('');
  readonly mensajeExito = signal('');

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    active: [''],
  });

  readonly categoryForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
    description: [''],
  });

  ngOnInit(): void {
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
            this.categories.set([]);
            this.mensajeError.set(response.message || 'No se pudieron cargar las categorías.');
            return;
          }

          this.categories.set(response.data ?? []);
        },
        error: () => {
          this.categories.set([]);
          this.mensajeError.set('No se pudieron cargar las categorías.');
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
    });
    this.loadCategories();
  }

  nuevaCategoria(): void {
    this.categoryForm.reset({
      name: '',
      description: '',
    });
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.mensajeExito.set('');
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
    this.mensajeExito.set('');

    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      this.mensajeFormulario.set('Ingresa el nombre de la categoría.');
      return;
    }

    const request = this.buildSaveRequest();

    this.guardando.set(true);
    this.categoriesService
      .create(request)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            this.mensajeFormulario.set(this.getResponseMessage(response.message, response.errors));
            return;
          }

          this.cancelarNuevaCategoria();
          this.mensajeExito.set(response.message || 'Categoría creada correctamente.');
          this.loadCategories();
        },
        error: () => {
          this.mensajeFormulario.set('No se pudo crear la categoría.');
        },
      });
  }

  nombreCategoriaInvalido(): boolean {
    const control = this.categoryForm.controls.name;
    return control.invalid && (control.dirty || control.touched);
  }

  trackCategory(index: number, category: Category): number | string {
    return category.id ?? category.categoryId ?? category.name ?? index;
  }

  displayId(category: Category): number | string {
    return category.id ?? category.categoryId ?? '-';
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

  private buildSaveRequest(): CategorySaveRequest {
    const formValue = this.categoryForm.getRawValue();
    const description = formValue.description.trim();

    return {
      name: formValue.name.trim(),
      description: description || null,
    };
  }

  private getResponseMessage(message: string, errors: string[] | null): string {
    return errors?.length ? errors.join(' ') : message || 'No se pudo crear la categoría.';
  }

  private setModalState(open: boolean): void {
    this.document.body.classList.toggle('modal-open', open);
    this.document.body.style.overflow = open ? 'hidden' : '';
  }
}
