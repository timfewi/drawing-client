import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { User, AuthCredentials, AuthResponse } from '../models/User.model';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  // Test-Daten
  const mockUser: User = {
    id: '123',
    email: 'test@example.com',
    displayName: 'Test User',
    emailVerified: true,
    roles: ['user']
  };

  const mockCredentials: AuthCredentials = {
    email: 'test@example.com',
    password: 'password123'
  };

  const mockAuthResponse: AuthResponse = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
    user: mockUser
  };

  beforeEach(() => {
    // localStorage zurücksetzen
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);

    // Wichtig: Offline-Modus für Tests deaktivieren
    // @ts-ignore - Zugriff auf private Property
    service['OFFLINE_MODE'] = false;
  });

  afterEach(() => {
    // Sicherstellen, dass keine ausstehenden HTTP-Anfragen vorhanden sind
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('login', () => {
    it('should authenticate user and store tokens', () => {
      // Anmeldungsversuch
      service.login(mockCredentials).subscribe(user => {
        expect(user).toEqual(mockUser);
        expect(service.isAuthenticated()).toBeTrue();
        expect(service.currentUser).toEqual(mockUser);
        expect(service.getToken()).toBe('mock-access-token');
      });

      // HTTP-Anfrage abfangen, mit Verwendung der korrekt definierten URLs aus dem Service
      const req = httpMock.expectOne(`${service['API_URL']}${service['LOGIN_ENDPOINT']}`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockCredentials);

      req.flush(mockAuthResponse);

      // Überprüfen, ob Tokens im localStorage gespeichert wurden
      expect(localStorage.getItem(service['TOKEN_KEY'])).toBe('mock-access-token');
      expect(localStorage.getItem(service['REFRESH_TOKEN_KEY'])).toBe('mock-refresh-token');
      expect(localStorage.getItem(service['USER_KEY'])).toBe(JSON.stringify(mockUser));
    });

    it('should handle login errors', () => {
      service.login(mockCredentials).subscribe({
        next: () => fail('Should have failed with 401 error'),
        error: (error) => {
          expect(error.message).toContain('Ungültige Anmeldedaten');
        }
      });

      const req = httpMock.expectOne(`${service['API_URL']}${service['LOGIN_ENDPOINT']}`);
      req.flush('Invalid credentials', { status: 401, statusText: 'Unauthorized' });

      expect(service.isAuthenticated()).toBeFalse();
    });
  });

  describe('logout', () => {
    it('should clear user data and tokens', () => {
      // Zuerst einloggen
      service.login(mockCredentials).subscribe();
      const req = httpMock.expectOne(`${service['API_URL']}${service['LOGIN_ENDPOINT']}`);
      req.flush(mockAuthResponse);

      expect(service.isAuthenticated()).toBeTrue();

      // Dann ausloggen
      service.logout();

      // Prüfen, ob alle Daten gelöscht wurden
      expect(service.isAuthenticated()).toBeFalse();
      expect(service.currentUser).toBeNull();
      expect(service.getToken()).toBeNull();
      expect(localStorage.getItem(service['TOKEN_KEY'])).toBeNull();
      expect(localStorage.getItem(service['REFRESH_TOKEN_KEY'])).toBeNull();
      expect(localStorage.getItem(service['USER_KEY'])).toBeNull();
    });
  });

  describe('register', () => {
    it('should register a new user and authenticate them', () => {
      service.register(mockCredentials).subscribe(user => {
        expect(user).toEqual(mockUser);
        expect(service.isAuthenticated()).toBeTrue();
      });

      const req = httpMock.expectOne(`${service['API_URL']}${service['REGISTER_ENDPOINT']}`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockCredentials);

      req.flush(mockAuthResponse);
    });
  });

  describe('token handling', () => {
    it('should refresh token when it expires', () => {
      // Zuerst einloggen mit einem Token, der bald abläuft
      service.login(mockCredentials).subscribe();
      const loginReq = httpMock.expectOne(`${service['API_URL']}${service['LOGIN_ENDPOINT']}`);

      // Token, der in der Vergangenheit abgelaufen ist
      const expiredResponse = { ...mockAuthResponse };
      loginReq.flush(expiredResponse);

      // Token-Ablaufzeit in der Vergangenheit setzen
      const pastDate = new Date();
      pastDate.setMinutes(pastDate.getMinutes() - 10); // 10 Minuten in der Vergangenheit
      localStorage.setItem('tokenExpiration', pastDate.toISOString());

      // getToken sollte versuchen, den Token zu erneuern
      service.getToken();

      // Abfangen der Anfrage zum Token-Refresh
      const refreshReq = httpMock.expectOne(`${service['API_URL']}${service['REFRESH_TOKEN_ENDPOINT']}`);
      expect(refreshReq.request.method).toBe('POST');

      // Neue Token-Daten bereitstellen
      const newAuthResponse = {
        ...mockAuthResponse,
        accessToken: 'new-access-token'
      };
      refreshReq.flush(newAuthResponse);

      // Überprüfen, ob der neue Token gespeichert wurde
      expect(service.getToken()).toBe('new-access-token');
    });
  });

  describe('role management', () => {
    it('should check if user has specific role', () => {
      // Benutzer mit 'admin' Rolle
      const adminUser: User = {
        ...mockUser,
        roles: ['user', 'admin']
      };

      // Benutzer mit Admin-Rolle einloggen
      service.login(mockCredentials).subscribe();
      const req = httpMock.expectOne(`${service['API_URL']}${service['LOGIN_ENDPOINT']}`);
      req.flush({
        ...mockAuthResponse,
        user: adminUser
      });

      // Überprüfen der Rollen
      expect(service.hasRole('user')).toBeTrue();
      expect(service.hasRole('admin')).toBeTrue();
      expect(service.hasRole('moderator')).toBeFalse();
    });
  });
});
