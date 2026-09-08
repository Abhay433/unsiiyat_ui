import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SearchService, SearchResultData, GenreSearchResultGroup, CoupletSearchResult, CoupletsSearchResponse } from '../../core/services/search.service';
import { ScriptService } from '../../core/services/script.service';
import { AuthorService } from '../../core/services/author.service';
import { ContentService } from '../../core/services/content.service';
import { AuthorDto } from '../../core/models/author.models';
import { ContentDto, ContentFilterRequest, ContentText } from '../../core/models/content.models';

export interface StaticWordMeaning {
  word: string;
  transliteration: string;
  partOfSpeech: string;
  definition: string;
  synonyms: string;
  exampleCouplet: string;
  poet: string;
}

export interface GenrePaginationState {
  page: number;
  loading: boolean;
  hasMore: boolean;
}

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css']
})
export class SearchComponent implements OnInit {
  readonly scriptService = inject(ScriptService);
  private readonly searchService = inject(SearchService);
  private readonly authorService = inject(AuthorService);
  private readonly contentService = inject(ContentService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  query = signal('');
  loading = signal(false);
  hasSearched = signal(false);
  searchData = signal<SearchResultData | null>(null);
  errorMessage = signal<string | null>(null);

  // Carousel for Authors & Shayars (Size: 3 with Left & Right arrows - same as Home Page)
  carouselAuthors = signal<AuthorDto[]>([]);
  authorsCarouselPage = signal<number>(0);
  authorsCarouselTotalPages = signal<number>(1);
  authorsCarouselTotalElements = signal<number>(0);
  authorsCarouselLoading = signal<boolean>(false);
  authorsCarouselIsLast = signal<boolean>(false);

  // Backward-compatibility signals
  authorsPage = signal<number>(0);
  authorsLoading = signal<boolean>(false);
  authorsHasMore = signal<boolean>(true);

  // Pagination state for each Genre section
  genrePaginationState = signal<Record<number, GenrePaginationState>>({});

  // Matching Ash'aar / Couplets State
  coupletsData = signal<CoupletsSearchResponse | null>(null);
  coupletsList = signal<CoupletSearchResult[]>([]);
  coupletsPage = signal<number>(0);
  coupletsLoading = signal<boolean>(false);
  coupletsHasMore = signal<boolean>(false);
  coupletsTotal = signal<number>(0);
  copiedCoupletKey = signal<string | null>(null);
  coupletScriptOverride = signal<Record<string, string>>({});

  // Static dictionary / word meaning section (as requested)
  readonly staticWordMeanings: StaticWordMeaning[] = [
    {
      word: 'आरज़ू / آرزو',
      transliteration: 'Aarzoo',
      partOfSpeech: 'Noun (स्त्रीलिंग / اسم مؤنث)',
      definition: 'A deep yearning, heartfelt longing, desire or wish; a cherished longing of the lover’s soul.',
      synonyms: 'तमन्ना (Tamanna), ख़्वाहिश (Khwahish), हसरत (Hasrat), मुराद (Muraad)',
      exampleCouplet: 'हज़ारों ख़्वाहिशें ऐसी कि हर ख़्वाहिश पे दम निकले\nबहुत निकले मिरे अरमान लेकिन फिर भी कम निकले',
      poet: 'Mirza Ghalib'
    },
    {
      word: 'रक़ीब / رقیب',
      transliteration: 'Raqeeb',
      partOfSpeech: 'Noun (पुल्लिंग / اسم مذकर)',
      definition: 'A rival or competitor in romantic courtship; historically portrayed with subtle wit and envy in classical poetry.',
      synonyms: 'प्रतिद्वंद्वी (Pratidwandi), हरीफ़ (Hareef), मुख़ालिफ़ (Mukhalif)',
      exampleCouplet: 'ग़ैरों से ले ली मैं ने मोहब्बत उधार पर\nऐ मेरे क़र्ज़-दार तुझे देर हो गई',
      poet: 'Zohaib Azmi'
    },
    {
      word: 'फ़िराक़ / فراق',
      transliteration: 'Firaaq',
      partOfSpeech: 'Noun (पुल्लिंग / اسم مذकर)',
      definition: 'Painful separation, absence from the beloved, heartache born of distance and unfulfilled longing.',
      synonyms: 'जुदाई (Judai), हिज्र (Hijr), विरह (Virah), फ़ासिला (Fasila)',
      exampleCouplet: 'फ़िराक़-ए-यार ने बे-चैन कर दिया दिल को\nवो आएँ भी तो मसीहा बना नहीं जाता',
      poet: 'Classical Master'
    },
    {
      word: 'सुख़न / سخن',
      transliteration: 'Sukhan',
      partOfSpeech: 'Noun (पुल्लिंग / اسم مذकर)',
      definition: 'Artistic poetic speech, verse creation, rhetorical eloquence that touches and elevates the listener’s soul.',
      synonyms: 'कविता (Kavita), कलाम (Kalaam), गुफ़्तगू (Guftagu), बयान (Bayaan)',
      exampleCouplet: 'हैं और भी दुनिया में सुख़न-वर बहुत अच्छे\nकहते हैं कि \'ग़ालिब\' का है अंदाज़-ए-बयाँ और',
      poet: 'Mirza Ghalib'
    }
  ];

  constructor() {
    effect(() => {
      this.scriptService.activeScript();
      const q = this.query().trim();
      if (q && this.hasSearched()) {
        this.loadAuthorsCarousel(this.authorsCarouselPage(), q);
      }
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const q = params['q'] || params['text'] || '';
      this.query.set(q);
      if (q.trim()) {
        this.performSearch(q.trim());
      }
    });
  }

  onSearchSubmit() {
    const q = this.query().trim();
    if (q) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { q },
        queryParamsHandling: 'merge'
      });
      this.performSearch(q);
    }
  }

  performSearch(text: string) {
    this.loading.set(true);
    this.hasSearched.set(true);
    this.errorMessage.set(null);
    this.authorsCarouselPage.set(0);
    this.authorsCarouselLoading.set(false);
    this.authorsCarouselIsLast.set(false);
    this.carouselAuthors.set([]);
    this.authorsPage.set(0);
    this.authorsLoading.set(false);
    this.authorsHasMore.set(true);
    this.genrePaginationState.set({});
    this.coupletsPage.set(0);
    this.coupletsLoading.set(false);
    this.coupletsHasMore.set(false);
    this.coupletsList.set([]);
    this.coupletsData.set(null);
    this.coupletsTotal.set(0);

    // Fetch matching Ash'aar (Couplets across Ghazals)
    this.loadCouplets(0, text);

    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());

    this.searchService.search(text).subscribe({
      next: res => {
        if (res && res.success && res.data) {
          const searchResult = res.data;
          this.searchData.set(searchResult);

          // 1. Initial 3 Authors for Carousel from /api/authors/list (Size: 3)
          this.loadAuthorsCarousel(0, text);

          // 2. Initial 5 Contents for each Genre from /api/contents/list
          const initialGenreState: Record<number, GenrePaginationState> = {};

          if (searchResult.resultsByGenre && searchResult.resultsByGenre.length > 0) {
            let completedCount = 0;
            const totalGenres = searchResult.resultsByGenre.length;

            searchResult.resultsByGenre.forEach(genreGroup => {
              const genreId = genreGroup.genreId;

              initialGenreState[genreId] = {
                page: 1,
                loading: false,
                hasMore: true
              };

              const filterReq: ContentFilterRequest = {
                genreId: genreId,
                search: text || undefined,
                scriptId: scriptId,
                page: 0,
                size: 5,
                sortBy: 'id',
                sortDirection: 'desc'
              };

              this.contentService.filterContents(filterReq).subscribe({
                next: (contentRes) => {
                  const rawList = contentRes.data || (contentRes as any).content || [];
                  const targetCode = this.scriptService.getCodeFromId(scriptId);

                  if (rawList.length > 0) {
                    const enrichedContents = rawList.map(item => {
                      const itemTexts = (item.contentTexts && item.contentTexts.length > 0)
                        ? item.contentTexts
                        : (item.texts || []);
                      const currentText = itemTexts.find((t: ContentText) => (t.scriptId && t.scriptId === scriptId) || this.scriptService.isScriptMatch(t, targetCode))
                        || item.primaryText
                        || itemTexts[0];
                      const matchedAuthor = item.author || searchResult.authors?.find(a => a.id === item.authorId);
                      return {
                        ...item,
                        contentTexts: itemTexts,
                        texts: itemTexts,
                        primaryText: currentText,
                        author: matchedAuthor || item.author
                      };
                    });

                    genreGroup.contents = enrichedContents;
                    const totalFromRes = contentRes.totalElements || 0;
                    genreGroup.totalCount = Math.max(genreGroup.totalCount || 0, totalFromRes, genreGroup.contents.length);
                    this.searchData.set({ ...searchResult });
                  }

                  const hasMore = !contentRes.last && rawList.length === 5;
                  this.genrePaginationState.update(prev => ({
                    ...prev,
                    [genreId]: {
                      page: 1,
                      loading: false,
                      hasMore: hasMore
                    }
                  }));

                  completedCount++;
                  if (completedCount >= totalGenres) {
                    this.loading.set(false);
                  }
                },
                error: () => {
                  completedCount++;
                  if (completedCount >= totalGenres) {
                    this.loading.set(false);
                  }
                }
              });
            });

            this.genrePaginationState.set(initialGenreState);
          } else {
            this.loading.set(false);
          }
        } else {
          this.searchData.set(null);
          this.loading.set(false);
        }
      },
      error: err => {
        this.loading.set(false);
        this.errorMessage.set('Failed to fetch search results. Please try again.');
        console.error('Search error:', err);
      }
    });
  }

  // Helper to extract first two non-empty lines of body
  getFirstTwoLines(content: ContentDto): string[] {
    const active = this.scriptService.activeScript();
    let bodyText = '';

    if (content.contentTexts && content.contentTexts.length > 0) {
      // Find text matching active script if available
      const targetScriptId = this.scriptService.getScriptId(active);

      let match = content.contentTexts.find(t => (t.scriptId && t.scriptId === targetScriptId) || this.scriptService.isScriptMatch(t, active));
      if (!match) {
        match = content.contentTexts[0];
      }
      bodyText = match?.body || '';
    } else if (content.primaryText) {
      bodyText = content.primaryText.body || '';
    }

    if (!bodyText) {
      return [];
    }

    return bodyText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 2);
  }

  getContentTitle(content: ContentDto): string {
    const active = this.scriptService.activeScript();

    if (content.contentTexts && content.contentTexts.length > 0) {
      const targetScriptId = this.scriptService.getScriptId(active);

      const match = content.contentTexts.find(t => (t.scriptId && t.scriptId === targetScriptId) || this.scriptService.isScriptMatch(t, active));
      if (match && match.title) {
        return match.title;
      }
      return content.contentTexts[0]?.title || content.title;
    }

    return content.primaryText?.title || content.title;
  }

  getAuthorName(author?: AuthorDto): string {
    if (!author) return 'Unknown Shayar';
    const active = this.scriptService.activeScript();
    if (active === 'ur' && author.urName) return author.urName;
    if (active === 'hi' && author.hiName) return author.hiName;
    if (active === 'en' && author.enName) return author.enName;
    return author.primaryName || author.name || author.enName || 'Shayar';
  }

  getAuthorInitial(author: AuthorDto): string {
    const name = this.getAuthorName(author);
    return name ? name.charAt(0).toUpperCase() : '✒';
  }

  getAuthorAvatar(author: AuthorDto): string {
    return this.authorService.getAuthorAvatar(author);
  }

  getAuthorBio(author: AuthorDto): string {
    const active = this.scriptService.activeScript();
    if (active === 'ur' && author.urBio) return author.urBio;
    if (active === 'hi' && author.hiBio) return author.hiBio;
    if (active === 'en' && author.enBio) return author.enBio;
    return author.primaryBio || (author as any).biography || author.enBio || author.urBio || author.hiBio || '';
  }

  onImgError(event: Event, author: any) {
    const target = event.target as HTMLImageElement;
    if (target) {
      const name = this.getAuthorName(author) || 'Author';
      target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3d2216&color=d4af37&font-size=0.38&bold=true`;
    }
  }

  // --- Authors Carousel with size: 3 and Left/Right Arrows (Same as Home Page) ---
  loadAuthorsCarousel(page: number = 0, searchText?: string) {
    this.authorsCarouselLoading.set(true);
    const q = (searchText !== undefined ? searchText : this.query()).trim();
    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());

    const filterReq = {
      search: q || undefined,
      scriptId: scriptId,
      page: page,
      size: 3,
      sortBy: 'id',
      sortDirection: 'asc'
    };

    console.log(`[SearchComponent] Loading authors carousel page ${page}:`, filterReq);

    this.authorService.getEnrichedAuthorsPaged(scriptId, filterReq as any).subscribe({
      next: (res) => {
        const list = res.data || (res as any).content || [];
        if (list.length > 0) {
          this.carouselAuthors.set(list);
          this.authorsCarouselPage.set(res.page ?? page);
          const total = res.totalElements ?? list.length;
          this.authorsCarouselTotalElements.set(total);
          this.authorsCarouselTotalPages.set(res.totalPages || Math.ceil(total / 3) || 1);
          this.authorsCarouselIsLast.set(res.last ?? (list.length < 3));

          // Keep searchData().authors in sync
          const current = this.searchData();
          if (current) {
            current.authors = list;
            this.searchData.set({ ...current });
          }
        } else if (page === 0) {
          const existing = this.searchData()?.authors || [];
          if (existing.length > 0) {
            this.carouselAuthors.set(existing.slice(0, 3));
            this.authorsCarouselPage.set(0);
            this.authorsCarouselTotalElements.set(existing.length);
            this.authorsCarouselTotalPages.set(Math.ceil(existing.length / 3) || 1);
            this.authorsCarouselIsLast.set(existing.length <= 3);
          } else {
            this.carouselAuthors.set([]);
            this.authorsCarouselTotalPages.set(1);
            this.authorsCarouselIsLast.set(true);
          }
        } else {
          this.authorsCarouselIsLast.set(true);
        }
        this.authorsCarouselLoading.set(false);
      },
      error: (err) => {
        console.error('[SearchComponent] Error loading authors carousel:', err);
        const existing = this.searchData()?.authors || [];
        if (existing.length > 0) {
          const start = page * 3;
          this.carouselAuthors.set(existing.slice(start, start + 3));
          this.authorsCarouselPage.set(page);
          this.authorsCarouselTotalElements.set(existing.length);
          this.authorsCarouselTotalPages.set(Math.ceil(existing.length / 3) || 1);
          this.authorsCarouselIsLast.set(start + 3 >= existing.length);
        }
        this.authorsCarouselLoading.set(false);
      }
    });
  }

  nextAuthorsPage() {
    if (this.authorsCarouselIsLast() || this.authorsCarouselLoading()) return;
    const next = this.authorsCarouselPage() + 1;
    this.loadAuthorsCarousel(next);
  }

  prevAuthorsPage() {
    if (this.authorsCarouselPage() <= 0 || this.authorsCarouselLoading()) return;
    const prev = this.authorsCarouselPage() - 1;
    this.loadAuthorsCarousel(prev);
  }

  goToAuthorsPage(page: number) {
    if (page < 0 || page >= this.authorsCarouselTotalPages() || this.authorsCarouselLoading()) return;
    this.loadAuthorsCarousel(page);
  }

  getAuthorsCarouselPageArray(): number[] {
    const total = this.authorsCarouselTotalPages();
    return Array.from({ length: Math.min(total, 12) }, (_, i) => i);
  }

  // Alias for backward compatibility
  loadMoreAuthors() {
    this.nextAuthorsPage();
  }

  // 2. Load 5 More Contents for a specific Genre from /api/contents/list (Expands to 10, 15...)
  getGenreLoading(genreId: number): boolean {
    return !!this.genrePaginationState()[genreId]?.loading;
  }

  getGenreHasMore(genreId: number, group?: GenreSearchResultGroup): boolean {
    const state = this.genrePaginationState()[genreId];
    if (state !== undefined) {
      return state.hasMore;
    }
    return (group?.contents?.length || 0) > 0;
  }

  loadMoreGenreContents(genreGroup: GenreSearchResultGroup) {
    const genreId = genreGroup.genreId;
    if (this.getGenreLoading(genreId) || !this.getGenreHasMore(genreId, genreGroup)) return;

    const currentData = this.searchData();
    if (!currentData) return;

    const currentState = this.genrePaginationState()[genreId] || {
      page: 1,
      loading: false,
      hasMore: true
    };

    const pageToFetch = currentState.page;

    this.genrePaginationState.update(prev => ({
      ...prev,
      [genreId]: { ...currentState, loading: true }
    }));

    const q = this.query().trim();
    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());

    const filterReq: ContentFilterRequest = {
      genreId: genreId,
      search: q || undefined,
      scriptId: scriptId,
      page: pageToFetch,
      size: 5,
      sortBy: 'id',
      sortDirection: 'desc'
    };

    console.log(`[SearchComponent] Requesting /api/contents/list for genre ${genreId}:`, filterReq);

    this.contentService.filterContents(filterReq).subscribe({
      next: (res) => {
        console.log(`[SearchComponent] Response from /api/contents/list for genre ${genreId}:`, res);
        this.genrePaginationState.update(prev => ({
          ...prev,
          [genreId]: { ...currentState, loading: false }
        }));

        const rawList = res.data || (res as any).content || [];
        const targetCode = this.scriptService.getCodeFromId(scriptId);

        const newContents: ContentDto[] = rawList.map(item => {
          const itemTexts = (item.contentTexts && item.contentTexts.length > 0)
            ? item.contentTexts
            : (item.texts || []);
          const currentText = itemTexts.find((t: ContentText) => (t.scriptId && t.scriptId === scriptId) || this.scriptService.isScriptMatch(t, targetCode))
            || item.primaryText
            || itemTexts[0];
          const matchedAuthor = item.author || currentData.authors?.find(a => a.id === item.authorId);
          return {
            ...item,
            contentTexts: itemTexts,
            texts: itemTexts,
            primaryText: currentText,
            author: matchedAuthor || item.author
          };
        });

        const existingIds = new Set(genreGroup.contents.map(c => c.id));
        const uniqueNew = newContents.filter(c => c.id && !existingIds.has(c.id));

        if (uniqueNew.length > 0) {
          genreGroup.contents = [...genreGroup.contents, ...uniqueNew];
          const totalFromRes = res.totalElements || 0;
          genreGroup.totalCount = Math.max(genreGroup.totalCount || 0, totalFromRes, genreGroup.contents.length);
          this.searchData.set({ ...currentData });

          const isLast = res.last || newContents.length < 5;
          this.genrePaginationState.update(prev => ({
            ...prev,
            [genreId]: {
              page: pageToFetch + 1,
              loading: false,
              hasMore: !isLast
            }
          }));
        } else {
          this.genrePaginationState.update(prev => ({
            ...prev,
            [genreId]: {
              page: pageToFetch + 1,
              loading: false,
              hasMore: false
            }
          }));
        }
      },
      error: (err) => {
        console.error(`[SearchComponent] Error loading more contents for genre ${genreId}:`, err);
        this.genrePaginationState.update(prev => ({
          ...prev,
          [genreId]: {
            ...currentState,
            loading: false,
            hasMore: true
          }
        }));
      }
    });
  }

  // Alias for backward compatibility if called
  loadMore(sectionName: string, genreGroup?: GenreSearchResultGroup) {
    if (sectionName === 'authors') {
      this.loadMoreAuthors();
    } else if (genreGroup) {
      this.loadMoreGenreContents(genreGroup);
    }
  }

  // --- Couplet / Ash'aar Search & Navigation ---
  loadCouplets(page: number = 0, searchText?: string) {
    this.coupletsLoading.set(true);
    const q = (searchText !== undefined ? searchText : this.query()).trim();
    if (!q) {
      this.coupletsLoading.set(false);
      return;
    }
    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());

    this.searchService.searchCouplets(q, undefined, page, 5, scriptId).subscribe({
      next: (res) => {
        if (res && res.success && res.data) {
          const data = res.data;
          this.coupletsData.set(data);
          this.coupletsPage.set(data.page ?? page);
          this.coupletsTotal.set(data.totalCount ?? 0);
          this.coupletsHasMore.set(data.hasMore ?? false);

          if (page === 0) {
            this.coupletsList.set(data.couplets || []);
          } else {
            this.coupletsList.update(prev => [...prev, ...(data.couplets || [])]);
          }
        }
        this.coupletsLoading.set(false);
      },
      error: (err) => {
        console.error('[SearchComponent] Error fetching couplets:', err);
        this.coupletsLoading.set(false);
      }
    });
  }

  loadMoreCouplets() {
    if (this.coupletsLoading() || !this.coupletsHasMore()) return;
    this.loadCouplets(this.coupletsPage() + 1);
  }

  getActiveScriptForCouplet(couplet: CoupletSearchResult): string {
    const key = `${couplet.contentId}-${couplet.coupletIndex}`;
    const override = this.coupletScriptOverride()[key];
    if (override) return override;

    const activeAppScript = this.scriptService.activeScript();
    if (couplet.linesByScript && couplet.linesByScript[activeAppScript] && couplet.linesByScript[activeAppScript].length > 0) {
      return activeAppScript;
    }
    if (couplet.scriptCode) return couplet.scriptCode.toLowerCase();
    return 'en';
  }

  setCoupletScript(couplet: CoupletSearchResult, scriptCode: string) {
    const key = `${couplet.contentId}-${couplet.coupletIndex}`;
    this.coupletScriptOverride.update(prev => ({
      ...prev,
      [key]: scriptCode
    }));
  }

  getCoupletLines(couplet: CoupletSearchResult): string[] {
    const script = this.getActiveScriptForCouplet(couplet);
    if (couplet.linesByScript && couplet.linesByScript[script] && couplet.linesByScript[script].length > 0) {
      return couplet.linesByScript[script];
    }
    return couplet.lines || [];
  }

  getCoupletFontClass(couplet: CoupletSearchResult): string {
    const script = this.getActiveScriptForCouplet(couplet);
    if (script === 'ur') return 'font-urdu';
    if (script === 'hi') return 'font-hindi';
    return 'font-display';
  }

  formatVerse(verse: string | undefined, query: string): string {
    if (!verse) return '';
    const q = query ? query.trim() : '';
    if (!q) return this.escapeHtml(verse);
    try {
      const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedQuery})`, 'gi');
      return this.escapeHtml(verse).replace(regex, '<mark class="highlight-search-term">$1</mark>');
    } catch {
      return this.escapeHtml(verse);
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  copyCouplet(couplet: CoupletSearchResult) {
    const lines = this.getCoupletLines(couplet);
    const poet = couplet.authorName || (couplet.author ? (couplet.author.name || couplet.author.enName || '') : '');
    const title = couplet.contentTitle || '';
    const textToCopy = `${lines.join('\n')}\n\n— ${poet}${title ? ' (“' + title + '”)' : ''}\nvia Unsiiyat`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      const key = `${couplet.contentId}-${couplet.coupletIndex}`;
      this.copiedCoupletKey.set(key);
      setTimeout(() => {
        if (this.copiedCoupletKey() === key) {
          this.copiedCoupletKey.set(null);
        }
      }, 2500);
    });
  }
}
