import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, BehaviorSubject } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { DrawingLine, DrawingLineUtils } from '../models/DrawingLine.model';
import { DrawingSettings } from '../models/DrawingSettings.model';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from './auth.service';

/**
 * Drawing Service
 *
 * Verwaltet die Zeichnungsoperationen und Speicherung.
 * Unterstützt Offline-Modus mit lokalem Speicher.
 */
@Injectable({
  providedIn: 'root'
})
export class DrawingService {
  // API URLs - würden normalerweise aus der Umgebungskonfiguration kommen
  private readonly API_URL = 'https://api.example.com'; // Backend-API URL
  private readonly DRAWINGS_ENDPOINT = '/drawings';
  private readonly OFFLINE_MODE = true; // Im Offline-Modus arbeiten

  // Lokale Speicherschlüssel
  private readonly DRAWINGS_KEY = 'drawing_app_drawings';
  private readonly CURRENT_DRAWING_KEY = 'drawing_app_current_drawing';

  // Settings Observable
  private settingsSubject = new BehaviorSubject<DrawingSettings>({
    backgroundColor: '#FFFFFF',
    tool: 'brush',
    color: '#000000',
    lineWidth: 3,
    opacity: 1,
    isDrawingEnabled: true
  });

  // Drawing Lines Observable (für Undo/Redo)
  private linesSubject = new BehaviorSubject<DrawingLine[]>([]);

  // Public Observables
  settings$ = this.settingsSubject.asObservable();
  lines$ = this.linesSubject.asObservable();

