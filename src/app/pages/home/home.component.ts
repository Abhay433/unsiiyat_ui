import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ScriptService, ScriptCode } from '../../core/services/script.service';
import { ContentService } from '../../core/services/content.service';
import { AuthorService } from '../../core/services/author.service';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { SeedDataService } from '../../core/services/seed-data.service';
import { Content } from '../../core/models/content.models';
import { Author } from '../../core/models/author.models';
import { Genre, Theme } from '../../core/models/taxonomy.models';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  readonly scriptService = inject(ScriptService);
  private readonly contentService = inject(ContentService);
  private readonly authorService = inject(AuthorService);
  private readonly taxonomyService = inject(TaxonomyService);
  private readonly seedService = inject(SeedDataService);

  // Data signals
  poets = signal<any[]>([]);
  genres = signal<Genre[]>([]);
  themes = signal<Theme[]>([]);
  contents = signal<any[]>([]);
  loading = signal(true);

  // Interactive states
  copiedHero = signal(false);
  isPlayingAudio = signal(false);
  heroFontSize = signal(28); // px

  // Couplet of the day
  readonly heroCouplets: Record<ScriptCode, { firstLine: string; secondLine: string; poet: string; poemTitle: string; id: number }> = {
    ur: {
      firstLine: 'ہزاروں خواہشیں ایسی کہ ہر خواہش پہ دم نکلے',
      secondLine: 'بہت نکلے مرے ارمان لیکن پھر بھی کم نکلے',
      poet: 'مرزا اسد اللہ خاں غالب',
      poemTitle: 'ہزاروں خواہشیں ایسی',
      id: 1
    },
    hi: {
      firstLine: 'हज़ारों ख़्वाहिशें ऐसी कि हर ख़्वाहिश पे दम निकले',
      secondLine: 'बहुत निकले मिरे अरमान लेकिन फिर भी कम निकले',
      poet: 'मिर्ज़ा ग़ालिब',
      poemTitle: 'हज़ारों ख़्वाहिशें ऐसी',
      id: 1
    },
    en: {
      firstLine: 'Hazaron khwahishen aisi ke har khwahish pe dam nikle',
      secondLine: 'Bahut nikle mire armaan lekin phir bhi kam nikle',
      poet: 'Mirza Ghalib',
      poemTitle: 'Hazaron Khwahishen Aisi',
      id: 1
    }
  };

  readonly currentHero = computed(() => {
    const lang = this.scriptService.activeScript();
    return this.heroCouplets[lang] || this.heroCouplets['ur'];
  });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());

    // Fallback + API combination
    this.authorService.getEnrichedAuthors(scriptId).subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.poets.set(data);
        } else {
          // Fallback to classical seed
          this.setFallbackPoets();
        }
      },
      error: () => this.setFallbackPoets()
    });

    this.contentService.getEnrichedContents(scriptId).subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.contents.set(data);
        } else {
          this.setFallbackContents();
        }
        this.loading.set(false);
      },
      error: () => {
        this.setFallbackContents();
        this.loading.set(false);
      }
    });

    this.taxonomyService.filterGenres().subscribe({
      next: (res) => {
        this.genres.set(res.data?.length ? res.data : this.seedService.initialGenres);
      },
      error: () => this.genres.set(this.seedService.initialGenres)
    });

    this.taxonomyService.filterThemes().subscribe({
      next: (res) => {
        this.themes.set(res.data?.length ? res.data : this.seedService.initialThemes);
      },
      error: () => this.themes.set(this.seedService.initialThemes)
    });
  }

  private setFallbackPoets() {
    const lang = this.scriptService.activeScript();
    const list = this.seedService.classicalPoets.map(p => ({
      id: p.id,
      birthDate: p.birthDate,
      deathDate: p.deathDate,
      avatarUrl: p.avatarUrl,
      primaryName: p.details[lang]?.name || p.details.ur.name,
      primaryBio: p.details[lang]?.biography || p.details.ur.biography
    }));
    this.poets.set(list);
  }

  private setFallbackContents() {
    const lang = this.scriptService.activeScript();
    const list = this.seedService.classicalPoems.map(poem => {
      const poet = this.seedService.classicalPoets.find(p => p.id === poem.authorId);
      const text = poem.texts[lang] || poem.texts.ur;
      return {
        id: poem.id,
        title: poem.title,
        genreId: poem.genreId,
        authorId: poem.authorId,
        authorName: poet?.details[lang]?.name || 'Legendary Poet',
        primaryText: {
          title: text.title,
          body: text.body
        },
        themeIds: poem.themeIds
      };
    });
    this.contents.set(list);
  }

  copyHeroCouplet() {
    const hero = this.currentHero();
    const text = `${hero.firstLine}\n${hero.secondLine}\n\n— ${hero.poet}\n(Via Unsiiyat Poetry)`;
    navigator.clipboard.writeText(text);
    this.copiedHero.set(true);
    setTimeout(() => this.copiedHero.set(false), 2000);
  }

  toggleAudio() {
    this.isPlayingAudio.update(v => !v);
  }

  changeFontSize(delta: number) {
    const newSize = this.heroFontSize() + delta;
    if (newSize >= 18 && newSize <= 42) {
      this.heroFontSize.set(newSize);
    }
  }

  getFirstCouplet(body?: string): string[] {
    if (!body) return ['', ''];
    const lines = body.split('\n').filter(l => l.trim().length > 0);
    return [lines[0] || '', lines[1] || ''];
  }
}
