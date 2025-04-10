/**
 * User Model
 *
 * Repräsentiert einen authentifizierten Benutzer in der Anwendung.
 */
export interface User {
  /** Eindeutige ID des Benutzers */
  id: string;

  /** E-Mail-Adresse des Benutzers */
  email: string;

  /** Anzeigename des Benutzers */
  displayName: string;

  /** Status der E-Mail-Verifizierung */
  emailVerified: boolean;

  /** Benutzerrollen für Zugriffsberechtigungen */
  roles: string[];

  /** URL zum Profilbild des Benutzers (optional) */
  photoURL?: string;

  /** Zeitstempel der letzten Anmeldung (optional) */
  lastLogin?: number;

  /** Zeitstempel der Kontoerstellung (optional) */
  createdAt?: number;
}

/**
 * Anmeldedaten für die Authentifizierung
 */
export interface AuthCredentials {
  /** E-Mail-Adresse */
  email: string;

  /** Passwort */
  password: string;
}

/**
 * Antwort des Servers nach erfolgreicher Authentifizierung
 */
export interface AuthResponse {
  /** JWT Access Token */
  accessToken: string;

  /** Refresh Token für Token-Erneuerung */
  refreshToken: string;

  /** Ablaufzeit des Tokens in Sekunden */
  expiresIn: number;

  /** Benutzerdaten */
  user: User;
}
