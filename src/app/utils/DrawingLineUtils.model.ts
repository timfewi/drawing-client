import { DrawingLine } from '../models/DrawingLine.model';
import { Point } from '../models/Point.model';
import { Bounds } from '../models/Bounds.model';

export class DrawingLineUtils {
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
      const fontSize = line.textSize ?? 16;
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
      bounds: bounds ?? undefined
    };
  }

  /**
   * Überprüft, ob ein Punkt in der Nähe eines der Skalierungsgriffe liegt
   * @param point Der zu prüfende Punkt
   * @param bounds Die Begrenzungsbox mit den Griffen
   * @returns Die Position des Griffs oder null
   */
  static getResizeHandleAtPoint(point: Point, bounds: Bounds): string | null {
    const handleSize = 8;
    const halfHandle = handleSize / 2;

    // Prüfe alle vier Ecken
    if (this.isPointNear(point, { x: bounds.x, y: bounds.y }, halfHandle)) {
      return 'top-left';
    }
    if (this.isPointNear(point, { x: bounds.x + bounds.width, y: bounds.y }, halfHandle)) {
      return 'top-right';
    }
    if (this.isPointNear(point, { x: bounds.x, y: bounds.y + bounds.height }, halfHandle)) {
      return 'bottom-left';
    }
    if (this.isPointNear(point, { x: bounds.x + bounds.width, y: bounds.y + bounds.height }, halfHandle)) {
      return 'bottom-right';
    }

    return null;
  }

  /**
   * Prüft, ob ein Punkt nahe einem anderen Punkt liegt
   */
  private static isPointNear(p1: Point, p2: Point, threshold: number): boolean {
    return Math.abs(p1.x - p2.x) <= threshold && Math.abs(p1.y - p2.y) <= threshold;
  }

  /**
   * Skaliert eine Linie basierend auf einer neuen Begrenzungsbox
   * @param line Die zu skalierende Linie
   * @param newBounds Die neue Begrenzung
   * @returns Die skalierte Linie
   */
  static scaleLine(line: DrawingLine, newBounds: Bounds): DrawingLine {
    // Original-Bounds erhalten oder berechnen
    const originalBounds = line.bounds || this.calculateBounds(line) || {
      x: 0, y: 0, width: 1, height: 1
    };

    // Skalierungsfaktoren berechnen
    const scaleX = newBounds.width / originalBounds.width;
    const scaleY = newBounds.height / originalBounds.height;

    // Verschiebungsoffset
    const offsetX = newBounds.x - originalBounds.x;
    const offsetY = newBounds.y - originalBounds.y;

    // Neue Punkteliste basierend auf Tool-Typ
    let scaledPoints: Point[];

    if (line.tool === 'text') {
      // Bei Text nur die Position ändern
      scaledPoints = [{ x: newBounds.x, y: newBounds.y }];

      // Textgröße entsprechend skalieren, wenn vorhanden
      if (line.textSize !== undefined) {
        const avgScale = (scaleX + scaleY) / 2;
        line.textSize = Math.max(8, Math.round(line.textSize * avgScale)); // Minimum 8px
      }
    }
    else if (line.tool === 'line') {
      // Bei Linien Start- und Endpunkt skalieren
      const start = line.points[0];
      const end = line.points[line.points.length - 1];

      // Relative Position innerhalb der ursprünglichen Begrenzung
      const startRelX = (start.x - originalBounds.x) / originalBounds.width;
      const startRelY = (start.y - originalBounds.y) / originalBounds.height;
      const endRelX = (end.x - originalBounds.x) / originalBounds.width;
      const endRelY = (end.y - originalBounds.y) / originalBounds.height;

      // Neue absolute Position basierend auf neuer Begrenzung
      scaledPoints = [
        {
          x: newBounds.x + startRelX * newBounds.width,
          y: newBounds.y + startRelY * newBounds.height
        },
        {
          x: newBounds.x + endRelX * newBounds.width,
          y: newBounds.y + endRelY * newBounds.height
        }
      ];
    }
    else if (line.tool === 'rectangle' || line.tool === 'circle') {
      // Bei Rechtecken und Kreisen die Eckpunkte anpassen
      scaledPoints = [
        { x: newBounds.x, y: newBounds.y },
        { x: newBounds.x + newBounds.width, y: newBounds.y + newBounds.height }
      ];
    }
    else {
      // Bei Pinsel und Radierer jeden Punkt skalieren
      scaledPoints = line.points.map(point => {
        const relX = (point.x - originalBounds.x) / originalBounds.width;
        const relY = (point.y - originalBounds.y) / originalBounds.height;

        return {
          x: newBounds.x + relX * newBounds.width,
          y: newBounds.y + relY * newBounds.height
        };
      });
    }

    // Linienstärke proportional anpassen
    let newWidth = line.width;
    if (line.tool !== 'text') {
      const avgScale = (scaleX + scaleY) / 2;
      newWidth = Math.max(1, Math.round(line.width * avgScale));
    }

    // Neue Linie erstellen mit skalierten Werten
    return {
      ...line,
      points: scaledPoints,
      width: newWidth,
      bounds: newBounds
    };
  }
}
