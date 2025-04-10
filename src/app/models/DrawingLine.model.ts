import { Point } from './Point.model';

/**
 * DrawingLine Model
 *
 * Repräsentiert eine Linie oder einen Strich in einer Zeichnung.
 * Besteht aus einer Reihe von Punkten, Farbe, Breite und Transparenz.
 */
export interface DrawingLine {
  /** Array von Punkten, die die Linie bilden */
  points: Point[];

  /** Farbe der Linie im HEX-Format */
  color: string;

  /** Breite der Linie in Pixeln */
  width: number;

  /** Transparenz der Linie (0-1) */
  opacity: number;

  /** Typ des Zeichenwerkzeugs für diese Linie (z.B. 'brush', 'pencil', 'eraser') */
  tool?: string;

  /** Eindeutige ID der Linie */
  id?: string;

  /** Zeitstempel der Erstellung */
  timestamp?: number;

  /** Startpunkt der Linie (besonders für Formen wie Linien und Rechtecke) */
  startPoint?: Point;

  /** Endpunkt der Linie (besonders für Formen wie Linien und Rechtecke) */
  endPoint?: Point;
}

/**
 * Hilfsfunktionen für DrawingLine
 */
export const DrawingLineUtils = {
  /**
   * Gibt den Startpunkt einer Linie zurück
   */
  getStartPoint(line: DrawingLine): Point | undefined {
    return line.points[0];
  },

  /**
   * Gibt den Endpunkt einer Linie zurück
   */
  getEndPoint(line: DrawingLine): Point | undefined {
    return line.points.length > 0 ? line.points[line.points.length - 1] : undefined;
  }
};
