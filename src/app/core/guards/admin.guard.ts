import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if authenticated and possesses the ADMIN role
  if (authService.isAuthenticated() && authService.isAdmin()) {
    return true;
  }

  // If not an authenticated Admin, redirect to the dedicated Admin Login portal
  return router.createUrlTree(['/admin/login'], {
    queryParams: { returnUrl: state.url }
  });
};
