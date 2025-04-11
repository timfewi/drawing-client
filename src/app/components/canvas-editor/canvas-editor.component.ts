import { Component, ElementRef, AfterViewInit, ViewChild, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DrawingService } from '../../services/drawing.service';
import { Point } from '../../models/Point.model';
import { DrawingLine } from '../../models/DrawingLine.model';
import { DrawingSettings } from '../../models/DrawingSettings.model';
import { DrawingTool } from '../../models/DrawingTool.model';
import { Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { DrawingLineUtils } from '../../utils/DrawingLineUtils.model';
import { Bounds } from '../../models/Bounds.model';

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
  imports: [CommonModule, FormsModule]
})
export class CanvasEditorComponent implements AfterViewInit, OnDestroy {
  /** Referenz auf das Canvas-Element */
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  /** Referenz auf das Text-Input Element */
  @ViewChild('textInput') textInputRef!: ElementRef<HTMLInputElement>;

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

  /** Aktuelle Textgröße (unabhängig von der Strichbreite) */
  currentTextSize = 16;

  /** Standardbreite und -höhe des Canvas */
  canvasWidth = 800;
  canvasHeight = 600;

  /** Kann eine Aktion rückgängig gemacht werden? */
  canUndo = false;

  /** Kann eine rückgängig gemachte Aktion wiederhergestellt werden? */
  canRedo = false;

  /** Fullscreen-Modus aktiv? */
  isFullscreen = false;

  /** Subscription für Settings-Updates */
  private settingsSubscription: Subscription;

  /** Subscription für Drawing-Updates */
  private drawingSubscription: Subscription;

  /** Speichert den aktuellen Zeichnungszustand */
  private currentDrawingLines: DrawingLine[] = [];

  /** Text-Editor Variablen */
  isTextEditing = false;
  currentText = '';
  textPosition: Point = { x: 0, y: 0 };

  /** Aktuell ausgewähltes Objekt */
  selectedLine: DrawingLine | null = null;

  /** Drag & Drop Zustände */
  isDragging = false; // Changed from private to public to be accessible in the template
  private dragStartPoint: Point | null = null;
  private dragStartLinePosition: Point[] | null = null;

  /** Skalierungszustand */
  private isResizing = false;
  private resizeHandle: string | null = null;
  private initialBounds: Bounds | null = null;

  private resizeTimeout: any;

  constructor(private readonly drawingService: DrawingService) {
    // Initialisierung der Subscriptions direkt im Konstruktor
    this.settingsSubscription = this.drawingService.settings$.subscribe(
      (settings: DrawingSettings) => {
        this.currentTool = settings.tool as DrawingTool;
        this.currentColor = settings.color;
        this.currentWidth = settings.lineWidth;
        // Textgröße aus den Settings holen oder Standardwert verwenden
        this.currentTextSize = settings.textSize || 16;
      }
    );

    this.drawingSubscription = this.drawingService.lines$.subscribe(
      (lines: DrawingLine[]) => {
        this.currentDrawingLines = lines;
        this.redrawCanvas(lines);
        this.canUndo = lines.length > 0;
        this.canRedo = false;
      }
    );
  }

