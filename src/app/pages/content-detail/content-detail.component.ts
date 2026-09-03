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
  readerFontSize = signal(24); // px
  isPlayingAudio = signal(false);
  audioSeconds = signal(0);
  copiedIndex = signal<number | null>(null);
  dictWord = signal<string>('');
  showDict = signal(false);
  loading = signal(true);
  isBookmarked = signal(false);

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
          this.allTexts.set(found.texts || []);
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
    const textObj = this.allTexts().find(t => t.scriptId === sId);
    if (textObj) return textObj;

    return this.content()?.primaryText || { title: this.content()?.title, body: '' };
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

  changeFontSize(delta: number) {
    const size = this.readerFontSize() + delta;
    if (size >= 16 && size <= 38) {
      this.readerFontSize.set(size);
    }
  }

  switchScript(code: ScriptCode) {
    this.scriptService.setScript(code);
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
    const poet = this.content()?.author?.primaryName || 'Legendary Poet';
    const text = `${couplet[0]}\n${couplet[1]}\n\n— ${poet}\n(Via Unsiiyat Poetry - Rekhta Realm)`;
    navigator.clipboard.writeText(text);
    this.copiedIndex.set(index);
    setTimeout(() => this.copiedIndex.set(null), 2000);
  }

  copyFullGhazal() {
    const poet = this.content()?.author?.primaryName || 'Legendary Poet';
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