  // Zeichnungszustand
  private currentLine: DrawingLine | null = null;
  private undoStack: DrawingLine[][] = [];
  private redoStack: DrawingLine[][] = [];

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService
  ) {
    // Beim Start die Beispielzeichnung erstellen
    this.createSampleDrawingIfNeeded();
  }

  /**
   * Speichert eine neue Zeichnung oder aktualisiert eine bestehende
   * @param lines Die Linien der Zeichnung
   * @param settings Die Zeichnungseinstellungen
   * @param title Der Titel der Zeichnung
   * @param id Die Zeichnungs-ID (optional, für Updates)
   * @returns Observable mit der Zeichnungs-ID
   */
  saveDrawing(
    lines: DrawingLine[],
    settings: DrawingSettings,
    title: string,
    id?: string
  ): Observable<string> {
    const drawingData = {
      id: id || uuidv4(),
      title,
      lines,
      settings,
      userId: this.authService.currentUser?.id || 'anonymous',
      createdAt: id ? undefined : Date.now(),
      updatedAt: Date.now()
    };

    if (this.OFFLINE_MODE) {
      return this.saveDrawingOffline(drawingData);
    }

    // Online-Modus: API-Aufruf
    if (id) {
      // Update
      return this.http.put<{ id: string }>(`${this.API_URL}${this.DRAWINGS_ENDPOINT}/${id}`, drawingData)
        .pipe(
          map(response => response.id),
          catchError(error => {
            console.error('Fehler beim Aktualisieren der Zeichnung', error);
            return throwError(() => new Error('Zeichnung konnte nicht aktualisiert werden.'));
          })
        );
    } else {
      // Neue Zeichnung
      return this.http.post<{ id: string }>(`${this.API_URL}${this.DRAWINGS_ENDPOINT}`, drawingData)
        .pipe(
          map(response => response.id),
          catchError(error => {
            console.error('Fehler beim Speichern der Zeichnung', error);
            return throwError(() => new Error('Zeichnung konnte nicht gespeichert werden.'));
          })
        );
    }
  }

  /**
   * Lädt eine Zeichnung anhand ihrer ID
   * @param id Die Zeichnungs-ID
   * @returns Observable mit den Zeichnungsdaten
   */
  getDrawing(id: string): Observable<any> {
    if (this.OFFLINE_MODE) {
      return this.getDrawingOffline(id);
    }

    return this.http.get<any>(`${this.API_URL}${this.DRAWINGS_ENDPOINT}/${id}`)
      .pipe(
        catchError(error => {
          console.error('Fehler beim Laden der Zeichnung', error);
          return throwError(() => new Error('Zeichnung konnte nicht geladen werden.'));
        })
      );
  }

  /**
   * Lädt alle Zeichnungen des aktuellen Benutzers
   * @returns Observable mit einem Array von Zeichnungen
   */
  getUserDrawings(): Observable<any[]> {
    if (this.OFFLINE_MODE) {
      return this.getUserDrawingsOffline();
    }

    const userId = this.authService.currentUser?.id;
    if (!userId) {
      return throwError(() => new Error('Kein Benutzer angemeldet.'));
    }

    return this.http.get<any[]>(`${this.API_URL}${this.DRAWINGS_ENDPOINT}/user/${userId}`)
      .pipe(
        catchError(error => {
          console.error('Fehler beim Laden der Benutzerzeichnungen', error);
          return throwError(() => new Error('Zeichnungen konnten nicht geladen werden.'));
        })
      );
  }

  /**
   * Löscht eine Zeichnung
   * @param id Die ID der zu löschenden Zeichnung
   * @returns Observable mit dem Erfolgsstatus
   */
  deleteDrawing(id: string): Observable<boolean> {
    if (this.OFFLINE_MODE) {
      return this.deleteDrawingOffline(id);
    }

    return this.http.delete<any>(`${this.API_URL}${this.DRAWINGS_ENDPOINT}/${id}`)
      .pipe(
        map(() => true),
        catchError(error => {
          console.error('Fehler beim Löschen der Zeichnung', error);
          return throwError(() => new Error('Zeichnung konnte nicht gelöscht werden.'));
        })
      );
  }

  /**
   * Speichert den aktuellen Zeichnungszustand zur späteren Fortsetzung
   * @param lines Die Linien der Zeichnung
   * @param settings Die Zeichnungseinstellungen
   */
  saveCurrentDrawingState(lines: DrawingLine[], settings: DrawingSettings): void {
    try {
      const drawingState = {
        lines,
        settings,
        timestamp: Date.now()
      };

      localStorage.setItem(this.CURRENT_DRAWING_KEY, JSON.stringify(drawingState));
    } catch (e) {
      console.error('Fehler beim Speichern des Zeichnungszustands', e);
    }
  }

  /**
   * Lädt den zuletzt gespeicherten Zeichnungszustand
   * @returns Die gespeicherten Zeichnungsdaten oder null
   */
  loadCurrentDrawingState(): { lines: DrawingLine[], settings: DrawingSettings } | null {
    try {
      const stateJson = localStorage.getItem(this.CURRENT_DRAWING_KEY);
      if (!stateJson) return null;

      const state = JSON.parse(stateJson);
      return {
        lines: state.lines,
        settings: state.settings
      };
    } catch (e) {
      console.error('Fehler beim Laden des Zeichnungszustands', e);
      return null;
    }
  }

  /**
   * Löscht den aktuell gespeicherten Zeichnungszustand
   */
  clearCurrentDrawingState(): void {
    localStorage.removeItem(this.CURRENT_DRAWING_KEY);
  }

  // Offline-Modus-Hilfsmethoden

  /**
   * Speichert eine Zeichnung im lokalen Speicher
   */
  private saveDrawingOffline(drawingData: any): Observable<string> {
    try {
      const drawings = this.getStoredDrawings();

      // Vorhandene Zeichnung finden und aktualisieren oder neue hinzufügen
      const existingIndex = drawings.findIndex(d => d.id === drawingData.id);

      if (existingIndex >= 0) {
        drawings[existingIndex] = {
          ...drawings[existingIndex],
          ...drawingData,
          updatedAt: Date.now()
        };
      } else {
        drawings.push(drawingData);
      }

      // Im lokalen Speicher speichern
      this.saveStoredDrawings(drawings);

      return of(drawingData.id);
    } catch (e) {
      console.error('Fehler beim lokalen Speichern der Zeichnung', e);
      return throwError(() => new Error('Zeichnung konnte nicht gespeichert werden.'));
    }
  }

  /**
   * Lädt eine Zeichnung aus dem lokalen Speicher
   */
  private getDrawingOffline(id: string): Observable<any> {
    try {
      const drawings = this.getStoredDrawings();
      const drawing = drawings.find(d => d.id === id);

      if (drawing) {
        return of(drawing);
      }

      return throwError(() => new Error('Zeichnung nicht gefunden.'));
    } catch (e) {
      console.error('Fehler beim lokalen Laden der Zeichnung', e);
      return throwError(() => new Error('Zeichnung konnte nicht geladen werden.'));
    }
  }

  /**
   * Lädt alle Zeichnungen des aktuellen Benutzers aus dem lokalen Speicher
   */
  private getUserDrawingsOffline(): Observable<any[]> {
    try {
      const drawings = this.getStoredDrawings();
      const userId = this.authService.currentUser?.id || 'anonymous';

      // Zeichnungen nach Benutzer filtern
      const userDrawings = drawings.filter(
        d => d.userId === userId || (!this.authService.isLoggedIn && d.userId === 'anonymous')
      );

      // Nach Erstellungsdatum sortieren, neueste zuerst
      userDrawings.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));

      return of(userDrawings);
    } catch (e) {
      console.error('Fehler beim lokalen Laden der Benutzerzeichnungen', e);
      return throwError(() => new Error('Zeichnungen konnten nicht geladen werden.'));
    }
  }

  /**
   * Löscht eine Zeichnung aus dem lokalen Speicher
   */
  private deleteDrawingOffline(id: string): Observable<boolean> {
    try {
      const drawings = this.getStoredDrawings();
      const initialCount = drawings.length;

      // Zeichnung mit der angegebenen ID entfernen
      const filteredDrawings = drawings.filter(d => d.id !== id);

      // Prüfen, ob eine Zeichnung entfernt wurde
      if (filteredDrawings.length === initialCount) {
        return throwError(() => new Error('Zeichnung nicht gefunden.'));
      }

      // Aktualisierte Liste speichern
      this.saveStoredDrawings(filteredDrawings);

      return of(true);
    } catch (e) {
      console.error('Fehler beim lokalen Löschen der Zeichnung', e);
      return throwError(() => new Error('Zeichnung konnte nicht gelöscht werden.'));
    }
  }

  /**
   * Lädt alle gespeicherten Zeichnungen aus dem lokalen Speicher
   */
  private getStoredDrawings(): any[] {
    try {
      const drawingsJson = localStorage.getItem(this.DRAWINGS_KEY);
      return drawingsJson ? JSON.parse(drawingsJson) : [];
    } catch (e) {
      console.error('Fehler beim Laden der gespeicherten Zeichnungen', e);
      return [];
    }
  }

  /**
   * Speichert alle Zeichnungen im lokalen Speicher
   */
  private saveStoredDrawings(drawings: any[]): void {
    try {
      localStorage.setItem(this.DRAWINGS_KEY, JSON.stringify(drawings));
    } catch (e) {
      console.error('Fehler beim Speichern der Zeichnungen', e);
    }
  }

  /**
   * Erstellt eine Beispielzeichnung, wenn keine Zeichnungen vorhanden sind
   * Nur für Entwicklungs- und Testzwecke.
   */
  createSampleDrawingIfNeeded(): void {
    if (!this.OFFLINE_MODE) return;

    const drawings = this.getStoredDrawings();

    // Wenn keine Zeichnungen vorhanden sind, eine Beispielzeichnung erstellen
    if (drawings.length === 0) {
      const sampleDrawing = {
        id: uuidv4(),
        title: 'Beispielzeichnung',
        lines: [
          {
            points: [
              { x: 100, y: 100 },
              { x: 200, y: 200 },
              { x: 300, y: 100 }
            ],
            color: '#FF0000',
            width: 5
          }
        ],
        settings: {
          backgroundColor: '#FFFFFF',
          defaultColor: '#000000',
          defaultWidth: 3
        },
        userId: 'anonymous',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      drawings.push(sampleDrawing);
      this.saveStoredDrawings(drawings);
      console.log('Beispielzeichnung erstellt');
    }
  }

  /**
   * Startet eine neue Zeichnung an einem Punkt
   * @param point Der Startpunkt
   */
  startDrawing(point: { x: number, y: number }): void {
    const settings = this.settingsSubject.value;
    this.currentLine = {
      points: [point],
      color: settings.color,
      width: settings.lineWidth,
      tool: settings.tool || 'brush',
      opacity: settings.opacity,
      startPoint: point  // Explizit den Startpunkt setzen
    };
  }

  /**
   * Setzt die Zeichnung an einem weiteren Punkt fort
   * @param point Der nächste Punkt
   */
  continueDrawing(point: { x: number, y: number }): void {
    if (!this.currentLine) return;

    // Bei Formen wie Rechteck oder Kreis nur den letzten Punkt aktualisieren
    if (this.currentLine.tool !== 'brush' && this.currentLine.tool !== 'eraser') {
      // Bei Formen nur Startpunkt und aktuellen Punkt behalten
      this.currentLine.points = [this.currentLine.points[0], point];
    } else {
      // Bei Freihandzeichnung alle Punkte hinzufügen
      this.currentLine.points.push(point);
    }

    // Bei allen Tools den Endpunkt aktualisieren
    this.currentLine.endPoint = point;
  }

  /**
   * Beendet die aktuelle Zeichnung
   * @param point Der Endpunkt
   */
  endDrawing(point: { x: number, y: number }): void {
    if (!this.currentLine) return;

    // Für alle Tools sicherstellen, dass der Endpunkt korrekt ist
    this.currentLine.endPoint = point;

    // Bei Freihandzeichnung den letzten Punkt hinzufügen
    if (this.currentLine.tool === 'brush' || this.currentLine.tool === 'eraser') {
      if (this.currentLine.points[this.currentLine.points.length - 1] !== point) {
        this.currentLine.points.push(point);
      }
    } else {
      // Bei Formen nur Start- und Endpunkt speichern
      this.currentLine.points = [this.currentLine.points[0], point];
    }

    // Vor dem Hinzufügen der neuen Linie den aktuellen Zustand auf den Undo-Stack legen
    this.undoStack.push([...this.linesSubject.value]);

    // Redo-Stack leeren, da eine neue Aktion ausgeführt wurde
    this.redoStack = [];

    // Linie zu den aktuellen Linien hinzufügen
    const updatedLines = [...this.linesSubject.value, this.currentLine];
    this.linesSubject.next(updatedLines);

    // Aktuellen Zustand speichern
    this.saveCurrentDrawingState(updatedLines, this.settingsSubject.value);

    // Aktuelle Linie zurücksetzen
    this.currentLine = null;
  }

  /**
   * Gibt die aktuelle Zeichnung zurück
   * @returns Die aktuelle Zeichnungslinie oder null
   */
  getCurrentLine(): DrawingLine | null {
    return this.currentLine;
  }

  /**
   * Aktualisiert die Zeichnungseinstellungen
   * @param settings Die zu aktualisierenden Einstellungen
   */
  updateSettings(settings: Partial<DrawingSettings>): void {
    // Alte Settings zwischenspeichern
    const oldSettings = { ...this.settingsSubject.value };

    // Nur die aktualisierten Einstellungen übernehmen, ohne die Liniendaten zu beeinflussen
    const newSettings = { ...oldSettings, ...settings };

    // Neue Settings setzen ohne den Canvas-Zustand zurückzusetzen
    this.settingsSubject.next(newSettings);

    // Den bestehenden Zeichnungszustand mit den neuen Einstellungen speichern
    // aber KEINE Änderung an den Zeichnungslinien vornehmen
    this.saveCurrentDrawingState(this.linesSubject.value, newSettings);
  }

  /**
   * Löscht den Canvas-Inhalt
   */
  clearCanvas(): void {
    // Vor dem Löschen den aktuellen Zustand auf den Undo-Stack legen
    this.undoStack.push([...this.linesSubject.value]);

    // Redo-Stack leeren
    this.redoStack = [];

    // Linien leeren
    this.linesSubject.next([]);

    // Aktuellen Zustand speichern
    this.saveCurrentDrawingState([], this.settingsSubject.value);
  }

  /**
   * Macht die letzte Aktion rückgängig
   */
  undo(): void {
    if (this.undoStack.length === 0) return;

    // Aktuellen Zustand auf den Redo-Stack legen
    this.redoStack.push([...this.linesSubject.value]);

    // Letzten Zustand vom Undo-Stack holen
    const previousState = this.undoStack.pop() || [];
    this.linesSubject.next(previousState);

    // Aktuellen Zustand speichern
    this.saveCurrentDrawingState(previousState, this.settingsSubject.value);
  }

  /**
   * Stellt die letzte rückgängig gemachte Aktion wieder her
   */
  redo(): void {
    if (this.redoStack.length === 0) return;

    // Aktuellen Zustand auf den Undo-Stack legen
    this.undoStack.push([...this.linesSubject.value]);

    // Letzten Zustand vom Redo-Stack holen
    const nextState = this.redoStack.pop() || [];
    this.linesSubject.next(nextState);

    // Aktuellen Zustand speichern
    this.saveCurrentDrawingState(nextState, this.settingsSubject.value);
  }

  /**
   * Speichert eine Zeichnung mit Namen und Canvas-Referenz
   * @param name Der Name der Zeichnung
   * @param canvas Das Canvas-Element
   */
  saveDrawingFromCanvas(name: string, canvas: HTMLCanvasElement): void {
    const lines = this.linesSubject.value;
    const settings = this.settingsSubject.value;

    // Canvas als Bild speichern (optional)
    const imageData = canvas.toDataURL('image/png');

    // Zeichnung mit Linien und Einstellungen speichern
    this.saveDrawing(lines, settings, name)
      .subscribe({
        next: (id) => console.log(`Zeichnung gespeichert mit ID: ${id}`),
        error: (err) => console.error('Fehler beim Speichern der Zeichnung:', err)
      });
  }
}
