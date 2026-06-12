import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

type ThemeMode = 'light' | 'dark';

interface HyperThemeConfig {
  theme?: ThemeMode;
  nav?: string;
  layout?: {
    mode?: string;
    position?: string;
  };
  topbar?: {
    color?: string;
  };
  menu?: {
    color?: string;
  };
  sidenav?: {
    size?: string;
    user?: boolean;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = '__HYPER_CONFIG__';
  private readonly defaultConfig: Required<HyperThemeConfig> = {
    theme: 'light',
    nav: 'vertical',
    layout: {
      mode: 'fluid',
      position: 'fixed',
    },
    topbar: {
      color: 'light',
    },
    menu: {
      color: 'dark',
    },
    sidenav: {
      size: 'default',
      user: false,
    },
  };
  private readonly darkState = signal(false);

  readonly isDark = this.darkState.asReadonly();

  initialize(): void {
    const theme = this.getCurrentTheme();
    this.applyTheme(theme);
  }

  toggle(): void {
    this.applyTheme(this.isDark() ? 'light' : 'dark');
  }

  private getCurrentTheme(): ThemeMode {
    const storedTheme = this.readConfig().theme;

    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }

    return this.document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light';
  }

  private applyTheme(theme: ThemeMode): void {
    this.document.documentElement.setAttribute('data-bs-theme', theme);
    this.darkState.set(theme === 'dark');
    this.writeConfig({
      ...this.readConfig(),
      theme,
    });
  }

  private readConfig(): HyperThemeConfig {
    const rawConfig = this.document.defaultView?.sessionStorage.getItem(this.storageKey);

    if (!rawConfig) {
      return this.getConfigFromAttributes();
    }

    try {
      const parsedConfig: unknown = JSON.parse(rawConfig);
      return this.isHyperThemeConfig(parsedConfig) ? this.mergeConfig(parsedConfig) : this.getConfigFromAttributes();
    } catch {
      return this.getConfigFromAttributes();
    }
  }

  private writeConfig(config: HyperThemeConfig): void {
    this.document.defaultView?.sessionStorage.setItem(this.storageKey, JSON.stringify(config));
  }

  private isHyperThemeConfig(value: unknown): value is HyperThemeConfig {
    return typeof value === 'object' && value !== null;
  }

  private getConfigFromAttributes(): Required<HyperThemeConfig> {
    const html = this.document.documentElement;

    return this.mergeConfig({
      theme: html.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light',
      layout: {
        mode: html.getAttribute('data-layout-mode') || this.defaultConfig.layout.mode,
        position: html.getAttribute('data-layout-position') || this.defaultConfig.layout.position,
      },
      topbar: {
        color: html.getAttribute('data-topbar-color') || this.defaultConfig.topbar.color,
      },
      menu: {
        color: html.getAttribute('data-menu-color') || this.defaultConfig.menu.color,
      },
      sidenav: {
        size: html.getAttribute('data-sidenav-size') || this.defaultConfig.sidenav.size,
        user: html.getAttribute('data-sidenav-user') === 'true',
      },
    });
  }

  private mergeConfig(config: HyperThemeConfig): Required<HyperThemeConfig> {
    return {
      ...this.defaultConfig,
      ...config,
      layout: {
        ...this.defaultConfig.layout,
        ...config.layout,
      },
      topbar: {
        ...this.defaultConfig.topbar,
        ...config.topbar,
      },
      menu: {
        ...this.defaultConfig.menu,
        ...config.menu,
      },
      sidenav: {
        ...this.defaultConfig.sidenav,
        ...config.sidenav,
      },
    };
  }
}
