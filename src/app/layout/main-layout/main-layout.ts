import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayout implements OnInit {
  private readonly document = inject(DOCUMENT);
  private readonly mobileBreakpoint = 767;

  readonly menuExpanded = signal(false);

  ngOnInit(): void {
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
    const nextSize = ['condensed', 'full', 'fullscreen'].includes(currentSize) ? 'default' : 'condensed';
    html.setAttribute('data-sidenav-size', nextSize);
    this.menuExpanded.set(nextSize !== 'condensed');
  }

  private syncMenuState(): void {
    const html = this.document.documentElement;
    const currentSize = html.getAttribute('data-sidenav-size') || 'default';

    this.menuExpanded.set(
      this.isMobile() ? html.classList.contains('sidebar-enable') : currentSize !== 'condensed'
    );
  }

  private isMobile(): boolean {
    return (this.document.defaultView?.innerWidth ?? 0) <= this.mobileBreakpoint;
  }
}
