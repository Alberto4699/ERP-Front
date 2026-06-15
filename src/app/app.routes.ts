import { Routes } from '@angular/router';

import { EmptyLayout } from './layout/empty-layout/empty-layout';
import { MainLayout } from './layout/main-layout/main-layout';
import { authGuard } from './core/guards/auth.guard';

import { Login } from './features/auth/login/login';
import { Brands } from './features/brands/brands';
import { Branches } from './features/branches/branches';
import { Categories } from './features/categories/categories';
import { CustomerAccounts } from './features/customer-accounts/customer-accounts';
import { Customers } from './features/customers/customers';
import { Dashboard } from './features/dashboard/dashboard';
import { Inventory } from './features/inventory/inventory';
import { InventoryAdjustments } from './features/inventory-adjustments/inventory-adjustments';
import { InventoryMovements } from './features/inventory-movements/inventory-movements';
import { MeasurementUnits } from './features/measurement-units/measurement-units';
import { Products } from './features/products/products';
import { Purchases } from './features/purchases/purchases';
import { Quotations } from './features/quotations/quotations';
import { Roles } from './features/roles/roles';
import { Sales } from './features/sales/sales';
import { Suppliers } from './features/suppliers/suppliers';
import { UserTypes } from './features/user-types/user-types';
import { Users } from './features/users/users';
import { WarehouseTransfers } from './features/warehouse-transfers/warehouse-transfers';
import { Warehouses } from './features/warehouses/warehouses';

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
      },
      {
        path: 'customers',
        component: Customers
      },
      {
        path: 'branches',
        component: Branches
      },
      {
        path: 'warehouses',
        component: Warehouses
      },
      {
        path: 'inventory',
        component: Inventory
      },
      {
        path: 'inventory-movements',
        component: InventoryMovements
      },
      {
        path: 'inventory-adjustments',
        component: InventoryAdjustments
      },
      {
        path: 'warehouse-transfers',
        component: WarehouseTransfers
      },
      {
        path: 'purchases',
        component: Purchases
      },
      {
        path: 'quotations',
        component: Quotations
      },
      {
        path: 'sales',
        component: Sales
      },
      {
        path: 'customer-accounts',
        component: CustomerAccounts
      },
      {
        path: 'roles',
        component: Roles
      },
      {
        path: 'user-types',
        component: UserTypes
      },
      {
        path: 'users',
        component: Users
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
