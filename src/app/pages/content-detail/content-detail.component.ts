import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
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
  private readonly seedService = inject(SeedDataService);
  private readonly route = inject(ActivatedRoute);

  contentId = signal<number>(1);
  content = signal<any>(null);
  allTexts = signal<any[]>([]);
  readerFontSize = signal(24); // px
  isPlayingAudio = signal(false);
  copiedIndex = signal<number | null>(null);
  dictWord = signal<string>('');
  showDict = signal(false);
  loading = signal(true);

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = Number(params['id']) || 1;
      this.contentId.set(id);
      this.loadContent(id);
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

  changeFontSize(delta: number) {
    const size = this.readerFontSize() + delta;
    if (size >= 16 && size <= 38) {
      this.readerFontSize.set(size);
    }
  }

  switchScript(code: ScriptCode) {
    this.scriptService.setScript(code);
  }

  copyCouplet(index: number, couplet: string[]) {
    const text = `${couplet[0]}\n${couplet[1]}\n\n— ${this.content()?.author?.primaryName || 'Unsiiyat'}`;
    navigator.clipboard.writeText(text);
    this.copiedIndex.set(index);
    setTimeout(() => this.copiedIndex.set(null), 2000);
  }

  openDictionary(word: string = '') {
    this.dictWord.set(word);
    this.showDict.set(true);
  }
}
