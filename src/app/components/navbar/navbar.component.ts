import { Component, inject, signal, computed, Output, EventEmitter, ElementRef, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ScriptService, ScriptCode, ScriptOption } from '../../core/services/script.service';
import { AuthService } from '../../core/services/auth.service';
import { SeedDataService, ClassicalPoet, ClassicalPoem } from '../../core/services/seed-data.service';

export interface SearchResultItem {
  type: 'poet' | 'ghazal' | 'theme';
  id: number | string;
  title: string;
  subtitle?: string;
  route: any[];
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {
  readonly scriptService = inject(ScriptService);
  readonly authService = inject(AuthService);
  readonly seedData = inject(SeedDataService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);

  @Output() openAuth = new EventEmitter<'login' | 'register'>();

  searchQuery = signal('');
  isSearchOpen = signal(false);
  mobileMenuOpen = signal(false);
  isLightMode = signal(localStorage.getItem('unsiiyat_theme') !== 'dark');

  // Computed live search results matching query across poets, ghazals, themes
  readonly searchResults = computed<SearchResultItem[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const results: SearchResultItem[] = [];

    // Search Poets
    this.seedData.classicalPoets.forEach((p: ClassicalPoet) => {
      const matchUr = p.details.ur.name.toLowerCase().includes(q);
      const matchHi = p.details.hi.name.toLowerCase().includes(q);
      const matchEn = p.details.en.name.toLowerCase().includes(q);

      if (matchUr || matchHi || matchEn) {
        const title = this.scriptService.activeScript() === 'ur' ? p.details.ur.name :
                      (this.scriptService.activeScript() === 'hi' ? p.details.hi.name : p.details.en.name);
        results.push({
          type: 'poet',
          id: p.id,
          title,
          subtitle: `${p.birthDate.slice(0, 4)} – ${p.deathDate.slice(0, 4)}`,
          route: ['/poet', p.id]
        });
      }
    });

    // Search Ghazals
    this.seedData.classicalPoems.forEach((poem: ClassicalPoem) => {
      const matchUr = poem.texts.ur.title.toLowerCase().includes(q) || poem.texts.ur.body.toLowerCase().includes(q);
      const matchHi = poem.texts.hi.title.toLowerCase().includes(q) || poem.texts.hi.body.toLowerCase().includes(q);
      const matchEn = poem.texts.en.title.toLowerCase().includes(q) || poem.texts.en.body.toLowerCase().includes(q);

      if (matchUr || matchHi || matchEn) {
        const title = this.scriptService.activeScript() === 'ur' ? poem.texts.ur.title :
                      (this.scriptService.activeScript() === 'hi' ? poem.texts.hi.title : poem.texts.en.title);
        results.push({
          type: 'ghazal',
          id: poem.id,
          title,
          subtitle: 'Ghazal',
          route: ['/content', poem.id]
        });
      }
    });

    // Search Themes
    this.seedData.initialThemes.forEach(theme => {
      if (theme.name.toLowerCase().includes(q) || theme.slug.toLowerCase().includes(q)) {
        results.push({
          type: 'theme',
          id: theme.id || theme.slug,
          title: theme.name,
          subtitle: 'Theme / Mood',
          route: ['/themes']
        });
      }
    });

    return results.slice(0, 7);
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isSearchOpen.set(false);
    }
  }

  onSearchFocus() {
    this.isSearchOpen.set(true);
  }

  ngOnInit() {
    if (this.isLightMode()) {
      document.body.classList.add('theme-light');
      document.body.classList.remove('theme-dark');
    } else {
      document.body.classList.add('theme-dark');
      document.body.classList.remove('theme-light');
    }
    this.scriptService.syncScriptsFromBackend().subscribe();
  }

  selectResult(item: SearchResultItem) {
    this.isSearchOpen.set(false);
    this.searchQuery.set('');
    this.router.navigate(item.route);
  }

  switchScript(item: ScriptOption | ScriptCode) {
    if (typeof item === 'string') {
      this.scriptService.setScript(item);
    } else {
      this.scriptService.selectScript(item);
    }
  }

  toggleTheme() {
    this.isLightMode.update(v => !v);
    if (this.isLightMode()) {
      document.body.classList.add('theme-light');
      document.body.classList.remove('theme-dark');
      localStorage.setItem('unsiiyat_theme', 'light');
    } else {
      document.body.classList.add('theme-dark');
      document.body.classList.remove('theme-light');
      localStorage.setItem('unsiiyat_theme', 'dark');
    }
  }

  onSearch(event: Event) {
    if (event) {
      event.preventDefault();
    }
    const query = this.searchQuery().trim();
    if (query) {
      this.isSearchOpen.set(false);
      this.router.navigate(['/search'], { queryParams: { q: query } });
    }
  }

  toggleMobileMenu() {
    this.mobileMenuOpen.update(v => !v);
  }

  closeMobileMenu() {
    this.mobileMenuOpen.set(false);
  }
}
