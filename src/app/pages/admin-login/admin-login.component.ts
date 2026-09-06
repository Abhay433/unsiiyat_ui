import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ScriptService } from '../../core/services/script.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.css']
})
export class AdminLoginComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly scriptService = inject(ScriptService);

  email = signal('admin@unsiiyat.org');
  password = signal('');
  showPassword = signal(false);
  loading = signal(false);
  errorMsg = signal('');
  successMsg = signal('');
  returnUrl = signal('/studio');

  ngOnInit() {
    // If already logged in as Admin, redirect immediately
    if (this.authService.isAuthenticated() && this.authService.isAdmin()) {
      this.router.navigateByUrl('/studio');
      return;
    }

    const queryReturnUrl = this.route.snapshot.queryParams['returnUrl'];
    if (queryReturnUrl) {
      this.returnUrl.set(queryReturnUrl);
    }
  }

  togglePasswordVisibility() {
    this.showPassword.update(v => !v);
  }

  onSubmit() {
    const trimmedEmail = this.email().trim();
    const trimmedPassword = this.password().trim();

    if (!trimmedEmail || !trimmedPassword) {
      this.errorMsg.set('Please provide both administrator email and security password.');
      return;
    }

    this.errorMsg.set('');
    this.successMsg.set('');
    this.loading.set(true);

    this.authService.login({ email: trimmedEmail, password: trimmedPassword }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          const role = res.data.role?.toUpperCase();
          if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'PLATFORM_ADMIN') {
            this.successMsg.set('Admin credentials verified. Welcome to Unsiiyat Studio.');
            setTimeout(() => {
              this.router.navigateByUrl(this.returnUrl());
            }, 700);
          } else {
            // User authenticated but lacks ADMIN authority
            this.authService.logout();
            this.errorMsg.set('Access Denied: This portal is strictly restricted to Unsiiyat Administrators.');
          }
        } else {
          this.errorMsg.set(res.message || 'Authentication failed. Please check administrator credentials.');
        }
      },
      error: (err) => {
        this.loading.set(false);
        const backendMessage = err?.error?.message;
        if (backendMessage) {
          this.errorMsg.set(backendMessage);
        } else if (err.status === 0) {
          this.errorMsg.set('Cannot connect to backend server (http://localhost:8080). Please ensure Spring Boot is running.');
        } else {
          this.errorMsg.set('Authentication failed. Invalid administrator credentials or server error.');
        }
      }
    });
  }
}
