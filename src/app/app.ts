import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FooterComponent } from './components/footer/footer.component';
import { AuthModalComponent } from './components/auth-modal/auth-modal.component';
import { ScriptService } from './core/services/script.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, FooterComponent, AuthModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly scriptService = inject(ScriptService);

  showAuthModal = signal(false);
  authMode = signal<'login' | 'register'>('login');

  constructor() {
    // Synchronize HTML document direction with active script
    effect(() => {
      const isRtl = this.scriptService.isRtl();
      document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
      document.documentElement.setAttribute('lang', this.scriptService.activeScript());
    });
  }

  openAuth(mode: 'login' | 'register') {
    this.authMode.set(mode);
    this.showAuthModal.set(true);
  }

  closeAuth() {
    this.showAuthModal.set(false);
  }
}
