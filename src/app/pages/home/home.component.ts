import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CanvasEditorComponent } from '../../components/canvas-editor/canvas-editor.component';

/**
 * HomeComponent
 *
 * Die Hauptseite der Anwendung, die den Benutzern einen Überblick über die
 * Funktionen und Vorteile der Drawing App bietet.
 */
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: true,
  imports: [CommonModule, CanvasEditorComponent]
})
export class HomeComponent {
  // Für zukünftige Erweiterungen: Hier könnten Methoden für Button-Aktionen oder dynamische Inhalte eingefügt werden
}
