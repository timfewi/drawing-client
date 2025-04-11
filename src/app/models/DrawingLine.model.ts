import { Point } from './Point.model';
import { DrawingTool } from './DrawingTool.model';
import { Bounds } from './Bounds.model';

export interface DrawingLine {
  tool: DrawingTool;
  color: string;
  width: number;
  points: Point[];
  opacity?: number;
  text?: string;
  textSize?: number; // Für Textgröße
  id?: string;           // Eindeutige ID für jedes Objekt
  selected?: boolean;    // Ob das Objekt aktuell ausgewählt ist
  bounds?: Bounds;       // Die Begrenzung des Objekts für Auswahl/Verschiebung
}

/**
 * Hilfsfunktionen für DrawingLine
 */
export class DrawingLineUtils {
  /**
   * Berechnet die Länge einer Linie
   * @param line Die zu messende Linie
   * @returns Die Länge der Linie oder 0 wenn keine Punkte vorhanden sind
   */
  static calculateLength(line: DrawingLine): number {
    if (!line.points || line.points.length < 2) return 0;

    let totalLength = 0;
    for (let i = 1; i < line.points.length; i++) {
      const p1 = line.points[i - 1];
      const p2 = line.points[i];
      totalLength += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    return totalLength;
  }

  /**
   * Erzeugt eine Kopie der Linie
   * @param line Die zu kopierende Linie
   * @returns Eine tiefe Kopie der Linie
   */
  static clone(line: DrawingLine): DrawingLine {
    return {
      tool: line.tool,
      color: line.color,
      width: line.width,
      points: line.points.map(p => ({ ...p })),
      opacity: line.opacity,
      text: line.text,
      textSize: line.textSize,
      id: line.id,
      selected: line.selected,
      bounds: line.bounds
    };
  }

  /**
   * Berechnet die Begrenzungsbox für eine Zeichnungslinie
   * @param line Die zu messende Linie
   * @returns Die Begrenzungsbox oder null wenn keine Punkte vorhanden sind
   */
  static calculateBounds(line: DrawingLine): Bounds | null {
    if (!line.points || line.points.length < 1) return null;

    let minX = Number.MAX_VALUE;
    let minY = Number.MAX_VALUE;
    let maxX = Number.MIN_VALUE;
    let maxY = Number.MIN_VALUE;

    // Für jeden Punkt die minimalen und maximalen Koordinaten ermitteln
    for (const point of line.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    // Zusätzlichen Padding für bessere Selektion hinzufügen
    const padding = line.width + 5;

    // Bei Text die Textdimensionen berücksichtigen
    if (line.tool === 'text' && line.text && line.points.length > 0) {
      // Ungefähre Textbreite basierend auf Zeichenanzahl und Größe
      const fontSize = line.textSize || 16;
      const approximateWidth = line.text.length * fontSize * 0.6;
      maxX = Math.max(maxX, line.points[0].x + approximateWidth);
      maxY = Math.max(maxY, line.points[0].y + fontSize);
    }

    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2
    };
  }

  /**
   * Überprüft, ob ein Punkt innerhalb der Begrenzungsbox einer Linie liegt
   */
  static isPointInBounds(point: Point, bounds: Bounds): boolean {
    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    );
  }

  /**
   * Verschiebt eine Linie um den angegebenen Offset
   */
  static moveLine(line: DrawingLine, offsetX: number, offsetY: number): DrawingLine {
    const movedPoints = line.points.map(point => ({
      x: point.x + offsetX,
      y: point.y + offsetY
    }));

    // Bounds aktualisieren
    const bounds = this.calculateBounds({ ...line, points: movedPoints });

    return {
      ...line,
      points: movedPoints,
      bounds: bounds || undefined
    };
  }
}
