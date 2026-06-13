import { Routes } from '@angular/router';

import { EmptyLayout } from './layout/empty-layout/empty-layout';
import { MainLayout } from './layout/main-layout/main-layout';
import { authGuard } from './core/guards/auth.guard';

import { Login } from './features/auth/login/login';
import { Brands } from './features/brands/brands';
import { Categories } from './features/categories/categories';
import { Dashboard } from './features/dashboard/dashboard';
import { MeasurementUnits } from './features/measurement-units/measurement-units';
import { Products } from './features/products/products';
import { Suppliers } from './features/suppliers/suppliers';

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
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        component: Dashboard
      },
      {
        path: 'categories',
        component: Categories
      },
      {
        path: 'brands',
        component: Brands
      },
      {
        path: 'measurement-units',
        component: MeasurementUnits
      },
      {
        path: 'products',
        component: Products
      },
      {
        path: 'suppliers',
        component: Suppliers
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
