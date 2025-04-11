import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Theme } from '../models/Theme.model';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // Predefined themes inspired by popular IDEs
  private readonly themes: Theme[] = [
    // Vorhandenes Default Theme
    {
      id: 'default',
      name: 'Default',
      colors: {
        primaryColor: '#4a6da7',
        primaryLight: '#7b9fd9',
        primaryDark: '#1a4177',
        secondaryColor: '#a74a6d',
        secondaryLight: '#d97b9f',
        secondaryDark: '#771a41',
        backgroundColor: '#f5f7fa',
        textColor: '#333333',
        textLight: '#777777',
        borderColor: '#dddddd',
        iconColor: '#4a6da7',
        iconHoverColor: '#7b9fd9',
        iconActiveColor: '#1a4177',
        iconDisabledColor: '#aaaaaa',
        navBackgroundColor: '#f5f7fa',
        canvasBackgroundColor: '#ffffff',
        canvasDrawingColor: '#000000'      // Dunkle Zeichenfarbe
      }
    },

    // Vorhandenes Nord Theme
    {
      id: 'nord',
      name: 'Nord',
      colors: {
        primaryColor: '#88c0d0',
        primaryLight: '#b1dae6',
        primaryDark: '#5e81ac',
        secondaryColor: '#b48ead',
        secondaryLight: '#d2b1ca',
        secondaryDark: '#9a6f89',
        backgroundColor: '#2e3440',
        textColor: '#eceff4',
        textLight: '#d8dee9',
        borderColor: '#3b4252',
        iconColor: '#81a1c1',
        iconHoverColor: '#88c0d0',
        iconActiveColor: '#5e81ac',
        iconDisabledColor: '#434c5e',
        navBackgroundColor: '#2e3440',
        canvasBackgroundColor: '#3b4252',  // Dunkler Canvas-Hintergrund
        canvasDrawingColor: '#eceff4'       // Helle Zeichenfarbe
      }
    },

    // Monochrome Light Theme: Heller Look in rein weißer Oberfläche mit dunkelgrauem/schwarzem Text.
    {
      id: 'mono-light',
      name: 'Monochrome Light',
      colors: {
        // Akzentfarben: Ausschließlich Schwarz und verschiedene Grautöne
        primaryColor: '#000000',       // Primär: Reines Schwarz für markante Akzente
        primaryLight: '#444444',       // Etwas helleres Grau für sanfte Variationen
        primaryDark: '#000000',        // Dunkel bleibt rein schwarz
        secondaryColor: '#888888',     // Sekundär: Mittleres Grau für zusätzliche Differenzierung
        secondaryLight: '#aaaaaa',     // Leichteres Grau als Kontrast
        secondaryDark: '#666666',      // Dunkleres Grau für tiefer gehende Akzente

        // Oberflächenfarben
        backgroundColor: '#ffffff',    // Hintergrund: Reinweiß für maximalen Kontrast
        textColor: '#111111',          // Text: Sehr dunkler Grauton (fast Schwarz) für optimale Lesbarkeit
        textLight: '#333333',          // Leichtere Textvariante für weniger wichtige Inhalte
        borderColor: '#cccccc',        // Dezent grauer Rahmen
        iconColor: '#888888',          // Icons: Gleicher Farbton wie secondaryColor
        iconHoverColor: '#aaaaaa',      // Icons Hover: Gleicher Farbton wie secondaryLight
        iconActiveColor: '#666666',     // Icons Active: Gleicher Farbton wie secondaryDark
        iconDisabledColor: '#888888',   // Icons Disabled: Gleicher Farbton wie secondaryColor
        navBackgroundColor: '#f7f7f7',   // Navigation: Sehr helles Grau als Alternative zum reinen Weiß

        // Canvas-Konzept: Gegensätzliche Farben, um Zeichnungen klar darzustellen
        canvasBackgroundColor: '#ffffff', // Canvas: Reinweiß
        canvasDrawingColor: '#000000'      // Zeichnungen: Reines Schwarz
      }
    },

    // Monochrome Dark Theme: Dunkler Look mit rein schwarzer Oberfläche und weißem Text.
    {
      id: 'mono-dark',
      name: 'Monochrome Dark',
      colors: {
        // Akzentfarben: Ausschließlich Weiß und verschiedene Grautöne
        primaryColor: '#ffffff',       // Primär: Reines Weiß für markante Akzente
        primaryLight: '#aaaaaa',       // Etwas helleres Grau als sanftere Variante
        primaryDark: '#dddddd',        // Light gray for hover/active states
        secondaryColor: '#888888',     // Sekundär: Mittleres Grau für differenzierende Akzente
        secondaryLight: '#bbbbbb',     // Helleres Grau als Kontrast
        secondaryDark: '#666666',      // Dunkleres Grau für tiefere Akzente

        // Oberflächenfarben
        backgroundColor: '#000000',    // Hintergrund: Reines Schwarz für maximalen Kontrast
        textColor: '#ffffff',          // Text: Reines Weiß für optimale Lesbarkeit
        textLight: '#cccccc',          // Leichteres Weiß bzw. Grauton für weniger hervorstechende Inhalte
        borderColor: '#333333',        // Dunkler Grauton für Rahmen
        iconColor: '#ffffff',         // Icons: Reines Weiß für maximale Sichtbarkeit
        iconHoverColor: '#aaaaaa',     // Icons Hover: Etwas helleres Grau für Interaktion
        iconActiveColor: '#ffffff',
        iconDisabledColor: '#333333',  // Dezent dunkler Grauton für inaktive Icons
        navBackgroundColor: '#111111',   // Navigation: Sehr dunkles Schwarz als Alternative
        // Canvas-Konzept: Gegensätzliche Farben, um Zeichnungen klar darzustellen
        canvasBackgroundColor: '#000000', // Canvas: Rein schwarz
        canvasDrawingColor: '#ffffff'      // Zeichnungen: Reines Weiß
      }
    },
    // Selbst erfundenes, angenehmes Theme: "Sunset"
    {
      id: 'sunset',
      name: 'Sunset',
      colors: {
        primaryColor: '#ff6f61',    // Warme, einladende Korallen-Töne
        primaryLight: '#ffa07a',
        primaryDark: '#cc574c',
        secondaryColor: '#8fbc8f',  // Sanfte, naturverbundene Grüntöne
        secondaryLight: '#cce6cc',
        secondaryDark: '#669966',
        backgroundColor: '#fffaf0', // Weiches, fast cremeweißes Hintergrund – angenehm warm
        textColor: '#333333',       // Dunkle Schrift für gute Lesbarkeit
        textLight: '#555555',
        borderColor: '#e0dcd8',
        iconColor: '#ff6f61',       // Icons in der Akzentfarbe
        iconHoverColor: '#ffa07a',
        iconActiveColor: '#cc574c',
        iconDisabledColor: '#aaaaaa', // Dezent grau für inaktive Icons
        // Navigation: Heller, aber sanfter Hintergrund
        navBackgroundColor: '#fff0e6',
        canvasBackgroundColor: '#fffaf0', // Heller Canvas-Hintergrund
        canvasDrawingColor: '#222222'     // Dunkle Zeichenfarbe – der kontrastreiche Gegenpol
      }
    },

    // Selbst erfundenes, angenehmes Theme: "Ocean Breeze"
    {
      id: 'oceanBreeze',
      name: 'Ocean Breeze',
      colors: {
        primaryColor: '#4da6ff',    // Frisches Meeresblau als Akzent
        primaryLight: '#80c1ff',
        primaryDark: '#1a75ff',
        secondaryColor: '#66cccc',  // Ergänzende, beruhigende Sekundärfarbe
        secondaryLight: '#99e6e6',
        secondaryDark: '#339999',
        backgroundColor: '#e6f7ff', // Sehr helles Blau als Hintergrund – luftig und frisch
        textColor: '#001f3f',       // Dunkle, fast marineähnliche Schriftfarbe
        textLight: '#3d9acc',
        borderColor: '#b3d1e6',
        iconColor: '#4da6ff',       // Icons in der Akzentfarbe
        iconHoverColor: '#80c1ff',
        iconActiveColor: '#1a75ff',
        iconDisabledColor: '#aaaaaa', // Dezent grau für inaktive Icons
        navBackgroundColor: '#cceeff',
        canvasBackgroundColor: '#e6f7ff', // Heller Canvas-Hintergrund
        canvasDrawingColor: '#001f3f'     // Dunkle Zeichenfarbe – sorgt für den nötigen Kontrast
      }
    }
  ];


  // Current theme
  private currentThemeSubject = new BehaviorSubject<Theme>(this.themes[0]);
  currentTheme$: Observable<Theme> = this.currentThemeSubject.asObservable();

  constructor() {
    // Check if a theme was saved in localStorage
    this.loadSavedTheme();
  }

  // Get all available themes
  getThemes(): Theme[] {
    return [...this.themes];
  }

  // Set the current theme
  setTheme(themeId: string): void {
    const theme = this.themes.find(t => t.id === themeId);
    if (theme) {
      // Adjust icon colors based on background color before applying
      const adjustedTheme = this.adjustIconColors(theme);
      this.currentThemeSubject.next(adjustedTheme);
      this.applyTheme(adjustedTheme);
      localStorage.setItem('selectedTheme', themeId);
    }
  }

  // Adjust icon colors based on background color for better contrast
  private adjustIconColors(theme: Theme): Theme {
    // Create a clone of the theme to avoid modifying the original
    const adjustedTheme = JSON.parse(JSON.stringify(theme)) as Theme;

    // Special handling for monochrome themes
    if (theme.id === 'mono-dark') {
      // For mono-dark theme, use bright contrasting colors for icons
      adjustedTheme.colors.iconColor = '#000000';         // Black icons on white background
      adjustedTheme.colors.iconHoverColor = '#333333';    // Dark gray on hover
      adjustedTheme.colors.iconActiveColor = '#990000';   // Dark red for active state
      adjustedTheme.colors.iconDisabledColor = '#aaaaaa'; // Light gray for disabled
      adjustedTheme.colors.canvasDrawingColor = '#ffffff'; // White for drawing on canvas
      return adjustedTheme;
    }

    if (theme.id === 'mono-light') {
      // For mono-light theme, use dark contrasting colors for icons
      adjustedTheme.colors.iconColor = '#ffffff';         // White icons on black background
      adjustedTheme.colors.iconHoverColor = '#dddddd';    // Light gray on hover
      adjustedTheme.colors.iconActiveColor = '#ff9999';   // Light red/pink for active state (more visible)
      adjustedTheme.colors.iconDisabledColor = '#555555'; // Darker gray for disabled
      adjustedTheme.colors.canvasDrawingColor = '#000000'; // Black for drawing on canvas
      return adjustedTheme;
    }

    // For other themes, check if dark or light
    const isDark = this.isDarkTheme(theme);

    // Adjust icon colors for better contrast
    if (isDark) {
      // For dark themes, use lighter icon colors
      adjustedTheme.colors.iconColor = adjustedTheme.colors.primaryLight;
      adjustedTheme.colors.iconHoverColor = '#ffffff'; // Full white for hover
      adjustedTheme.colors.iconActiveColor = adjustedTheme.colors.secondaryLight;
      adjustedTheme.colors.iconDisabledColor = '#555555'; // Darker gray for disabled
    } else {
      // For light themes, use darker icon colors
      adjustedTheme.colors.iconColor = adjustedTheme.colors.primaryDark;
      adjustedTheme.colors.iconHoverColor = adjustedTheme.colors.primaryDark;
      adjustedTheme.colors.iconActiveColor = adjustedTheme.colors.secondaryDark;
      adjustedTheme.colors.iconDisabledColor = '#aaaaaa'; // Light gray for disabled
    }

    return adjustedTheme;
  }

  // Apply the theme by setting CSS variables
  private applyTheme(theme: Theme): void {
    const root = document.documentElement;

    console.log('Applying theme:', theme.name); // Debug output

    // Set all color variables
    Object.entries(theme.colors).forEach(([property, value]) => {
      root.style.setProperty(`--${property}`, value);
      // Debug: Log the actual computed value to see if it's being applied
      console.log(`Setting --${property} to ${value}`);
    });

    // Add a class to the body to indicate the current theme
    document.body.className = '';
    document.body.classList.add(`theme-${theme.id}`);

    // Debug: Output computed styles to verify they're being applied
    const computedBgColor = getComputedStyle(document.body).backgroundColor;
    const computedTextColor = getComputedStyle(document.body).color;
    console.log(`Computed styles - Background: ${computedBgColor}, Text: ${computedTextColor}`);

    // Try forcing a repaint - sometimes Angular's change detection doesn't catch CSS var changes
    document.body.style.display = 'none';
    document.body.offsetHeight; // Force a reflow
    document.body.style.display = '';

    // Add more explicit theme attributes directly to body for debugging
    document.body.style.backgroundColor = theme.colors.backgroundColor;
    document.body.style.color = theme.colors.textColor;

    setTimeout(() => {
      // Check if the styles were actually applied after a short delay
      const afterBgColor = getComputedStyle(document.body).backgroundColor;
      console.log(`After timeout - Background color: ${afterBgColor}`);

      // Reset the direct style application (let CSS vars take over)
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
    }, 100);
  }

  // Get the current theme
  getCurrentTheme(): Theme {
    return this.currentThemeSubject.value;
  }

  // Load the saved theme from localStorage
  private loadSavedTheme(): void {
    console.log('Loading saved theme'); // Debug output
    const savedThemeId = localStorage.getItem('selectedTheme');

    if (savedThemeId) {
      console.log('Found saved theme ID:', savedThemeId); // Debug output
      const theme = this.themes.find(t => t.id === savedThemeId);
      if (theme) {
        const adjustedTheme = this.adjustIconColors(theme);
        this.currentThemeSubject.next(adjustedTheme);
        this.applyTheme(adjustedTheme);
      } else {
        console.log('Saved theme not found, using default'); // Debug output
        const defaultTheme = this.adjustIconColors(this.themes[0]);
        this.applyTheme(defaultTheme);
      }
    } else {
      console.log('No saved theme, using default'); // Debug output
      const defaultTheme = this.adjustIconColors(this.themes[0]);
      this.applyTheme(defaultTheme);
    }
  }


  // Helper method to determine if a theme is dark
  private isDarkTheme(theme: Theme): boolean {
    // Simple check: convert background color to RGB and check brightness
    const bgColor = theme.colors.backgroundColor;

    // If it starts with #, convert hex to RGB
    if (bgColor.startsWith('#')) {
      const r = parseInt(bgColor.substr(1, 2), 16);
      const g = parseInt(bgColor.substr(3, 2), 16);
      const b = parseInt(bgColor.substr(5, 2), 16);

      // Calculate perceived brightness (ITU-R BT.709)
      const brightness = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;

      return brightness < 0.5;
    }

    return false;
  }
}
