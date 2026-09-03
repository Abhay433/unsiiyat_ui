import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ScriptService } from '../../core/services/script.service';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { ContentService } from '../../core/services/content.service';
import { SeedDataService } from '../../core/services/seed-data.service';
import { Theme } from '../../core/models/taxonomy.models';

@Component({
  selector: 'app-themes',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './themes.component.html',
  styleUrls: ['./themes.component.css']
})
export class ThemesComponent implements OnInit {
  readonly scriptService = inject(ScriptService);
  private readonly taxonomyService = inject(TaxonomyService);
  private readonly contentService = inject(ContentService);
  private readonly seedService = inject(SeedDataService);

  themes = signal<Theme[]>([]);
  contents = signal<any[]>([]);
  selectedThemeId = signal<number | null>(null);

  constructor() {
    effect(() => {
      this.scriptService.activeScript();
      this.loadContents();
    });
  }

  ngOnInit() {
    this.taxonomyService.filterThemes().subscribe({
      next: (res) => {
        const list = res.data?.length ? res.data : this.seedService.initialThemes;
        this.themes.set(list);
        if (list.length > 0 && list[0].id) {
          this.selectedThemeId.set(list[0].id);
        }
      },
      error: () => {
        this.themes.set(this.seedService.initialThemes);
        this.selectedThemeId.set(1);
      }
    });

    this.loadContents();
  }

  loadContents() {
    const sId = this.scriptService.getScriptId(this.scriptService.activeScript());
    this.contentService.getEnrichedContents(sId).subscribe({
      next: (data) => this.contents.set(data),
      error: () => this.setFallbackContents()
    });
  }

  private setFallbackContents() {
    const lang = this.scriptService.activeScript();
    const list = this.seedService.classicalPoems.map(poem => {
      const poet = this.seedService.classicalPoets.find(p => p.id === poem.authorId);
      return {
        id: poem.id,
        themeIds: poem.themeIds,
        title: poem.title,
        author: { primaryName: poet?.details[lang]?.name || 'Legendary Poet' },
        primaryText: poem.texts[lang] || poem.texts.ur
      };
    });
    this.contents.set(list);
  }

  getActiveThemeName(): string {
    const found = this.themes().find(t => t.id === this.selectedThemeId());
    return found ? found.name : 'Selected Mood';
  }

  getActiveThemeSlug(): string {
    const found = this.themes().find(t => t.id === this.selectedThemeId());
    return found ? found.slug : 'theme';
  }

  get filteredContents() {
    const tId = this.selectedThemeId();
    if (!tId) return this.contents();
    return this.contents().filter(c => c.themeIds?.includes(tId));
  }
}
