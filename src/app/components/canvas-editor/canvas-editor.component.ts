import { Component, ElementRef, AfterViewInit, ViewChild, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DrawingService } from '../../services/drawing.service';
import { HeaderService } from '../../services/header.service';
import { Point } from '../../models/Point.model';
import { DrawingLine } from '../../models/DrawingLine.model';
import { DrawingSettings } from '../../models/DrawingSettings.model';
import { DrawingTool } from '../../models/DrawingTool.model';
import { Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { DrawingLineUtils } from '../../utils/DrawingLineUtils.model';
import { Bounds } from '../../models/Bounds.model';
import { ConfirmModalComponent } from "../confirm-modal/confirm-modal.component";


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
  imports: [CommonModule, FormsModule, ConfirmModalComponent]
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

  /** Text-Eingabefeld Größenvariablen */
  textWidth = 150;
  textHeight = 30;
  isResizingTextInput = false;
  private textResizeStartPosition: Point | null = null;
  private textInitialSize = { width: 0, height: 0 };

  /** Aktuell ausgewähltes Objekt */
  selectedLine: DrawingLine | null = null;

  /** Mehrfachauswahl Funktionalität */
  selectedLines: DrawingLine[] = [];
  isMultiSelecting = false;
  selectionStartPoint: Point | null = null;
  selectionRect: { x: number, y: number, width: number, height: number } | null = null;
  private isMultiSelectKeyPressed = false;

  /** Gruppierung */
  isGrouped = false;
  groupedLines: string[] = []; // IDs der gruppierten Linien

  /** Drag & Drop Zustände */
  isDragging = false; // Changed from private to public to be accessible in the template
  private dragStartPoint: Point | null = null;
  private dragStartLinePosition: Point[] | null = null;
  private dragStartLinesPositions: Map<string, Point[]> = new Map();

  /** Skalierungszustand */
  private isResizing = false;
  private resizeHandle: string | null = null;
  private initialBounds: Bounds | null = null;

  private resizeTimeout: any;

  showModal = false;

  constructor(
    private readonly drawingService: DrawingService,
    private readonly headerService: HeaderService
  ) {
    // Initialisierung der Subscriptions direkt im Konstruktor
    this.settingsSubscription = this.drawingService.settings$.subscribe(
      (settings: DrawingSettings) => {
        this.currentTool = settings.tool;
        this.currentColor = settings.color;
        this.currentWidth = settings.lineWidth;
        // Textgröße aus den Settings holen oder Standardwert verwenden
        this.currentTextSize = settings.textSize ?? 16;
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
   * Beim Scrollen des Fensters den Header kontrollieren
   */
  @HostListener('window:scroll')
  onScroll(): void {
    // Beim Scrollen nach unten den Header ausblenden
    if (window.scrollY > 100) {
      this.headerService.hideHeader();
    } else {
      this.headerService.showHeader();
    }
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
   * Beim Drücken von Strg+G Objekte gruppieren
   */
  @HostListener('document:keydown.control.g', ['$event'])
  onGroupKey(event: KeyboardEvent): void {
    // Verhindern, dass der Browser seine Standard-Aktion ausführt
    event.preventDefault();

    // Nur im Auswahlmodus erlauben
    if (this.currentTool === 'select' && this.selectedLines.length >= 2) {
      this.groupSelectedObjects();
    }
  }

  /**
   * Beim Drücken von Strg+Shift+G Gruppierung aufheben
   */
  @HostListener('document:keydown.control.shift.g', ['$event'])
  onUngroupKey(event: KeyboardEvent): void {
    // Verhindern, dass der Browser seine Standard-Aktion ausführt
    event.preventDefault();

    // Nur im Auswahlmodus und wenn eine Gruppierung vorhanden ist
    if (this.currentTool === 'select' && this.isGrouped) {
      this.ungroupObjects();
    }
  }

  /**
   * Beim Drücken der Shift-Taste Mehrfachauswahl aktivieren
   */
  @HostListener('document:keydown.shift', ['$event'])
  onShiftKeyDown(event: KeyboardEvent): void {
    this.isMultiSelectKeyPressed = true;
  }

  /**
   * Beim Loslassen der Shift-Taste Mehrfachauswahl deaktivieren
   */
  @HostListener('document:keyup.shift', ['$event'])
  onShiftKeyUp(event: KeyboardEvent): void {
    this.isMultiSelectKeyPressed = false;
  }

  /**
   * Tastaturkürzel für Werkzeuge und Aktionen:
   * Alt+1: Pinsel
   * Alt+2: Radierer
   * Alt+3: Text
   * Alt+4: Linie
   * Alt+5: Rechteck
   * Alt+6: Kreis
   * Alt+7: Auswahl
   * Alt+Z: Redo
   * Alt+Y: Undo
   * Entf: Lösche ausgewählte Objekte
   * Alt+S: Speichern
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Ignorieren, wenn Texteingabe aktiv ist
    if (this.isTextEditing) return;

    // Entf-Taste für Löschen der Auswahl
    if (event.key === 'Delete' && this.currentTool === 'select' && this.selectedLines.length > 0) {
      this.deleteSelectedObjects();
      event.preventDefault();
      return;
    }

    // Nur Alt-Taste Kombinationen behandeln
    if (event.altKey) {
      switch (event.key) {
        case '1':
          this.selectTool('brush');
          event.preventDefault();
          break;
        case '2':
          this.selectTool('eraser');
          event.preventDefault();
          break;
        case '3':
          this.selectTool('text');
          event.preventDefault();
          break;
        case '4':
          this.selectTool('line');
          event.preventDefault();
          break;
        case '5':
          this.selectTool('rectangle');
          event.preventDefault();
          break;
        case '6':
          this.selectTool('circle');
          event.preventDefault();
          break;
        case '7':
          this.selectTool('select');
          event.preventDefault();
          break;
        case 'z':
        case 'Z':
          this.undo();
          event.preventDefault();
          break;
        case 'y':
        case 'Y':
          this.redo();
          event.preventDefault();
          break;
        case 's':
        case 'S':
          this.saveDrawing();
          event.preventDefault();
          break;
      }
    }
  }

  /**
   * Löscht alle aktuell ausgewählten Objekte
   */
  private deleteSelectedObjects(): void {
    if (this.selectedLines.length === 0) return;

    // Alle ausgewählten Objekte durchlaufen und löschen
    for (const line of this.selectedLines) {
      if (line.id) {
        this.drawingService.deleteDrawingObject(line.id);
      }
    }

    // Auswahl zurücksetzen
    this.selectedLines = [];
    this.selectedLine = null;

    // Optional: Feedback anzeigen
    this.showTooltip(`${this.selectedLines.length} Objekte gelöscht`, {
      x: this.canvasWidth / 2,
      y: this.canvasHeight / 2
    });
  }

  /**
   * Fullscreen-Modus umschalten
   */
  toggleFullscreen(): void {
    // Aktuelle Zeichnungsdaten für die Wiederherstellung sichern
    const savedDrawingData = JSON.parse(JSON.stringify(this.currentDrawingLines));

    // Vorherigen Zustand speichern
    const wasFullscreen = this.isFullscreen;

    // Fullscreen-Status umschalten
    this.isFullscreen = !this.isFullscreen;

    // Header im Vollbildmodus ausblenden, sonst einblenden
    if (this.isFullscreen) {
      this.headerService.hideHeader();
    } else {
      this.headerService.showHeader();
    }

    document.body.classList.toggle('canvas-fullscreen-active', this.isFullscreen);

    // DOM-Update und Neuzeichnen mit erhöhter Stabilität
    setTimeout(() => {
      // Force reflow/repaint
      const _ = document.body.offsetHeight;

      // Canvas-Element referenzieren
      const canvas = this.canvasRef.nativeElement;

      // Container-Größe ermitteln
      const container = canvas.parentElement;
      if (!container) return;

      // Canvas-Dimensionen berechnen
      this.calculateCanvasDimensions(container);

      // Canvas-Dimensionen explizit setzen
      canvas.width = this.canvasWidth;
      canvas.height = this.canvasHeight;

      // Context neu initialisieren
      this.ctx = canvas.getContext('2d')!;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      // Immer ersten Redraw ausführen
      this.forceRedraw(savedDrawingData);

      // Bei BEIDEN Richtungen einen zweiten Redraw mit unterschiedlicher Verzögerung durchführen
      setTimeout(() => {
        this.forceRedraw(savedDrawingData);

        // Bei größeren Änderungen einen dritten Redraw durchführen
        setTimeout(() => {
          this.forceRedraw(savedDrawingData);
        }, wasFullscreen ? 50 : 200); // Längere Verzögerung beim Wechsel in den Vollbildmodus
      }, wasFullscreen ? 100 : 50); // Unterschiedliche Verzögerungen je nach Richtung
    }, 50);
  }

  /**
   * Erzwingt ein vollständiges Neuzeichnen mit den gegebenen Daten
   */
  private forceRedraw(drawingData: DrawingLine[]): void {
    if (!this.ctx || !this.canvasRef?.nativeElement) return;

    // Canvas explizit löschen
    this.clearCanvas();

    // Alle Linien durchgehen und neu zeichnen
    if (drawingData && drawingData.length > 0) {
      for (const line of drawingData) {
        this.drawLine(line);
      }
    }
  }

  /**
   * Berechnet die Dimensionen des Canvas basierend auf dem Container
   */
  private calculateCanvasDimensions(container: HTMLElement): void {
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
  }

  /**
   * Canvas-Größe an das Eltern-Element anpassen
   */
  private resizeCanvas(): void {
    setTimeout(() => {
      const container = this.canvasRef?.nativeElement.parentElement;
      if (!container) return;

      // Aktuelle Zeichnung sichern
      const currentDrawingData = [...this.currentDrawingLines];

      // Canvas-Dimensionen berechnen
      this.calculateCanvasDimensions(container);

      // Canvas-Element direkt referenzieren und Größe setzen
      const canvas = this.canvasRef.nativeElement;
      canvas.width = this.canvasWidth;
      canvas.height = this.canvasHeight;

      // Context neu initialisieren und Basiseinstellungen setzen
      this.ctx = canvas.getContext('2d')!;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      // Zeichnung aus dem gespeicherten Zustand wiederherstellen
      if (currentDrawingData.length > 0) {
        this.redrawCanvas(currentDrawingData);
      }
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

    // Gruppierungsmodus deaktivieren, wenn ein anderes Werkzeug ausgewählt wird
    if (tool !== 'select') {
      this.isGrouped = false;
      this.groupedLines = [];
    }
  }

  /**
   * Aktualisiert den Cursor-Stil basierend auf dem ausgewählten Werkzeug
   */
  private updateCanvasCursor(resizeHandle: string | null = null): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    // Alle Cursor-Klassen entfernen
    canvas.classList.remove('select-mode', 'object-hover', 'dragging', 'eraser-hover');
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
    this.showModal = true;
  }

  /**
   * Bestätigt das Löschen des Canvas
   */
  onConfirmClear(): void {
    this.drawingService.clearCanvas();
    this.clearCanvas();
    this.showModal = false;
  }

  /**
   * Bricht das Löschen des Canvas ab
   */
  onCancelClear(): void {
    this.showModal = false;
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

    // Wenn im Radierer-Modus: Jetzt nach Objekten suchen, die gelöscht werden sollen
    if (this.currentTool === 'eraser') {
      this.handleEraserDown(event);
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
    const isShiftPressed = event.shiftKey;

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

    // Prüfen, ob wir eine neue Auswahlbox starten
    // Nur starten, wenn wir nicht auf ein Objekt geklickt haben und Shift nicht gedrückt ist
    const clickedLine = this.findLineAtPoint(point);
    if (!clickedLine && !isShiftPressed) {
      this.startSelectionBox(point);
      return;
    }

    // Wenn wir eine Gruppe haben und auf ein Mitglied der Gruppe klicken,
    // alle Elemente der Gruppe zum Verschieben auswählen
    if (this.isGrouped && clickedLine && this.groupedLines.includes(clickedLine.id!)) {
      this.startDraggingGroup(point, clickedLine);
      return;
    }

    // Wenn wir auf ein existierendes Objekt geklickt haben
    if (clickedLine) {
      // Bei Shift-Klick das Objekt zur Auswahl hinzufügen oder aus der Auswahl entfernen
      if (isShiftPressed) {
        this.toggleSelection(clickedLine);
      }
      // Prüfen, ob das angeklickte Objekt bereits ausgewählt ist
      else if (clickedLine.selected && this.selectedLines.length > 1) {
        // Objekt ist bereits ausgewählt und Teil einer Mehrfachauswahl
        // Wir behalten die Auswahl und starten das Verschieben aller ausgewählten Objekte
        this.startDraggingMultipleObjects(point, clickedLine);
      }
      else {
        // Objekt ist nicht ausgewählt, also alte Auswahl löschen und nur neues Objekt auswählen
        this.clearSelection();
        this.addToSelection(clickedLine);

        // Dragging für ein einzelnes Objekt starten
        this.selectedLine = clickedLine;
        this.isDragging = true;
        this.dragStartPoint = point;
        this.dragStartLinePosition = [...clickedLine.points];
      }
    } else if (!isShiftPressed) {
      // Klick ins Leere ohne Shift löscht die Auswahl
      this.clearSelection();
    }

    // Canvas neu zeichnen
    this.redrawCanvas(this.currentDrawingLines);
  }

  /**
   * Startet das Verschieben mehrerer ausgewählter Objekte
   */
  private startDraggingMultipleObjects(point: Point, clickedLine: DrawingLine): void {
    this.isDragging = true;
    this.dragStartPoint = point;
    this.selectedLine = clickedLine; // Das angeklickte Objekt als Hauptauswahl setzen

    // Speichere die Startpositionen aller ausgewählten Objekte
    this.dragStartLinesPositions.clear();
    this.selectedLines.forEach(line => {
      if (line.id) {
        this.dragStartLinesPositions.set(line.id, [...line.points]);
      }
    });
  }

  /**
   * Startet das Zeichnen einer Auswahlbox
   */
  private startSelectionBox(startPoint: Point): void {
    this.isMultiSelecting = true;
    this.selectionStartPoint = startPoint;
    this.selectionRect = {
      x: startPoint.x,
      y: startPoint.y,
      width: 0,
      height: 0
    };

    // Wenn nicht mit Shift, bestehende Auswahl aufheben
    if (!this.isGrouped) {
      this.clearSelection();
    }
  }

  /**
   * Ein Objekt zur Auswahl hinzufügen oder daraus entfernen
   */
  private toggleSelection(line: DrawingLine): void {
    if (!line.id) return;

    const index = this.selectedLines.findIndex(l => l.id === line.id);
    if (index >= 0) {
      // Aus Auswahl entfernen
      line.selected = false;
      this.selectedLines.splice(index, 1);
    } else {
      // Zur Auswahl hinzufügen
      line.selected = true;
      this.selectedLines.push(line);
    }
  }

  /**
   * Objekt zur Auswahl hinzufügen
   */
  private addToSelection(line: DrawingLine): void {
    if (!line.id) return;

    // Prüfen, ob das Objekt bereits ausgewählt ist
    const exists = this.selectedLines.some(l => l.id === line.id);
    if (!exists) {
      line.selected = true;
      this.selectedLines.push(line);
    }
  }

  /**
   * Auswahl leeren
   */
  private clearSelection(): void {
    // Alle Objekte deselektieren
    this.selectedLines.forEach(line => {
      line.selected = false;
    });
    this.selectedLines = [];
    this.selectedLine = null;

    // Gruppierungszustand zurücksetzen, wenn nicht im Gruppierungsmodus
    if (!this.isGrouped) {
      this.groupedLines = [];
    }
  }

  /**
   * Startet das Verschieben einer Gruppe von Objekten
   */
  private startDraggingGroup(point: Point, clickedLine: DrawingLine): void {
    this.isDragging = true;
    this.dragStartPoint = point;

    // Startpositionen aller Objekte in der Gruppe speichern
    this.dragStartLinesPositions.clear();

    // Eine Hilfsliste für das Dragging erstellen, die alle gruppierten Objekte enthält
    this.selectedLines = this.currentDrawingLines.filter(line =>
      line.id && this.groupedLines.includes(line.id)
    );

    // Alle Objekte als ausgewählt markieren
    this.selectedLines.forEach(line => {
      line.selected = true;
      if (line.id) {
        this.dragStartLinesPositions.set(line.id, [...line.points]);
      }
    });

    // Auch das angeklickte Objekt als Hauptauswahl setzen (für andere Operationen)
    this.selectedLine = clickedLine;
  }

  /**
   * Behandelt Radierer-Klicks zum Löschen ganzer Objekte
   */
  private handleEraserDown(event: MouseEvent): void {
    const point = this.getPointFromEvent(event);

    // Finde das Objekt, das unter dem Klickpunkt liegt
    const objectToErase = this.findLineAtPoint(point);

    if (objectToErase && objectToErase.id) {
      // Das Objekt aus der Liste löschen
      this.drawingService.deleteDrawingObject(objectToErase.id);

      // Optional: Visuelles Feedback geben
      // this.showTooltip(`Objekt gelöscht`, point, 1000);
    }
  }

  /**
   * Mausbewegung-Handler
   */
  onMouseMove(event: MouseEvent): void {
    const currentPoint = this.getPointFromEvent(event);

    // Handle based on current tool and state
    if (this.currentTool === 'eraser') {
      this.handleEraserMove(currentPoint);
      return;
    }

    if (this.currentTool === 'select') {
      if (this.isResizing && this.canResize()) {
        this.handleResizeMove(currentPoint);
        return;
      }

      if (this.isDragging && this.canDrag()) {
        this.handleDragMove(currentPoint);
        return;
      }

      if (this.isMultiSelecting) {
        this.handleSelectionBoxMove(currentPoint);
        return;
      }
    }

    this.handleRegularDrawing(currentPoint);
  }

  /**
   * Handles mouse movement in eraser mode
   */
  private handleEraserMove(currentPoint: Point): void {
    const canvas = this.canvasRef.nativeElement;
    const hoverObject = this.findLineAtPoint(currentPoint);

    if (hoverObject) {
      // Statt direktem no-drop-Cursor CSS-Klassen verwenden
      canvas.classList.add('eraser-hover');
      this.previewObjectToErase(hoverObject);
    } else {
      // CSS-Klasse entfernen, wenn kein Objekt gefunden wurde
      canvas.classList.remove('eraser-hover');
      this.redrawCanvas(this.currentDrawingLines);
    }
  }

  /**
   * Checks if all conditions for resizing are met
   */
  private canResize(): boolean {
    return Boolean(this.selectedLine && this.initialBounds && this.dragStartPoint && this.resizeHandle);
  }

  /**
   * Handles resizing of selected objects
   */
  private handleResizeMove(currentPoint: Point): void {
    const deltaX = currentPoint.x - this.dragStartPoint!.x;
    const deltaY = currentPoint.y - this.dragStartPoint!.y;

    // Neue Bounds basierend auf dem aktiven Handle berechnen
    const newBounds = this.calculateResizedBounds(deltaX, deltaY);

    // Objekt skalieren und neu zeichnen
    const scaledLine = DrawingLineUtils.scaleLine(this.selectedLine!, newBounds);
    scaledLine.selected = true;
    this.selectedLine = scaledLine;

    // Neu zeichnen
    const updatedLines = this.currentDrawingLines.map(line =>
      line.id === scaledLine.id ? scaledLine : line
    );

    this.redrawCanvas(updatedLines);
  }

  /**
   * Calculates new bounds based on resize deltas
   */
  private calculateResizedBounds(deltaX: number, deltaY: number): Bounds {
    const newBounds = { ...this.initialBounds! };

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
    newBounds.width = Math.max(newBounds.width, 10);
    newBounds.height = Math.max(newBounds.height, 10);

    return newBounds;
  }

  /**
   * Checks if all conditions for dragging are met
   */
  private canDrag(): boolean {
    // Bei Mehrfachauswahl anders prüfen als bei Einzelauswahl
    if (this.selectedLines.length > 1) {
      // Bei mehreren ausgewählten Objekten ist wichtig, dass:
      // - ein Startpunkt definiert ist
      // - mindestens ein Objekt eine Startposition hat
      return Boolean(this.dragStartPoint) && this.dragStartLinesPositions.size > 0;
    } else {
      // Bei einem Objekt wie bisher prüfen
      return Boolean(this.selectedLine && this.dragStartPoint && this.dragStartLinePosition);
    }
  }

  /**
   * Handles dragging of selected objects
   */
  private handleDragMove(currentPoint: Point): void {
    const offsetX = currentPoint.x - this.dragStartPoint!.x;
    const offsetY = currentPoint.y - this.dragStartPoint!.y;

    // Wenn wir mehrere Objekte ausgewählt haben (egal ob gruppiert oder nicht)
    if (this.selectedLines.length > 1) {
      // Alle ausgewählten Objekte verschieben
      this.moveMultipleObjects(offsetX, offsetY);
    } else {
      // Einzelnes Objekt verschieben
      this.moveSingleObject(offsetX, offsetY);
    }

    // Canvas neu zeichnen
    this.redrawCanvas(this.currentDrawingLines);
  }

  /**
   * Verschiebt ein einzelnes Objekt
   */
  private moveSingleObject(offsetX: number, offsetY: number): void {
    if (!this.selectedLine || !this.dragStartLinePosition) return;

    // Neues Punktarray mit den verschobenen Punkten erstellen
    const movedPoints = this.dragStartLinePosition.map(point => ({
      x: point.x + offsetX,
      y: point.y + offsetY
    }));

    // Punkte aktualisieren
    this.selectedLine.points = movedPoints;
    this.selectedLine.bounds = DrawingLineUtils.calculateBounds(this.selectedLine) || undefined;
  }

  /**
   * Verschiebt mehrere Objekte gleichzeitig
   */
  private moveMultipleObjects(offsetX: number, offsetY: number): void {
    // Alle ausgewählten Objekte verschieben
    for (const line of this.selectedLines) {
      if (!line.id) continue;

      // Nur verschieben, wenn wir Startpositionen für dieses Objekt haben
      const startPositions = this.dragStartLinesPositions.get(line.id);
      if (!startPositions) continue;

      // Neue Punktposition berechnen
      const movedPoints = startPositions.map(point => ({
        x: point.x + offsetX,
        y: point.y + offsetY
      }));

      // Punkte und Bounds aktualisieren
      line.points = movedPoints;
      line.bounds = DrawingLineUtils.calculateBounds(line) || undefined;
    }
  }

  /**
   * Handles regular drawing operations
   */
  private handleRegularDrawing(currentPoint: Point): void {
    if (!this.isDrawing) return;

    this.drawingService.continueDrawing(currentPoint);

    if (this.currentTool === 'brush') {
      this.drawLine(this.drawingService.getCurrentLine());
    } else if (this.currentTool !== 'text') {
      this.previewShape();
    }
  }

  /**
   * Behandelt die Mausbewegung während der Mehrfachauswahl (Auswahlbox ziehen)
   */
  private handleSelectionBoxMove(currentPoint: Point): void {
    if (!this.isMultiSelecting || !this.selectionStartPoint || !this.selectionRect) return;

    // Berechne die Auswahlbox basierend auf Start- und aktuellem Punkt
    const x = Math.min(this.selectionStartPoint.x, currentPoint.x);
    const y = Math.min(this.selectionStartPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - this.selectionStartPoint.x);
    const height = Math.abs(currentPoint.y - this.selectionStartPoint.y);

    this.selectionRect = { x, y, width, height };

    // In Echtzeit überprüfen, welche Objekte unter der Auswahlbox liegen
    const potentialSelection = this.findLinesInRect(this.selectionRect);

    // Temporär für die Vorschau alle vorherigen Selektionen entfernen
    this.currentDrawingLines.forEach(line => {
      line.selected = false;
    });

    // Objekte, die unter der Auswahlbox liegen, temporär als ausgewählt markieren
    potentialSelection.forEach(line => {
      line.selected = true;
    });

    // Canvas neu zeichnen mit den vorläufig ausgewählten Objekten
    this.redrawCanvas(this.currentDrawingLines);

    // Auswahlbox darüber zeichnen
    this.drawSelectionBox(this.selectionRect);
  }

  /**
   * Beendet die Mehrfachauswahl und wählt alle Objekte innerhalb der Box aus
   */
  private finalizeSelectionBox(): void {
    if (!this.selectionRect) return;

    // Alle Objekte finden, die mit der Auswahlbox überlappen oder darin enthalten sind
    const selectedObjects = this.findLinesInRect(this.selectionRect);

    // Wenn wir nicht mit Shift auswählen, bestehende Auswahl aufheben
    // Da wir keinen Zugriff auf das Event haben, verwenden wir eine Hilfsvariable
    if (!this.isMultiSelectKeyPressed) {
      this.clearSelection();
    }

    // Alle gefundenen Objekte zur Auswahl hinzufügen
    selectedObjects.forEach(line => this.addToSelection(line));

    // Wenn genau ein Objekt ausgewählt ist, setze es als Hauptauswahl
    if (this.selectedLines.length === 1) {
      this.selectedLine = this.selectedLines[0];
    }

    // Auswahl zurücksetzen
    this.isMultiSelecting = false;
    this.selectionStartPoint = null;
    this.selectionRect = null;

    // Canvas neu zeichnen
    this.redrawCanvas(this.currentDrawingLines);
  }

  /**
   * Zeichnet die Auswahlbox
   */
  private drawSelectionBox(rect: { x: number, y: number, width: number, height: number }): void {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.strokeStyle = '#4285F4';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    // Transparente Füllung
    this.ctx.fillStyle = 'rgba(66, 133, 244, 0.1)';
    this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    this.ctx.restore();
  }

  /**
   * Findet alle Linien, die mit einem Rechteck überlappen oder darin enthalten sind
   */
  private findLinesInRect(rect: { x: number, y: number, width: number, height: number }): DrawingLine[] {
    return this.currentDrawingLines.filter(line => {
      // Sicherstellen, dass Bounds berechnet sind
      if (!line.bounds) {
        line.bounds = DrawingLineUtils.calculateBounds(line) || undefined;
      }

      if (!line.bounds) return false;

      // Intelligente Auswahl: Objekt wird ausgewählt, wenn es mit der Auswahlbox überlappt
      // Dafür prüfen wir, ob sich die beiden Rechtecke überschneiden
      const objectBounds = line.bounds;

      // Prüfen auf Überlappung der Rechtecke
      const overlaps = !(
        // Rechtecke überlappen nicht, wenn eines der folgenden Kriterien erfüllt ist:
        objectBounds.x > rect.x + rect.width || // Objekt ist rechts von der Auswahlbox
        objectBounds.x + objectBounds.width < rect.x || // Objekt ist links von der Auswahlbox
        objectBounds.y > rect.y + rect.height || // Objekt ist unterhalb der Auswahlbox
        objectBounds.y + objectBounds.height < rect.y // Objekt ist oberhalb der Auswahlbox
      );

      return overlaps;
    });
  }

  /**
   * Gruppiert die aktuell ausgewählten Objekte
   */
  groupSelectedObjects(): void {
    if (this.selectedLines.length < 2) {
      // Mindestens 2 Objekte müssen ausgewählt sein
      return;
    }

    // Setze den Gruppierungszustand
    this.isGrouped = true;

    // Speichere die IDs der gruppierten Objekte
    this.groupedLines = this.selectedLines.map(line => line.id!).filter(id => id !== undefined);

    // Info-Meldung zeigen
    this.showTooltip(`${this.selectedLines.length} Objekte gruppiert`, this.getGroupCenter());
  }

  /**
   * Hebt die Gruppierung auf
   */
  ungroupObjects(): void {
    if (!this.isGrouped) return;

    // Gruppierungszustand zurücksetzen
    this.isGrouped = false;

    // Info-Meldung zeigen
    const count = this.groupedLines.length;
    this.showTooltip(`Gruppierung von ${count} Objekten aufgehoben`, this.getGroupCenter());

    // Gruppenliste leeren
    this.groupedLines = [];
  }

  /**
   * Berechnet den Mittelpunkt der aktuellen Gruppe oder Auswahl
   */
  private getGroupCenter(): Point {
    // Standardposition, falls keine Auswahl vorhanden
    let center: Point = { x: this.canvasWidth / 2, y: this.canvasHeight / 2 };

    const lines = this.isGrouped
      ? this.currentDrawingLines.filter(line => line.id && this.groupedLines.includes(line.id))
      : this.selectedLines;

    if (lines.length > 0) {
      // Gemeinsame Bounds berechnen
      let minX = Number.MAX_VALUE;
      let minY = Number.MAX_VALUE;
      let maxX = Number.MIN_VALUE;
      let maxY = Number.MIN_VALUE;

      lines.forEach(line => {
        if (line.bounds) {
          minX = Math.min(minX, line.bounds.x);
          minY = Math.min(minY, line.bounds.y);
          maxX = Math.max(maxX, line.bounds.x + line.bounds.width);
          maxY = Math.max(maxY, line.bounds.y + line.bounds.height);
        }
      });

      // Mittelpunkt berechnen
      center = {
        x: minX + (maxX - minX) / 2,
        y: minY + (maxY - minY) / 2
      };
    }

    return center;
  }

  /**
   * Zeigt eine Vorschau des zu löschenden Objekts an
   */
  private previewObjectToErase(line: DrawingLine): void {
    // Aktuelle Zeichnung speichern, um sie später wiederherzustellen
    const originalLines = this.currentDrawingLines;

    // Objekt mit einem roten Umriss markieren
    if (line.bounds) {
      this.redrawCanvas(originalLines);

      // Roten Rahmen zeichnen
      this.ctx.save();
      this.ctx.strokeStyle = 'red';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      this.ctx.strokeRect(
        line.bounds.x,
        line.bounds.y,
        line.bounds.width,
        line.bounds.height
      );
      this.ctx.restore();
    }
  }

  /**
   * Zeigt einen kurzen Tooltip an der angegebenen Position
   */
  private showTooltip(message: string, position: Point, duration: number = 1500): void {
    // Tooltip-Element erstellen
    const tooltip = document.createElement('div');
    tooltip.className = 'eraser-tooltip';
    tooltip.textContent = message;
    tooltip.style.position = 'absolute';
    tooltip.style.left = `${position.x + 10}px`;
    tooltip.style.top = `${position.y + 10}px`;
    tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '5px 10px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.zIndex = '1000';
    tooltip.style.pointerEvents = 'none';

    // Tooltip zum Canvas-Container hinzufügen
    const container = this.canvasRef.nativeElement.parentElement;
    if (container) {
      container.appendChild(tooltip);

      // Tooltip nach der angegebenen Zeit entfernen
      setTimeout(() => {
        if (tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
      }, duration);
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
      this.dragStartLinesPositions.clear();

      // Wenn mehrere Objekte ausgewählt sind, aktualisiere alle im Service
      if (this.selectedLines.length > 1) {
        this.drawingService.updateMultipleLines(this.selectedLines);
      }
      // Sonst aktualisiere nur das eine ausgewählte Objekt
      else if (this.selectedLine) {
        this.drawingService.updateLine(this.selectedLine);
      }

      // Cursor zurücksetzen
      this.updateCanvasCursor();
      return;
    }

    // Mehrfachauswahl beenden
    if (this.isMultiSelecting) {
      this.finalizeSelectionBox();
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
    // Prüfen ob wir nicht im Text- oder Auswahlmodus oder Radierer-Modus sind
    if (this.currentTool === 'text' || this.currentTool === 'select' || this.currentTool === 'eraser') return;

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
      // Canvas-Position berücksichtigen für korrekte Koordinatenumrechnung
      const rect = this.canvasRef.nativeElement.getBoundingClientRect();
      const point = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };

      // Basierend auf dem ausgewählten Werkzeug entsprechende Aktionen ausführen
      if (this.currentTool === 'select') {
        this.handleSelectionTouchStart(point);
      } else if (this.currentTool === 'eraser') {
        this.handleEraserTouchStart(point);
      } else if (this.currentTool === 'text') {
        if (!this.isTextEditing) {
          this.startTextEditing(point);
        }
      } else {
        // Zeichenwerkzeuge (Pinsel, Linie, Rechteck, Kreis)
        this.isDrawing = true;
        this.drawingService.startDrawing(point);
      }
    }
  }

  /**
   * Hilfsmethode zur Behandlung von Touch-Ereignissen im Auswahlmodus
   */
  private handleSelectionTouchStart(point: Point): void {
    // Prüfen, ob ein Objekt an der Berührungsposition liegt
    const clickedLine = this.findLineAtPoint(point);

    if (clickedLine) {
      // Prüfen, ob das angeklickte Objekt bereits ausgewählt ist
      if (clickedLine.selected && this.selectedLines.length > 1) {
        // Wenn bereits mehrere Objekte ausgewählt sind und eines davon angeklickt wurde,
        // alle gemeinsam verschieben
        this.startDraggingMultipleObjects(point, clickedLine);
      }
      // Prüfen, ob das angeklickte Objekt zu einer Gruppe gehört
      else if (this.isGrouped && clickedLine.id && this.groupedLines.includes(clickedLine.id)) {
        // Wenn das Objekt Teil einer Gruppe ist, die gesamte Gruppe verschieben
        this.startDraggingGroup(point, clickedLine);
      }
      else {
        // Andernfalls neue Einzelauswahl
        this.clearSelection();
        this.addToSelection(clickedLine);

        // Dragging-Zustand für ein einzelnes Objekt einrichten
        this.selectedLine = clickedLine;
        this.isDragging = true;
        this.dragStartPoint = point;
        this.dragStartLinePosition = [...clickedLine.points];
      }
    } else {
      // Wenn kein Objekt getroffen wurde, Auswahlbox starten
      this.startSelectionBox(point);
    }

    // Canvas neu zeichnen
    this.redrawCanvas(this.currentDrawingLines);
  }

  /**
   * Hilfsmethode zur Behandlung von Touch-Ereignissen im Radierer-Modus
   */
  private handleEraserTouchStart(point: Point): void {
    const objectToErase = this.findLineAtPoint(point);
    if (objectToErase?.id) {
      this.drawingService.deleteDrawingObject(objectToErase.id);
    }
  }

  /**
   * Touch-Move-Handler für mobile Geräte
   * @param event Das Touch-Event
   */
  onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      // Canvas-Position berücksichtigen für korrekte Koordinatenumrechnung
      const rect = this.canvasRef.nativeElement.getBoundingClientRect();
      const point = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };

      // Je nach aktuellem Zustand und Werkzeug entsprechende Aktionen ausführen
      if (this.isDrawing) {
        // Beim Zeichnen
        this.drawingService.continueDrawing(point);

        if (this.currentTool === 'brush') {
          this.drawLine(this.drawingService.getCurrentLine());
        } else if (this.currentTool !== 'text') {
          this.previewShape();
        }
      } else if (this.isDragging && this.currentTool === 'select') {
        // Beim Verschieben von Objekten
        const offsetX = point.x - this.dragStartPoint!.x;
        const offsetY = point.y - this.dragStartPoint!.y;

        if (this.selectedLines.length > 1) {
          this.moveMultipleObjects(offsetX, offsetY);
        } else {
          this.moveSingleObject(offsetX, offsetY);
        }

        this.redrawCanvas(this.currentDrawingLines);
      } else if (this.isMultiSelecting) {
        // Bei der Erstellung einer Auswahlbox
        this.handleSelectionBoxMove(point);
      }
    }
  }

  /**
   * Touch-End-Handler für mobile Geräte
   * @param event Das Touch-Event
   */
  onTouchEnd(event: TouchEvent): void {
    event.preventDefault();

    // Canvas-Position für eventuelle Berechnung der letzten Position
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const lastTouch = event.changedTouches[0];
    const point = {
      x: lastTouch.clientX - rect.left,
      y: lastTouch.clientY - rect.top
    };

    // Zeichenvorgang beenden
    if (this.isDrawing) {
      this.drawingService.endDrawing(point);
      this.isDrawing = false;
    }

    // Drag & Drop beenden
    if (this.isDragging) {
      this.isDragging = false;
      this.dragStartPoint = null;
      this.dragStartLinePosition = null;
      this.dragStartLinesPositions.clear();

      // Änderungen speichern
      if (this.selectedLines.length > 1) {
        this.drawingService.updateMultipleLines(this.selectedLines);
      } else if (this.selectedLine) {
        this.drawingService.updateLine(this.selectedLine);
      }
    }

    // Mehrfachauswahl beenden
    if (this.isMultiSelecting) {
      this.finalizeSelectionBox();
    }
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
   * Startet die Größenänderung des Texteingabefelds
   * @param event Das Maus-Event
   */
  startResizingTextInput(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.isResizingTextInput = true;
    this.textResizeStartPosition = this.getPointFromEvent(event);

    // Speichere die aktuelle Größe des Texteingabefelds
    this.textInitialSize = {
      width: this.textWidth,
      height: this.textHeight
    };

    // Event-Handler für Mausbewegung und Mausfreigabe hinzufügen
    document.addEventListener('mousemove', this.handleTextResize);
    document.addEventListener('mouseup', this.finishTextResize);

    // Cursor für die Größenänderung setzen
    document.body.style.cursor = 'nwse-resize';
  }

  /**
   * Handler für die Größenänderung des Texteingabefelds während der Mausbewegung
   */
  private readonly handleTextResize = (event: MouseEvent): void => {
    if (!this.isResizingTextInput || !this.textResizeStartPosition) return;

    // Berechne den Unterschied zur Startposition
    const currentPoint = this.getPointFromEvent(event);
    const deltaX = currentPoint.x - this.textResizeStartPosition.x;
    const deltaY = currentPoint.y - this.textResizeStartPosition.y;

    // Neue Größe berechnen
    this.textWidth = Math.max(this.textInitialSize.width + deltaX, 50); // Mindestbreite: 50px
    this.textHeight = Math.max(this.textInitialSize.height + deltaY, 20); // Mindesthöhe: 20px

    // Textgröße basierend auf der neuen Eingabefeld-Größe anpassen
    // Wir verwenden einen Skalierungsfaktor, damit die Textgröße proportional zur Größe des Feldes ist
    const scaleFactor = 0.5; // Dieser Faktor kann angepasst werden
    const newTextSize = Math.max(Math.min(this.textHeight * scaleFactor, 96), 4); // Zwischen 4px und 96px begrenzen

    // Aktualisiere die Textgröße
    this.currentTextSize = Math.round(newTextSize);

    // Aktualisiere den Textgrößen-Stil direkt am Input-Element
    if (this.textInputRef?.nativeElement) {
      this.textInputRef.nativeElement.style.fontSize = `${this.currentTextSize}px`;
    }

    // Update auch in den Einstellungen
    this.drawingService.updateSettings({ textSize: this.currentTextSize });
  }

  /**
   * Beendet die Größenänderung des Texteingabefelds
   */
  private readonly finishTextResize = (): void => {
    this.isResizingTextInput = false;
    this.textResizeStartPosition = null;

    // Event-Handler entfernen
    document.removeEventListener('mousemove', this.handleTextResize);
    document.removeEventListener('mouseup', this.finishTextResize);

    // Cursor zurücksetzen
    document.body.style.cursor = '';

    // Fokus auf das Texteingabefeld setzen
    setTimeout(() => {
      if (this.textInputRef?.nativeElement) {
        this.textInputRef.nativeElement.focus();
      }
    }, 10);
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
      const fontSize = line.textSize ?? line.width * 3;
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
    this.ctx.strokeStyle = line.color;
    this.ctx.lineWidth = line.width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (line.tool === 'brush') {
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

