import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { LoginRequest, LoginResponse, RegisterRequest, CurrentUser } from '../models/auth.models';
import { ApiResponse } from '../models/api-response.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly api = inject(ApiService);

  readonly token = signal<string | null>(localStorage.getItem('unsiiyat_token'));
  readonly currentUser = signal<CurrentUser | null>(this.getStoredUser());

  readonly isAuthenticated = computed(() => !!this.token());
  readonly isAdmin = computed(() => {
    const role = this.currentUser()?.role?.toUpperCase();
    return role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'PLATFORM_ADMIN';
  });

  login(credentials: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    return this.api.post<ApiResponse<LoginResponse>>('/auth/login', credentials).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.setSession(response.data);
        }
      })
    );
  }

  register(userData: RegisterRequest): Observable<ApiResponse<LoginResponse>> {
    return this.api.post<ApiResponse<LoginResponse>>('/auth/register', userData).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.setSession(response.data);
        }
      })
    );
  }

  logout() {
    localStorage.removeItem('unsiiyat_token');
    localStorage.removeItem('unsiiyat_user');
    this.token.set(null);
    this.currentUser.set(null);
  }

  updateProfilePicture(photoUrl: string) {
    const current = this.currentUser();
    const updated: CurrentUser = current
      ? { ...current, profilePictureUrl: photoUrl }
      : { name: 'Administrator', email: 'admin@unsiiyat.org', role: 'ADMIN', profilePictureUrl: photoUrl };

    localStorage.setItem('unsiiyat_user', JSON.stringify(updated));
    this.currentUser.set(updated);
  }

  private setSession(authData: LoginResponse) {
    const user: CurrentUser = {
      name: authData.name || authData.email,
      email: authData.email,
      role: authData.role || 'USER',
      profilePictureUrl: authData.profilePictureUrl
    };

    localStorage.setItem('unsiiyat_token', authData.token);
    localStorage.setItem('unsiiyat_user', JSON.stringify(user));
    this.token.set(authData.token);
    this.currentUser.set(user);
  }

  private getStoredUser(): CurrentUser | null {
    const raw = localStorage.getItem('unsiiyat_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
