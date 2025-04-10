/**
 * DrawingSettings Model
 *
 * Konfigurationseinstellungen für das Zeichenwerkzeug.
 * Definiert Farbe, Größe, Deckkraft und andere Parameter für das Zeichnen.
 */
export interface DrawingSettings {
  /** Aktuelle Stiftfarbe im HEX-Format */
  color: string;
  backgroundColor: string;
  /** Stärke/Breite des Zeichenwerkzeugs in Pixeln */
  lineWidth: number;

  /** Grad der Deckkraft/Transparenz (0-1) */
  opacity: number;

  /** Ausgewähltes Zeichenwerkzeug (z.B. 'brush', 'pencil', 'eraser') */
  tool: string;

  /** Aktiviert/Deaktiviert den Zeichenmodus */
  isDrawingEnabled: boolean;

  /** Optional: Aktiviert einen Rastereffekt für präziseres Zeichnen */
  snapToGrid?: boolean;

  /** Optional: Größe des Rasters in Pixeln, wenn snapToGrid aktiviert ist */
  gridSize?: number;

  /** Optional: Glättung der Linie (0-1) */
  smoothing?: number;
}
