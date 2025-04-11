import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  showDebugPanel = true; // Set to false for production
  currentThemeName = '';

  constructor(
    private themeService: ThemeService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    // Force initialize the theme service
    // This ensures the service is created early in the application lifecycle
    const currentTheme = this.themeService.getCurrentTheme();
    this.currentThemeName = currentTheme.name;
    console.log('App initialized with theme:', currentTheme.name);

    // Subscribe to theme changes
    this.themeService.currentTheme$.subscribe(theme => {
      console.log('Theme changed to:', theme.name);
      this.currentThemeName = theme.name;
      this.cdr.detectChanges(); // Force change detection
    });

    // Debug: Add listener to test theme changes with keyboard shortcut (Ctrl+Shift+T)
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'T') {
        console.log('Theme toggle shortcut pressed');
        this.testThemeChange();
      }
    });
  }

  // Test method to verify theme changing works
  testThemeChange() {
    const themes = this.themeService.getThemes();
    const currentTheme = this.themeService.getCurrentTheme();
    const currentIndex = themes.findIndex(t => t.id === currentTheme.id);
    const nextIndex = (currentIndex + 1) % themes.length;

    console.log(`Changing theme from ${currentTheme.name} to ${themes[nextIndex].name}`);
    this.themeService.setTheme(themes[nextIndex].id);
  }

  // Force a refresh of the UI
  forceRefresh() {
    console.log('Forcing UI refresh');
    // Apply current theme again
    const currentTheme = this.themeService.getCurrentTheme();
    this.themeService.setTheme(currentTheme.id);
    this.cdr.detectChanges();
  }
}
