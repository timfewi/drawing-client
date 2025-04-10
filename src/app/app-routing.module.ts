import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'home', redirectTo: '', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  // Hier könnten weitere geschützte Routen hinzugefügt werden
  // { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  // { path: 'admin', component: AdminComponent, canActivate: [() => roleGuard('admin')] },
  { path: '**', redirectTo: '' } // Wildcard-Route für nicht gefundene Pfade
];
