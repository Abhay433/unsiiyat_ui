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
  loading = signal(true);

  readonly alphabet = ['ALL', 'A', 'B', 'F', 'G', 'I', 'J', 'M', 'P', 'R', 'S', 'Z'];

  constructor() {
    effect(() => {
      this.scriptService.activeScript();
      this.loadPoets();
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['q']) {
        this.searchFilter.set(params['q']);
      }
    });
    this.loadPoets(true);
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

  loadPoets(forceRefresh = false) {
    this.loading.set(true);
    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());

    this.authorService.getEnrichedAuthors(scriptId, forceRefresh).subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.poets.set(data);
        } else {
          this.setFallback();
        }
        this.loading.set(false);
      },
      error: () => {
        this.setFallback();
        this.loading.set(false);
      }
    });
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
