import { Component, inject, signal, OnInit, computed } from '@angular/core';
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

export interface AdminUserItem {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'ACTIVE' | 'OFFLINE';
  lastActive: string;
}

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

  // Active Navigation Tab
  activeTab = signal<'content' | 'genres' | 'themes' | 'authors' | 'auth' | 'seed'>('content');
  isSidebarCollapsed = signal(false);
  searchQuery = signal('');

  // Modals & Forms Visibility
  showAddModal = signal(false);

  // Data Collections
  authors = signal<Author[]>([]);
  contents = signal<Content[]>([]);
  genres = signal<Genre[]>([]);
  themes = signal<Theme[]>([]);
  scripts = signal<Script[]>([]);

  // Platform Admins List
  adminUsers = signal<AdminUserItem[]>([
    { id: 1, name: 'Chief Diwan Admin', email: 'admin@unsiiyat.org', role: 'PLATFORM_ADMIN', status: 'ACTIVE', lastActive: 'Just now' },
    { id: 2, name: 'Rekhta Content Curator', email: 'curator@unsiiyat.org', role: 'CONTENT_EDITOR', status: 'ACTIVE', lastActive: '10 mins ago' },
    { id: 3, name: 'Lughat Linguist', email: 'linguist@unsiiyat.org', role: 'MODERATOR', status: 'ACTIVE', lastActive: '2 hours ago' }
  ]);

  // Feedback & Logs
  statusMsg = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  seedLogs = signal<string[]>([]);
  isSeeding = signal(false);

  // Forms
  contentForm = signal({
    title: '',
    authorId: 1,
    genreId: 1,
    selectedThemeIds: [1],
    urTitle: '',
    urBody: '',
    hiTitle: '',
    hiBody: '',
    enTitle: '',
    enBody: ''
  });

  genreForm = signal({ name: '', slug: '', description: '' });
  themeForm = signal({ name: '', slug: '', description: '' });

  poetForm = signal({
    birthDate: '1797-12-27',
    deathDate: '1869-02-15',
    urName: '',
    urBio: '',
    hiName: '',
    hiBio: '',
    enName: '',
    enBio: ''
  });

  newAdminForm = signal({
    name: '',
    email: '',
    password: '',
    role: 'PLATFORM_ADMIN'
  });

  ngOnInit() {
    this.refreshAllData();
  }

  toggleSidebar() {
    this.isSidebarCollapsed.update(v => !v);
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

  // Filtered lists based on search
  filteredContents = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.contents();
    return this.contents().filter(c => 
      (c.title || '').toLowerCase().includes(q) ||
      (c.primaryText?.title || '').toLowerCase().includes(q) ||
      (c.author?.primaryName || '').toLowerCase().includes(q)
    );
  });

  filteredGenres = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.genres();
    return this.genres().filter(g => 
      (g.name || '').toLowerCase().includes(q) ||
      (g.slug || '').toLowerCase().includes(q)
    );
  });

  filteredThemes = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.themes();
    return this.themes().filter(t => 
      (t.name || '').toLowerCase().includes(q) ||
      (t.slug || '').toLowerCase().includes(q)
    );
  });

  filteredAuthors = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.authors();
    return this.authors().filter(a => {
      const matchPrimary = (a.primaryName || '').toLowerCase().includes(q);
      const matchDetails = Array.isArray(a.details) && a.details.some(d => (d.name || '').toLowerCase().includes(q));
      return matchPrimary || matchDetails;
    });
  });

  getAuthorUrduName(a: Author): string {
    if (Array.isArray(a.details)) {
      const ur = a.details.find(d => d.scriptId === 1);
      if (ur?.name) return ur.name;
    }
    return a.primaryName || '';
  }

  filteredAdmins = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.adminUsers();
    return this.adminUsers().filter(u => 
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  // Actions
  openAddModal() {
    this.showAddModal.set(true);
  }

  closeAddModal() {
    this.showAddModal.set(false);
  }

  // --- Save Content ---
  saveContentWithTexts() {
    const f = this.contentForm();
    if (!f.title) {
      this.showStatus('error', 'Please enter a title for the Ghazal / Poem.');
      return;
    }

    this.contentService.saveContent({
      title: f.title,
      genreId: f.genreId,
      authorId: f.authorId,
      themeIds: f.selectedThemeIds
    }).subscribe({
      next: () => {
        this.showStatus('success', 'Ghazal successfully published to database!');
        this.closeAddModal();
        this.refreshAllData();
      },
      error: (err) => this.showStatus('error', err?.error?.message || 'Failed to save content.')
    });
  }

  // --- Save Genre ---
  saveGenre() {
    const f = this.genreForm();
    if (!f.name || !f.slug) {
      this.showStatus('error', 'Genre name and slug are required.');
      return;
    }
    this.taxonomyService.saveGenre({ name: f.name, slug: f.slug }).subscribe({
      next: () => {
        this.showStatus('success', `Genre "${f.name}" saved!`);
        this.genreForm.set({ name: '', slug: '', description: '' });
        this.closeAddModal();
        this.refreshAllData();
      },
      error: () => this.showStatus('error', 'Failed to save genre.')
    });
  }

  // --- Save Theme ---
  saveTheme() {
    const f = this.themeForm();
    if (!f.name || !f.slug) {
      this.showStatus('error', 'Theme name and slug are required.');
      return;
    }
    this.taxonomyService.saveTheme({ name: f.name, slug: f.slug }).subscribe({
      next: () => {
        this.showStatus('success', `Theme "${f.name}" saved!`);
        this.themeForm.set({ name: '', slug: '', description: '' });
        this.closeAddModal();
        this.refreshAllData();
      },
      error: () => this.showStatus('error', 'Failed to save theme.')
    });
  }

  // --- Save Author ---
  saveAuthorWithDetails() {
    const f = this.poetForm();
    if (!f.urName && !f.enName && !f.hiName) {
      this.showStatus('error', 'Please enter the poet name in at least one script.');
      return;
    }

    this.authorService.saveAuthor({ birthDate: f.birthDate, deathDate: f.deathDate }).subscribe({
      next: () => {
        this.showStatus('success', 'Shayar profile saved into database!');
        this.closeAddModal();
        this.refreshAllData();
      },
      error: (err) => this.showStatus('error', err?.error?.message || 'Failed to save author.')
    });
  }

  // --- Save New Admin ---
  saveAdminUser() {
    const f = this.newAdminForm();
    if (!f.email || !f.name) {
      this.showStatus('error', 'Name and email are required.');
      return;
    }

    const newUser: AdminUserItem = {
      id: this.adminUsers().length + 1,
      name: f.name,
      email: f.email,
      role: f.role,
      status: 'ACTIVE',
      lastActive: 'Just registered'
    };

    this.adminUsers.update(list => [...list, newUser]);
    this.showStatus('success', `Admin user "${f.name}" created successfully!`);
    this.newAdminForm.set({ name: '', email: '', password: '', role: 'PLATFORM_ADMIN' });
    this.closeAddModal();
  }

  // --- Run Database Seeder ---
  runDatabaseSeed() {
    this.isSeeding.set(true);
    this.seedLogs.set(['⚡ Initiating Rekhta database seed process...']);

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
        this.showStatus('success', 'All Rekhta classics populated into database successfully!');
        this.refreshAllData();
      }
    });
  }

  logoutAdmin() {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }

  private showStatus(type: 'success' | 'error', text: string) {
    this.statusMsg.set({ type, text });
    setTimeout(() => this.statusMsg.set(null), 4500);
  }
}
