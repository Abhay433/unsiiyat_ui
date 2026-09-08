import { Component, inject, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ScriptService, ScriptCode } from '../../core/services/script.service';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { ContentService } from '../../core/services/content.service';
import { AuthorService } from '../../core/services/author.service';
import { SeedDataService } from '../../core/services/seed-data.service';
import { Genre } from '../../core/models/taxonomy.models';
import { Content } from '../../core/models/content.models';

@Component({
  selector: 'app-genre-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './genre-detail.component.html',
  styleUrls: ['./genre-detail.component.css']
})
export class GenreDetailComponent implements OnInit {
  readonly scriptService = inject(ScriptService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly taxonomyService = inject(TaxonomyService);
  private readonly contentService = inject(ContentService);
  private readonly authorService = inject(AuthorService);
  private readonly seedService = inject(SeedDataService);

  genreId = signal<number>(1);
  genre = signal<Genre | null>(null);
  genresList = signal<Genre[]>([]);

  // Contents & Pagination State (10 items per page)
  contents = signal<Content[]>([]);
  contentsLoading = signal<boolean>(true);
  currentPage = signal<number>(0);
  totalPages = signal<number>(1);
  totalElements = signal<number>(0);
  isLastPage = signal<boolean>(true);
  copiedContentId = signal<number | null>(null);

  constructor() {
    // Re-fetch when user switches script (Urdu, Hindi, English)
    effect(() => {
      this.scriptService.activeScript();
      if (this.genreId()) {
        this.loadGenreContents(this.currentPage());
      }
    });
  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      const id = idParam ? parseInt(idParam, 10) : 1;
      if (!isNaN(id)) {
        this.genreId.set(id);
        this.currentPage.set(0);
        this.loadGenreDetails(id);
        this.loadGenreContents(0);
      }
    });
  }

  loadGenreDetails(id: number) {
    this.taxonomyService.getAllGenres().subscribe({
      next: (list) => {
        const genres = list && list.length > 0 ? list : this.seedService.initialGenres;
        this.genresList.set(genres);
        const match = genres.find(g => g.id === id);
        if (match) {
          this.genre.set(match);
        } else {
          this.genre.set(this.getFallbackGenre(id));
        }
      },
      error: () => {
        this.genresList.set(this.seedService.initialGenres);
        this.genre.set(this.getFallbackGenre(id));
      }
    });
  }

  loadGenreContents(page: number = 0) {
    this.contentsLoading.set(true);
    const genreId = this.genreId();
    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());

    this.contentService.getContentsByGenrePaged({
      genreId,
      scriptId,
      page,
      size: 10
    }).subscribe({
      next: (res) => {
        if (res && res.data && res.data.length > 0) {
          this.contents.set(res.data);
          this.totalPages.set(res.totalPages || 1);
          this.totalElements.set(res.totalElements || res.data.length);
          this.isLastPage.set(res.last ?? (page >= (res.totalPages || 1) - 1));
        } else {
          this.loadFallbackGenrePoems(genreId, page);
        }
        this.contentsLoading.set(false);
      },
      error: (err) => {
        console.warn('[GenreDetail] Backend error, using fallback seed data:', err);
        this.loadFallbackGenrePoems(genreId, page);
        this.contentsLoading.set(false);
      }
    });
  }

  private loadFallbackGenrePoems(genreId: number, page: number) {
    const lang = this.scriptService.activeScript();
    // Filter classical poems matching genre or return all if genre not specified
    let filtered = this.seedService.classicalPoems.filter(p => p.genreId === genreId);
    if (filtered.length === 0) {
      // If none match specific genreId, show classical poems
      filtered = this.seedService.classicalPoems;
    }

    const pageSize = 10;
    const total = filtered.length;
    const totalP = Math.max(1, Math.ceil(total / pageSize));
    const start = page * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    const mapped: Content[] = paged.map(poem => {
      const poet = this.seedService.classicalPoets.find(p => p.id === poem.authorId);
      const text = poem.texts[lang] || poem.texts.ur;
      return {
        id: poem.id,
        genreId: poem.genreId,
        authorId: poem.authorId,
        title: text.title || poem.title,
        author: {
          id: poem.authorId,
          primaryName: poet?.details[lang]?.name || 'Legendary Poet',
          avatarUrl: poet?.avatarUrl || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=100'
        },
        primaryText: {
          id: poem.id,
          scriptId: this.scriptService.getScriptId(lang),
          title: text.title,
          body: text.body
        }
      };
    });

    this.contents.set(mapped);
    this.totalPages.set(totalP);
    this.totalElements.set(total);
    this.isLastPage.set(page >= totalP - 1);
  }

  private getFallbackGenre(id: number): Genre {
    const list = this.seedService.initialGenres;
    return list.find(g => g.id === id) || {
      id,
      name: id === 1 ? 'غزل / ग़ज़ल / Ghazal' : id === 2 ? 'نظم / नज़्म / Nazm' : id === 3 ? 'شعر / शेर / Sher' : 'رباعی / रुबाई / Rubai',
      slug: id === 1 ? 'ghazal' : id === 2 ? 'nazm' : id === 3 ? 'sher' : 'rubai'
    };
  }

  goToPage(page: number) {
    if (page < 0 || (this.totalPages() > 0 && page >= this.totalPages())) return;
    this.currentPage.set(page);
    this.loadGenreContents(page);
    const el = document.getElementById('genre-works-top');
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

  copyCouplet(poem: Content) {
    const lines = this.getPoemLines(poem);
    const poet = this.getPoetName(poem);
    const title = poem.primaryText?.title || poem.title;
    const text = `${lines[0]}\n${lines[1]}\n\n— ${poet}\n(${title})\nVia Unsiiyat Poetry Realm`;
    navigator.clipboard.writeText(text);
    if (poem.id) {
      this.copiedContentId.set(poem.id);
      setTimeout(() => this.copiedContentId.set(null), 2000);
    }
  }

  getPoemLines(poem?: Content | null): [string, string] {
    if (!poem) return ['', ''];
    const body = poem.primaryText?.body || (poem as any).contentTexts?.[0]?.body || (poem as any).texts?.[0]?.body || '';
    const lines = body.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    if (lines.length >= 2) {
      return [lines[0], lines[1]];
    }
    if (lines.length === 1) {
      return [lines[0], poem.title && poem.title !== lines[0] ? poem.title : ''];
    }
    return [poem.title || 'Classical Verse', ''];
  }

  getPoetName(poem?: Content | null): string {
    if (poem?.author) {
      const activeScript = this.scriptService.activeScript();
      if (activeScript === 'ur' && poem.author.urName) return poem.author.urName;
      if (activeScript === 'hi' && poem.author.hiName) return poem.author.hiName;
      if (poem.author.enName) return poem.author.enName;
      if (poem.author.primaryName) return poem.author.primaryName;
    }
    return (poem as any)?.authorName || 'Master Shayar';
  }

  getPoetAvatar(poem?: Content | null): string {
    if (poem?.author) {
      return this.authorService.getAuthorAvatar(poem.author);
    }
    return 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=100';
  }

  getGenreIcon(slug?: string): string {
    const s = (slug || '').toLowerCase();
    switch (s) {
      case 'ghazal': return '📜';
      case 'nazm': return '📑';
      case 'sher':
      case 'ashar': return '✒️';
      case 'rubai': return '🪶';
      case 'qasida': return '👑';
      case 'marsiya': return '🕯️';
      case 'masnavi': return '📖';
      default: return '📜';
    }
  }

  getGenreTitle(genre?: Genre | null): string {
    if (!genre) return 'Classical Genre';
    const lang = this.scriptService.activeScript();
    const slug = (genre.slug || '').toLowerCase();
    const titles: Record<string, Record<ScriptCode, string>> = {
      'ghazal': { ur: 'غزل (Ghazal)', hi: 'ग़ज़ल (Ghazal)', en: 'Ghazal' },
      'nazm': { ur: 'نظم (Nazm)', hi: 'नज़्में (Nazms)', en: 'Nazm' },
      'sher': { ur: 'اشعار (Ash\'ar)', hi: 'अशआर (Couplets)', en: "Sher / Ash'ar" },
      'rubai': { ur: 'رباعیات (Rubaiyat)', hi: 'रुबाइयात (Rubaiyat)', en: 'Rubaiyat' },
      'qasida': { ur: 'قصائد (Qasaid)', hi: 'क़सीदे (Qasaid)', en: 'Qasida' },
      'marsiya': { ur: 'مراثی (Marsiye)', hi: 'मर्सिया (Marsiya)', en: 'Marsiya' }
    };
    if (titles[slug] && titles[slug][lang]) {
      return titles[slug][lang];
    }
    return genre.name;
  }

  getGenreDescription(genre?: Genre | null): string {
    const slug = (genre?.slug || '').toLowerCase();
    switch (slug) {
      case 'ghazal':
        return 'The quintessential classical form of Urdu poetry. Built of independent couplets (shers) bound by strict meter (Bahr), rhyming pattern (Qafiya), and refrain (Radif).';
      case 'nazm':
        return 'Continuous thematic verse characterized by unified poetic thought, reflective modern expressions, philosophical depth, and social revolution.';
      case 'sher':
        return 'Two-line standalone master couplets (Bait) delivering profound truths, unforgettable metaphors, and romantic philosophies in supreme brevity.';
      case 'rubai':
        return 'Four-line classical Persian/Urdu quatrains conforming to an AABA rhyming structure, renowned for delivering sharp punchlines and mystical wisdom.';
      case 'qasida':
        return 'Majestic panegyrics and descriptive praise poems composed in elaborate, rolling meters honoring patrons, saints, or divine qualities.';
      case 'marsiya':
        return 'Solemn elegies and mourning poetry commemorating historical valor, sacrifice, and spiritual martyrdom, composed with poignant eloquence.';
      default:
        return 'Explore timeless heritage verses and literary structures from the masters of Urdu and Hindi poetry.';
    }
  }
}
