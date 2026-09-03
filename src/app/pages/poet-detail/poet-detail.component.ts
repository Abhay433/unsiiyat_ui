import { Component, inject, signal, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { ScriptService } from '../../core/services/script.service';
import { AuthorService } from '../../core/services/author.service';
import { ContentService } from '../../core/services/content.service';
import { SeedDataService } from '../../core/services/seed-data.service';

@Component({
  selector: 'app-poet-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './poet-detail.component.html',
  styleUrls: ['./poet-detail.component.css']
})
export class PoetDetailComponent implements OnInit {
  readonly scriptService = inject(ScriptService);
  private readonly authorService = inject(AuthorService);
  private readonly contentService = inject(ContentService);
  readonly seedService = inject(SeedDataService);
  private readonly route = inject(ActivatedRoute);

  poetId = signal<number>(1);
  poet = signal<any>(null);
  poetContents = signal<any[]>([]);
  activeTab = signal<'ghazals' | 'ashar' | 'bio'>('ghazals');
  copiedIndex = signal<number | null>(null);
  loading = signal(true);

  constructor() {
    effect(() => {
      this.scriptService.activeScript();
      if (this.poetId()) {
        this.loadPoetData(this.poetId());
      }
    });
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = Number(params['id']) || 1;
      this.poetId.set(id);
      this.loadPoetData(id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  loadPoetData(id: number) {
    this.loading.set(true);
    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());

    this.authorService.getEnrichedAuthors(scriptId).subscribe({
      next: (authors) => {
        const found = authors.find(a => a.id === id);
        if (found) {
          this.poet.set(found);
        } else {
          this.setFallbackPoet(id);
        }
      },
      error: () => this.setFallbackPoet(id)
    });

    this.contentService.getEnrichedContents(scriptId).subscribe({
      next: (contents) => {
        const filtered = contents.filter(c => c.authorId === id);
        if (filtered.length > 0) {
          this.poetContents.set(filtered);
        } else {
          this.setFallbackContents(id);
        }
        this.loading.set(false);
      },
      error: () => {
        this.setFallbackContents(id);
        this.loading.set(false);
      }
    });
  }

  private setFallbackPoet(id: number) {
    const lang = this.scriptService.activeScript();
    const p = this.seedService.classicalPoets.find(item => item.id === id) || this.seedService.classicalPoets[0];
    this.poet.set({
      id: p.id,
      birthDate: p.birthDate,
      deathDate: p.deathDate,
      avatarUrl: p.avatarUrl,
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
