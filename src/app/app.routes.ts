import { Routes } from '@angular/router';

import { EmptyLayout } from './layout/empty-layout/empty-layout';
import { MainLayout } from './layout/main-layout/main-layout';

import { Login } from './features/auth/login/login';
import { Dashboard } from './features/dashboard/dashboard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: '',
    component: EmptyLayout,
    children: [
      {
        path: 'login',
        component: Login
      }
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'dashboard',
        component: Dashboard
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];