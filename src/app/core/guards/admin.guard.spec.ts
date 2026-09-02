// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { adminGuard } from './admin.guard';
import { AuthService } from '../services/auth.service';

describe('adminGuard', () => {
  let authServiceMock: any;
  let routerMock: any;

  beforeAll(() => {
    try {
      TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
    } catch {
      // Already initialized
    }
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    authServiceMock = {
      isAuthenticated: vi.fn(),
      isAdmin: vi.fn(),
    };

    routerMock = {
      createUrlTree: vi.fn().mockImplementation((commands, extras) => ({
        commands,
        extras,
      })),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    });
  });

  it('should allow activation when user is authenticated and is an admin', () => {
    authServiceMock.isAuthenticated.mockReturnValue(true);
    authServiceMock.isAdmin.mockReturnValue(true);

    const dummyRoute = {} as ActivatedRouteSnapshot;
    const dummyState = { url: '/studio' } as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() =>
      adminGuard(dummyRoute, dummyState)
    );

    expect(result).toBe(true);
  });

  it('should redirect to /admin/login when user is not authenticated', () => {
    authServiceMock.isAuthenticated.mockReturnValue(false);
    authServiceMock.isAdmin.mockReturnValue(false);

    const dummyRoute = {} as ActivatedRouteSnapshot;
    const dummyState = { url: '/studio' } as RouterStateSnapshot;

    TestBed.runInInjectionContext(() =>
      adminGuard(dummyRoute, dummyState)
    );

    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/admin/login'], {
      queryParams: { returnUrl: '/studio' },
    });
  });

  it('should redirect to /admin/login when user is authenticated but not an admin', () => {
    authServiceMock.isAuthenticated.mockReturnValue(true);
    authServiceMock.isAdmin.mockReturnValue(false);

    const dummyRoute = {} as ActivatedRouteSnapshot;
    const dummyState = { url: '/studio' } as RouterStateSnapshot;

    TestBed.runInInjectionContext(() =>
      adminGuard(dummyRoute, dummyState)
    );

    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/admin/login'], {
      queryParams: { returnUrl: '/studio' },
    });
  });
});
