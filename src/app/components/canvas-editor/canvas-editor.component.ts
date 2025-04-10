import { Component, ElementRef, AfterViewInit, ViewChild, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DrawingService } from '../../services/drawing.service';
import { Point } from '../../models/Point.model';
import { DrawingLine } from '../../models/DrawingLine.model';
import { DrawingSettings } from '../../models/DrawingSettings.model';
import { DrawingTool } from '../../models/DrawingTool.model';
import { Subscription } from 'rxjs';

/**
 * Canvas-Editor-Komponente
 *
 * Diese Komponente stellt eine Benutzeroberfläche zum Zeichnen mit verschiedenen Werkzeugen bereit.
 * Sie nutzt ein HTML5 Canvas-Element und den DrawingService für die Zustandsverwaltung.
 */
@Component({
  selector: 'app-canvas-editor',
  templateUrl: './canvas-editor.component.html',
  styleUrls: ['./canvas-editor.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class CanvasEditorComponent implements AfterViewInit, OnDestroy {
  /** Referenz auf das Canvas-Element */
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  /** Canvas-Kontext für das Zeichnen */
  private ctx!: CanvasRenderingContext2D;

  /** Ist der Benutzer gerade am Zeichnen? */
  private isDrawing = false;

  /** Aktuell ausgewähltes Werkzeug */
  currentTool: DrawingTool = 'brush';
  /** Aktuelle Strichfarbe */
  currentColor = '#000000';

  /** Aktuelle Strichbreite */
  currentWidth = 5;

  /** Standardbreite und -höhe des Canvas */
  canvasWidth = 800;
  canvasHeight = 600;

  /** Kann eine Aktion rückgängig gemacht werden? */
  canUndo = false;

  /** Kann eine rückgängig gemachte Aktion wiederhergestellt werden? */
  canRedo = false;

  /** Subscription für Settings-Updates */
  private settingsSubscription: Subscription;

  /** Subscription für Drawing-Updates */
  private drawingSubscription: Subscription;

  /** Speichert den aktuellen Zeichnungszustand */
  private currentDrawingLines: DrawingLine[] = [];

  constructor(private readonly drawingService: DrawingService) {
    // Subscriptions für Settings und Drawing initialisieren
    this.settingsSubscription = this.drawingService.settings$.subscribe(
      (settings: DrawingSettings) => {
        this.currentTool = settings.tool as 'brush' | 'eraser' | 'line' | 'rectangle' | 'circle';
        this.currentColor = settings.color;
        this.currentWidth = settings.lineWidth;
      }
    );

    // WICHTIG: Direkt auf linesSubject subscriben statt getUserDrawings zu verwenden
    // Dies verhindert, dass die Zeichnung beim Werkzeugwechsel zurückgesetzt wird
    this.drawingSubscription = this.drawingService.lines$.subscribe(
      (lines: DrawingLine[]) => {
        this.currentDrawingLines = lines; // Speichern des aktuellen Zustands
        this.redrawCanvas(lines);
        this.canUndo = lines.length > 0;
        this.canRedo = false; // Wird in undo() aktualisiert
      }
    );
  }

  /**
   * Nach der Initialisierung der View das Canvas und seinen Kontext einrichten
   */
  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    // Canvas-Größe an das Eltern-Element anpassen
    this.resizeCanvas();

    // Initial Canvas leeren
    this.clearCanvas();
  }

  /**
   * Bei der Zerstörung der Komponente alle Subscriptions beenden
   */
  ngOnDestroy(): void {
    if (this.settingsSubscription) {
      this.settingsSubscription.unsubscribe();
    }
    if (this.drawingSubscription) {
      this.drawingSubscription.unsubscribe();
    }
  }

  /**
   * Bei Fenstergrößenänderung die Canvas-Größe anpassen
   */
  @HostListener('window:resize')
  onResize(): void {
    this.resizeCanvas();
  }

  /**
   * Canvas-Größe an das Eltern-Element anpassen
   */
  private resizeCanvas(): void {
    const container = this.canvasRef.nativeElement.parentElement;
    if (container) {
      // Wir behalten das Seitenverhältnis bei
      const containerWidth = container.clientWidth;
      // Hier können wir entweder eine feste Höhe oder ein Seitenverhältnis verwenden
      const containerHeight = Math.min(window.innerHeight * 0.6, containerWidth * 0.75);

      this.canvasWidth = containerWidth;
      this.canvasHeight = containerHeight;

      // Nach der Größenänderung alles neu zeichnen
      this.redrawCanvas();
    }
  }

  /**
   * Werkzeug auswählen
   * @param tool Das auszuwählende Werkzeug
   */
  selectTool(tool: 'brush' | 'eraser' | 'line' | 'rectangle' | 'circle'): void {
    // Nur das Werkzeug aktualisieren, aber nicht die gesamte Zeichnung zurücksetzen
    this.currentTool = tool;

    // Sende nur die Werkzeugänderung an den Service, ohne den Canvas-Zustand zu beeinflussen
    this.drawingService.updateSettings({
      tool,
      // Wichtig: Behalte alle anderen Einstellungen bei
      color: this.currentColor,
      lineWidth: this.currentWidth
    });

    // Keine Neuzeichnung des Canvas erforderlich, nur das aktuelle Werkzeug ändern
  }

  /**
   * Farbe aktualisieren
   * @param event Das Input-Event des Farbwählers
   */
  updateColor(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.currentColor = input.value;
    this.drawingService.updateSettings({ color: this.currentColor });
  }

  /**
   * Strichbreite aktualisieren
   * @param event Das Input-Event des Breiten-Sliders
   */
  updateWidth(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.currentWidth = parseInt(input.value, 10);
    this.drawingService.updateSettings({ lineWidth: this.currentWidth });
  }

  /**
   * Canvas leeren
   */
  clear(): void {
    if (confirm('Möchten Sie wirklich die gesamte Zeichnung löschen?')) {
      this.drawingService.clearCanvas();
      this.clearCanvas();
    }
  }

  /**
   * Letzte Aktion rückgängig machen
   */
  undo(): void {
    this.drawingService.undo();
    this.canRedo = true;
  }

  /**
   * Letzte rückgängig gemachte Aktion wiederherstellen
   */
  redo(): void {
    this.drawingService.redo();
  }

  /**
   * Zeichnung speichern
   */
  saveDrawing(): void {
    const name = prompt('Geben Sie einen Namen für Ihre Zeichnung ein:',
      `Zeichnung vom ${new Date().toLocaleDateString()}`);

    if (name) {
      const settings: DrawingSettings =
      {
        tool: this.currentTool,
        color: this.currentColor,
        lineWidth: this.currentWidth,
        opacity: 1,
        isDrawingEnabled: true,
        backgroundColor: '#ffffff'
      };
      this.drawingService.saveDrawing(this.currentDrawingLines, settings, name).subscribe((id) => {
        alert(`Zeichnung "${name}" wurde gespeichert!`);
      });
    }
  }

  /**
   * Mausklick-Handler für den Zeichenbeginn
   * @param event Das Maus-Event
   */
  onMouseDown(event: MouseEvent): void {
    this.isDrawing = true;
    const point = this.getPointFromEvent(event);
    this.drawingService.startDrawing(point);

    // Bei Formen wird ein temporärer Vorschau-Effekt gezeichnet
    if (this.currentTool !== 'brush' && this.currentTool !== 'eraser') {
      // Keine ctx.save() mehr hier - das verursacht Probleme
      // Stattdessen werden wir bei jedem Vorschau-Zeichnen den Canvas neu zeichnen
    }
  }

  /**
   * Mausbewegung-Handler während des Zeichnens
   * @param event Das Maus-Event
   */
  onMouseMove(event: MouseEvent): void {
    if (!this.isDrawing) return;

    const point = this.getPointFromEvent(event);
    this.drawingService.continueDrawing(point);

    // Für Freihandzeichnung direkt zeichnen
    if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
      this.drawLine(this.drawingService.getCurrentLine());
    } else {
      // Für Formen Vorschau zeichnen
      this.previewShape();
    }
  }

  /**
   * Mausklick-Ende-Handler für das Zeichenende
   * @param event Das Maus-Event
   */
  onMouseUp(event: MouseEvent): void {
    if (!this.isDrawing) return;

    const point = this.getPointFromEvent(event);
    this.drawingService.endDrawing(point);
    this.isDrawing = false;

    // Die final gezeichnete Form wird durch die Subscription des DrawingService aktualisiert
    // Kein ctx.restore() mehr nötig
  }

  /**
   * Handler für das Verlassen des Canvas während des Zeichnens
   */
  onMouseLeave(): void {
    if (this.isDrawing) {
      const currentLine = this.drawingService.getCurrentLine();
      if (currentLine && currentLine.points.length > 0) {
        const lastPoint = currentLine.points[currentLine.points.length - 1];
        this.drawingService.endDrawing(lastPoint);
      }
      this.isDrawing = false;
    }
  }

  /**
   * Touch-Start-Handler für mobile Geräte
   * @param event Das Touch-Event
   */
  onTouchStart(event: TouchEvent): void {
    event.preventDefault(); // Standard-Touch-Verhalten verhindern
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.onMouseDown(mouseEvent);
    }
  }

  /**
   * Touch-Move-Handler für mobile Geräte
   * @param event Das Touch-Event
   */
  onTouchMove(event: TouchEvent): void {
    event.preventDefault(); // Standard-Touch-Verhalten verhindern
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.onMouseMove(mouseEvent);
    }
  }

  /**
   * Touch-End-Handler für mobile Geräte
   * @param event Das Touch-Event
   */
  onTouchEnd(event: TouchEvent): void {
    event.preventDefault(); // Standard-Touch-Verhalten verhindern
    const mouseEvent = new MouseEvent('mouseup', {});
    this.onMouseUp(mouseEvent);
  }

  /**
   * Extrahiert einen Punkt aus einem Maus-Event
   * @param event Das Maus-Event
   * @returns Der extrahierte Punkt
   */
  private getPointFromEvent(event: MouseEvent): Point {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  /**
   * Löscht den Canvas
   */
  private clearCanvas(): void {
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    }
  }

  /**
   * Zeichnet alle Linien neu
   * @param lines Die zu zeichnenden Linien
   */
  private redrawCanvas(lines?: DrawingLine[]): void {
    this.clearCanvas();

    if (!lines) return;

    for (const line of lines) {
      this.drawLine(line);
    }
  }

  /**
   * Zeichnet eine einzelne Linie
   * @param line Die zu zeichnende Linie
   */
  private drawLine(line: DrawingLine | null): void {
    if (!line || !this.ctx) return;
    if (!line.points || !Array.isArray(line.points) || line.points.length < 1) return;

    this.ctx.strokeStyle = line.tool === 'eraser' ? '#FFFFFF' : line.color;
    this.ctx.lineWidth = line.width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (line.tool === 'brush' || line.tool === 'eraser') {
      // Freihandzeichnung
      if (line.points.length < 2) return;

      this.ctx.beginPath();
      this.ctx.moveTo(line.points[0].x, line.points[0].y);

      for (let i = 1; i < line.points.length; i++) {
        this.ctx.lineTo(line.points[i].x, line.points[i].y);
      }

      this.ctx.stroke();
    } else {
      // Für Formen: Ersten und letzten Punkt aus dem points Array verwenden
      if (line.points.length < 2) return;
      const start = line.points[0];
      const end = line.points[line.points.length - 1];

      switch (line.tool) {
        case 'line':
          this.drawLineShape(start, end, line);
          break;
        case 'rectangle':
          this.drawRectangleShape(start, end, line);
          break;
        case 'circle':
          this.drawCircleShape(start, end, line);
          break;
      }
    }
  }

  /**
   * Zeichnet eine gerade Linie
   * @param start Startpunkt
   * @param end Endpunkt
   * @param line Linieneigenschaften
   */
  private drawLineShape(start: Point, end: Point, line: DrawingLine): void {
    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();
  }

  /**
   * Zeichnet ein Rechteck
   * @param start Startpunkt
   * @param end Endpunkt
   * @param line Linieneigenschaften
   */
  private drawRectangleShape(start: Point, end: Point, line: DrawingLine): void {
    const width = end.x - start.x;
    const height = end.y - start.y;

    this.ctx.beginPath();
    this.ctx.rect(start.x, start.y, width, height);
    this.ctx.stroke();
  }

  /**
   * Zeichnet einen Kreis
   * @param start Startpunkt
   * @param end Endpunkt
   * @param line Linieneigenschaften
   */
  private drawCircleShape(start: Point, end: Point, line: DrawingLine): void {
    const radiusX = Math.abs(end.x - start.x) / 2;
    const radiusY = Math.abs(end.y - start.y) / 2;
    const centerX = Math.min(start.x, end.x) + radiusX;
    const centerY = Math.min(start.y, end.y) + radiusY;

    this.ctx.beginPath();
    this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    this.ctx.stroke();
  }

  /**
   * Zeigt eine Vorschau der aktuellen Form
   */
  private previewShape(): void {
    const line = this.drawingService.getCurrentLine();
    if (!line || !line.points || !Array.isArray(line.points) || line.points.length < 2) return;

    // Vollständiges Löschen und Neuzeichnen des Canvas
    this.clearCanvas();

    // Zuerst alle bestehenden Linien zeichnen
    for (const existingLine of this.currentDrawingLines) {
      this.drawLine(existingLine);
    }

    // Dann die Vorschau der aktuellen Form darüber zeichnen
    this.drawLine(line);
  }
}
