import { Component, inject, signal, OnInit, computed, effect, untracked } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ScriptService, ScriptCode } from '../../core/services/script.service';
import { ContentService } from '../../core/services/content.service';
import { AuthorService } from '../../core/services/author.service';
import { SeedDataService } from '../../core/services/seed-data.service';
import { DictionaryModalComponent } from '../../components/dictionary-modal/dictionary-modal.component';

@Component({
  selector: 'app-content-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DictionaryModalComponent],
  templateUrl: './content-detail.component.html',
  styleUrls: ['./content-detail.component.css']
})
export class ContentDetailComponent implements OnInit {
  readonly scriptService = inject(ScriptService);
  private readonly contentService = inject(ContentService);
  readonly authorService = inject(AuthorService);
  readonly seedService = inject(SeedDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  getAuthorAvatar(author: any): string {
    return this.authorService.getAuthorAvatar(author);
  }

  onAuthorImgError(event: Event) {
    const target = event.target as HTMLImageElement;
    if (target) {
      const name = this.getAuthorName() || 'Poet';
      target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3d2216&color=d4af37&font-size=0.38&bold=true`;
    }
  }

  contentId = signal<number>(1);
  content = signal<any>(null);
  loading = signal<boolean>(true);

  readerFontSize = signal<number>(26); // px
  isPlayingAudio = signal<boolean>(false);
  audioSeconds = signal<number>(0);
  copiedIndex = signal<number | null>(null);
  dictWord = signal<string>('');
  showDict = signal<boolean>(false);
  isBookmarked = signal<boolean>(false);
  showShareToast = signal<boolean>(false);

  constructor() {
    // React to script changes from top navbar dynamically
    effect(() => {
      const currentScript = this.scriptService.activeScript();
      const sId = this.scriptService.getScriptId(currentScript);
      const syncVer = this.scriptService.scriptSyncVersion();
      const id = this.contentId();

      if (id) {
        untracked(() => {
          this.loadContent(id, sId);
        });
      }
    });
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = Number(params['id']) || 1;
      this.contentId.set(id);
      this.loadContent(id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Load content using exact id and navbar scriptId payload
  loadContent(id: number, scriptId?: number) {
    this.loading.set(true);
    const sId = scriptId ?? this.scriptService.getScriptId(this.scriptService.activeScript());

    this.contentService.getEnrichedContentsPaged(sId, { id, size: 1 }).subscribe({
      next: (res) => {
        const item = res.data && res.data.length > 0 ? res.data[0] : null;
        if (item && (item.primaryText?.body?.trim() || item.primaryText?.title?.trim())) {
          this.content.set(item);
          this.loading.set(false);
        } else {
          // If no content for this scriptId, query base content info so we can still display author / poem details
          this.contentService.getEnrichedContentsPaged(undefined, { id, size: 1 } as any).subscribe({
            next: (baseRes) => {
              const baseItem = baseRes.data && baseRes.data.length > 0 ? baseRes.data[0] : null;
              if (baseItem) {
                this.content.set({ ...baseItem, primaryText: null });
              } else {
                this.setFallbackContent(id);
              }
              this.loading.set(false);
            },
            error: () => {
              this.setFallbackContent(id);
              this.loading.set(false);
            }
          });
        }
      },
      error: () => {
        this.setFallbackContent(id);
        this.loading.set(false);
      }
    });
  }

  hasScriptContent(): boolean {
    const c = this.content();
    if (!c) return false;
    const text = c.primaryText;
    return !!(text?.body?.trim() || text?.title?.trim());
  }

  displayTitle(): string {
    const c = this.content();
    const lang = this.scriptService.activeScript();
    const text = c?.primaryText;
    if (text?.title?.trim()) {
      return text.title.trim();
    }
    if (c?.title?.trim() && this.scriptService.isScriptMatch({ title: c.title }, lang)) {
      return c.title.trim();
    }
    const firstLine = (text?.body || '').split('\n').map((l: string) => l.trim()).find((l: string) => l.length > 0);
    if (firstLine) {
      return firstLine;
    }
    return c?.title || (lang === 'ur' ? 'کلام' : (lang === 'hi' ? 'कलाम' : 'Poem'));
  }

  readonly isGhazal = computed(() => {
    const c = this.content();
    if (!c) return false;

    const gName = (c.genre?.name || c.genreName || c.genre || c.contentType || c.type || '').toString().toLowerCase();

    if (gName.includes('article') || gName.includes('mazmoon') || gName.includes('essay') || gName.includes('prose') ||
        gName.includes('nazm') || gName.includes('مضمون') || gName.includes('نظم') || gName.includes('نثر') ||
        gName.includes('مقالہ') || gName.includes('شخصیت') || gName.includes('انشائیہ')) {
      return false;
    }

    if (gName.includes('ghazal') || gName.includes('غزل') || gName.includes('گزل') || gName.includes('गज़ल')) {
      return true;
    }

    const body = c.primaryText?.body || c.body || '';
    if (body) {
      const lines = body.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      if (lines.length > 0) {
        const totalChars = lines.reduce((acc: number, l: string) => acc + l.length, 0);
        const totalWords = lines.reduce((acc: number, l: string) => acc + l.split(/\s+/).filter(w => w.length > 0).length, 0);
        const avgChars = totalChars / lines.length;
        const avgWords = totalWords / lines.length;

        if (avgChars > 65 || avgWords > 11) {
          return false;
        }
      }
    }

    return true;
  });

  // Memoized couplets computed signal
  readonly couplets = computed(() => {
    const c = this.content();
    const text = c?.primaryText;
    const body = text?.body || '';
    if (!body.trim()) return [];

    const lines = body.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    const result: { line1: string; line2: string; words1: string[]; words2: string[] }[] = [];

    for (let i = 0; i < lines.length; i += 2) {
      const l1 = lines[i] || '';
      const l2 = lines[i + 1] || '';
      result.push({
        line1: l1,
        line2: l2,
        words1: l1.split(' ').filter((w: string) => w.trim().length > 0),
        words2: l2.split(' ').filter((w: string) => w.trim().length > 0)
      });
    }
    return result;
  });

  private setFallbackContent(id: number) {
    const lang = this.scriptService.activeScript();
    const poem = this.seedService.classicalPoems.find(p => p.id === id);
    if (!poem) {
      this.content.set(null);
      return;
    }
    const poet = this.seedService.classicalPoets.find(p => p.id === poem.authorId);
    const activeText = poem.texts?.[lang] || null;

    const enriched = {
      id: poem.id,
      title: poem.title,
      genreId: poem.genreId,
      authorId: poem.authorId,
      author: {
        id: poet?.id || poem.authorId,
        primaryName: poet?.details?.[lang]?.name || poet?.details?.ur?.name || 'Unknown Poet',
        primaryBio: poet?.details?.[lang]?.biography || poet?.details?.ur?.biography || '',
        avatarUrl: poet?.avatarUrl || ''
      },
      primaryText: activeText
    };

    this.content.set(enriched);
  }

  goBack() {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/']);
    }
  }


  getAuthorName(): string {
    const lang = this.scriptService.activeScript();
    const c = this.content();
    if (!c) return 'Legendary Poet';

    const author = c.author;
    if (author) {
      if (lang === 'ur' && author.urName) return author.urName;
      if (lang === 'hi' && author.hiName) return author.hiName;
      if (lang === 'en' && author.enName) return author.enName;

      if (Array.isArray(author.details)) {
        const d = author.details.find((x: any) => this.scriptService.isScriptMatch({ scriptId: x.scriptId, title: x.name, body: x.biography }, lang));
        if (d?.name) return d.name;
      }
      if (author.primaryName) return author.primaryName;
    }

    const seedPoet = this.seedService.classicalPoets.find(p => p.id === c.authorId);
    if (seedPoet?.details?.[lang]?.name) return seedPoet.details[lang].name;

    return c.author?.primaryName || (lang === 'ur' ? 'شاعر' : (lang === 'hi' ? 'शायर' : 'Poet'));
  }

  getAuthorBio(): string {
    const lang = this.scriptService.activeScript();
    const c = this.content();
    const author = c?.author;

    if (author) {
      if (Array.isArray(author.details)) {
        const d = author.details.find((x: any) => this.scriptService.isScriptMatch({ scriptId: x.scriptId, title: x.name, body: x.biography }, lang));
        if (d?.biography) return d.biography;
      }
      if (author.primaryBio) return author.primaryBio;
    }

    const seedPoet = this.seedService.classicalPoets.find(p => p.id === c?.authorId);
    if (seedPoet?.details?.[lang]?.biography) return seedPoet.details[lang].biography;

    return (
      author?.primaryBio ||
      (lang === 'ur'
        ? 'اردو و ہندی کلاسیکی شاعری کا عظیم و لافانی ورثہ۔'
        : (lang === 'hi'
          ? 'उर्दू व हिन्दी शास्त्रीय शायरी की अनमोल धरोहर।'
          : 'Celebrated classical master poet of timeless poetic tradition.'))
    );
  }

  getPoemDirection(): 'rtl' | 'ltr' {
    return this.scriptService.activeScript() === 'ur' ? 'rtl' : 'ltr';
  }

  getPoemFontClass(): string {
    const lang = this.scriptService.activeScript();
    if (lang === 'ur') return 'font-urdu';
    if (lang === 'hi') return 'font-hindi';
    return 'font-english';
  }

  changeFontSize(delta: number) {
    const size = this.readerFontSize() + delta;
    if (size >= 18 && size <= 42) {
      this.readerFontSize.set(size);
    }
  }

  openDictionary(word: string = '') {
    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"?۔]/g, '').trim();
    if (cleanWord) {
      this.dictWord.set(cleanWord);
      this.showDict.set(true);
    }
  }

  navigateToPreviousGhazal() {
    const all = this.seedService.classicalPoems;
    const currentIdx = all.findIndex(p => p.id === this.contentId());
    const prevIdx = (currentIdx - 1 + all.length) % all.length;
    this.router.navigate(['/content', all[prevIdx].id]);
  }

  navigateToNextGhazal() {
    const all = this.seedService.classicalPoems;
    const currentIdx = all.findIndex(p => p.id === this.contentId());
    const nextIdx = (currentIdx + 1) % all.length;
    this.router.navigate(['/content', all[nextIdx].id]);
  }

  trackByIndex(index: number): number {
    return index;
  }
}
