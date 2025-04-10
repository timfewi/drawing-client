import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Auth Guard
 *
 * Protects routes from unauthorized access by checking if the user is authenticated.
 * Redirects to the login page if not authenticated.
 */
export const authGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.isAuthenticated()) {
        return true;
    }

    // Not authenticated, redirect to login page with return URL
    return router.createUrlTree(['/login'], {
        queryParams: { returnUrl: state.url }
    });
};

/**
 * Role Guard
 *
 * Protects routes based on user roles.
 * Requires the user to have the specified role to access the route.
 * Redirects to unauthorized page if user doesn't have the required role.
 *
 * @param role The required role to access the route
 */
export const roleGuard = (role: string): CanActivateFn => {
    return (route, state) => {
        const authService = inject(AuthService);
        const router = inject(Router);

        if (authService.isAuthenticated() && authService.hasRole(role)) {
            return true;
        }

        if (!authService.isAuthenticated()) {
            // Not authenticated, redirect to login
            return router.createUrlTree(['/login'], {
                queryParams: { returnUrl: state.url }
            });
        }

        // Authenticated but doesn't have the required role
        return router.createUrlTree(['/unauthorized']);
    };
};
