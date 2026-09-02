import { Component, inject, signal, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ScriptService } from '../../core/services/script.service';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth-modal.component.html',
  styleUrls: ['./auth-modal.component.css']
})
export class AuthModalComponent {
  private readonly authService = inject(AuthService);
  readonly scriptService = inject(ScriptService);

  @Input() mode: 'login' | 'register' = 'login';
  @Output() close = new EventEmitter<void>();

  email = signal('');
  password = signal('');
  name = signal('');
  errorMsg = signal('');
  successMsg = signal('');
  loading = signal(false);

  switchMode(newMode: 'login' | 'register') {
    this.mode = newMode;
    this.errorMsg.set('');
    this.successMsg.set('');
  }

  onSubmit() {
    this.errorMsg.set('');
    this.successMsg.set('');
    this.loading.set(true);

    if (this.mode === 'login') {
      this.authService.login({ email: this.email(), password: this.password() }).subscribe({
        next: (res) => {
          this.loading.set(false);
          if (res.success) {
            this.successMsg.set('Welcome back! Login successful.');
            setTimeout(() => this.close.emit(), 1000);
          } else {
            this.errorMsg.set(res.message || 'Login failed. Please check your credentials.');
          }
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMsg.set(err?.error?.message || 'Login failed. Please verify credentials.');
        }
      });
    } else {
      this.authService.register({
        name: this.name(),
        email: this.email(),
        password: this.password(),
        role: 'ADMIN'
      }).subscribe({
        next: (res) => {
          this.loading.set(false);
          if (res.success) {
            this.successMsg.set('Account registered successfully!');
            setTimeout(() => this.close.emit(), 1000);
          } else {
            this.errorMsg.set(res.message || 'Registration failed.');
          }
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMsg.set(err?.error?.message || 'Registration failed.');
        }
      });
    }
  }
}
