import { Component, inject, signal, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ScriptService } from '../../core/services/script.service';
import { AuthorService } from '../../core/services/author.service';
import { SeedDataService } from '../../core/services/seed-data.service';

@Component({
  selector: 'app-poets',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './poets.component.html',
  styleUrls: ['./poets.component.css']
})
export class PoetsComponent implements OnInit {
  readonly scriptService = inject(ScriptService);
  readonly authorService = inject(AuthorService);
  private readonly seedService = inject(SeedDataService);
  private readonly route = inject(ActivatedRoute);

  poets = signal<any[]>([]);
  searchFilter = signal('');
  selectedLetter = signal('ALL');
  selectedEra = signal<'all' | 'classical' | 'progressive' | 'modern'>('all');
  loading = signal<boolean>(true);
  // Pagination signals (size: 10)
  currentPage = signal<number>(0);
  totalPages = signal<number>(1);
  totalElements = signal<number>(0);
  isLastPage = signal<boolean>(false);
  readonly pageSize = 10;

  readonly alphabet = ['ALL', 'A', 'B', 'F', 'G', 'I', 'J', 'M', 'P', 'R', 'S', 'Z'];

  constructor() {
    effect(() => {
      this.scriptService.activeScript();
      this.loadPoets(0);
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['q']) {
        this.searchFilter.set(params['q']);
      }
    });
    this.loadPoets(0);
  }

  getPoetAvatar(poet: any): string {
    return this.authorService.getAuthorAvatar(poet);
  }

  getPoetInitial(poet: any): string {
    const name = poet?.primaryName || poet?.name || '';
    return name ? name.charAt(0).toUpperCase() : '✒';
  }

  onImgError(event: Event, poet: any) {
    const target = event.target as HTMLImageElement;
    if (target) {
      const name = poet?.primaryName || poet?.name || 'Poet';
      target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3d2216&color=d4af37&font-size=0.38&bold=true`;
    }
  }

  loadPoets(page: number = 0) {
    this.loading.set(true);
    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());

    this.authorService.getEnrichedAuthorsPaged(scriptId, {
      page: page,
      size: this.pageSize,
      sortBy: 'id',
      sortDirection: 'asc'
    }).subscribe({
      next: (res) => {
        const list = res.data || [];
        if (list.length > 0) {
          this.poets.set(list);
          this.currentPage.set(res.page ?? page);
          const total = res.totalElements ?? list.length;
          this.totalElements.set(total);
          this.totalPages.set(res.totalPages || Math.ceil(total / this.pageSize) || 1);
          this.isLastPage.set(res.last ?? (list.length < this.pageSize));
        } else {
          if (page === 0) {
            this.setFallback();
          }
          this.totalPages.set(1);
          this.isLastPage.set(true);
        }
        this.loading.set(false);
      },
      error: () => {
        if (page === 0) {
          this.setFallback();
        }
        this.loading.set(false);
        this.totalPages.set(1);
        this.isLastPage.set(true);
      }
    });
  }

  goToPage(page: number) {
    if (page < 0 || page >= this.totalPages() || page === this.currentPage() || this.loading()) return;
    this.loadPoets(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  getPageRange(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    const start = Math.max(0, current - 2);
    const end = Math.min(total, start + 5);
    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    return pages;
  }

  private setFallback() {
    const lang = this.scriptService.activeScript();
    const list = this.seedService.classicalPoets.map(p => ({
      id: p.id,
      birthDate: p.birthDate,
      deathDate: p.deathDate,
      avatarUrl: p.avatarUrl,
      primaryName: p.details[lang]?.name || p.details.ur.name,
      primaryBio: p.details[lang]?.biography || p.details.ur.biography,
      era: p.id === 1 ? 'classical' : (p.id === 2 ? 'progressive' : 'modern')
    }));
    this.poets.set(list);
  }

  readonly filteredPoets = computed(() => {
    const query = this.searchFilter().toLowerCase().trim();
    const letter = this.selectedLetter();
    const era = this.selectedEra();

    return this.poets().filter(p => {
      const name = (p.primaryName || '').toLowerCase();
      const bio = (p.primaryBio || '').toLowerCase();

      const matchesQuery = !query || name.includes(query) || bio.includes(query);
      const matchesLetter = letter === 'ALL' || name.startsWith(letter.toLowerCase()) || name.includes(letter.toLowerCase());
      const matchesEra = era === 'all' || (p.era || 'classical') === era;

      return matchesQuery && matchesLetter && matchesEra;
    });
  });

  setLetter(l: string) {
    this.selectedLetter.set(l);
  }

  setEra(era: 'all' | 'classical' | 'progressive' | 'modern') {
    this.selectedEra.set(era);
  }
}
