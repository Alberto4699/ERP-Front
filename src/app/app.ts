import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppNotifications } from './shared/components/app-notifications/app-notifications';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppNotifications],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('ERP-Front');
}
