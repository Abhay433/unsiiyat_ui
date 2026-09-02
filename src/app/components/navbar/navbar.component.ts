import { Component, inject, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ScriptService, ScriptCode } from '../../core/services/script.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  readonly scriptService = inject(ScriptService);
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  @Output() openAuth = new EventEmitter<'login' | 'register'>();

  searchQuery = signal('');
  mobileMenuOpen = signal(false);
  isLightMode = signal(false);

  switchScript(code: ScriptCode) {
    this.scriptService.setScript(code);
  }

  toggleTheme() {
    this.isLightMode.update(v => !v);
    if (this.isLightMode()) {
      document.body.classList.add('theme-light');
      document.body.classList.remove('theme-dark');
    } else {
      document.body.classList.add('theme-dark');
      document.body.classList.remove('theme-light');
    }
  }

  onSearch(event: Event) {
    event.preventDefault();
    const query = this.searchQuery().trim();
    if (query) {
      this.router.navigate(['/poets'], { queryParams: { q: query } });
    }
  }

  toggleMobileMenu() {
    this.mobileMenuOpen.update(v => !v);
  }

  closeMobileMenu() {
    this.mobileMenuOpen.set(false);
  }
}
