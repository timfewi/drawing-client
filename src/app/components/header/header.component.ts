import { Component, OnInit, HostListener, HostBinding, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HeaderService } from '../../services/header.service';
import { User } from '../../models/User.model';

/**
 * Header-Komponente
 *
 * Zeigt die Navigationsleiste mit adaptivem Design für mobile und Desktop-Ansichten an.
 * Enthält Benutzermenü und Login/Logout-Funktionalität.
 */
@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive]
})
export class HeaderComponent implements OnInit, OnDestroy {
  @HostBinding('class.hidden') isHidden = false;
  mobileMenuVisible = false;
  userMenuVisible = false;
  currentUser$: Observable<User | null>;
  private headerSubscription: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router,
    private headerService: HeaderService
  ) {
    this.currentUser$ = this.authService.currentUser$;
    this.headerSubscription = this.headerService.headerVisibility$.subscribe(
      hidden => {
        this.isHidden = hidden;
      }
    );
  }

  ngOnInit(): void { }

  ngOnDestroy(): void {
    if (this.headerSubscription) {
      this.headerSubscription.unsubscribe();
    }
  }

  /**
   * Schaltet das mobile Menü um
   */
  toggleMobileMenu(): void {
    this.mobileMenuVisible = !this.mobileMenuVisible;
    // Benutzermenü schließen, wenn das mobile Menü umgeschaltet wird
    if (this.userMenuVisible) {
      this.userMenuVisible = false;
    }
  }

  /**
   * Schaltet das Benutzermenü um
   */
  toggleUserMenu(): void {
    this.userMenuVisible = !this.userMenuVisible;
  }

  /**
   * Loggt den Benutzer aus und navigiert zur Startseite
   */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
    this.userMenuVisible = false;
  }

  /**
   * Schließt die Menüs, wenn außerhalb geklickt wird
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    // Schließe das Benutzermenü, wenn außerhalb geklickt wird
    if (this.userMenuVisible && !target.closest('.user-menu')) {
      this.userMenuVisible = false;
    }

    // Schließe das mobile Menü, wenn außerhalb geklickt wird (bei Bildschirmen kleiner als 768px)
    if (window.innerWidth < 768 && this.mobileMenuVisible && !target.closest('nav') && !target.closest('.mobile-menu-toggle')) {
      this.mobileMenuVisible = false;
    }
  }

  /**
   * Schaltet die Sichtbarkeit des Headers um
   */
  public toggleVisibility(hidden: boolean): void {
    this.isHidden = hidden;
  }
}
