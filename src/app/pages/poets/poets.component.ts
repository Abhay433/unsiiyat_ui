import { Component, inject, signal, OnInit } from '@angular/core';
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
  private readonly authorService = inject(AuthorService);
  private readonly seedService = inject(SeedDataService);
  private readonly route = inject(ActivatedRoute);

  poets = signal<any[]>([]);
  searchFilter = signal('');
  selectedEra = signal('all');
  loading = signal(true);

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['q']) {
        this.searchFilter.set(params['q']);
      }
    });
    this.loadPoets();
  }

  loadPoets() {
    this.loading.set(true);
    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());

    this.authorService.getEnrichedAuthors(scriptId).subscribe({
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
      primaryBio: p.details[lang]?.biography || p.details.ur.biography
    }));
    this.poets.set(list);
  }

  get filteredPoets() {
    const query = this.searchFilter().toLowerCase().trim();
    if (!query) return this.poets();

    return this.poets().filter(p => {
      const name = (p.primaryName || '').toLowerCase();
      const bio = (p.primaryBio || '').toLowerCase();
      return name.includes(query) || bio.includes(query);
    });
  }
}
