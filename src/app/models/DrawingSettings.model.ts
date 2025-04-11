import { DrawingTool } from './DrawingTool.model';

/**
 * DrawingSettings Model
 *
 * Konfigurationseinstellungen für das Zeichenwerkzeug.
 * Definiert Farbe, Größe, Deckkraft und andere Parameter für das Zeichnen.
 */
export interface DrawingSettings {
  /** Hintergrundfarbe im HEX-Format */
  backgroundColor: string;

  /** Ausgewähltes Zeichenwerkzeug */
  tool: DrawingTool;

  /** Aktuelle Stiftfarbe im HEX-Format */
  color: string;

  /** Stärke/Breite des Zeichenwerkzeugs in Pixeln */
  lineWidth: number;

  /** Grad der Deckkraft/Transparenz (0-1) */
  opacity: number;

  /** Aktiviert/Deaktiviert den Zeichenmodus */
  isDrawingEnabled: boolean;

  /** Optional: Textgröße */
  textSize?: number; // Für Textgröße
}
