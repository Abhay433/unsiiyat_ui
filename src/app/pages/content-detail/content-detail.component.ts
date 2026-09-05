import { Component, inject, signal, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ScriptService, ScriptCode } from '../../core/services/script.service';
import { ContentService } from '../../core/services/content.service';
import { AuthorService } from '../../core/services/author.service';
import { SeedDataService } from '../../core/services/seed-data.service';
import { DictionaryModalComponent } from '../../components/dictionary-modal/dictionary-modal.component';

@Component({
  selector: 'app-content-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, DictionaryModalComponent],
  templateUrl: './content-detail.component.html',
  styleUrls: ['./content-detail.component.css']
})
export class ContentDetailComponent implements OnInit {
  readonly scriptService = inject(ScriptService);
  private readonly contentService = inject(ContentService);
  private readonly authorService = inject(AuthorService);
  readonly seedService = inject(SeedDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  contentId = signal<number>(1);
  content = signal<any>(null);
  allTexts = signal<any[]>([]);
  readerFontSize = signal(26); // px
  isPlayingAudio = signal(false);
  audioSeconds = signal(0);
  copiedIndex = signal<number | null>(null);
  dictWord = signal<string>('');
  showDict = signal(false);
  loading = signal(true);
  isBookmarked = signal(false);
  showShareToast = signal(false);

  constructor() {
    effect(() => {
      this.scriptService.activeScript();
      if (this.contentId()) {
        this.loadContent(this.contentId());
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

  loadContent(id: number) {
    this.loading.set(true);
    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());

    this.contentService.getEnrichedContents(scriptId).subscribe({
      next: (contents) => {
        const found = contents.find(c => c.id === id);
        if (found) {
          this.content.set(found);
          this.allTexts.set(found.texts || (found as any).contentTexts || []);
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

  private setFallbackContent(id: number) {
    const lang = this.scriptService.activeScript();
    const poem = this.seedService.classicalPoems.find(p => p.id === id) || this.seedService.classicalPoems[0];
    const poet = this.seedService.classicalPoets.find(p => p.id === poem.authorId);

    const enriched = {
      id: poem.id,
      title: poem.title,
      genreId: poem.genreId,
      authorId: poem.authorId,
      author: {
        id: poet?.id,
        primaryName: poet?.details[lang]?.name || poet?.details.ur.name,
        primaryBio: poet?.details[lang]?.biography || poet?.details.ur.biography,
        avatarUrl: poet?.avatarUrl
      },
      primaryText: poem.texts[lang] || poem.texts.ur,
      allTexts: [
        { scriptId: 1, ...poem.texts.ur },
        { scriptId: 2, ...poem.texts.hi },
        { scriptId: 3, ...poem.texts.en }
      ]
    };

    this.content.set(enriched);
    this.allTexts.set(enriched.allTexts);
  }

  // Get current active script text
  readonly currentPoemText = computed(() => {
    const lang = this.scriptService.activeScript();
    const sId = this.scriptService.getScriptId(lang);
    const texts = this.allTexts();

    if (texts && texts.length > 0) {
      const match = texts.find(t => t.scriptId === sId);
      if (match && (match.title?.trim() || match.body?.trim())) {
        return match;
      }
    }

    // Fallback: Check seed
    const seedItem = this.seedService.classicalPoems.find(p => p.id === this.contentId());
    if (seedItem?.texts?.[lang]) {
      return seedItem.texts[lang];
    }

    if (texts && texts.length > 0) {
      const firstWithBody = texts.find(t => t.body?.trim());
      if (firstWithBody) return firstWithBody;
      return texts[0];
    }

    return this.content()?.primaryText || { title: this.content()?.title || 'Untitled Kalam', body: '' };
  });

  // Split poem body into couplets (stanzas of 2 lines)
  get couplets(): string[][] {
    const body = this.currentPoemText()?.body || '';
    const lines = body.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    const result: string[][] = [];

    for (let i = 0; i < lines.length; i += 2) {
      result.push([lines[i], lines[i + 1] || '']);
    }
    return result;
  }

  getWords(line: string): string[] {
    return line.split(' ').filter(w => w.trim().length > 0);
  }

  getGenreName(): string {
    const lang = this.scriptService.activeScript();
    const c = this.content();
    const gid = c?.genreId || c?.genre?.id || 1;
    const slug = (c?.genre?.slug || (gid === 1 ? 'ghazal' : gid === 2 ? 'nazm' : gid === 3 ? 'sher' : gid === 4 ? 'rubai' : 'ghazal')).toLowerCase();

    const genreMap: Record<string, Record<ScriptCode, string>> = {
      ghazal: { ur: 'غزل', hi: 'ग़ज़ल', en: 'Ghazal' },
      nazm: { ur: 'نظم', hi: 'नज़्म', en: 'Nazm' },
      sher: { ur: 'شعر', hi: 'शेर', en: 'Sher / Couplet' },
      rubai: { ur: 'رباعی', hi: 'रुबाई', en: 'Rubai' },
      qasida: { ur: 'قصیدہ', hi: 'क़सीदा', en: 'Qasida' },
      marsiya: { ur: 'مرثیہ', hi: 'मर्सिया', en: 'Marsiya' },
      masnavi: { ur: 'مثنوی', hi: 'मसनवी', en: 'Masnavi' }
    };
    return genreMap[slug]?.[lang] || (lang === 'ur' ? 'غزل' : (lang === 'hi' ? 'ग़ज़ल' : 'Ghazal'));
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
        const sId = this.scriptService.getScriptId(lang);
        const d = author.details.find((x: any) => x.scriptId === sId);
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
        const sId = this.scriptService.getScriptId(lang);
        const d = author.details.find((x: any) => x.scriptId === sId);
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

  getCoupletNumeral(idx: number): string {
    const lang = this.scriptService.activeScript();
    const urduNums = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹', '۱۰', '۱۱', '۱۲', '۱۳', '۱۴', '۱۵', '۱۶', '۱۷', '۱۸', '۱۹', '۲۰'];
    const hindiNums = ['१', '२', '३', '४', '५', '६', '७', '८', '९', '१०', '११', '१२', '१३', '१४', '१५', '१६', '१७', '१८', '१९', '२०'];
    const num = idx + 1;
    if (lang === 'ur') return `شعر ${urduNums[idx] || num}`;
    if (lang === 'hi') return `शेर ${hindiNums[idx] || num}`;
    return `Sher #${num}`;
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

  switchScript(code: ScriptCode) {
    this.scriptService.setScript(code);
  }

  editInStudio() {
    const id = this.contentId();
    this.router.navigate(['/studio'], { queryParams: { editContentId: id } });
  }

  toggleAudio() {
    this.isPlayingAudio.update(v => !v);
    if (this.isPlayingAudio()) {
      this.audioSeconds.set(0);
      const timer = setInterval(() => {
        if (!this.isPlayingAudio()) {
          clearInterval(timer);
          return;
        }
        this.audioSeconds.update(s => s + 1);
      }, 1000);
    }
  }

  copyCouplet(index: number, couplet: string[]) {
    const poet = this.getAuthorName();
    const text = `${couplet[0]}\n${couplet[1]}\n\n— ${poet}\n(Via Unsiiyat Poetry - Rekhta Realm)`;
    navigator.clipboard.writeText(text);
    this.copiedIndex.set(index);
    setTimeout(() => this.copiedIndex.set(null), 2000);
  }

  copyFullGhazal() {
    const poet = this.getAuthorName();
    const title = this.currentPoemText()?.title || '';
    const body = this.currentPoemText()?.body || '';
    const text = `${title}\n\n${body}\n\n— ${poet}\n(Read more on Unsiiyat Poetry)`;
    navigator.clipboard.writeText(text);
    this.copiedIndex.set(-1);
    setTimeout(() => this.copiedIndex.set(null), 2000);
  }

  openDictionary(word: string = '') {
    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"?۔]/g, '').trim();
    this.dictWord.set(cleanWord);
    this.showDict.set(true);
  }

  toggleBookmark() {
    this.isBookmarked.update(v => !v);
  }

  shareKalam() {
    if (navigator.share) {
      navigator.share({
        title: this.currentPoemText()?.title || 'Unsiiyat Poetry',
        text: `Read "${this.currentPoemText()?.title}" by ${this.getAuthorName()} on Unsiiyat Poetry`,
        url: window.location.href
      }).catch(() => { });
    } else {
      navigator.clipboard.writeText(window.location.href);
      this.showShareToast.set(true);
      setTimeout(() => this.showShareToast.set(false), 2500);
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
}
