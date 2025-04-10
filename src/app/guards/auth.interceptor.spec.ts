import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HTTP_INTERCEPTORS, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AuthInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { of, throwError } from 'rxjs';

describe('AuthInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', [
      'getToken',
      'refreshAccessToken',
      'logout'
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
      ]
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should add an Authorization header to requests', () => {
    // Mock-Token
    authService.getToken.and.returnValue('test-token');

    // Test-Anfrage
    httpClient.get('/api/data').subscribe();

    // HTTP-Anfrage abfangen und Antwort simulieren
    const req = httpMock.expectOne('/api/data');

    // Überprüfen, ob der Header gesetzt wurde
    expect(req.request.headers.has('Authorization')).toBeTrue();
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');

    req.flush({ data: 'test' });
  });

  it('should not add an Authorization header to auth endpoints', () => {
    // Mock-Token
    authService.getToken.and.returnValue('test-token');

    // Test-Anfrage an Auth-Endpunkt
    httpClient.post('/auth/login', { email: 'test@example.com', password: 'password' }).subscribe();

    // HTTP-Anfrage abfangen
    const req = httpMock.expectOne('/auth/login');

    // Überprüfen, dass kein Auth-Header gesetzt wurde
    expect(req.request.headers.has('Authorization')).toBeFalse();

    req.flush({ token: 'test-token' });
  });

  it('should attempt to refresh token on 401 unauthorized error', () => {
    // Zuerst Mock für getToken
    authService.getToken.and.returnValue('expired-token');

    // Mock für den Token-Refresh
    authService.refreshAccessToken.and.returnValue(of({
      accessToken: 'new-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 3600,
      user: { id: '1', email: 'test@example.com', displayName: 'Test User', emailVerified: true, roles: ['user'] }
    }));

    // Test-Anfrage
    httpClient.get('/api/data').subscribe(
      data => expect(data).toBeTruthy(),
      error => fail('should not error')
    );

    // Erste Anfrage abfangen, 401 zurückgeben
    const firstReq = httpMock.expectOne('/api/data');
    firstReq.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    // Refresh-Token-Anfrage abfangen
    const refreshReq = httpMock.expectOne('/auth/refresh-token');
    expect(refreshReq.request.method).toBe('POST');
    refreshReq.flush({
      accessToken: 'new-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 3600,
      user: { id: '1', email: 'test@example.com', displayName: 'Test User', emailVerified: true, roles: ['user'] }
    });

    // Erneute Anfrage mit neuem Token
    authService.getToken.and.returnValue('new-token');
    const retryReq = httpMock.expectOne('/api/data');
    expect(retryReq.request.headers.get('Authorization')).toBe('Bearer new-token');
    retryReq.flush({ data: 'success' });
  });

  it('should logout user when token refresh fails', () => {
    // Token vorhanden, aber abgelaufen
    authService.getToken.and.returnValue('expired-token');

    // Token-Refresh schlägt fehl
    authService.refreshAccessToken.and.returnValue(throwError(() => new Error('Refresh failed')));

    // Test-Anfrage
    httpClient.get('/api/data').subscribe({
      next: () => fail('should have failed with 401 error'),
      error: (error) => expect(error).toBeTruthy()
    });

    // Erste Anfrage abfangen, 401 zurückgeben
    const firstReq = httpMock.expectOne('/api/data');
    firstReq.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    // Refresh-Token-Anfrage
    const refreshReq = httpMock.expectOne('/auth/refresh-token');
    refreshReq.error(new ErrorEvent('network error'));

    // Prüfen, ob logout aufgerufen wurde
    expect(authService.logout).toHaveBeenCalled();
  });
});
