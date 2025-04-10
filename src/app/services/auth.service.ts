import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { User, AuthCredentials, AuthResponse } from '../models/User.model';
import { v4 as uuidv4 } from 'uuid';

/**
 * Auth Service
 *
 * Verwaltet die Benutzerauthentifizierung und die Token-Persistenz.
 * Funktioniert auch im Offline-Modus mit lokaler Simulation.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // API URLs - würden normalerweise aus der Umgebungskonfiguration kommen
  private readonly API_URL = 'https://api.example.com'; // Backend-API URL
  private readonly AUTH_ENDPOINT = '/auth';
  private readonly LOGIN_ENDPOINT = `${this.AUTH_ENDPOINT}/login`;
  private readonly REGISTER_ENDPOINT = `${this.AUTH_ENDPOINT}/register`;
  private readonly REFRESH_TOKEN_ENDPOINT = `${this.AUTH_ENDPOINT}/refresh-token`;
  private readonly OFFLINE_MODE = true; // Im Offline-Modus arbeiten

  // Lokale Speicherschlüssel
  private readonly TOKEN_KEY = 'auth_token';
  private readonly REFRESH_TOKEN_KEY = 'auth_refresh_token';
  private readonly USER_KEY = 'auth_user';
  private readonly OFFLINE_USERS_KEY = 'drawing_app_users';

  // Aktueller Benutzer-Subject für Komponenten zum Abonnieren
  private readonly currentUserSubject = new BehaviorSubject<User | null>(null);

  // Öffentliches Observable für den aktuellen Benutzer
  public readonly currentUser$ = this.currentUserSubject.asObservable();

  // Privater Zwischenspeicher für den aktuellen Token
  private currentToken: string | null = null;
  private tokenExpirationTimer: any = null;

  constructor(private readonly http: HttpClient) {
    // Versucht, den Benutzer aus dem lokalen Speicher wiederherzustellen
    this.loadUserFromStorage();
    // Testbenutzer für Entwicklung erstellen
    this.createTestUserIfNeeded();
  }

  /**
   * Prüft, ob ein Benutzer angemeldet ist
   */
  public get isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  /**
   * Prüft, ob ein Benutzer authentifiziert ist (für Auth-Guard)
   */
  isAuthenticated(): boolean {
    return this.isLoggedIn;
  }

  /**
   * Gibt den aktuellen Benutzer zurück
   */
  public get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Gibt den aktuellen JWT-Token zurück
   */
  public get token(): string | null {
    if (!this.currentToken) {
      this.currentToken = localStorage.getItem(this.TOKEN_KEY);
    }
    return this.currentToken;
  }

  /**
   * Gibt den aktuellen JWT-Token zurück (für Interceptor)
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Prüft, ob der Benutzer eine bestimmte Rolle hat
   * @param role Die zu prüfende Rolle
   * @returns true, wenn der Benutzer die Rolle hat
   */
  hasRole(role: string): boolean {
    const user = this.currentUser;
    return !!user && user.roles.includes(role);
  }

  /**
   * Benutzeranmeldung
   * @param credentials Die Anmeldedaten (E-Mail und Passwort)
   * @returns Observable mit den Benutzerdaten bei erfolgreicher Anmeldung
   */
  login(credentials: AuthCredentials): Observable<User> {
    if (this.OFFLINE_MODE) {
      return this.offlineLogin(credentials);
    }

    return this.http.post<AuthResponse>(`${this.API_URL}${this.LOGIN_ENDPOINT}`, credentials).pipe(
      tap(response => this.handleAuthentication(response)),
      map(response => response.user),
      catchError(error => {
        console.error('Anmeldefehler', error);
        return throwError(() => new Error('Ungültige Anmeldedaten. Bitte überprüfen Sie Ihre E-Mail und Ihr Passwort.'));
      })
    );
  }

  /**
   * Benutzerregistrierung
   * @param userData Die Benutzerdaten inkl. E-Mail und Passwort
   * @returns Observable mit den Benutzerdaten bei erfolgreicher Registrierung
   */
  register(userData: AuthCredentials & { displayName?: string }): Observable<User> {
    if (this.OFFLINE_MODE) {
      return this.offlineRegister(userData);
    }

    return this.http.post<AuthResponse>(`${this.API_URL}${this.REGISTER_ENDPOINT}`, userData).pipe(
      tap(response => this.handleAuthentication(response)),
      map(response => response.user),
      catchError(error => {
        console.error('Registrierungsfehler', error);
        return throwError(() => new Error('Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.'));
      })
    );
  }

  /**
   * Benutzerabmeldung
   */
  logout(): void {
    // Token aus dem Speicher entfernen
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);

    // Benutzerinformationen zurücksetzen
    this.currentToken = null;
    this.currentUserSubject.next(null);

    // Timer für die Token-Erneuerung löschen
    this.clearTokenExpirationTimer();
  }

  /**
   * Auffrischen des Access Tokens
   * @returns Observable mit dem neuen Token
   */
  refreshToken(): Observable<string> {
    const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);

    if (!refreshToken) {
      // Wenn kein Refresh-Token vorhanden ist, Benutzer abmelden
      this.logout();
      return throwError(() => new Error('Kein Refresh-Token verfügbar.'));
    }

    if (this.OFFLINE_MODE) {
      // Im Offline-Modus simulieren wir einfach einen neuen Token
      return this.offlineRefreshToken();
    }

    return this.http.post<AuthResponse>(
      `${this.API_URL}${this.REFRESH_TOKEN_ENDPOINT}`,
      { refreshToken }
    ).pipe(
      tap(response => this.handleAuthentication(response)),
      map(response => response.accessToken),
      catchError(error => {
        console.error('Token-Aktualisierung fehlgeschlagen', error);
        this.logout();
        return throwError(() => new Error('Sitzung abgelaufen. Bitte melden Sie sich erneut an.'));
      })
    );
  }

  /**
   * Auffrischen des Access Tokens (für Interceptor)
   */
  refreshAccessToken(): Observable<any> {
    return this.refreshToken().pipe(
      map(token => ({ accessToken: token }))
    );
  }

  /**
   * Verarbeitet die Authentifizierungsantwort des Servers
   * @param response Die Server-Antwort mit Tokens und Benutzerdaten
   */
  private handleAuthentication(response: AuthResponse): void {
    const { accessToken, refreshToken, expiresIn, user } = response;

    // Tokens speichern
    this.storeTokens(accessToken, refreshToken, expiresIn);

    // Benutzerdaten speichern
    this.storeUser(user);

    // Benutzer-Subject aktualisieren
    this.currentUserSubject.next(user);
  }

  /**
   * Speichert die Tokens im lokalen Speicher
   */
  private storeTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    this.currentToken = accessToken;
    localStorage.setItem(this.TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);

    // Token-Erneuerungstimer einrichten (kurz vor Ablauf erneuern)
    const expirationTime = expiresIn * 1000; // Umrechnung in Millisekunden
    this.setTokenExpirationTimer(expirationTime);
  }

  /**
   * Speichert die Benutzerdaten im lokalen Speicher
   */
  private storeUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  /**
   * Lädt den Benutzer aus dem lokalen Speicher
   */
  private loadUserFromStorage(): void {
    try {
      const userJson = localStorage.getItem(this.USER_KEY);
      const token = localStorage.getItem(this.TOKEN_KEY);

      if (userJson && token) {
        const user: User = JSON.parse(userJson);
        this.currentUserSubject.next(user);
        this.currentToken = token;

        // Wenn wir im Offline-Modus sind, simulieren wir den Token-Ablauf und -Erneuerung
        if (this.OFFLINE_MODE) {
          this.setTokenExpirationTimer(3600 * 1000); // 1 Stunde
        }
      }
    } catch (e) {
      console.error('Fehler beim Laden des Benutzers aus dem Speicher', e);
      this.logout();
    }
  }

  /**
   * Richtet einen Timer für die Token-Erneuerung ein
   */
  private setTokenExpirationTimer(expirationTime: number): void {
    // Bestehenden Timer löschen
    this.clearTokenExpirationTimer();

    // Neuen Timer einrichten (erneuert 30 Sekunden vor Ablauf)
    const timeoutDuration = Math.max(0, expirationTime - 30000);
    this.tokenExpirationTimer = setTimeout(() => {
      this.refreshToken().subscribe();
    }, timeoutDuration);
  }

  /**
   * Löscht den Timer für die Token-Erneuerung
   */
  private clearTokenExpirationTimer(): void {
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
      this.tokenExpirationTimer = null;
    }
  }

  // Offline-Modus-Hilfsmethoden

  /**
   * Simuliert eine Anmeldung im Offline-Modus
   */
  private offlineLogin(credentials: AuthCredentials): Observable<User> {
    try {
      // Benutzer aus dem lokalen Speicher laden
      const users = this.getOfflineUsers();

      // Benutzer mit passender E-Mail finden
      const user = users.find((u: any) => u.email.toLowerCase() === credentials.email.toLowerCase());

      // Prüfen, ob Benutzer existiert und Passwort übereinstimmt
      // Hinweis: Dies ist nur eine Simulation. In einer echten App sollte
      // das Passwort niemals im Klartext gespeichert werden!
      if (user && this.checkOfflinePassword(user, credentials.password)) {
        // Antwort simulieren
        const response: AuthResponse = {
          accessToken: this.generateFakeToken(),
          refreshToken: this.generateFakeToken(),
          expiresIn: 3600, // 1 Stunde
          user: { ...user }
        };

        this.handleAuthentication(response);
        return of(user);
      }

      // Fehlgeschlagene Anmeldung
      return throwError(() => new Error('Ungültige Anmeldedaten. Bitte überprüfen Sie Ihre E-Mail und Ihr Passwort.'));
    } catch (e) {
      console.error('Offline-Anmeldungsfehler', e);
      return throwError(() => new Error('Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.'));
    }
  }

  /**
   * Simuliert eine Registrierung im Offline-Modus
   */
  private offlineRegister(userData: AuthCredentials & { displayName?: string }): Observable<User> {
    try {
      // Bestehende Benutzer laden
      const users = this.getOfflineUsers();

      // Prüfen, ob die E-Mail bereits verwendet wird
      if (users.some((u: any) => u.email.toLowerCase() === userData.email.toLowerCase())) {
        return throwError(() => new Error('Diese E-Mail-Adresse wird bereits verwendet.'));
      }

      // Neuen Benutzer erstellen
      const newUser: User = {
        id: uuidv4(),
        email: userData.email,
        displayName: userData.displayName || userData.email.split('@')[0],
        emailVerified: false,
        roles: ['user'],
        createdAt: Date.now(),
        lastLogin: Date.now()
      };

      // Passwort im lokalen Speicher speichern (nur für Simulation)
      // In einer echten App würde das Passwort auf dem Server gehasht
      const userWithPassword = {
        ...newUser,
        // Warnung: Dieses ist nur für Testzwecke. Niemals Passwörter im
        // Klartext speichern!
        password: userData.password
      };

      // Benutzer zur Liste hinzufügen
      users.push(userWithPassword);
      this.saveOfflineUsers(users);

      // Simulierte Antwort erstellen
      const response: AuthResponse = {
        accessToken: this.generateFakeToken(),
        refreshToken: this.generateFakeToken(),
        expiresIn: 3600, // 1 Stunde
        user: newUser
      };

      this.handleAuthentication(response);
      return of(newUser);
    } catch (e) {
      console.error('Offline-Registrierungsfehler', e);
      return throwError(() => new Error('Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.'));
    }
  }

  /**
   * Simuliert eine Token-Erneuerung im Offline-Modus
   */
  private offlineRefreshToken(): Observable<string> {
    // Neuen Token generieren
    const newToken = this.generateFakeToken();

    // Aktuellen Benutzer aus dem Speicher laden
    const user = this.currentUser;

    if (!user) {
      return throwError(() => new Error('Kein Benutzer angemeldet.'));
    }

    // Simulierte Antwort
    const response: AuthResponse = {
      accessToken: newToken,
      refreshToken: this.generateFakeToken(),
      expiresIn: 3600, // 1 Stunde
      user
    };

    this.handleAuthentication(response);
    return of(newToken);
  }

  /**
   * Generiert einen gefälschten JWT-Token für den Offline-Modus
   */
  private generateFakeToken(): string {
    // Dies erstellt nur einen zufälligen String, der wie ein JWT aussieht
    // Achtung: Dies ist kein echter JWT und nicht sicher!
    const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      sub: this.currentUser?.id || uuidv4(),
      name: this.currentUser?.displayName || 'Offline User',
      iat: Date.now() / 1000,
      exp: (Date.now() / 1000) + 3600
    }));
    const signature = btoa(uuidv4());

    return `${header}.${payload}.${signature}`;
  }

  /**
   * Lädt alle Benutzer aus dem lokalen Speicher
   */
  private getOfflineUsers(): any[] {
    try {
      const usersJson = localStorage.getItem(this.OFFLINE_USERS_KEY);
      return usersJson ? JSON.parse(usersJson) : [];
    } catch (e) {
      console.error('Fehler beim Laden der Offline-Benutzer', e);
      return [];
    }
  }

  /**
   * Speichert alle Benutzer im lokalen Speicher
   */
  private saveOfflineUsers(users: any[]): void {
    try {
      localStorage.setItem(this.OFFLINE_USERS_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Fehler beim Speichern der Offline-Benutzer', e);
    }
  }

  /**
   * Prüft das Passwort eines Offline-Benutzers
   * Hinweis: Dies ist nur für Demonstrations- und Testzwecke.
   * In einer echten App sollten Passwörter niemals im Klartext gespeichert werden!
   */
  private checkOfflinePassword(user: any, password: string): boolean {
    return user.password === password;
  }

  /**
   * Erstellt einen Testbenutzer, wenn keine Benutzer vorhanden sind
   * Nur für Entwicklungs- und Testzwecke.
   */
  createTestUserIfNeeded(): void {
    if (!this.OFFLINE_MODE) return;

    const users = this.getOfflineUsers();

    // Wenn keine Benutzer vorhanden sind, einen Testbenutzer erstellen
    if (users.length === 0) {
      const testUser = {
        id: uuidv4(),
        email: 'test@example.com',
        password: 'password', // WARNUNG: Nur für Tests!
        displayName: 'Test User',
        emailVerified: true,
        roles: ['user'],
        createdAt: Date.now(),
        lastLogin: Date.now()
      };

      users.push(testUser);
      this.saveOfflineUsers(users);
      console.log('Testbenutzer erstellt: test@example.com / password');
    }
  }
}
