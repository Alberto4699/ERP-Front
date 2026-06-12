import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

import { Auth } from '../../core/services/auth';
import { Session } from '../../core/services/session';
import { ThemeService } from '../../core/services/theme';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayout implements OnInit {
  private readonly document = inject(DOCUMENT);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  readonly session = inject(Session);
  readonly theme = inject(ThemeService);
  private readonly mobileBreakpoint = 767;

  readonly menuExpanded = signal(false);
  readonly displayName = computed(() => {
    return this.auth.datosSesion()?.nombreCompleto || this.session.user()?.nombre || this.session.user()?.username || 'Usuario';
  });
  readonly displayRole = computed(
    () => this.auth.datosSesion()?.role || this.session.user()?.roleName || 'Usuario',
  );

  ngOnInit(): void {
    this.theme.initialize();
    this.syncMenuState();
  }

  toggleMenu(event?: MouseEvent): void {
    event?.preventDefault();

    const html = this.document.documentElement;

    if (this.isMobile()) {
      html.setAttribute('data-sidenav-size', 'full');
      this.menuExpanded.set(html.classList.toggle('sidebar-enable'));
      return;
    }

    html.classList.remove('sidebar-enable');

    const currentSize = html.getAttribute('data-sidenav-size') || 'default';
    const nextSize = ['condensed', 'full', 'fullscreen'].includes(currentSize)
      ? 'default'
      : 'condensed';
    html.setAttribute('data-sidenav-size', nextSize);
    this.menuExpanded.set(nextSize !== 'condensed');
  }

  cerrarSesion(): void {
    this.auth.cerrarSesion();
    this.session.clear();
    void this.router.navigateByUrl('/login');
  }

  private syncMenuState(): void {
    const html = this.document.documentElement;
    const currentSize = html.getAttribute('data-sidenav-size') || 'default';

    this.menuExpanded.set(
      this.isMobile() ? html.classList.contains('sidebar-enable') : currentSize !== 'condensed',
    );
  }

  private isMobile(): boolean {
    return (this.document.defaultView?.innerWidth ?? 0) <= this.mobileBreakpoint;
  }
}
