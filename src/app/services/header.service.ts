import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HeaderService {
  private headerVisibilitySubject = new BehaviorSubject<boolean>(false);
  public headerVisibility$: Observable<boolean> = this.headerVisibilitySubject.asObservable();

  constructor() { }

  /**
   * Header ausblenden
   */
  hideHeader(): void {
    this.headerVisibilitySubject.next(true);
  }

  /**
   * Header einblenden
   */
  showHeader(): void {
    this.headerVisibilitySubject.next(false);
  }

  /**
   * Header-Sichtbarkeit umschalten
   */
  toggleHeaderVisibility(): void {
    this.headerVisibilitySubject.next(!this.headerVisibilitySubject.value);
  }
}
