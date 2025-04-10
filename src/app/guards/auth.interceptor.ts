import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

// Variablen für den Interceptor-Zustand
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<any>(null);

/**
 * Auth Interceptor
 *
 * Intercepts HTTP requests to add authorization headers and handle token refresh.
 */
export const authInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);

  // Skip authentication for login, register, and refresh endpoints
  if (isAuthEndpoint(request.url)) {
    return next(request);
  }

  // Add auth token to request
  const token = authService.getToken();
  if (token) {
    request = addToken(request, token);
  }

  return next(request).pipe(
    catchError(error => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        // Try to refresh token if unauthorized and not currently refreshing
        return handle401Error(request, next, authService);
      }
      return throwError(() => error);
    })
  );
};

/**
 * Add JWT token to request headers
 */
function addToken(request: HttpRequest<any>, token: string): HttpRequest<any> {
  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
}

/**
 * Handle 401 unauthorized error by refreshing token
 */
function handle401Error(
  request: HttpRequest<any>,
  next: HttpHandlerFn,
  authService: AuthService
): Observable<HttpEvent<any>> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    // Attempt to refresh token
    return authService.refreshAccessToken().pipe(
      switchMap(response => {
        isRefreshing = false;
        refreshTokenSubject.next(response.accessToken);

        // Retry original request with new token
        return next(addToken(request, response.accessToken));
      }),
      catchError(error => {
        isRefreshing = false;
        authService.logout();
        return throwError(() => error);
      })
    );
  } else {
    // Wait for token refresh to complete, then retry original request
    return refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(token => next(addToken(request, token)))
    );
  }
}

/**
 * Check if the request is targeting an authentication endpoint
 */
function isAuthEndpoint(url: string): boolean {
  const authEndpoints = ['/auth/login', '/auth/register', '/auth/refresh'];
  return authEndpoints.some(endpoint => url.includes(endpoint));
}
