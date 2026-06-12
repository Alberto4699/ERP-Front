import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AppNotification } from '../../../core/models/notification.model';
import { NotificationsService } from '../../../core/services/notifications';

@Component({
  selector: 'app-notifications',
  imports: [],
  templateUrl: './app-notifications.html',
  styleUrl: './app-notifications.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppNotifications {
  readonly notificationsService = inject(NotificationsService);

  notificationRole(notification: AppNotification): 'alert' | 'status' {
    return notification.type === 'error' || notification.type === 'warning' ? 'alert' : 'status';
  }

  notificationLive(notification: AppNotification): 'assertive' | 'polite' {
    return notification.type === 'error' || notification.type === 'warning' ? 'assertive' : 'polite';
  }

  dismiss(id: number): void {
    this.notificationsService.dismiss(id);
  }
}
