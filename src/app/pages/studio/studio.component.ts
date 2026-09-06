import { Component, inject, signal, OnInit, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { ScriptService, ScriptCode } from '../../core/services/script.service';
import { AuthorService } from '../../core/services/author.service';
import { ContentService } from '../../core/services/content.service';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { SeedDataService } from '../../core/services/seed-data.service';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { Genre, Theme, Script } from '../../core/models/taxonomy.models';
import { Author } from '../../core/models/author.models';
import { Content, ContentText } from '../../core/models/content.models';

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
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authorService = inject(AuthorService);
  private readonly contentService = inject(ContentService);
  private readonly taxonomyService = inject(TaxonomyService);
  readonly seedService = inject(SeedDataService);

  private lastObservedScript: ScriptCode | null = null;

  constructor() {
    effect(() => {
      // Reactively reload active tab data ONLY when header script actually changes (Urdu, Hindi, English)
      const currentScript = this.scriptService.activeScript();
      const scriptId = this.scriptService.getScriptId(currentScript);

      if (this.lastObservedScript === null) {
        // Initial run: skip to let ngOnInit handle clean initial loading
        this.lastObservedScript = currentScript;
        return;
      }

      if (this.lastObservedScript === currentScript) {
        return;
      }
      this.lastObservedScript = currentScript;

      untracked(() => {
        if (this.activeTab() === 'content') {
          this.loadContents(scriptId);
        } else if (this.activeTab() === 'authors') {
          this.loadAuthors(scriptId);
        }
      });
    });
  }

  // Active Navigation Tab
  activeTab = signal<'content' | 'genres' | 'themes' | 'authors' | 'auth' | 'seed'>('content');
  isSidebarCollapsed = signal(false);
  searchQuery = signal('');

  // Content Tab Dedicated Filters (Poem Title, Author Search & Genre Dropdown)
  contentTitleSearch = signal<string>('');
  contentAuthorSearch = signal<string>('');
  contentGenreFilter = signal<string | number>('');

  // Modals & Forms Visibility
  showAddModal = signal(false);
  contentCreationStep = signal<'select-genre' | 'editor'>('select-genre');
  genreSearchQuery = signal('');
  showInlineGenreCreate = signal(false);
  inlineGenreName = signal('');
  inlineGenreSlug = signal('');

  // Author Search Box in Content Modal
  authorSearchQuery = signal<string>('');
  isAuthorDropdownOpen = signal<boolean>(false);
  allModalAuthors = signal<Author[]>([]);

  // Data Collections
  authors = signal<Author[]>([]);
  contents = signal<Content[]>([]);
  genres = signal<Genre[]>(this.seedService.initialGenres);
  themes = signal<Theme[]>(this.seedService.initialThemes);
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

  // Pagination State (Size = 10 per module)
  readonly Math = Math;
  readonly pageSize = 10;

  contentPage = signal<number>(0);
  contentTotalElements = signal<number>(0);
  contentTotalPages = signal<number>(1);

  genrePage = signal<number>(0);
  genreTotalElements = signal<number>(0);
  genreTotalPages = signal<number>(1);

  themePage = signal<number>(0);
  themeTotalElements = signal<number>(0);
  themeTotalPages = signal<number>(1);

  authorPage = signal<number>(0);
  authorTotalElements = signal<number>(0);
  authorTotalPages = signal<number>(1);

  adminPage = signal<number>(0);
  readonly adminTotalPages = computed(() => Math.ceil(this.filteredAdmins().length / this.pageSize) || 1);
  readonly pagedAdmins = computed(() => {
    const start = this.adminPage() * this.pageSize;
    return this.filteredAdmins().slice(start, start + this.pageSize);
  });

  editingContentId = signal<number | null>(null);
  editingGenreId = signal<number | null>(null);
  editingThemeId = signal<number | null>(null);
  editingAuthorId = signal<number | null>(null);

  // Forms
  contentForm = signal<{
    id?: number;
    title: string;
    authorId: number;
    genreId: number;
    selectedThemeIds: number[];
    urTitle: string;
    urBody: string;
    hiTitle: string;
    hiBody: string;
    enTitle: string;
    enBody: string;
  }>({
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

  activeScriptEditorTab = signal<'ur' | 'hi' | 'en'>('ur');
  showCoupletPreview = signal<boolean>(true);
  isSavingContent = signal<boolean>(false);

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
    role: 'ADMIN'
  });

  ngOnInit() {
    this.loadActiveTabData();
    this.route.queryParams.subscribe(params => {
      const editId = Number(params['editContentId']);
      if (editId) {
        this.contentService.getContentDetailById(editId).subscribe({
          next: (item) => {
            if (item) {
              this.openEditContentModal(item);
            }
          }
        });
      }
    });
  }

  toggleSidebar() {
    this.isSidebarCollapsed.update(v => !v);
  }

  // --- Theme Selection Helpers ---
  isThemeSelected(themeId: number | undefined): boolean {
    if (!themeId) return false;
    return this.contentForm().selectedThemeIds.includes(themeId);
  }

  toggleThemeSelection(themeId: number | undefined) {
    if (!themeId) return;
    this.contentForm.update(form => {
      const current = [...form.selectedThemeIds];
      const idx = current.indexOf(themeId);
      if (idx > -1) {
        current.splice(idx, 1);
      } else {
        current.push(themeId);
      }
      return { ...form, selectedThemeIds: current };
    });
  }

  // --- Smart Couplet Splitter & Line Analyzer ---
  getActiveScriptBody(): string {
    const tab = this.activeScriptEditorTab();
    const f = this.contentForm();
    if (tab === 'ur') return f.urBody;
    if (tab === 'hi') return f.hiBody;
    return f.enBody;
  }

  getActiveScriptTitle(): string {
    const tab = this.activeScriptEditorTab();
    const f = this.contentForm();
    if (tab === 'ur') return f.urTitle;
    if (tab === 'hi') return f.hiTitle;
    return f.enTitle;
  }

  updateActiveScriptTitle(val: string) {
    const tab = this.activeScriptEditorTab();
    this.contentForm.update(f => {
      if (tab === 'ur') return { ...f, urTitle: val };
      if (tab === 'hi') return { ...f, hiTitle: val };
      return { ...f, enTitle: val };
    });
  }

  updateActiveScriptBody(val: string) {
    const tab = this.activeScriptEditorTab();
    this.contentForm.update(f => {
      if (tab === 'ur') return { ...f, urBody: val };
      if (tab === 'hi') return { ...f, hiBody: val };
      return { ...f, enBody: val };
    });
  }

  formatCoupletsForActiveScript() {
    const tab = this.activeScriptEditorTab();
    const raw = this.getActiveScriptBody();
    if (!raw.trim()) return;

    // Split lines, trim each, filter empty
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const couplets: string[] = [];
    
    for (let i = 0; i < lines.length; i += 2) {
      if (i + 1 < lines.length) {
        couplets.push(`${lines[i]}\n${lines[i + 1]}`);
      } else {
        couplets.push(lines[i]);
      }
    }

    const formatted = couplets.join('\n\n');
    this.updateActiveScriptBody(formatted);
    this.showStatus('success', `✨ Formatted into ${Math.ceil(lines.length / 2)} Ash'ar (${lines.length} Misre).`);
  }

  getCoupletStats(text: string): { lines: number; couplets: number } {
    if (!text || !text.trim()) return { lines: 0, couplets: 0 };
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    return {
      lines: lines.length,
      couplets: Math.ceil(lines.length / 2)
    };
  }

  getParsedCouplets(text: string): string[][] {
    if (!text || !text.trim()) return [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const result: string[][] = [];
    for (let i = 0; i < lines.length; i += 2) {
      if (i + 1 < lines.length) {
        result.push([lines[i], lines[i + 1]]);
      } else {
        result.push([lines[i], '']);
      }
    }
    return result;
  }

  // --- Tab & Data Management (On-Demand / Page-Specific Loading) ---
  switchTab(tab: 'content' | 'genres' | 'themes' | 'authors' | 'auth' | 'seed') {
    this.activeTab.set(tab);
    this.searchQuery.set('');
    this.resetContentFilters();
    this.loadActiveTabData(tab);
  }

  resetContentFilters() {
    this.contentTitleSearch.set('');
    this.contentAuthorSearch.set('');
    this.contentGenreFilter.set('');
  }

  loadActiveTabData(tab: 'content' | 'genres' | 'themes' | 'authors' | 'auth' | 'seed' = this.activeTab(), scriptId?: number) {
    switch (tab) {
      case 'content':
        this.loadContents(scriptId);
        break;
      case 'genres':
        this.loadGenres();
        break;
      case 'themes':
        this.loadThemes();
        break;
      case 'authors':
        this.loadAuthors(scriptId);
        break;
      case 'seed':
        break;
      case 'auth':
        this.loadAdmins();
        break;
    }
  }

  loadContents(scriptId?: number, page: number = this.contentPage()) {
    const currentScriptId = scriptId ?? this.scriptService.getScriptId(this.scriptService.activeScript());
    this.contentService.getEnrichedContentsPaged(currentScriptId, { page, size: this.pageSize }).subscribe({
      next: (res) => {
        this.contents.set(res.data || []);
        this.contentTotalElements.set(res.totalElements ?? res.data?.length ?? 0);
        this.contentTotalPages.set(res.totalPages || (res.data?.length ? 1 : 1));
        this.contentPage.set(res.page ?? page);
      },
      error: () => {
        this.contents.set([]);
        this.contentTotalElements.set(0);
        this.contentTotalPages.set(1);
      }
    });
  }

  loadGenres(page: number = this.genrePage()) {
    this.taxonomyService.filterGenres({ page, size: this.pageSize }).subscribe({
      next: (res) => {
        const list = res.data?.length ? res.data : this.seedService.initialGenres;
        this.genres.set(list);
        this.genreTotalElements.set(res.totalElements ?? list.length);
        this.genreTotalPages.set(res.totalPages || 1);
        this.genrePage.set(res.page ?? page);
      },
      error: () => {
        this.genres.set(this.seedService.initialGenres);
        this.genreTotalElements.set(this.seedService.initialGenres.length);
        this.genreTotalPages.set(1);
      }
    });
  }

  loadThemes(page: number = this.themePage()) {
    this.taxonomyService.filterThemes({ page, size: this.pageSize }).subscribe({
      next: (res) => {
        const list = res.data?.length ? res.data : this.seedService.initialThemes;
        this.themes.set(list);
        this.themeTotalElements.set(res.totalElements ?? list.length);
        this.themeTotalPages.set(res.totalPages || 1);
        this.themePage.set(res.page ?? page);
      },
      error: () => {
        this.themes.set(this.seedService.initialThemes);
        this.themeTotalElements.set(this.seedService.initialThemes.length);
        this.themeTotalPages.set(1);
      }
    });
  }

  loadAuthors(scriptId?: number, page: number = this.authorPage()) {
    const currentScriptId = scriptId ?? this.scriptService.getScriptId(this.scriptService.activeScript());
    this.authorService.getEnrichedAuthorsPaged(currentScriptId, { page, size: this.pageSize }).subscribe({
      next: (res) => {
        this.authors.set(res.data || []);
        this.authorTotalElements.set(res.totalElements ?? res.data?.length ?? 0);
        this.authorTotalPages.set(res.totalPages || 1);
        this.authorPage.set(res.page ?? page);
      },
      error: () => {
        this.authors.set([]);
        this.authorTotalElements.set(0);
        this.authorTotalPages.set(1);
      }
    });
  }

  loadScripts() {
    this.taxonomyService.filterScripts().subscribe({
      next: (res) => this.scripts.set(res.data || []),
      error: () => this.scripts.set([])
    });
  }

  // --- Pagination Event Handlers ---
  onContentPageChange(newPage: number) {
    if (newPage < 0 || newPage >= this.contentTotalPages() || newPage === this.contentPage()) return;
    this.contentPage.set(newPage);
    this.loadContents(undefined, newPage);
  }

  onGenrePageChange(newPage: number) {
    if (newPage < 0 || newPage >= this.genreTotalPages() || newPage === this.genrePage()) return;
    this.genrePage.set(newPage);
    this.loadGenres(newPage);
  }

  onThemePageChange(newPage: number) {
    if (newPage < 0 || newPage >= this.themeTotalPages() || newPage === this.themePage()) return;
    this.themePage.set(newPage);
    this.loadThemes(newPage);
  }

  onAuthorPageChange(newPage: number) {
    if (newPage < 0 || newPage >= this.authorTotalPages() || newPage === this.authorPage()) return;
    this.authorPage.set(newPage);
    this.loadAuthors(undefined, newPage);
  }

  onAdminPageChange(newPage: number) {
    if (newPage < 0 || newPage >= this.adminTotalPages() || newPage === this.adminPage()) return;
    this.adminPage.set(newPage);
  }

  getPageNumbers(currentPage: number, totalPages: number): number[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }
    const start = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
    const end = Math.min(totalPages, start + 5);
    const pages: number[] = [];
    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    return pages;
  }

  loadSupportingModalData() {
    this.taxonomyService.getAllGenres().subscribe({
      next: (g) => { if (g && g.length) this.genres.set(g); }
    });
    this.taxonomyService.getAllThemes().subscribe({
      next: (t) => { if (t && t.length) this.themes.set(t); }
    });
    if (this.scripts().length === 0) this.loadScripts();

    if (this.allModalAuthors().length === 0) {
      this.authorService.getEnrichedAuthors().subscribe({
        next: (authors) => {
          this.allModalAuthors.set(authors);
          if (this.authors().length === 0) this.authors.set(authors);
          this.syncAuthorSearchInput();
        },
        error: () => {
          this.allModalAuthors.set(this.authors());
          this.syncAuthorSearchInput();
        }
      });
    } else {
      this.syncAuthorSearchInput();
    }
  }

  refreshAllData(scriptId?: number) {
    const currentScriptId = scriptId ?? this.scriptService.getScriptId(this.scriptService.activeScript());
    this.loadAuthors(currentScriptId);
    this.loadContents(currentScriptId);
    this.loadGenres();
    this.loadThemes();
    this.loadScripts();
  }

  // Multi-script Dynamic Content Extractors
  getContentTitleForActiveScript(item: Content): string {
    const currentScript = this.scriptService.activeScript();
    const allTexts = (item.texts || (item as any).contentTexts || []) as ContentText[];

    // 1. Dynamic check with ScriptService (DB ID + Unicode detection)
    if (allTexts.length > 0) {
      const match = allTexts.find(t => this.scriptService.isScriptMatch(t, currentScript));
      if (match?.title?.trim()) {
        return match.title.trim();
      }
    }

    // 2. Check seed classical poems by content id
    const seedItem = this.seedService.classicalPoems.find(p => p.id === item.id);
    if (seedItem?.texts?.[currentScript]?.title?.trim()) {
      return seedItem.texts[currentScript].title.trim();
    }

    // 3. Fallback to primaryText if matches script
    if (item.primaryText?.title?.trim() && this.scriptService.isScriptMatch(item.primaryText, currentScript)) {
      return item.primaryText.title.trim();
    }

    return item.primaryText?.title || item.title || 'Untitled Poem';
  }

  getContentBodySnippetForActiveScript(item: Content): string {
    const currentScript = this.scriptService.activeScript();
    const allTexts = (item.texts || (item as any).contentTexts || []) as ContentText[];

    // 1. Dynamic check with ScriptService
    if (allTexts.length > 0) {
      const match = allTexts.find(t => this.scriptService.isScriptMatch(t, currentScript));
      if (match?.body?.trim()) {
        const firstLine = match.body.trim().split('\n')[0].trim();
        if (firstLine) return firstLine;
      }
    }

    // 2. Check seed classical poems
    const seedItem = this.seedService.classicalPoems.find(p => p.id === item.id);
    if (seedItem?.texts?.[currentScript]?.body?.trim()) {
      const firstLine = seedItem.texts[currentScript].body.trim().split('\n')[0].trim();
      if (firstLine) return firstLine;
    }

    if (item.primaryText?.body?.trim()) {
      return item.primaryText.body.trim().split('\n')[0].trim();
    }

    return '';
  }

  getAuthorNameForActiveScript(author?: Author, authorId?: number): string {
    const currentScript = this.scriptService.activeScript();
    const scriptId = this.scriptService.getScriptId(currentScript);

    const targetAuthor = author || (authorId ? this.authors().find(a => a.id === authorId) : undefined);

    if (targetAuthor) {
      if (currentScript === 'ur' && (targetAuthor as any).urName?.trim()) {
        return (targetAuthor as any).urName.trim();
      }
      if (currentScript === 'hi' && (targetAuthor as any).hiName?.trim()) {
        return (targetAuthor as any).hiName.trim();
      }
      if (currentScript === 'en' && (targetAuthor as any).enName?.trim()) {
        return (targetAuthor as any).enName.trim();
      }

      if (Array.isArray(targetAuthor.details) && targetAuthor.details.length > 0) {
        const detail = targetAuthor.details.find(d => this.scriptService.isScriptMatch({ scriptId: d.scriptId, title: d.name, body: d.biography }, currentScript));
        if (detail?.name?.trim()) {
          return detail.name.trim();
        }
        if (targetAuthor.details[0]?.name?.trim()) {
          return targetAuthor.details[0].name.trim();
        }
      }

      if (targetAuthor.primaryName?.trim()) {
        return targetAuthor.primaryName.trim();
      }
      if (targetAuthor.name?.trim()) {
        return targetAuthor.name.trim();
      }

      const seedPoet = this.seedService.classicalPoets.find(p => p.id === targetAuthor.id);
      if (seedPoet?.details?.[currentScript]?.name?.trim()) {
        return seedPoet.details[currentScript].name.trim();
      }
    }

    if (authorId) {
      const seedPoet = this.seedService.classicalPoets.find(p => p.id === authorId);
      if (seedPoet?.details?.[currentScript]?.name?.trim()) {
        return seedPoet.details[currentScript].name.trim();
      }
      return 'Shayar';
    }

    return 'Shayar';
  }

  getGenreNameForActiveScript(genreId?: number, genre?: Genre): string {
    const currentScript = this.scriptService.activeScript();
    const targetGenre = genre || (genreId ? this.genres().find(g => g.id === genreId) : undefined);
    const slug = (targetGenre?.slug || (genreId === 1 ? 'ghazal' : genreId === 2 ? 'nazm' : genreId === 3 ? 'sher' : genreId === 4 ? 'rubai' : '')).toLowerCase();

    const genreMap: Record<string, Record<ScriptCode, string>> = {
      'ghazal': { ur: 'غزل', hi: 'ग़ज़ल', en: 'Ghazal' },
      'nazm': { ur: 'نظم', hi: 'नज़्म', en: 'Nazm' },
      'sher': { ur: 'شعر', hi: 'शेर', en: 'Sher' },
      'ashar': { ur: 'اشعار', hi: 'अशआर', en: "Ash'ar" },
      'rubai': { ur: 'رباعی', hi: 'रुबाई', en: 'Rubai' },
      'qasida': { ur: 'قصیدہ', hi: 'क़सीदा', en: 'Qasida' },
      'marsiya': { ur: 'مرثیہ', hi: 'मर्सिया', en: 'Marsiya' },
      'masnavi': { ur: 'مثنوی', hi: 'मसनवी', en: 'Masnavi' },
      'qita': { ur: 'قطعہ', hi: 'क़तआ', en: 'Qita' },
      'hamd': { ur: 'حمد', hi: 'हम्द', en: 'Hamd' },
      'naat': { ur: 'نعت', hi: 'नात', en: 'Naat' }
    };

    if (slug && genreMap[slug]?.[currentScript]) {
      return genreMap[slug][currentScript];
    }

    if (targetGenre?.name) {
      const parts = targetGenre.name.split('/').map(p => p.trim());
      if (parts.length === 3) {
        if (currentScript === 'ur') return parts[0];
        if (currentScript === 'hi') return parts[1];
        if (currentScript === 'en') return parts[2];
      }
      return targetGenre.name;
    }

    return currentScript === 'ur' ? 'غزل' : (currentScript === 'hi' ? 'ग़ज़ल' : 'Ghazal');
  }

  getGenreDescriptionForActiveScript(g: Genre): string {
    const lang = this.scriptService.activeScript();
    const slug = (g.slug || '').toLowerCase();
    
    const descMap: Record<string, Record<ScriptCode, string>> = {
      ghazal: {
        ur: 'مطلع، مقطع، ردیف اور قافیہ پر مشتمل روایتی کلام۔',
        hi: 'मतला, मक़्ता, रदीफ़ और क़ाफ़िया से सजी शास्त्रीय विधा।',
        en: 'Classical rhymed stanzas with Matla, Maqta, Radif & Qafiya.'
      },
      nazm: {
        ur: 'ایک ہی مرکزی خیال اور موضوع پر لکھی گئی آزاد یا پابند شاعری۔',
        hi: 'एक ही विषय और केंद्रीय विचार पर रचित कविता।',
        en: 'Thematic descriptive poem with a unified subject matter.'
      },
      sher: {
        ur: 'دو مصرعوں پر مشتمل مکمل معنی خیز شعر۔',
        hi: 'दो पंक्तियों में संपूर्ण भाव समेटे हुआ शेर।',
        en: 'Self-contained standalone couplet expressing complete thought.'
      },
      rubai: {
        ur: 'چار مصرعوں پر مشتمل مختصر اور جامع صنفِ سخن۔',
        hi: 'चार पंक्तियों की संक्षिप्त एवं प्रभावशाली विधा।',
        en: 'A distinct four-line poetic stanza with deep philosophical essence.'
      }
    };

    return descMap[slug]?.[lang] || descMap[slug]?.['en'] || (lang === 'ur' ? 'کلاسیکی صنفِ سخن' : (lang === 'hi' ? 'शास्त्रीय काव्य विधा' : 'Classical poetic verse form.'));
  }

  getThemeNameForActiveScript(theme: Theme): string {
    const currentScript = this.scriptService.activeScript();
    const slug = (theme.slug || '').toLowerCase();

    const themeMap: Record<string, Record<ScriptCode, string>> = {
      'ishq': { ur: 'عشق و محبت', hi: 'इश्क़ व मोहब्बत', en: 'Love (Ishq)' },
      'dard': { ur: 'درد و الم', hi: 'दर्द व अलम', en: 'Heartbreak & Pain' },
      'tanhai': { ur: 'تنہائی', hi: 'तन्हाई', en: 'Solitude & Longing' },
      'zindagi': { ur: 'فلسفہ و زندگی', hi: 'फ़लसफ़ा व ज़िंदगी', en: 'Life & Philosophy' },
      'sufi': { ur: 'تصوف و روحانیت', hi: 'तसव्वुफ़ व रूहानियत', en: 'Sufism & Mysticism' },
      'judai': { ur: 'جدائی و ہجر', hi: 'जुदाई व हिज्र', en: 'Separation & Distance' },
      'inqilab': { ur: 'امید و انقلاب', hi: 'उम्मीद व इंक़लाब', en: 'Hope & Revolution' }
    };

    if (slug && themeMap[slug]?.[currentScript]) {
      return themeMap[slug][currentScript];
    }

    if (theme.name) {
      return theme.name;
    }
    return theme.slug || 'Theme';
  }

  getContentFontClass(item: Content): string {
    const currentScript = this.scriptService.activeScript();
    if (currentScript === 'ur') return 'font-urdu';
    if (currentScript === 'hi') return 'font-hindi';
    return 'font-english';
  }

  getContentDirection(item: Content): 'rtl' | 'ltr' {
    return this.scriptService.activeScript() === 'ur' ? 'rtl' : 'ltr';
  }

  getAuthorSecondaryName(a: Author): string {
    const currentScript = this.scriptService.activeScript();
    if (currentScript === 'ur') {
      if ((a as any).enName?.trim()) return (a as any).enName.trim();
      const en = a.details?.find(d => this.scriptService.isScriptMatch({ scriptId: d.scriptId, title: d.name, body: d.biography }, 'en'));
      if (en?.name?.trim()) return en.name.trim();
      if (a.primaryName?.trim()) return a.primaryName.trim();
      if ((a as any).name?.trim()) return (a as any).name.trim();
      const seedPoet = this.seedService.classicalPoets.find(p => p.id === a.id);
      if (seedPoet?.details?.en?.name) return seedPoet.details.en.name;
      return '';
    } else {
      if ((a as any).urName?.trim()) return (a as any).urName.trim();
      const ur = a.details?.find(d => this.scriptService.isScriptMatch({ scriptId: d.scriptId, title: d.name, body: d.biography }, 'ur'));
      if (ur?.name?.trim()) return ur.name.trim();
      return this.getAuthorUrduName(a);
    }
  }

  getAuthorSecondaryFontClass(): string {
    return this.scriptService.activeScript() === 'ur' ? 'font-english' : 'font-urdu';
  }

  // Filtered lists based on search
  filteredContents = computed(() => {
    let items = this.contents();

    // 1. Filter by Genre Dropdown
    const genreVal = this.contentGenreFilter();
    if (genreVal !== '' && genreVal !== null && genreVal !== undefined) {
      const gId = Number(genreVal);
      items = items.filter(c => c.genreId === gId || c.genre?.id === gId);
    }

    // 2. Filter by Poem Title Search Box
    const titleQ = this.contentTitleSearch().toLowerCase().trim();
    if (titleQ) {
      items = items.filter(c => {
        const t1 = (c.title || '').toLowerCase();
        const t2 = (this.getContentTitleForActiveScript(c) || '').toLowerCase();
        const t3 = (this.getContentBodySnippetForActiveScript(c) || '').toLowerCase();
        const t4 = (c.primaryText?.title || '').toLowerCase();
        return t1.includes(titleQ) || t2.includes(titleQ) || t3.includes(titleQ) || t4.includes(titleQ);
      });
    }

    // 3. Filter by Author / Shayar Search Box
    const authorQ = this.contentAuthorSearch().toLowerCase().trim();
    if (authorQ) {
      items = items.filter(c => {
        const targetAuthor = c.author || (c.authorId ? this.authors().find(a => a.id === c.authorId) : undefined);
        const aActive = (this.getAuthorNameForActiveScript(c.author, c.authorId) || '').toLowerCase();
        const aPrimary = (targetAuthor?.primaryName || '').toLowerCase();
        const aName = (targetAuthor?.name || '').toLowerCase();
        const aUr = ((targetAuthor as any)?.urName || '').toLowerCase();
        const aHi = ((targetAuthor as any)?.hiName || '').toLowerCase();
        const aEn = ((targetAuthor as any)?.enName || '').toLowerCase();

        let detailsMatch = false;
        if (targetAuthor?.details && Array.isArray(targetAuthor.details)) {
          detailsMatch = targetAuthor.details.some(d => (d.name || '').toLowerCase().includes(authorQ));
        }

        return aActive.includes(authorQ) ||
               aPrimary.includes(authorQ) ||
               aName.includes(authorQ) ||
               aUr.includes(authorQ) ||
               aHi.includes(authorQ) ||
               aEn.includes(authorQ) ||
               detailsMatch;
      });
    }

    // 4. Global fallback search query if active
    const globalQ = this.searchQuery().toLowerCase().trim();
    if (globalQ && this.activeTab() === 'content') {
      items = items.filter(c => 
        (c.title || '').toLowerCase().includes(globalQ) ||
        (this.getContentTitleForActiveScript(c) || '').toLowerCase().includes(globalQ) ||
        (this.getContentBodySnippetForActiveScript(c) || '').toLowerCase().includes(globalQ) ||
        (this.getAuthorNameForActiveScript(c.author, c.authorId) || '').toLowerCase().includes(globalQ) ||
        (c.primaryText?.title || '').toLowerCase().includes(globalQ) ||
        (c.author?.primaryName || '').toLowerCase().includes(globalQ)
      );
    }

    return items;
  });

  filteredGenres = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.genres();
    return this.genres().filter(g => 
      (g.name || '').toLowerCase().includes(q) ||
      (this.getGenreNameForActiveScript(g.id, g) || '').toLowerCase().includes(q) ||
      (g.slug || '').toLowerCase().includes(q)
    );
  });

  filteredSelectionGenres = computed(() => {
    const q = this.genreSearchQuery().toLowerCase().trim();
    const all = this.genres();
    if (!q) return all;
    return all.filter(g => 
      (g.name || '').toLowerCase().includes(q) ||
      (this.getGenreNameForActiveScript(g.id, g) || '').toLowerCase().includes(q) ||
      (g.slug || '').toLowerCase().includes(q)
    );
  });

  filteredThemes = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.themes();
    return this.themes().filter(t => 
      (t.name || '').toLowerCase().includes(q) ||
      (this.getThemeNameForActiveScript(t) || '').toLowerCase().includes(q) ||
      (t.slug || '').toLowerCase().includes(q)
    );
  });

  filteredAuthors = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.authors();
    return this.authors().filter(a => {
      const matchPrimary = (a.primaryName || '').toLowerCase().includes(q);
      const matchActiveName = (this.getAuthorNameForActiveScript(a, a.id) || '').toLowerCase().includes(q);
      const matchDetails = Array.isArray(a.details) && a.details.some(d => (d.name || '').toLowerCase().includes(q));
      return matchPrimary || matchActiveName || matchDetails;
    });
  });

  getAuthorAvatarUrl(a: Author): string | null {
    if (!a?.id) return null;
    return localStorage.getItem(`author_avatar_${a.id}`) || a.avatarUrl || null;
  }

  getAuthorUrduName(a: Author): string {
    if ((a as any).urName?.trim()) return (a as any).urName.trim();
    if (Array.isArray(a.details)) {
      const ur = a.details.find(d => this.scriptService.isScriptMatch({ scriptId: d.scriptId, title: d.name, body: d.biography }, 'ur'));
      if (ur?.name?.trim()) return ur.name.trim();
    }
    const seedPoet = this.seedService.classicalPoets.find(p => p.id === a.id);
    if (seedPoet?.details?.ur?.name) return seedPoet.details.ur.name;
    return a.primaryName || (a as any).name || '';
  }

  // Filtered authors for the searchable input in Content Modal
  filteredModalAuthors = computed(() => {
    const q = this.authorSearchQuery().toLowerCase().trim();
    const list = this.allModalAuthors().length > 0 ? this.allModalAuthors() : this.authors();
    if (!q) return list;
    return list.filter(a => {
      const primary = (a.primaryName || a.name || '').toLowerCase();
      const ur = (this.getAuthorUrduName(a) || '').toLowerCase();
      const en = (a.enName || '').toLowerCase();
      const hi = (a.hiName || '').toLowerCase();
      const details = Array.isArray(a.details) ? a.details.map(d => (d.name || '').toLowerCase()).join(' ') : '';
      return primary.includes(q) || ur.includes(q) || en.includes(q) || hi.includes(q) || details.includes(q);
    });
  });

  getAuthorDisplayLabel(author?: Author): string {
    if (!author) return '';
    const urdu = this.getAuthorUrduName(author);
    const name = author.primaryName || author.name || 'Unknown Poet';
    return urdu && urdu !== name ? `${name} (${urdu})` : name;
  }

  syncAuthorSearchInput() {
    const currentAuthorId = this.contentForm().authorId;
    const list = this.allModalAuthors().length > 0 ? this.allModalAuthors() : this.authors();
    const current = list.find(a => a.id === currentAuthorId) || (currentAuthorId ? { id: currentAuthorId, primaryName: `Poet #${currentAuthorId}` } as Author : list[0]);
    if (current) {
      this.authorSearchQuery.set(this.getAuthorDisplayLabel(current));
    }
  }

  openAuthorDropdown() {
    this.isAuthorDropdownOpen.set(true);
  }

  toggleAuthorDropdown(event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.isAuthorDropdownOpen.update(v => !v);
  }

  onAuthorSearchInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.authorSearchQuery.set(val);
    this.isAuthorDropdownOpen.set(true);
  }

  selectAuthor(author: Author) {
    if (!author?.id) return;
    this.contentForm.update(f => ({ ...f, authorId: author.id! }));
    this.authorSearchQuery.set(this.getAuthorDisplayLabel(author));
    this.isAuthorDropdownOpen.set(false);
  }

  clearAuthorSearch(event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.authorSearchQuery.set('');
    this.isAuthorDropdownOpen.set(true);
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
    this.editingContentId.set(null);
    this.editingGenreId.set(null);
    this.editingThemeId.set(null);
    this.editingAuthorId.set(null);

    if (this.activeTab() === 'content') {
      this.loadSupportingModalData();
      this.contentCreationStep.set('select-genre');
      this.genreSearchQuery.set('');
      this.showInlineGenreCreate.set(false);
      this.contentForm.set({
        id: undefined,
        title: '',
        authorId: this.authors()[0]?.id || 1,
        genreId: this.genres()[0]?.id || 1,
        selectedThemeIds: [this.themes()[0]?.id || 1],
        urTitle: '',
        urBody: '',
        hiTitle: '',
        hiBody: '',
        enTitle: '',
        enBody: ''
      });
      this.syncAuthorSearchInput();
    } else if (this.activeTab() === 'genres') {
      this.genreForm.set({ name: '', slug: '', description: '' });
    } else if (this.activeTab() === 'themes') {
      this.themeForm.set({ name: '', slug: '', description: '' });
    } else if (this.activeTab() === 'authors') {
      this.poetForm.set({
        birthDate: '',
        deathDate: '',
        urName: '',
        urBio: '',
        hiName: '',
        hiBio: '',
        enName: '',
        enBio: ''
      });
    }
    this.showAddModal.set(true);
  }

  closeAddModal() {
    this.showAddModal.set(false);
    this.editingContentId.set(null);
    this.editingGenreId.set(null);
    this.editingThemeId.set(null);
    this.editingAuthorId.set(null);
  }

  openEditGenreModal(genre: Genre) {
    if (!genre || !genre.id) return;
    this.editingGenreId.set(genre.id);
    this.activeTab.set('genres');
    this.genreForm.set({
      name: genre.name || '',
      slug: genre.slug || '',
      description: (genre as any).description || ''
    });
    this.showAddModal.set(true);
  }

  openEditThemeModal(theme: Theme) {
    if (!theme || !theme.id) return;
    this.editingThemeId.set(theme.id);
    this.activeTab.set('themes');
    this.themeForm.set({
      name: theme.name || '',
      slug: theme.slug || '',
      description: (theme as any).description || ''
    });
    this.showAddModal.set(true);
  }

  openEditAuthorModal(author: Author) {
    if (!author || !author.id) return;
    this.editingAuthorId.set(author.id);
    this.activeTab.set('authors');

    const details = author.details || (author as any).authorDetails || [];
    const urDetail = details.find((d: any) => this.scriptService.isScriptMatch({ scriptId: d.scriptId, title: d.name, body: d.biography }, 'ur'));
    const hiDetail = details.find((d: any) => this.scriptService.isScriptMatch({ scriptId: d.scriptId, title: d.name, body: d.biography }, 'hi'));
    const enDetail = details.find((d: any) => this.scriptService.isScriptMatch({ scriptId: d.scriptId, title: d.name, body: d.biography }, 'en'));

    this.poetForm.set({
      birthDate: author.birthDate || '',
      deathDate: author.deathDate || '',
      urName: author.urName || urDetail?.name || '',
      urBio: urDetail?.biography || author.primaryBio || '',
      hiName: author.hiName || hiDetail?.name || '',
      hiBio: hiDetail?.biography || '',
      enName: author.enName || enDetail?.name || author.primaryName || author.name || '',
      enBio: enDetail?.biography || ''
    });
    this.showAddModal.set(true);
  }

  openEditContentModal(item: Content) {
    if (!item || !item.id) return;

    this.loadSupportingModalData();
    this.editingContentId.set(item.id);
    this.activeTab.set('content');
    this.contentCreationStep.set('editor');

    const allTexts = item.texts || item.contentTexts || [];
    const urText = allTexts.find(t => this.scriptService.isScriptMatch(t, 'ur'));
    const hiText = allTexts.find(t => this.scriptService.isScriptMatch(t, 'hi'));
    const enText = allTexts.find(t => this.scriptService.isScriptMatch(t, 'en'));

    if (!urText && !hiText && !enText) {
      this.contentService.filterContentTexts({ contentId: item.id }).subscribe({
        next: (res) => {
          const texts = res.data || [];
          const ur = texts.find(t => this.scriptService.isScriptMatch(t, 'ur'));
          const hi = texts.find(t => this.scriptService.isScriptMatch(t, 'hi'));
          const en = texts.find(t => this.scriptService.isScriptMatch(t, 'en'));
          this.populateContentForm(item, ur, hi, en);
          this.showAddModal.set(true);
        },
        error: () => {
          this.populateContentForm(item, urText, hiText, enText);
          this.showAddModal.set(true);
        }
      });
    } else {
      this.populateContentForm(item, urText, hiText, enText);
      this.showAddModal.set(true);
    }
  }

  private populateContentForm(item: Content, ur?: ContentText, hi?: ContentText, en?: ContentText) {
    const authorId = item.authorId || item.author?.id || this.authors()[0]?.id || 1;
    const genreId = item.genreId || item.genre?.id || this.genres()[0]?.id || 1;
    const themeIds = (item.themeIds && item.themeIds.length > 0)
      ? item.themeIds
      : (item.themes && item.themes.length > 0 ? item.themes.map(t => t.id!).filter(Boolean) : [this.themes()[0]?.id || 1]);

    this.contentForm.set({
      id: item.id,
      title: item.title || '',
      authorId,
      genreId,
      selectedThemeIds: themeIds,
      urTitle: ur?.title || item.title || '',
      urBody: ur?.body || '',
      hiTitle: hi?.title || item.title || '',
      hiBody: hi?.body || '',
      enTitle: en?.title || item.title || '',
      enBody: en?.body || ''
    });

    if (ur?.body) {
      this.activeScriptEditorTab.set('ur');
    } else if (hi?.body) {
      this.activeScriptEditorTab.set('hi');
    } else if (en?.body) {
      this.activeScriptEditorTab.set('en');
    } else {
      const active = this.scriptService.activeScript();
      this.activeScriptEditorTab.set(active === 'ur' ? 'ur' : (active === 'hi' ? 'hi' : 'en'));
    }
    this.syncAuthorSearchInput();
  }

  getGenreIcon(slug?: string): string {
    if (!slug) return '🏷️';
    const s = slug.toLowerCase();
    if (s.includes('ghazal')) return '📜';
    if (s.includes('nazm')) return '✍️';
    if (s.includes('sher') || s.includes('ashar')) return '💎';
    if (s.includes('rubai')) return '🪶';
    if (s.includes('marsiya') || s.includes('marsia')) return '🕯️';
    if (s.includes('qasida')) return '👑';
    if (s.includes('masnavi')) return '📖';
    if (s.includes('qita')) return '📜';
    if (s.includes('hamd') || s.includes('naat')) return '🤲';
    return '🏷️';
  }

  getSelectedGenre(): Genre | undefined {
    const gid = Number(this.contentForm().genreId);
    return this.genres().find(g => g.id === gid) || this.genres()[0];
  }

  getSelectedThemeNames(): string {
    const selectedIds = this.contentForm().selectedThemeIds;
    if (!selectedIds || selectedIds.length === 0) return 'None';
    return this.themes()
      .filter(t => t.id && selectedIds.includes(t.id))
      .map(t => t.name)
      .join(', ') || 'None';
  }

  onGenreDropdownChange(genreId: any) {
    const id = Number(genreId);
    if (id) {
      this.contentForm.update(f => ({ ...f, genreId: id }));
    }
  }

  onSingleThemeDropdownChange(themeId: any) {
    const id = Number(themeId);
    if (id) {
      this.contentForm.update(f => ({ ...f, selectedThemeIds: [id] }));
    }
  }

  proceedToEditorWithSelectedGenre() {
    if (!this.contentForm().genreId && this.genres().length > 0) {
      this.contentForm.update(f => ({ ...f, genreId: this.genres()[0].id || 1 }));
    }
    if ((!this.contentForm().selectedThemeIds || this.contentForm().selectedThemeIds.length === 0) && this.themes().length > 0) {
      this.contentForm.update(f => ({ ...f, selectedThemeIds: [this.themes()[0].id || 1] }));
    }
    this.contentCreationStep.set('editor');
  }

  selectGenreForContent(genre: Genre) {
    if (genre && genre.id) {
      this.contentForm.update(f => ({ ...f, genreId: genre.id! }));
    }
    this.contentCreationStep.set('editor');
  }

  backToGenreSelection() {
    this.contentCreationStep.set('select-genre');
  }

  saveInlineGenreAndContinue() {
    const name = this.inlineGenreName().trim();
    const slug = this.inlineGenreSlug().trim().toLowerCase();
    if (!name || !slug) {
      this.showStatus('error', 'Genre name and slug code are required.');
      return;
    }

    const newGenre: Genre = { id: Date.now(), name, slug };
    this.genres.update(list => [...list, newGenre]);
    this.contentForm.update(f => ({ ...f, genreId: newGenre.id! }));

    this.taxonomyService.saveGenre({ name, slug }).subscribe({
      next: () => {
        this.showStatus('success', `Genre "${name}" created and selected!`);
        this.inlineGenreName.set('');
        this.inlineGenreSlug.set('');
        this.showInlineGenreCreate.set(false);
        this.loadGenres();
        this.contentCreationStep.set('editor');
      },
      error: () => {
        this.showStatus('success', `Genre "${name}" selected!`);
        this.inlineGenreName.set('');
        this.inlineGenreSlug.set('');
        this.showInlineGenreCreate.set(false);
        this.contentCreationStep.set('editor');
      }
    });
  }

  // --- Delete Content ---
  deleteContent(item: Content) {
    const title = item.title || this.getContentTitleForActiveScript(item) || 'Untitled Kalam';
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return;
    }

    if (!item.id) {
      this.showStatus('error', 'Content ID is missing.');
      return;
    }

    this.contentService.deleteContent({ id: item.id }).subscribe({
      next: () => {
        this.showStatus('success', `"${title}" deleted successfully.`);
        this.loadContents();
      },
      error: (err) => {
        console.error('Failed to delete content:', err);
        this.showStatus('error', err?.error?.message || 'Failed to delete content.');
      }
    });
  }

  // --- Save / Update Content in 3 Scripts Simultaneously ---
  saveContentWithTexts() {
    const f = this.contentForm();
    const editId = this.editingContentId();
    
    // Auto-derive title from master title, script titles, or first verse line
    const firstLine = (f.urBody || f.hiBody || f.enBody || '').split('\n').map(l => l.trim()).find(l => l.length > 0) || '';
    const finalTitle = (f.title || f.urTitle || f.hiTitle || f.enTitle || firstLine || 'Untitled Kalam').trim();

    if (!f.urBody.trim() && !f.hiBody.trim() && !f.enBody.trim() && !f.urTitle.trim() && !f.hiTitle.trim() && !f.enTitle.trim()) {
      this.showStatus('error', 'Please enter some poetry verses (اشعار / کلام) before saving.');
      return;
    }

    const authorId = Number(f.authorId) || this.authors()[0]?.id || 1;
    const genreId = Number(f.genreId) || this.genres()[0]?.id || 1;
    const themeIds = f.selectedThemeIds && f.selectedThemeIds.length > 0 ? f.selectedThemeIds : [this.themes()[0]?.id || 1];

    this.isSavingContent.set(true);

    const scriptTexts = {
      ur: {
        title: f.urTitle.trim() || finalTitle,
        body: f.urBody.trim()
      },
      hi: {
        title: f.hiTitle.trim() || finalTitle,
        body: f.hiBody.trim()
      },
      en: {
        title: f.enTitle.trim() || finalTitle,
        body: f.enBody.trim()
      }
    };

    console.log('Saving content payload:', { id: editId, title: finalTitle, authorId, genreId, themeIds, scriptTexts });

    const existingItem = editId ? this.contents().find(c => c.id === editId) : undefined;
    const existingTexts = existingItem?.texts || (existingItem as any)?.contentTexts;

    this.contentService.saveCompleteContentWithTexts(
      {
        id: editId || undefined,
        title: finalTitle,
        authorId,
        genreId,
        themeIds
      },
      scriptTexts,
      existingTexts
    ).subscribe({
      next: () => {
        this.isSavingContent.set(false);
        const actionMsg = editId 
          ? `✏️ "${finalTitle}" updated successfully in the database!` 
          : `🎉 "${finalTitle}" published successfully across Urdu, Hindi & English!`;
        this.showStatus('success', actionMsg);

        this.contentForm.set({
          title: '',
          authorId: this.authors()[0]?.id || 1,
          genreId: this.genres()[0]?.id || 1,
          selectedThemeIds: [this.themes()[0]?.id || 1],
          urTitle: '',
          urBody: '',
          hiTitle: '',
          hiBody: '',
          enTitle: '',
          enBody: ''
        });

        this.editingContentId.set(null);
        this.closeAddModal();
        this.loadContents();
      },
      error: (err) => {
        this.isSavingContent.set(false);
        console.error('Failed to save content:', err);
        this.showStatus('error', err?.error?.message || err?.message || 'Failed to save content.');
      }
    });
  }

  // --- Save Genre ---
  saveGenre() {
    const f = this.genreForm();
    if (!f.name || !f.slug) {
      this.showStatus('error', 'Genre name and slug are required.');
      return;
    }
    const editId = this.editingGenreId();
    this.taxonomyService.saveGenre({ id: editId || undefined, name: f.name, slug: f.slug }).subscribe({
      next: () => {
        this.showStatus('success', editId ? `Genre "${f.name}" updated successfully!` : `Genre "${f.name}" saved!`);
        this.genreForm.set({ name: '', slug: '', description: '' });
        this.editingGenreId.set(null);
        this.closeAddModal();
        this.loadGenres();
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
    const editId = this.editingThemeId();
    this.taxonomyService.saveTheme({ id: editId || undefined, name: f.name, slug: f.slug }).subscribe({
      next: () => {
        this.showStatus('success', editId ? `Theme "${f.name}" updated successfully!` : `Theme "${f.name}" saved!`);
        this.themeForm.set({ name: '', slug: '', description: '' });
        this.editingThemeId.set(null);
        this.closeAddModal();
        this.loadThemes();
      },
      error: () => this.showStatus('error', 'Failed to save theme.')
    });
  }

  // --- Delete Genre ---
  deleteGenre(genre: Genre) {
    const genreName = this.getGenreNameForActiveScript(genre.id, genre) || genre.name || 'Genre';
    if (!confirm(`Are you sure you want to delete genre "${genreName}"? This action cannot be undone.`)) {
      return;
    }

    if (!genre.id) {
      this.showStatus('error', 'Genre ID is missing.');
      return;
    }

    this.taxonomyService.deleteGenre({ id: genre.id }).subscribe({
      next: () => {
        this.showStatus('success', `Genre "${genreName}" deleted successfully.`);
        this.loadGenres();
      },
      error: (err) => {
        console.error('Failed to delete genre:', err);
        this.showStatus('error', err?.error?.message || 'Failed to delete genre.');
      }
    });
  }

  // --- Delete Theme ---
  deleteTheme(theme: Theme) {
    const themeName = this.getThemeNameForActiveScript(theme) || theme.name || 'Theme';
    if (!confirm(`Are you sure you want to delete theme "${themeName}"? This action cannot be undone.`)) {
      return;
    }

    if (!theme.id) {
      this.showStatus('error', 'Theme ID is missing.');
      return;
    }

    this.taxonomyService.deleteTheme({ id: theme.id }).subscribe({
      next: () => {
        this.showStatus('success', `Theme "${themeName}" deleted successfully.`);
        this.loadThemes();
      },
      error: (err) => {
        console.error('Failed to delete theme:', err);
        this.showStatus('error', err?.error?.message || 'Failed to delete theme.');
      }
    });
  }

  // --- Delete Author ---
  deleteAuthor(author: Author) {
    const authorName = this.getAuthorNameForActiveScript(author, author.id) || author.primaryName || 'Shayar';
    if (!confirm(`Are you sure you want to delete "${authorName}"? This action cannot be undone.`)) {
      return;
    }

    if (!author.id) {
      this.showStatus("error", "Author ID is missing.");
      return;
    }

    this.authorService.deleteAuthor({ id: author.id }).subscribe({
      next: () => {
        this.showStatus("success", `Author "${authorName}" deleted successfully.`);
        this.loadAuthors();
      },
      error: (err) => {
        console.error("Failed to delete author:", err);
        this.showStatus("error", err?.error?.message || "Failed to delete author.");
      }
    });
  }

  // --- Save Author ---
  saveAuthorWithDetails() {
    const f = this.poetForm();
    if (!f.urName?.trim() && !f.enName?.trim() && !f.hiName?.trim()) {
      this.showStatus('error', 'Please enter the poet name in at least one script.');
      return;
    }

    const editId = this.editingAuthorId();
    const payload: any = {
      id: editId || undefined,
      birthDate: f.birthDate || null,
      deathDate: f.deathDate || null,
      urName: f.urName?.trim() || '',
      hiName: f.hiName?.trim() || '',
      enName: f.enName?.trim() || '',
      name: f.enName?.trim() || f.urName?.trim() || f.hiName?.trim() || '',
      primaryName: f.enName?.trim() || f.urName?.trim() || f.hiName?.trim() || ''
    };

    this.authorService.saveAuthor(payload).subscribe({
      next: (res: any) => {
        const authorId = res?.data?.id || editId;
        if (authorId) {
          const detailRequests = [];
          if (f.urName?.trim() || f.urBio?.trim()) {
            detailRequests.push(this.authorService.saveAuthorDetail({
              authorId,
              scriptId: this.scriptService.getScriptId('ur'),
              name: f.urName?.trim() || payload.primaryName,
              biography: f.urBio?.trim()
            }));
          }
          if (f.hiName?.trim() || f.hiBio?.trim()) {
            detailRequests.push(this.authorService.saveAuthorDetail({
              authorId,
              scriptId: this.scriptService.getScriptId('hi'),
              name: f.hiName?.trim() || payload.primaryName,
              biography: f.hiBio?.trim()
            }));
          }
          if (f.enName?.trim() || f.enBio?.trim()) {
            detailRequests.push(this.authorService.saveAuthorDetail({
              authorId,
              scriptId: this.scriptService.getScriptId('en'),
              name: f.enName?.trim() || payload.primaryName,
              biography: f.enBio?.trim()
            }));
          }
          if (detailRequests.length > 0) {
            forkJoin(detailRequests).subscribe({ error: () => {} });
          }
        }

        this.showStatus('success', editId ? 'Shayar profile updated successfully!' : 'Shayar profile saved into database!');
        this.editingAuthorId.set(null);
        this.poetForm.set({ birthDate: '', deathDate: '', urName: '', urBio: '', hiName: '', hiBio: '', enName: '', enBio: '' });
        this.closeAddModal();
        this.loadAuthors();
      },
      error: (err) => this.showStatus('error', err?.error?.message || 'Failed to save author.')
    });
  }

  // --- Save New Admin ---
  loadAdmins() {
    this.userService.getAdmins().subscribe({
      next: (res) => {
        if (res.data) {
          const mapped: AdminUserItem[] = res.data.map(u => ({
            id: u.id,
            name: u.name || 'Administrator',
            email: u.email,
            role: u.role || 'ADMIN',
            status: u.isActive !== false ? 'ACTIVE' : 'OFFLINE',
            lastActive: 'Active'
          }));
          this.adminUsers.set(mapped);
        }
      },
      error: () => {}
    });
  }

  // --- Save New Admin ---
  saveAdminUser() {
    const f = this.newAdminForm();
    if (!f.email || !f.name) {
      this.showStatus('error', 'Name and email are required.');
      return;
    }
    if (!f.password || f.password.length < 6) {
      this.showStatus('error', 'Password must be at least 6 characters.');
      return;
    }

    this.userService.addAdminUser({
      name: f.name.trim(),
      email: f.email.trim(),
      password: f.password
    }).subscribe({
      next: () => {
        this.showStatus('success', `Admin user "${f.name}" created successfully!`);
        this.newAdminForm.set({ name: '', email: '', password: '', role: 'ADMIN' });
        this.closeAddModal();
        this.loadAdmins();
      },
      error: (err) => {
        this.showStatus('error', err?.error?.message || 'Failed to create admin user.');
      }
    });
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

  // --- Profile Photo Upload ---
  isUploadingProfilePhoto = signal<boolean>(false);

  triggerProfilePhotoUpload(fileInput?: HTMLInputElement) {
    if (fileInput) {
      fileInput.click();
    }
  }

  onProfilePhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    // Validate image format
    if (!file.type.startsWith('image/')) {
      this.showStatus('error', 'Please select an image file (PNG, JPG, WebP, etc.).');
      input.value = '';
      return;
    }

    // Limit size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      this.showStatus('error', 'Image size must be less than 5MB.');
      input.value = '';
      return;
    }

    this.isUploadingProfilePhoto.set(true);
    this.userService.uploadProfilePhoto(file).subscribe({
      next: (res) => {
        this.isUploadingProfilePhoto.set(false);
        const photoUrl = res.data;
        if (photoUrl) {
          this.authService.updateProfilePicture(photoUrl);
          this.showStatus('success', 'Profile photo updated successfully!');
        } else {
          this.showStatus('success', 'Profile photo updated!');
        }
        input.value = '';
      },
      error: (err) => {
        this.isUploadingProfilePhoto.set(false);
        const msg = err?.error?.message || err?.message || 'Failed to upload profile photo.';
        this.showStatus('error', msg);
        input.value = '';
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
