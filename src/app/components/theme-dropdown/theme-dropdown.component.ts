import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Theme } from '../../models/Theme.model';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-theme-dropdown',
  templateUrl: './theme-dropdown.component.html',
  styleUrls: ['./theme-dropdown.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class ThemeDropdownComponent implements OnInit {
  themes: Theme[] = [];
  currentTheme!: Theme;
  isDropdownOpen = false;

  constructor(private themeService: ThemeService) { }

  ngOnInit(): void {
    this.themes = this.themeService.getThemes();
    // Set initial current theme
    this.currentTheme = this.themeService.getCurrentTheme();

    // Subscribe to theme changes
    this.themeService.currentTheme$.subscribe(theme => {
      console.log('Theme dropdown received theme change:', theme.name);
      this.currentTheme = theme;
    });
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  closeDropdown(): void {
    this.isDropdownOpen = false;
  }

  changeTheme(themeId: string): void {
    console.log('User selected theme:', themeId);
    this.themeService.setTheme(themeId);
    this.closeDropdown();
  }

  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  clickOutside(event: Event): void {
    if (!(event.target as HTMLElement).closest('.theme-dropdown-container')) {
      this.closeDropdown();
    }
  }

  // Prevent event bubbling for dropdown toggle clicks
  onDropdownClick(event: Event): void {
    event.stopPropagation();
  }
}
