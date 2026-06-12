import { Injectable, signal } from '@angular/core';

import { AppNotification, NotificationOptions, NotificationType } from '../models/notification.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  private readonly notificationsState = signal<AppNotification[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextId = 1;

  readonly notifications = this.notificationsState.asReadonly();

  success(message: string, options: NotificationOptions = {}): void {
    this.show('success', message, options);
  }

  error(message: string, options: NotificationOptions = {}): void {
    this.show('error', message, {
      title: 'Error',
      duration: 6000,
      ...options,
    });
  }

  warning(message: string, options: NotificationOptions = {}): void {
    this.show('warning', message, options);
  }

  info(message: string, options: NotificationOptions = {}): void {
    this.show('info', message, options);
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this.notificationsState.update((notifications) => notifications.filter((notification) => notification.id !== id));
  }

  clear(): void {
    for (const id of this.timers.keys()) {
      this.clearTimer(id);
    }

    this.notificationsState.set([]);
  }

  private show(type: NotificationType, message: string, options: NotificationOptions): void {
    const notification: AppNotification = {
      id: this.nextId,
      type,
      title: options.title || this.getDefaultTitle(type),
      message,
    };
    this.nextId += 1;

    this.notificationsState.update((notifications) => [notification, ...notifications].slice(0, 5));

    const duration = options.duration ?? 4500;
    if (duration > 0) {
      this.timers.set(notification.id, setTimeout(() => this.dismiss(notification.id), duration));
    }
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);

    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.timers.delete(id);
  }

  private getDefaultTitle(type: NotificationType): string {
    switch (type) {
      case 'success':
        return 'Correcto';
      case 'warning':
        return 'Atención';
      case 'info':
        return 'Información';
      case 'error':
        return 'Error';
    }
  }
}