  /**
   * Nach der Initialisierung der View das Canvas und seinen Kontext einrichten
   */
  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    this.resizeCanvas();
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
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    this.resizeTimeout = setTimeout(() => {
      this.resizeCanvas();
    }, 100);
  }

  /**
   * Beim Drücken der Escape-Taste Fullscreen beenden
   */
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isFullscreen) {
      this.toggleFullscreen();
    }
  }

  /**
   * Canvas-Größe an das Eltern-Element anpassen
   */
  private resizeCanvas(): void {
    setTimeout(() => {
      const container = this.canvasRef?.nativeElement.parentElement;
      if (!container) return;

      const containerStyle = window.getComputedStyle(container);
      const paddingX = parseFloat(containerStyle.paddingLeft) + parseFloat(containerStyle.paddingRight);
      const paddingY = parseFloat(containerStyle.paddingTop) + parseFloat(containerStyle.paddingBottom);
      const borderX = parseFloat(containerStyle.borderLeftWidth) + parseFloat(containerStyle.borderRightWidth);
      const borderY = parseFloat(containerStyle.borderTopWidth) + parseFloat(containerStyle.borderBottomWidth);

      const availableWidth = container.clientWidth - paddingX - borderX;

      let availableHeight: number;

      if (this.isFullscreen) {
        const toolbarHeight = document.querySelector('.toolbar-container')?.clientHeight || 80;
        availableHeight = window.innerHeight - toolbarHeight - 10;
      } else {
        const parentHeight = container.clientHeight - paddingY - borderY;
        availableHeight = Math.min(window.innerHeight * 0.6, parentHeight);

        const aspectRatio = 4 / 3;
        const heightByAspectRatio = availableWidth / aspectRatio;

        availableHeight = Math.min(availableHeight, heightByAspectRatio);
      }

      this.canvasWidth = Math.floor(availableWidth);
      this.canvasHeight = Math.floor(availableHeight);

      this.redrawCanvas();

    }, 0);
  }

  /**
   * Werkzeug auswählen
   * @param tool Das auszuwählende Werkzeug
   */
  selectTool(tool: DrawingTool): void {
    console.log('Selecting tool:', tool); // Debugging-Hilfe

    // Wenn Texteingabe läuft, beenden
    if (this.isTextEditing) {
      this.finalizeText();
    }

    this.currentTool = tool;

    // Cursor-Stil aktualisieren
    this.updateCanvasCursor();

    // Einstellungen im Service aktualisieren
    this.drawingService.updateSettings({
      tool,
      color: this.currentColor,
      lineWidth: this.currentWidth,
      textSize: this.currentTextSize
    });
  }

  /**
   * Aktualisiert den Cursor-Stil basierend auf dem ausgewählten Werkzeug
   */
  private updateCanvasCursor(resizeHandle: string | null = null): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    // Alle Cursor-Klassen entfernen
    canvas.classList.remove('select-mode', 'object-hover', 'dragging');
    canvas.style.cursor = '';

    if (this.currentTool === 'select') {
      canvas.classList.add('select-mode');

      // Skalierungscursor setzen, wenn ein Handle aktiv ist
      if (resizeHandle) {
        switch (resizeHandle) {
          case 'top-left':
          case 'bottom-right':
            canvas.style.cursor = 'nwse-resize';
            break;
          case 'top-right':
          case 'bottom-left':
            canvas.style.cursor = 'nesw-resize';
            break;
        }
      } else if (this.isDragging) {
        canvas.style.cursor = 'grabbing';
      }
    }
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
   * Textgröße aktualisieren
   * @param event Das Input-Event des Textgrößen-Sliders
   */
  updateTextSize(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.currentTextSize = parseInt(input.value, 10);
    // Speichere die Textgröße in einem eigenen Feld im Settings-Objekt
    this.drawingService.updateSettings({ textSize: this.currentTextSize });

    // Wenn ein Text-Eingabefeld aktiv ist, die Schriftgröße sofort aktualisieren
    if (this.isTextEditing && this.textInputRef?.nativeElement) {
      this.textInputRef.nativeElement.style.fontSize = `${this.currentTextSize}px`;
    }
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
        textSize: this.currentTextSize,
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
   * Fullscreen-Modus umschalten
   */
  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;

    document.body.classList.toggle('canvas-fullscreen-active', this.isFullscreen);

    setTimeout(() => {
      this.resizeCanvas();
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }

  /**
   * Mausklick-Handler für den Zeichenbeginn
   * @param event Das Maus-Event
   */
  onMouseDown(event: MouseEvent): void {
    console.log('MouseDown', this.currentTool);

    // Wenn im Auswahlmodus
    if (this.currentTool === 'select') {
      this.handleSelectionMouseDown(event);
      return;
    }

    // Beende laufende Texteingabe bei Klick
    if (this.isTextEditing) {
      this.finalizeText();

      // Wenn nicht im Text-Werkzeug, verarbeite den Klick für Zeichenwerkzeuge
      if (this.currentTool !== 'text') {
        this.startDrawingAtPoint(event);
      }
      return;
    }

    // Wenn im Text-Werkzeug und noch keine Texteingabe läuft
    if (this.currentTool === 'text') {
      this.startTextEditing(this.getPointFromEvent(event));
      return;
    }

    // Für alle anderen Werkzeuge
    this.startDrawingAtPoint(event);
  }

  /**
   * Behandelt Mausklick im Auswahlmodus
   */
  private handleSelectionMouseDown(event: MouseEvent): void {
    const point = this.getPointFromEvent(event);

    // Zuerst prüfen, ob ein bereits ausgewähltes Objekt an einem Resizing-Handle angeklickt wurde
    if (this.selectedLine?.bounds) {
      const handle = DrawingLineUtils.getResizeHandleAtPoint(point, this.selectedLine.bounds);

      if (handle) {
        // Größenänderung starten
        this.isResizing = true;
        this.resizeHandle = handle;
        this.initialBounds = { ...this.selectedLine.bounds };
        this.dragStartPoint = point;

        // Canvas-Cursor aktualisieren
        this.updateCanvasCursor(handle);
        return;
      }
    }

    // Falls kein Handle getroffen wurde, normal fortfahren...

    // Alte Auswahl aufheben
    if (this.selectedLine) {
      this.selectedLine.selected = false;
    }

    // Prüfen, ob ein Objekt getroffen wurde
    this.selectedLine = this.findLineAtPoint(point);

    // Wenn ein Objekt gefunden wurde
    if (this.selectedLine) {
      this.selectedLine.selected = true;
      this.isDragging = true;
      this.dragStartPoint = point;
      this.dragStartLinePosition = [...this.selectedLine.points];

      // Canvas neu zeichnen, um Selektionsrahmen anzuzeigen
      this.redrawCanvas(this.currentDrawingLines);
    } else {
      // Neu zeichnen, um alte Selektionsrahmen zu entfernen
      this.redrawCanvas(this.currentDrawingLines);
    }
  }

  /**
   * Mausbewegung-Handler
   */
  onMouseMove(event: MouseEvent): void {
    const currentPoint = this.getPointFromEvent(event);

    // Cursor-Updates für Hover-Effekte im Auswahlmodus
    if (this.currentTool === 'select' && !this.isDragging && !this.isResizing) {
      const canvas = this.canvasRef.nativeElement;
      canvas.style.cursor = '';

      // Wenn ein Objekt bereits ausgewählt ist, prüfe auf Handle-Hover
      if (this.selectedLine?.bounds) {
        const handle = DrawingLineUtils.getResizeHandleAtPoint(currentPoint, this.selectedLine.bounds);
        if (handle) {
          switch (handle) {
            case 'top-left':
            case 'bottom-right':
              canvas.style.cursor = 'nwse-resize';
              break;
            case 'top-right':
            case 'bottom-left':
              canvas.style.cursor = 'nesw-resize';
              break;
          }
          return;
        }
      }

      // Prüfe, ob der Cursor über einem Objekt schwebt
      const hoverLine = this.findLineAtPoint(currentPoint);
      if (hoverLine) {
        canvas.style.cursor = 'move';
      }
    }

    // Für Größenänderung im Auswahlmodus
    if (this.currentTool === 'select' && this.isResizing && this.selectedLine &&
      this.initialBounds && this.dragStartPoint && this.resizeHandle) {

      const deltaX = currentPoint.x - this.dragStartPoint.x;
      const deltaY = currentPoint.y - this.dragStartPoint.y;

      // Neue Bounds basierend auf dem aktiven Handle berechnen
      const newBounds = { ...this.initialBounds };

      switch (this.resizeHandle) {
        case 'top-left':
          newBounds.x += deltaX;
          newBounds.y += deltaY;
          newBounds.width -= deltaX;
          newBounds.height -= deltaY;
          break;
        case 'top-right':
          newBounds.y += deltaY;
          newBounds.width += deltaX;
          newBounds.height -= deltaY;
          break;
        case 'bottom-left':
          newBounds.x += deltaX;
          newBounds.width -= deltaX;
          newBounds.height += deltaY;
          break;
        case 'bottom-right':
          newBounds.width += deltaX;
          newBounds.height += deltaY;
          break;
      }

      // Minimale Größe durchsetzen
      if (newBounds.width < 10) newBounds.width = 10;
      if (newBounds.height < 10) newBounds.height = 10;

      // Objekt skalieren und neu zeichnen
      const scaledLine = DrawingLineUtils.scaleLine(this.selectedLine, newBounds);

      // Skalierte Linie als ausgewählt markieren und anzeigen
      scaledLine.selected = true;
      this.selectedLine = scaledLine;

      // Neu zeichnen
      // Bestehende Liste behalten, aber das ausgewählte Objekt ersetzen
      const updatedLines = this.currentDrawingLines.map(line =>
        line.id === scaledLine.id ? scaledLine : line
      );

      this.redrawCanvas(updatedLines);
      return;
    }

    // Für Drag & Drop im Auswahlmodus
    if (this.currentTool === 'select' && this.isDragging && this.selectedLine &&
      this.dragStartPoint && this.dragStartLinePosition) {

      const offsetX = currentPoint.x - this.dragStartPoint.x;
      const offsetY = currentPoint.y - this.dragStartPoint.y;

      // Neues Punktarray mit den verschobenen Punkten erstellen
      const movedPoints = this.dragStartLinePosition.map(point => ({
        x: point.x + offsetX,
        y: point.y + offsetY
      }));

      // Punkte aktualisieren
      this.selectedLine.points = movedPoints;

      // Bounds aktualisieren
      const bounds = DrawingLineUtils.calculateBounds(this.selectedLine);
      this.selectedLine.bounds = bounds || undefined;

      // Canvas neu zeichnen
      this.redrawCanvas(this.currentDrawingLines);
      return;
    }

    // Bestehende Zeichenlogik beibehalten
    if (!this.isDrawing) return;

    this.drawingService.continueDrawing(currentPoint);

    if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
      this.drawLine(this.drawingService.getCurrentLine());
    } else if (this.currentTool !== 'text') {
      this.previewShape();
    }
  }

  /**
   * Mausklick-Ende-Handler
   */
  onMouseUp(event: MouseEvent): void {
    // Größenänderung beenden
    if (this.isResizing && this.selectedLine) {
      this.isResizing = false;
      this.resizeHandle = null;
      this.initialBounds = null;

      // Aktualisiere die Zeichnung im Service
      this.drawingService.updateLine(this.selectedLine);

      // Cursor zurücksetzen
      this.updateCanvasCursor();
      return;
    }

    // Drag & Drop beenden
    if (this.currentTool === 'select' && this.isDragging) {
      this.isDragging = false;
      this.dragStartPoint = null;
      this.dragStartLinePosition = null;

      // Aktualisiere die Zeichnung im Service
      if (this.selectedLine) {
        this.drawingService.updateLine(this.selectedLine);
      }

      // Cursor zurücksetzen
      this.updateCanvasCursor();
      return;
    }

    // Bestehende Zeichenlogik
    if (!this.isDrawing) return;
    if (this.currentTool === 'text') return;

    const point = this.getPointFromEvent(event);
    this.drawingService.endDrawing(point);
    this.isDrawing = false;
  }

  /**
   * Handler für das Verlassen des Canvas während des Zeichnens
   */
  onMouseLeave(): void {
    // Beende Zeichnen, wenn der Cursor den Canvas verlässt
    if (this.isDrawing) {
      const currentLine = this.drawingService.getCurrentLine();
      if (currentLine && currentLine.points.length > 0) {
        const lastPoint = currentLine.points[currentLine.points.length - 1];
        this.drawingService.endDrawing(lastPoint);
      }
      this.isDrawing = false;
    }

    // Beende auch das Dragging, wenn der Cursor den Canvas verlässt
    if (this.isDragging || this.isResizing) {
      this.isDragging = false;
      this.isResizing = false;
      this.dragStartPoint = null;
      this.dragStartLinePosition = null;
      this.resizeHandle = null;
      this.initialBounds = null;

      // Aktualisiere die Zeichnung im Service, wenn ein Objekt ausgewählt war
      if (this.selectedLine) {
        this.drawingService.updateLine(this.selectedLine);
      }
    }
  }

  /**
   * Sucht nach einem Objekt an der angegebenen Position
   */
  private findLineAtPoint(point: Point): DrawingLine | null {
    // In umgekehrter Reihenfolge durchgehen (zuletzt gezeichnete zuerst)
    for (let i = this.currentDrawingLines.length - 1; i >= 0; i--) {
      const line = this.currentDrawingLines[i];

      // Wenn Bounds nicht definiert sind, berechnen
      if (!line.bounds) {
        line.bounds = DrawingLineUtils.calculateBounds(line) || undefined;
      }

      // Prüfen, ob Punkt in den Bounds liegt
      if (line.bounds && DrawingLineUtils.isPointInBounds(point, line.bounds)) {
        return line;
      }
    }

    return null;
  }

  /**
   * Startet den Zeichenvorgang an einem bestimmten Punkt
   */
  private startDrawingAtPoint(event: MouseEvent): void {
    // Prüfen ob wir nicht im Text- oder Auswahlmodus sind
    if (this.currentTool === 'text' || this.currentTool === 'select') return;

    this.isDrawing = true;
    const point = this.getPointFromEvent(event);

    // Direkt StartDrawing im Service aufrufen
    this.drawingService.startDrawing(point);
  }

  /**
   * Touch-Start-Handler für mobile Geräte
   * @param event Das Touch-Event
   */
  onTouchStart(event: TouchEvent): void {
    event.preventDefault();
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
    event.preventDefault();
    if (event.touches.length === 1 && this.isDrawing) {
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
    event.preventDefault();
    const mouseEvent = new MouseEvent('mouseup', {});
    this.onMouseUp(mouseEvent);
  }

  /**
   * Handler für Klicks auf den Canvas-Container (für Text-Tool)
   */
  onCanvasContainerClick(event: MouseEvent): void {
    // Prüfen, ob das Ziel tatsächlich der Canvas ist, nicht das Overlay
    if (event.target !== this.canvasRef.nativeElement) {
      return;
    }

    // Nur Text-Modus behandeln
    if (this.currentTool === 'text' && !this.isTextEditing) {
      this.startTextEditing(this.getPointFromEvent(event));
    }
  }

  /**
   * Startet die Texteingabe an der angegebenen Position
   */
  private startTextEditing(position: Point): void {
    this.textPosition = position;
    this.currentText = '';
    this.isTextEditing = true;

    setTimeout(() => {
      if (this.textInputRef?.nativeElement) {
        this.textInputRef.nativeElement.focus();
        this.textInputRef.nativeElement.style.fontSize = `${this.currentTextSize}px`;
      }
    }, 10);
  }

  /**
   * Beendet die Texteingabe und zeichnet den Text auf den Canvas
   */
  finalizeText(): void {
    if (!this.isTextEditing) return;

    if (this.currentText.trim()) {
      this.drawText(this.textPosition, this.currentText);
    }

    this.isTextEditing = false;
    this.currentText = '';
  }

  /**
   * Zeichnet Text auf den Canvas und speichert ihn
   */
  private drawText(position: Point, text: string): void {
    if (!this.ctx || !text.trim()) return;

    // Textstil festlegen mit aktueller Textgröße
    this.ctx.font = `${this.currentTextSize}px Arial`;
    this.ctx.fillStyle = this.currentColor;
    this.ctx.textBaseline = 'top';

    // Text zeichnen
    this.ctx.fillText(text, position.x, position.y);

    // Text als "Linie" speichern, um Undo/Redo zu unterstützen
    const textLine: DrawingLine = {
      tool: 'text',
      color: this.currentColor,
      width: this.currentWidth, // Behalte width für Kompatibilität
      points: [position],
      text: text,
      textSize: this.currentTextSize // Speichere die Textgröße als zusätzliche Eigenschaft
    };

    // An den DrawingService senden
    this.drawingService.addTextToDrawing(textLine);
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
   * Zeichnet eine Linie inklusive Selektionsrahmen
   */
  private drawLine(line: DrawingLine | null): void {
    if (!line || !this.ctx) return;
    if (!line.points || !Array.isArray(line.points) || line.points.length < 1) return;

    // Sicherstellen dass jede Linie eine ID hat
    if (!line.id) {
      line.id = uuidv4();
    }

    // Bounds berechnen wenn nicht vorhanden
    if (!line.bounds) {
      line.bounds = DrawingLineUtils.calculateBounds(line) || undefined;
    }

    // Text-Objekte zeichnen
    if (line.tool === 'text' && line.text && line.points.length > 0) {
      const position = line.points[0];
      const fontSize = line.textSize || line.width * 3;
      this.ctx.font = `${fontSize}px Arial`;
      this.ctx.fillStyle = line.color;
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(line.text, position.x, position.y);

      // Wenn das Objekt ausgewählt ist, den Selektionsrahmen zeichnen
      if (line.selected && line.bounds) {
        this.drawSelectionBorder(line.bounds);
      }
      return;
    }

    // Anderes Zeichnen wie bisher
    this.ctx.strokeStyle = line.tool === 'eraser' ? '#FFFFFF' : line.color;
    this.ctx.lineWidth = line.width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (line.tool === 'brush' || line.tool === 'eraser') {
      if (line.points.length < 2) return;

      this.ctx.beginPath();
      this.ctx.moveTo(line.points[0].x, line.points[0].y);

      for (let i = 1; i < line.points.length; i++) {
        this.ctx.lineTo(line.points[i].x, line.points[i].y);
      }

      this.ctx.stroke();

      // Wenn das Objekt ausgewählt ist, den Selektionsrahmen zeichnen
      if (line.selected && line.bounds) {
        this.drawSelectionBorder(line.bounds);
      }
    } else {
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

      // Wenn das Objekt ausgewählt ist, den Selektionsrahmen zeichnen
      if (line.selected && line.bounds) {
        this.drawSelectionBorder(line.bounds);
      }
    }
  }

  /**
   * Zeichnet einen Selektionsrahmen um ein Objekt
   */
  private drawSelectionBorder(bounds: Bounds): void {
    if (!this.ctx) return;

    // Rahmen um das ausgewählte Objekt zeichnen
    this.ctx.save();
    this.ctx.strokeStyle = '#4285F4';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]); // Gestrichelte Linie
    this.ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

    // Größenänderungsgriffe an den Ecken zeichnen
    const handleSize = 8;
    this.ctx.fillStyle = '#4285F4';

    // Ecken
    this.ctx.fillRect(bounds.x - handleSize / 2, bounds.y - handleSize / 2, handleSize, handleSize);
    this.ctx.fillRect(bounds.x + bounds.width - handleSize / 2, bounds.y - handleSize / 2, handleSize, handleSize);
    this.ctx.fillRect(bounds.x - handleSize / 2, bounds.y + bounds.height - handleSize / 2, handleSize, handleSize);
    this.ctx.fillRect(bounds.x + bounds.width - handleSize / 2, bounds.y + bounds.height - handleSize / 2, handleSize, handleSize);

    this.ctx.restore();
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
    if (!line?.points || !Array.isArray(line.points) || line.points.length < 2) return;

    this.clearCanvas();

    for (const existingLine of this.currentDrawingLines) {
      this.drawLine(existingLine);
    }

    this.drawLine(line);
  }
}

