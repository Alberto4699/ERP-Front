import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize, forkJoin } from 'rxjs';

import { Branch } from '../../core/models/branch.model';
import { Customer } from '../../core/models/customer.model';
import { ProductListItem } from '../../core/models/product.model';
import { Quotation, QuotationCreateRequest, QuotationDetail, QuotationFilters, QuotationUpdateRequest } from '../../core/models/quotation.model';
import { BranchesService } from '../../core/services/branches';
import { CustomersService } from '../../core/services/customers';
import { NotificationsService } from '../../core/services/notifications';
import { ProductsService } from '../../core/services/products';
import { QuotationsService } from '../../core/services/quotations';
import { Session } from '../../core/services/session';

type QuotationModalMode = 'create' | 'edit' | 'view' | 'delete' | 'send' | 'accept' | 'reject' | 'cancel';

@Component({
  selector: 'app-quotations',
  imports: [ReactiveFormsModule],
  templateUrl: './quotations.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'cerrarModalConEscape()',
  },
})
export class Quotations implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly quotationsService = inject(QuotationsService);
  private readonly customersService = inject(CustomersService);
  private readonly branchesService = inject(BranchesService);
  private readonly productsService = inject(ProductsService);
  private readonly session = inject(Session);
  private readonly notifications = inject(NotificationsService);
  private readonly newQuotationButton = viewChild<ElementRef<HTMLButtonElement>>('newQuotationButton');
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

  readonly quotations = signal<Quotation[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly products = signal<ProductListItem[]>([]);
  readonly cargando = signal(false);
  readonly cargandoCatalogos = signal(false);
  readonly cargandoDetalle = signal(false);
  readonly guardando = signal(false);
  readonly mostrandoFormulario = signal(false);
  readonly modalMode = signal<QuotationModalMode>('create');
  readonly selectedQuotation = signal<Quotation | null>(null);
  readonly mensajeError = signal('');
  readonly mensajeFormulario = signal('');

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    customerId: [''],
    branchId: [''],
    salespersonUserId: [''],
    status: [''],
    fromDate: [''],
    toDate: [''],
  });

  readonly quotationForm = this.fb.nonNullable.group({
    customerId: [''],
    branchId: ['', [Validators.required]],
    folio: ['', [Validators.maxLength(50)]],
    quotationDate: [''],
    expirationDate: [''],
    vatPercentage: [16, [Validators.required, Validators.min(0), Validators.max(100)]],
    notes: ['', [Validators.maxLength(500)]],
    details: this.fb.array([this.createDetailForm()]),
  });

  get quotationDetails() {
    return this.quotationForm.controls.details;
  }

  ngOnInit(): void {
    this.listenSearchChanges();
    this.loadCatalogs();
    this.loadQuotations();
  }

  ngOnDestroy(): void {
    this.setModalState(false);
  }

  loadQuotations(): void {
    this.cargando.set(true);
    this.mensajeError.set('');

    this.quotationsService
      .getAll(this.buildFilters())
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = response.message || 'No se pudieron cargar las cotizaciones.';
            this.quotations.set([]);
            this.mensajeError.set(message);
            this.notifications.error(message);
            return;
          }

          this.quotations.set(response.data ?? []);
        },
        error: () => {
          const message = 'No se pudieron cargar las cotizaciones.';
          this.quotations.set([]);
          this.mensajeError.set(message);
          this.notifications.error(message);
        },
      });
  }

  buscar(): void {
    this.loadQuotations();
  }

  limpiarFiltros(): void {
    this.filterForm.reset(
      {
        search: '',
        customerId: '',
        branchId: '',
        salespersonUserId: '',
        status: '',
        fromDate: '',
        toDate: '',
      },
      { emitEvent: false }
    );
    this.loadQuotations();
  }

  nuevaCotizacion(): void {
    this.recordFocusedElement();
    this.resetQuotationForm();
    this.modalMode.set('create');
    this.selectedQuotation.set(null);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.modalCloseButton()?.nativeElement.focus());
  }

  editarCotizacion(quotation: Quotation): void {
    this.recordFocusedElement();
    this.resetQuotationForm(quotation);
    this.modalMode.set('edit');
    this.selectedQuotation.set(quotation);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.modalCloseButton()?.nativeElement.focus());
    this.loadQuotationDetail(quotation, true);
  }

  verCotizacion(quotation: Quotation): void {
    this.recordFocusedElement();
    this.modalMode.set('view');
    this.selectedQuotation.set(quotation);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.modalCloseButton()?.nativeElement.focus());
    this.loadQuotationDetail(quotation);
  }

  eliminarCotizacion(quotation: Quotation): void {
    this.openActionModal(quotation, 'delete');
  }

  enviarCotizacion(quotation: Quotation): void {
    this.openActionModal(quotation, 'send');
  }

  aceptarCotizacion(quotation: Quotation): void {
    this.openActionModal(quotation, 'accept');
  }

  rechazarCotizacion(quotation: Quotation): void {
    this.openActionModal(quotation, 'reject');
  }

  cancelarCotizacion(quotation: Quotation): void {
    this.openActionModal(quotation, 'cancel');
  }

  cerrarModal(): void {
    this.mostrandoFormulario.set(false);
    this.mensajeFormulario.set('');
    this.selectedQuotation.set(null);
    this.cargandoDetalle.set(false);
    this.modalMode.set('create');
    this.resetQuotationForm();
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

  guardarCotizacion(): void {
    this.mensajeFormulario.set('');

    if (this.quotationForm.invalid) {
      this.quotationForm.markAllAsTouched();
      this.mensajeFormulario.set('Revisa los campos obligatorios de la cotización.');
      return;
    }

    const salespersonUserId = this.resolveSalespersonUserId();

    if (salespersonUserId === null) {
      this.mensajeFormulario.set('No se pudo identificar el vendedor de la cotización.');
      return;
    }

    if (this.modalMode() === 'edit') {
      this.actualizarCotizacion(salespersonUserId);
      return;
    }

    this.guardando.set(true);
    this.quotationsService
      .create(this.buildCreateRequest(salespersonUserId))
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = this.getResponseMessage(response.message, response.errors, 'No se pudo crear la cotización.');
            this.mensajeFormulario.set(message);
            this.notifications.error(message, { title: 'No se pudo guardar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Cotización creada correctamente.');
          this.loadQuotations();
        },
        error: () => {
          const message = 'No se pudo crear la cotización.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  confirmarEliminacion(): void {
    const id = this.getQuotationId(this.selectedQuotation());

    if (id === null) {
      this.notifications.error('No se pudo identificar la cotización.', { title: 'No se pudo eliminar' });
      return;
    }

    this.guardando.set(true);
    this.quotationsService
      .remove(id)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo eliminar la cotización.'), { title: 'No se pudo eliminar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Cotización eliminada correctamente.');
          this.loadQuotations();
        },
        error: () => {
          this.notifications.error('No se pudo eliminar la cotización.', { title: 'No se pudo eliminar' });
        },
      });
  }

  confirmarAccionEstado(): void {
    const id = this.getQuotationId(this.selectedQuotation());

    if (id === null) {
      this.notifications.error('No se pudo identificar la cotización.', { title: 'No se pudo actualizar' });
      return;
    }

    const request = this.buildStatusRequest(id);

    if (!request) {
      return;
    }

    this.guardando.set(true);
    request.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notifications.error(this.getResponseMessage(response.message, response.errors, 'No se pudo actualizar la cotización.'), { title: 'No se pudo actualizar' });
          return;
        }

        this.cerrarModal();
        this.notifications.success(response.message || this.statusSuccessMessage());
        this.loadQuotations();
      },
      error: () => {
        this.notifications.error('No se pudo actualizar la cotización.', { title: 'No se pudo actualizar' });
      },
    });
  }

  agregarDetalle(): void {
    this.quotationDetails.push(this.createDetailForm());
  }

  eliminarDetalle(index: number): void {
    if (this.quotationDetails.length === 1) {
      this.quotationDetails.at(0).reset({
        productId: '',
        quantity: 1,
        unitPrice: 0,
        vatPercentage: '',
      });
      return;
    }

    this.quotationDetails.removeAt(index);
  }

  modalTitle(): string {
    switch (this.modalMode()) {
      case 'edit':
        return 'Editar cotización';
      case 'view':
        return 'Detalle de cotización';
      case 'delete':
        return 'Eliminar cotización';
      case 'send':
        return 'Enviar cotización';
      case 'accept':
        return 'Aceptar cotización';
      case 'reject':
        return 'Rechazar cotización';
      case 'cancel':
        return 'Cancelar cotización';
      case 'create':
        return 'Nueva cotización';
    }
  }

  submitButtonText(): string {
    if (this.guardando()) {
      return this.modalMode() === 'edit' ? 'Actualizando...' : 'Guardando...';
    }

    return this.modalMode() === 'edit' ? 'Actualizar' : 'Guardar';
  }

  actionQuestion(): string {
    switch (this.modalMode()) {
      case 'send':
        return '¿Deseas marcar esta cotización como enviada?';
      case 'accept':
        return '¿Deseas aceptar esta cotización?';
      case 'reject':
        return '¿Deseas rechazar esta cotización?';
      case 'cancel':
        return '¿Deseas cancelar esta cotización?';
      default:
        return '';
    }
  }

  actionHint(): string {
    switch (this.modalMode()) {
      case 'send':
        return 'La cotización quedará marcada como enviada al cliente.';
      case 'accept':
        return 'La cotización quedará aceptada.';
      case 'reject':
        return 'La cotización quedará rechazada.';
      case 'cancel':
        return 'La cotización quedará cancelada.';
      default:
        return '';
    }
  }

  actionButtonText(): string {
    if (this.guardando()) {
      switch (this.modalMode()) {
        case 'send':
          return 'Enviando...';
        case 'accept':
          return 'Aceptando...';
        case 'reject':
          return 'Rechazando...';
        case 'cancel':
          return 'Cancelando...';
        default:
          return 'Actualizando...';
      }
    }

    switch (this.modalMode()) {
      case 'send':
        return 'Enviar';
      case 'accept':
        return 'Aceptar';
      case 'reject':
        return 'Rechazar';
      case 'cancel':
        return 'Cancelar cotización';
      default:
        return 'Confirmar';
    }
  }

  trackQuotation(index: number, quotation: Quotation): number | string {
    return quotation.id ?? quotation.quotationId ?? quotation.folio ?? index;
  }

  trackCustomer(index: number, customer: Customer): number | string {
    return this.getCustomerId(customer) ?? customer.name ?? index;
  }

  trackBranch(index: number, branch: Branch): number | string {
    return this.getBranchId(branch) ?? branch.code ?? index;
  }

  trackProduct(index: number, product: ProductListItem): number | string {
    return product.id ?? product.code ?? index;
  }

  trackQuotationDetail(index: number, detail: QuotationDetail): number | string {
    return detail.id ?? detail.quotationDetailId ?? detail.productId ?? index;
  }

  getCustomerId(customer: Customer | null): number | null {
    return customer?.id ?? customer?.customerId ?? null;
  }

  getBranchId(branch: Branch | null): number | null {
    return branch?.id ?? branch?.branchId ?? null;
  }

  productLabel(product: ProductListItem): string {
    return `${product.code} - ${product.name}`;
  }

  customerName(quotation: Quotation): string {
    const customer = this.findCustomer(quotation.customerId);
    return quotation.customerName || customer?.name || 'Mostrador';
  }

  branchName(quotation: Quotation): string {
    const branch = this.findBranch(quotation.branchId);
    return quotation.branchName || branch?.name || '-';
  }

  salespersonName(quotation: Quotation): string {
    return quotation.salespersonUserName || (quotation.salespersonUserId ? `Usuario ${quotation.salespersonUserId}` : '-');
  }

  productName(detail: QuotationDetail): string {
    const product = this.findProduct(detail.productId);
    return detail.productName || product?.name || '-';
  }

  productCode(detail: QuotationDetail): string {
    const product = this.findProduct(detail.productId);
    return detail.productCode || product?.code || '-';
  }

  quotationDate(quotation: Quotation): string {
    const dateValue = quotation.quotationDate ?? quotation.createdAt;

    if (!dateValue) {
      return '-';
    }

    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? '-' : this.dateFormatter.format(date);
  }

  expirationDate(quotation: Quotation): string {
    if (!quotation.expirationDate) {
      return '-';
    }

    const date = new Date(quotation.expirationDate);
    return Number.isNaN(date.getTime()) ? '-' : this.dateFormatter.format(date);
  }

  statusText(quotation: Quotation): string {
    return quotation.status || 'Borrador';
  }

  isSent(quotation: Quotation): boolean {
    return ['sent', 'enviado', 'enviada'].includes(this.normalizedStatus(quotation));
  }

  isAccepted(quotation: Quotation): boolean {
    return ['accepted', 'aceptado', 'aceptada'].includes(this.normalizedStatus(quotation));
  }

  isRejected(quotation: Quotation): boolean {
    return ['rejected', 'rechazado', 'rechazada'].includes(this.normalizedStatus(quotation));
  }

  isCancelled(quotation: Quotation): boolean {
    return ['cancelled', 'canceled', 'cancelado', 'cancelada'].includes(this.normalizedStatus(quotation));
  }

  canEdit(quotation: Quotation): boolean {
    return !this.isAccepted(quotation) && !this.isRejected(quotation) && !this.isCancelled(quotation);
  }

  canSend(quotation: Quotation): boolean {
    return this.canEdit(quotation) && !this.isSent(quotation);
  }

  canAccept(quotation: Quotation): boolean {
    return !this.isAccepted(quotation) && !this.isRejected(quotation) && !this.isCancelled(quotation);
  }

  canReject(quotation: Quotation): boolean {
    return !this.isAccepted(quotation) && !this.isRejected(quotation) && !this.isCancelled(quotation);
  }

  canCancel(quotation: Quotation): boolean {
    return !this.isAccepted(quotation) && !this.isRejected(quotation) && !this.isCancelled(quotation);
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

  detailTotal(detail: QuotationDetail, quotationVatPercentage: number | undefined): number {
    const subtotal = detail.subtotal ?? (detail.quantity ?? 0) * (detail.unitPrice ?? 0);
    const vatPercentage = detail.vatPercentage ?? quotationVatPercentage ?? 0;
    const vatAmount = detail.vatAmount ?? subtotal * (vatPercentage / 100);
    return detail.total ?? subtotal + vatAmount;
  }

  quotationTotal(quotation: Quotation): string {
    if (quotation.total !== undefined) {
      return this.formatMoney(quotation.total);
    }

    const total = (quotation.details ?? []).reduce((sum, detail) => sum + this.detailTotal(detail, quotation.vatPercentage), 0);
    return this.formatMoney(total);
  }

  campoInvalido(controlName: string): boolean {
    const control = this.quotationForm.get(controlName);
    return Boolean(control?.invalid && (control.dirty || control.touched));
  }

  detalleCampoInvalido(index: number, controlName: string): boolean {
    const control = this.quotationDetails.at(index).get(controlName);
    return Boolean(control?.invalid && (control.dirty || control.touched));
  }

  private loadCatalogs(): void {
    this.cargandoCatalogos.set(true);

    forkJoin({
      customers: this.customersService.getAll({ active: true }),
      branches: this.branchesService.getAll({ active: true }),
      products: this.productsService.getAll({ active: true }),
    })
      .pipe(finalize(() => this.cargandoCatalogos.set(false)))
      .subscribe({
        next: ({ customers, branches, products }) => {
          if (!customers.success) {
            this.customers.set([]);
            this.notifications.error(customers.message || 'No se pudieron cargar los clientes.');
          } else {
            this.customers.set(customers.data ?? []);
          }

          if (!branches.success) {
            this.branches.set([]);
            this.notifications.error(branches.message || 'No se pudieron cargar las sucursales.');
          } else {
            this.branches.set(branches.data ?? []);
          }

          if (!products.success) {
            this.products.set([]);
            this.notifications.error(products.message || 'No se pudieron cargar los productos.');
          } else {
            this.products.set(products.data ?? []);
          }
        },
        error: () => {
          this.customers.set([]);
          this.branches.set([]);
          this.products.set([]);
          this.notifications.error('No se pudieron cargar los catálogos de cotizaciones.');
        },
      });
  }

  private loadQuotationDetail(quotation: Quotation, populateForm = false): void {
    const id = this.getQuotationId(quotation);

    if (id === null) {
      return;
    }

    this.cargandoDetalle.set(true);
    this.quotationsService
      .getById(id)
      .pipe(finalize(() => this.cargandoDetalle.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success || !response.data) {
            this.notifications.error(response.message || 'No se pudo cargar el detalle de la cotización.');
            return;
          }

          this.selectedQuotation.set(response.data);

          if (populateForm) {
            this.resetQuotationForm(response.data);
          }
        },
        error: () => {
          this.notifications.error('No se pudo cargar el detalle de la cotización.');
        },
      });
  }

  private actualizarCotizacion(salespersonUserId: number): void {
    const id = this.getQuotationId(this.selectedQuotation());

    if (id === null) {
      this.mensajeFormulario.set('No se pudo identificar la cotización.');
      return;
    }

    this.guardando.set(true);
    this.quotationsService
      .update(id, this.buildUpdateRequest(salespersonUserId))
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message = this.getResponseMessage(response.message, response.errors, 'No se pudo actualizar la cotización.');
            this.mensajeFormulario.set(message);
            this.notifications.error(message, { title: 'No se pudo guardar' });
            return;
          }

          this.cerrarModal();
          this.notifications.success(response.message || 'Cotización actualizada correctamente.');
          this.loadQuotations();
        },
        error: () => {
          const message = 'No se pudo actualizar la cotización.';
          this.mensajeFormulario.set(message);
          this.notifications.error(message, { title: 'No se pudo guardar' });
        },
      });
  }

  private openActionModal(quotation: Quotation, mode: QuotationModalMode): void {
    this.recordFocusedElement();
    this.modalMode.set(mode);
    this.selectedQuotation.set(quotation);
    this.mostrandoFormulario.set(true);
    this.mensajeFormulario.set('');
    this.setModalState(true);
    setTimeout(() => this.modalCloseButton()?.nativeElement.focus());
  }

  private buildFilters(): QuotationFilters {
    const formValue = this.filterForm.getRawValue();
    const search = formValue.search.trim();
    const status = formValue.status.trim();

    return {
      search: search || undefined,
      customerId: this.parseOptionalNumber(formValue.customerId) ?? undefined,
      branchId: this.parseOptionalNumber(formValue.branchId) ?? undefined,
      salespersonUserId: this.parseOptionalNumber(formValue.salespersonUserId) ?? undefined,
      status: status || undefined,
      fromDate: this.toDateTime(formValue.fromDate, false),
      toDate: this.toDateTime(formValue.toDate, true),
    };
  }

  private buildCreateRequest(salespersonUserId: number): QuotationCreateRequest {
    const formValue = this.quotationForm.getRawValue();

    return {
      customerId: this.parseOptionalNumber(formValue.customerId),
      branchId: this.parseRequiredNumber(formValue.branchId),
      salespersonUserId,
      folio: this.cleanOptionalValue(formValue.folio),
      quotationDate: formValue.quotationDate || null,
      expirationDate: formValue.expirationDate || null,
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

  private buildUpdateRequest(salespersonUserId: number): QuotationUpdateRequest {
    const formValue = this.quotationForm.getRawValue();

    return {
      customerId: this.parseOptionalNumber(formValue.customerId),
      branchId: this.parseRequiredNumber(formValue.branchId),
      salespersonUserId,
      quotationDate: formValue.quotationDate || null,
      expirationDate: formValue.expirationDate || null,
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

  private buildStatusRequest(id: number) {
    switch (this.modalMode()) {
      case 'send':
        return this.quotationsService.send(id);
      case 'accept':
        return this.quotationsService.accept(id);
      case 'reject':
        return this.quotationsService.reject(id);
      case 'cancel':
        return this.quotationsService.cancel(id);
      default:
        return null;
    }
  }

  private statusSuccessMessage(): string {
    switch (this.modalMode()) {
      case 'send':
        return 'Cotización enviada correctamente.';
      case 'accept':
        return 'Cotización aceptada correctamente.';
      case 'reject':
        return 'Cotización rechazada correctamente.';
      case 'cancel':
        return 'Cotización cancelada correctamente.';
      default:
        return 'Cotización actualizada correctamente.';
    }
  }

  private listenSearchChanges(): void {
    this.filterForm.controls.search.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadQuotations());
  }

  private resetQuotationForm(quotation?: Quotation): void {
    this.quotationForm.reset({
      customerId: quotation?.customerId ? String(quotation.customerId) : '',
      branchId: quotation?.branchId ? String(quotation.branchId) : '',
      folio: quotation?.folio ?? '',
      quotationDate: this.toDateTimeInput(quotation?.quotationDate),
      expirationDate: this.toDateTimeInput(quotation?.expirationDate),
      vatPercentage: quotation?.vatPercentage ?? 16,
      notes: quotation?.notes ?? '',
    });

    this.quotationDetails.clear();
    const details = quotation?.details ?? [];

    if (!details.length) {
      this.quotationDetails.push(this.createDetailForm());
      return;
    }

    for (const detail of details) {
      this.quotationDetails.push(this.createDetailForm(detail));
    }
  }

  private createDetailForm(detail?: QuotationDetail) {
    return this.fb.nonNullable.group({
      productId: [detail?.productId ?? '', [Validators.required]],
      quantity: [detail?.quantity ?? 1, [Validators.required, Validators.min(0.0001)]],
      unitPrice: [detail?.unitPrice ?? 0, [Validators.required, Validators.min(0)]],
      vatPercentage: [detail?.vatPercentage ?? '', [Validators.min(0), Validators.max(100)]],
    });
  }

  private getQuotationId(quotation: Quotation | null): number | null {
    return quotation?.id ?? quotation?.quotationId ?? null;
  }

  private resolveSalespersonUserId(): number | null {
    return this.selectedQuotation()?.salespersonUserId ?? this.session.user()?.idUsuario ?? null;
  }

  private normalizedStatus(quotation: Quotation): string {
    return (quotation.status || '').trim().toLowerCase();
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

  private toDateTimeInput(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    return value.includes('T') ? value.slice(0, 16) : '';
  }

  private findCustomer(customerId: number | null | undefined): Customer | null {
    if (customerId === null || customerId === undefined) {
      return null;
    }

    return this.customers().find((customer) => this.getCustomerId(customer) === customerId) ?? null;
  }

  private findBranch(branchId: number | undefined): Branch | null {
    if (branchId === undefined) {
      return null;
    }

    return this.branches().find((branch) => this.getBranchId(branch) === branchId) ?? null;
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
    this.lastFocusedElement = activeElement instanceof HTMLElement ? activeElement : this.newQuotationButton()?.nativeElement ?? null;
  }

  private restoreFocus(): void {
    setTimeout(() => {
      const target = this.lastFocusedElement ?? this.newQuotationButton()?.nativeElement;
      target?.focus();
      this.lastFocusedElement = null;
    });
  }

  private setModalState(open: boolean): void {
    this.document.body.classList.toggle('modal-open', open);
    this.document.body.style.overflow = open ? 'hidden' : '';
  }
}
