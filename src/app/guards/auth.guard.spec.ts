import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { authGuard, roleGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

describe('Auth Guards', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: Router;
  let mockRoute: ActivatedRouteSnapshot;
  let mockState: RouterStateSnapshot;

  beforeEach(() => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', [
      'isAuthenticated',
      'hasRole'
    ]);

    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy }
      ]
    });

    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router);

    mockRoute = {} as ActivatedRouteSnapshot;
    mockState = { url: '/protected' } as RouterStateSnapshot;
  });

  describe('authGuard', () => {
    it('should allow access when user is authenticated', () => {
      authService.isAuthenticated.and.returnValue(true);

      TestBed.runInInjectionContext(() => {
        const result = authGuard(mockRoute, mockState);
        expect(result).toBeTrue();
      });
    });

    it('should redirect to login when user is not authenticated', () => {
      authService.isAuthenticated.and.returnValue(false);
      spyOn(router, 'createUrlTree').and.callThrough();

      TestBed.runInInjectionContext(() => {
        const result = authGuard(mockRoute, mockState);
        expect(router.createUrlTree).toHaveBeenCalledWith(
          ['/login'],
          { queryParams: { returnUrl: '/protected' } }
        );
        expect(result).toBeInstanceOf(UrlTree);
      });
    });
  });

  describe('roleGuard', () => {
    it('should allow access when user is authenticated and has required role', () => {
      authService.isAuthenticated.and.returnValue(true);
      authService.hasRole.withArgs('admin').and.returnValue(true);

      TestBed.runInInjectionContext(() => {
        const guardFn = roleGuard('admin');
        const result = guardFn(mockRoute, mockState);
        expect(result).toBeTrue();
      });
    });

    it('should redirect to login when user is not authenticated', () => {
      authService.isAuthenticated.and.returnValue(false);
      spyOn(router, 'createUrlTree').and.callThrough();

      TestBed.runInInjectionContext(() => {
        const guardFn = roleGuard('admin');
        const result = guardFn(mockRoute, mockState);
        expect(router.createUrlTree).toHaveBeenCalledWith(
          ['/login'],
          { queryParams: { returnUrl: '/protected' } }
        );
        expect(result).toBeInstanceOf(UrlTree);
      });
    });

    it('should redirect to unauthorized page when user is authenticated but lacks required role', () => {
      authService.isAuthenticated.and.returnValue(true);
      authService.hasRole.withArgs('admin').and.returnValue(false);
      spyOn(router, 'createUrlTree').and.callThrough();

      TestBed.runInInjectionContext(() => {
        const guardFn = roleGuard('admin');
        const result = guardFn(mockRoute, mockState);
        expect(router.createUrlTree).toHaveBeenCalledWith(['/unauthorized']);
        expect(result).toBeInstanceOf(UrlTree);
      });
    });
  });
});
