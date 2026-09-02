import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ScriptService } from '../../core/services/script.service';
import { AuthorService } from '../../core/services/author.service';
import { ContentService } from '../../core/services/content.service';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { SeedDataService } from '../../core/services/seed-data.service';
import { AuthService } from '../../core/services/auth.service';
import { Genre, Theme, Script } from '../../core/models/taxonomy.models';
import { Author } from '../../core/models/author.models';
import { Content } from '../../core/models/content.models';

@Component({
  selector: 'app-studio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './studio.component.html',
  styleUrls: ['./studio.component.css']
})
export class StudioComponent implements OnInit {
  readonly scriptService = inject(ScriptService);
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly authorService = inject(AuthorService);
  private readonly contentService = inject(ContentService);
  private readonly taxonomyService = inject(TaxonomyService);
  private readonly seedService = inject(SeedDataService);

  activeTab = signal<'poets' | 'contents' | 'taxonomy' | 'seed'>('poets');

  // Lists
  authors = signal<Author[]>([]);
  contents = signal<Content[]>([]);
  genres = signal<Genre[]>([]);
  themes = signal<Theme[]>([]);
  scripts = signal<Script[]>([]);

  // Feedback
  statusMsg = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  seedLogs = signal<string[]>([]);
  isSeeding = signal(false);

  // Poet Form Model
  poetForm = signal({
    birthDate: '1800-01-01',
    deathDate: '1870-01-01',
    urName: '',
    urBio: '',
    hiName: '',
    hiBio: '',
    enName: '',
    enBio: ''
  });

  // Content Form Model
  contentForm = signal({
    authorId: 1,
    genreId: 1,
    selectedThemeIds: [1],
    title: '',
    urTitle: '',
    urBody: '',
    hiTitle: '',
    hiBody: '',
    enTitle: '',
    enBody: ''
  });

  // Taxonomy Form Model
  genreForm = signal({ name: '', slug: '' });
  themeForm = signal({ name: '', slug: '' });
  scriptForm = signal({ code: '', name: '' });

  ngOnInit() {
    this.refreshAllData();
  }

  refreshAllData() {
    this.authorService.getEnrichedAuthors().subscribe({
      next: (res) => this.authors.set(res),
      error: () => this.authors.set([])
    });

    this.contentService.getEnrichedContents().subscribe({
      next: (res) => this.contents.set(res),
      error: () => this.contents.set([])
    });

    this.taxonomyService.filterGenres().subscribe({
      next: (res) => this.genres.set(res.data || []),
      error: () => this.genres.set([])
    });

    this.taxonomyService.filterThemes().subscribe({
      next: (res) => this.themes.set(res.data || []),
      error: () => this.themes.set([])
    });

    this.taxonomyService.filterScripts().subscribe({
      next: (res) => this.scripts.set(res.data || []),
      error: () => this.scripts.set([])
    });
  }

  // --- Seed Database Action ---
  runDatabaseSeed() {
    this.isSeeding.set(true);
    this.seedLogs.set(['Initiating database seed process...']);

    this.seedService.seedAllToBackend().subscribe({
      next: (logs) => {
        this.seedLogs.set(logs);
      },
      error: (err) => {
        this.isSeeding.set(false);
        this.seedLogs.update(l => [...l, `❌ Seeding stopped: ${err?.message || 'Error occurred'}`]);
      },
      complete: () => {
        this.isSeeding.set(false);
        this.showStatus('success', 'Rekhta classics seeded into Spring Boot database!');
        this.refreshAllData();
      }
    });
  }

  // --- Save Author with Multi-Script Details ---
  saveAuthorWithDetails() {
    const f = this.poetForm();
    if (!f.urName && !f.enName && !f.hiName) {
      this.showStatus('error', 'Please enter poet name.');
      return;
    }

    this.authorService.saveAuthor({ birthDate: f.birthDate, deathDate: f.deathDate }).subscribe({
      next: () => {
        this.showStatus('success', 'Author saved! Now adding multi-script details...');
        this.refreshAllData();
        this.poetForm.set({
          birthDate: '1800-01-01',
          deathDate: '1870-01-01',
          urName: '',
          urBio: '',
          hiName: '',
          hiBio: '',
          enName: '',
          enBio: ''
        });
      },
      error: (err) => this.showStatus('error', err?.error?.message || 'Failed to save author.')
    });
  }

  // --- Save Content with Multi-Script Texts ---
  saveContentWithTexts() {
    const f = this.contentForm();
    if (!f.title) {
      this.showStatus('error', 'Please enter a title for the Ghazal.');
      return;
    }

    this.contentService.saveContent({
      title: f.title,
      genreId: f.genreId,
      authorId: f.authorId,
      themeIds: f.selectedThemeIds
    }).subscribe({
      next: () => {
        this.showStatus('success', 'Ghazal created successfully!');
        this.refreshAllData();
      },
      error: (err) => this.showStatus('error', err?.error?.message || 'Failed to save content.')
    });
  }

  // --- Taxonomy Handlers ---
  saveGenre() {
    const f = this.genreForm();
    if (!f.name || !f.slug) return;
    this.taxonomyService.saveGenre({ name: f.name, slug: f.slug }).subscribe({
      next: () => {
        this.showStatus('success', 'Genre saved!');
        this.genreForm.set({ name: '', slug: '' });
        this.refreshAllData();
      },
      error: (err) => this.showStatus('error', 'Failed to save genre.')
    });
  }

  saveTheme() {
    const f = this.themeForm();
    if (!f.name || !f.slug) return;
    this.taxonomyService.saveTheme({ name: f.name, slug: f.slug }).subscribe({
      next: () => {
        this.showStatus('success', 'Theme saved!');
        this.themeForm.set({ name: '', slug: '' });
        this.refreshAllData();
      },
      error: (err) => this.showStatus('error', 'Failed to save theme.')
    });
  }

  saveScript() {
    const f = this.scriptForm();
    if (!f.name || !f.code) return;
    this.taxonomyService.saveScript({ code: f.code, name: f.name }).subscribe({
      next: () => {
        this.showStatus('success', 'Script saved!');
        this.scriptForm.set({ code: '', name: '' });
        this.refreshAllData();
      },
      error: (err) => this.showStatus('error', 'Failed to save script.')
    });
  }

  logoutAdmin() {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }

  private showStatus(type: 'success' | 'error', text: string) {
    this.statusMsg.set({ type, text });
    setTimeout(() => this.statusMsg.set(null), 4000);
  }
}

