import { Component, inject, signal, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable, of, map, catchError } from 'rxjs';
import { ScriptService, ScriptCode } from '../../core/services/script.service';
import { AuthorService } from '../../core/services/author.service';
import { ContentService } from '../../core/services/content.service';
import { SeedDataService } from '../../core/services/seed-data.service';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { Genre } from '../../core/models/taxonomy.models';

@Component({
  selector: 'app-poet-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './poet-detail.component.html',
  styleUrls: ['./poet-detail.component.css']
})
export class PoetDetailComponent implements OnInit {
  readonly scriptService = inject(ScriptService);
  readonly authorService = inject(AuthorService);
  private readonly contentService = inject(ContentService);
  private readonly taxonomyService = inject(TaxonomyService);
  readonly seedService = inject(SeedDataService);
  private readonly route = inject(ActivatedRoute);

  poetId = signal<number | null>(null);
  poet = signal<any>(null);
  poetContents = signal<any[]>([]);
  genres = signal<Genre[]>([]);
  activeTab = signal<string>('works');
  selectedGenreId = signal<number | 'all'>('all');
  copiedIndex = signal<number | null>(null);
  loading = signal(true);
  loadingContents = signal(false);

  // Pagination (size: 10)
  currentPage = signal<number>(0);
  pageSize = signal<number>(10);
  totalElements = signal<number>(0);
  totalPages = signal<number>(0);
  isLastPage = signal<boolean>(true);

