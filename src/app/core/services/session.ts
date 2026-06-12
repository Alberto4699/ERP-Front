import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, tap } from 'rxjs';

import { AuthenticatedUserPermission } from '../models/authenticated-user-permission.model';
import { AuthenticatedUser } from '../models/authenticated-user.model';
import { Auth } from './auth';

@Injectable({
  providedIn: 'root',
})
export class Session {
  private readonly auth = inject(Auth);
  private readonly userSignal = signal<AuthenticatedUser | null>(null);
  private readonly permissionsSignal = signal<AuthenticatedUserPermission[]>([]);

  readonly user = this.userSignal.asReadonly();
  readonly permissions = this.permissionsSignal.asReadonly();
  readonly permissionCodes = computed(() => {
    const codes = this.permissionsSignal()
      .map((permission) => permission.permissionCode || permission.code || permission.permissionName || permission.name)
      .filter((code): code is string => Boolean(code));

    return new Set(codes);
  });

  load(): Observable<boolean> {
    return forkJoin({
      user: this.auth.me(),
      permissions: this.auth.permissions(),
    }).pipe(
      tap(({ user, permissions }) => {
        this.userSignal.set(user.success ? user.data : null);
        this.permissionsSignal.set(permissions.success ? permissions.data ?? [] : []);
      }),
      map(({ user, permissions }) => user.success && permissions.success),
      catchError(() => {
        this.clear();
        return of(false);
      })
    );
  }

  hasPermission(permissionCode: string): boolean {
    return this.permissionCodes().has(permissionCode);
  }

  clear(): void {
    this.userSignal.set(null);
    this.permissionsSignal.set([]);
  }
}