  constructor() {
    effect(() => {
      this.scriptService.activeScript();
      const id = this.poetId();
      if (id) {
        this.loadPoetData(id);
      }
    });
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = Number(params['id']);
      if (id) {
        this.poetId.set(id);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  loadGenres(): Observable<Genre[]> {
    return this.taxonomyService.getAllGenres().pipe(
      map(data => {
        const list = (data && data.length > 0) ? data : this.seedService.initialGenres;
        this.genres.set(list);
        if (list.length > 0 && (this.selectedGenreId() === 'all' || !this.selectedGenreId())) {
          this.selectedGenreId.set(list[0].id!);
        }
        return list;
      }),
      catchError(() => {
        const list = this.seedService.initialGenres;
        this.genres.set(list);
        if (list.length > 0 && (this.selectedGenreId() === 'all' || !this.selectedGenreId())) {
          this.selectedGenreId.set(list[0].id!);
        }
        return of(list);
      })
    );
  }

  onGenreChange(newGenreId: any) {
    const val = newGenreId === 'all' ? 'all' : Number(newGenreId);
    this.selectedGenreId.set(val);
    this.currentPage.set(0);
    this.loadAuthorContents();
  }

  goToPage(page: number) {
    if (page < 0 || (this.totalPages() > 0 && page >= this.totalPages())) return;
    this.currentPage.set(page);
    this.loadAuthorContents();
    const el = document.getElementById('author-works-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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

  selectTab(tab: string) {
    this.activeTab.set(tab);
  }

  getGenreIcon(genre?: Genre): string {
    const slug = (genre?.slug || '').toLowerCase();
    switch (slug) {
      case 'ghazal': return '📜';
      case 'nazm': return '📑';
      case 'sher':
      case 'ashar': return '✒️';
      case 'rubai': return '🪶';
      case 'qasida': return '👑';
      case 'marsiya': return '🕯️';
      default: return '🏷️';
    }
  }

  getGenreDisplayName(genre?: Genre, genreId?: number): string {
    const currentScript = this.scriptService.activeScript();
    const targetGenre = genre || (genreId ? this.genres().find(g => g.id === genreId) : undefined);
    const slug = (targetGenre?.slug || (genreId === 1 ? 'ghazal' : genreId === 2 ? 'nazm' : genreId === 3 ? 'sher' : genreId === 4 ? 'rubai' : '')).toLowerCase();

    const genreMap: Record<string, Record<ScriptCode, string>> = {
      'ghazal': { ur: 'غزلیات (Ghazals)', hi: 'ग़ज़लें (Ghazals)', en: 'Ghazals' },
      'nazm': { ur: 'نظمیات (Nazms)', hi: 'नज़्में (Nazms)', en: 'Nazms' },
      'sher': { ur: 'اشعار (Ash\'ar)', hi: 'अशआर (Couplets)', en: "Ash'ar" },
      'ashar': { ur: 'اشعار (Ash\'ar)', hi: 'अशआर (Couplets)', en: "Ash'ar" },
      'rubai': { ur: 'رباعیات (Rubaiyat)', hi: 'रुबाइयात (Rubaiyat)', en: 'Rubaiyat' },
      'qasida': { ur: 'قصائد (Qasaid)', hi: 'क़सीदे (Qasaid)', en: 'Qasaid' },
      'marsiya': { ur: 'مراثی (Marsiye)', hi: 'मर्सिये (Marsiye)', en: 'Marsiya' },
      'masnavi': { ur: 'مثنوی (Masnavi)', hi: 'मसनवी (Masnavi)', en: 'Masnavi' },
      'qita': { ur: 'قطعہ (Qita)', hi: 'क़तआ (Qita)', en: 'Qita' },
      'hamd': { ur: 'حمد (Hamd)', hi: 'हम्द (Hamd)', en: 'Hamd' },
      'naat': { ur: 'نعت (Naat)', hi: 'नात (Naat)', en: 'Naat' }
    };

    if (slug && genreMap[slug]?.[currentScript]) {
      return genreMap[slug][currentScript];
    }

    if (targetGenre?.name) {
      const parts = String(targetGenre.name).split('/').map((p: string) => p.trim());
      if (parts.length === 3) {
        if (currentScript === 'ur') return parts[0];
        if (currentScript === 'hi') return parts[1];
        if (currentScript === 'en') return parts[2];
      }
      return targetGenre.name;
    }

    return currentScript === 'ur' ? 'صنف' : (currentScript === 'hi' ? 'विधा' : 'Genre');
  }

  getGenreBadge(item: any): string {
    const currentScript = this.scriptService.activeScript();
    const genreId = item.genreId || item.genre?.id;
    const targetGenre = item.genre || (genreId ? this.genres().find(g => g.id === genreId) : undefined);
    const slug = (targetGenre?.slug || (genreId === 1 ? 'ghazal' : genreId === 2 ? 'nazm' : genreId === 3 ? 'sher' : genreId === 4 ? 'rubai' : '')).toLowerCase();

    const singleMap: Record<string, Record<ScriptCode, string>> = {
      'ghazal': { ur: 'غزل', hi: 'ग़ज़ल', en: 'Ghazal' },
      'nazm': { ur: 'نظم', hi: 'नज़्म', en: 'Nazm' },
      'sher': { ur: 'شعر', hi: 'शेर', en: 'Sher' },
      'ashar': { ur: 'شعر', hi: 'शेर', en: 'Sher' },
      'rubai': { ur: 'رباعی', hi: 'रुबाई', en: 'Rubai' },
      'qasida': { ur: 'قصیدہ', hi: 'क़सीदा', en: 'Qasida' },
      'marsiya': { ur: 'مرثیہ', hi: 'मर्सिया', en: 'Marsiya' },
      'masnavi': { ur: 'مثنوی', hi: 'मसनवी', en: 'Masnavi' },
      'qita': { ur: 'قطعہ', hi: 'क़तआ', en: 'Qita' },
      'hamd': { ur: 'حمد', hi: 'हम्द', en: 'Hamd' },
      'naat': { ur: 'نعت', hi: 'नात', en: 'Naat' }
    };

    if (slug && singleMap[slug]?.[currentScript]) {
      return singleMap[slug][currentScript];
    }

    if (targetGenre?.name) {
      const parts = String(targetGenre.name).split('/').map((p: string) => p.trim());
      if (parts.length === 3) {
        if (currentScript === 'ur') return parts[0];
        if (currentScript === 'hi') return parts[1];
        if (currentScript === 'en') return parts[2];
      }
      return targetGenre.name;
    }

    return 'Ghazal';
  }

  getSelectedGenreTitle(): string {
    const gId = this.selectedGenreId();
    if (gId === 'all') {
      return this.scriptService.activeScript() === 'ur' ? 'تمام کلام (All Works)' : (this.scriptService.activeScript() === 'hi' ? 'सम्पूर्ण रचनाएँ (All Works)' : 'All Works');
    }
    const g = this.genres().find(item => item.id === gId);
    return this.getGenreDisplayName(g, typeof gId === 'number' ? gId : undefined);
  }

  getPoetAvatar(poet: any): string {
    return this.authorService.getAuthorAvatar(poet);
  }

  onImgError(event: Event, poet: any) {
    const target = event.target as HTMLImageElement;
    if (target) {
      const name = poet?.primaryName || poet?.name || 'Poet';
      target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3d2216&color=d4af37&font-size=0.38&bold=true`;
    }
  }

  loadPoetData(id: number) {
    this.loading.set(true);
    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());
    const cachedAvatar = localStorage.getItem(`author_avatar_${id}`);

    this.authorService.getAuthorById(id, scriptId).subscribe({
      next: (found) => {
        if (found) {
          if (cachedAvatar) {
            found.avatarUrl = cachedAvatar;
          }
          this.poet.set(found);
        } else {
          this.setFallbackPoet(id);
        }
        this.loading.set(false);
      },
      error: () => {
        this.setFallbackPoet(id);
        this.loading.set(false);
      }
    });

    if (this.genres().length === 0) {
      this.loadGenres().subscribe(() => {
        this.loadAuthorContents();
      });
    } else {
      if (this.selectedGenreId() === 'all' || !this.selectedGenreId()) {
        this.selectedGenreId.set(this.genres()[0].id!);
      }
      this.loadAuthorContents();
    }
  }

  loadAuthorContents() {
    const id = this.poetId();
    if (!id) return;
    this.loadingContents.set(true);
    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());
    const gId = this.selectedGenreId();
    const genreId = (gId !== 'all' && gId !== null) ? Number(gId) : null;

    this.contentService.getContentsByAuthorPaged({
      authorId: id,
      genreId: genreId,
      scriptId: scriptId,
      page: this.currentPage(),
      size: this.pageSize()
    }).subscribe({
      next: (res) => {
        this.poetContents.set(res.data || []);
        this.totalElements.set(res.totalElements ?? (res.data?.length || 0));
        this.totalPages.set(res.totalPages || (res.data && res.data.length > 0 ? 1 : 0));
        this.isLastPage.set(res.last ?? true);
        this.loadingContents.set(false);
      },
      error: () => {
        this.setFallbackContents(id);
        this.loadingContents.set(false);
      }
    });
  }

  private setFallbackPoet(id: number) {
    const lang = this.scriptService.activeScript();
    const p = this.seedService.classicalPoets.find(item => item.id === id) || this.seedService.classicalPoets[0];
    const cachedAvatar = localStorage.getItem(`author_avatar_${id}`);
    this.poet.set({
      id: p.id,
      birthDate: p.birthDate,
      deathDate: p.deathDate,
      avatarUrl: cachedAvatar || p.avatarUrl,
      primaryName: p.details[lang]?.name || p.details.ur.name,
      primaryBio: p.details[lang]?.biography || p.details.ur.biography
    });
  }

  private setFallbackContents(id: number) {
    const lang = this.scriptService.activeScript();
    const list = this.seedService.classicalPoems
      .filter(poem => poem.authorId === id)
      .map(poem => ({
        id: poem.id,
        title: poem.title,
        genreId: poem.genreId,
        primaryText: poem.texts[lang] || poem.texts.ur,
        themeIds: poem.themeIds
      }));
    this.poetContents.set(list);
  }

  copyCouplet(index: number, lines: string[]) {
    const text = `${lines.join('\n')}\n\n— ${this.poet()?.primaryName}\n(Via Unsiiyat Poetry)`;
    navigator.clipboard.writeText(text);
    this.copiedIndex.set(index);
    setTimeout(() => this.copiedIndex.set(null), 2000);
  }

  getFirstCouplet(body?: string): string[] {
    if (!body) return ['', ''];
    const lines = body.split('\n').filter(l => l.trim().length > 0);
    return [lines[0] || '', lines[1] || ''];
  }
}
