import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SearchService, SearchResultData, GenreSearchResultGroup } from '../../core/services/search.service';
import { ScriptService } from '../../core/services/script.service';
import { AuthorService } from '../../core/services/author.service';
import { ContentService } from '../../core/services/content.service';
import { AuthorDto } from '../../core/models/author.models';
import { ContentDto, ContentFilterRequest } from '../../core/models/content.models';

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

  // Pagination for Poets & Shayars
  authorsPage = signal<number>(0);
  authorsLoading = signal<boolean>(false);
  authorsHasMore = signal<boolean>(true);

  // Pagination state for each Genre section
  genrePaginationState = signal<Record<number, GenrePaginationState>>({});

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
    this.authorsPage.set(0);
    this.authorsLoading.set(false);
    this.authorsHasMore.set(true);
    this.genrePaginationState.set({});

    this.searchService.search(text).subscribe({
      next: res => {
        this.loading.set(false);
        if (res && res.success && res.data) {
          this.searchData.set(res.data);
          this.authorsHasMore.set(!!res.data.authors && res.data.authors.length > 0);

          const initialGenreState: Record<number, GenrePaginationState> = {};
          res.data.resultsByGenre?.forEach(g => {
            const hasMore = g.totalCount ? g.contents.length < g.totalCount : g.contents.length >= 3;
            initialGenreState[g.genreId] = {
              page: 0,
              loading: false,
              hasMore: hasMore
            };
          });
          this.genrePaginationState.set(initialGenreState);
        } else {
          this.searchData.set(null);
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

      let match = content.contentTexts.find(t => t.scriptId === targetScriptId || this.scriptService.isScriptMatch(t, active));
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

      const match = content.contentTexts.find(t => t.scriptId === targetScriptId || this.scriptService.isScriptMatch(t, active));
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

  // 1. Load 5 More Poets from /api/authors/list
  loadMoreAuthors() {
    if (this.authorsLoading() || !this.authorsHasMore()) return;
    const q = this.query().trim();
    const currentData = this.searchData();
    if (!currentData) return;

    const nextPage = this.authorsPage() + 1;
    this.authorsLoading.set(true);
    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());

    this.authorService.getEnrichedAuthorsPaged(scriptId, {
      search: q || undefined,
      name: q || undefined,
      page: nextPage,
      size: 5,
      sortBy: 'id',
      sortDirection: 'asc'
    } as any).subscribe({
      next: (res) => {
        this.authorsLoading.set(false);
        const newAuthors = res.data || [];
        const existingIds = new Set((currentData.authors || []).map(a => a.id));
        const uniqueNew = newAuthors.filter(a => a.id && !existingIds.has(a.id));

        if (uniqueNew.length > 0) {
          currentData.authors = [...(currentData.authors || []), ...uniqueNew];
          this.searchData.set({ ...currentData });
        }

        this.authorsPage.set(nextPage);

        if (res.last || newAuthors.length < 5 || uniqueNew.length === 0) {
          this.authorsHasMore.set(false);
        }
      },
      error: (err) => {
        this.authorsLoading.set(false);
        console.error('[SearchComponent] Error loading more authors:', err);
        this.authorsHasMore.set(false);
      }
    });
  }

  // 2. Load 5 More Contents for a specific Genre from /api/contents/list
  getGenreLoading(genreId: number): boolean {
    return !!this.genrePaginationState()[genreId]?.loading;
  }

  getGenreHasMore(genreId: number, group?: GenreSearchResultGroup): boolean {
    const state = this.genrePaginationState()[genreId];
    if (state !== undefined) {
      return state.hasMore;
    }
    if (group && group.totalCount !== undefined && group.contents.length >= group.totalCount) {
      return false;
    }
    return (group?.contents?.length || 0) > 0;
  }

  loadMoreGenreContents(genreGroup: GenreSearchResultGroup) {
    const genreId = genreGroup.genreId;
    if (this.getGenreLoading(genreId) || !this.getGenreHasMore(genreId, genreGroup)) return;

    const currentData = this.searchData();
    if (!currentData) return;

    const currentState = this.genrePaginationState()[genreId] || {
      page: 0,
      loading: false,
      hasMore: true
    };

    const nextPage = currentState.page + 1;

    this.genrePaginationState.update(prev => ({
      ...prev,
      [genreId]: { ...currentState, loading: true }
    }));

    const q = this.query().trim();
    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());

    const filterReq: ContentFilterRequest = {
      genreId: genreId,
      search: q || undefined,
      title: q || undefined,
      scriptId: scriptId,
      page: nextPage,
      size: 5,
      sortBy: 'id',
      sortDirection: 'desc'
    };

    this.contentService.filterContents(filterReq).subscribe({
      next: (res) => {
        const newContents = res.data || [];
        const existingIds = new Set(genreGroup.contents.map(c => c.id));
        const uniqueNew = newContents.filter(c => c.id && !existingIds.has(c.id));

        if (uniqueNew.length > 0) {
          genreGroup.contents = [...genreGroup.contents, ...uniqueNew];
          if (res.totalElements && res.totalElements > genreGroup.totalCount) {
            genreGroup.totalCount = res.totalElements;
          }
          this.searchData.set({ ...currentData });
        }

        const isLast = res.last || newContents.length < 5 || uniqueNew.length === 0 || (res.totalElements ? genreGroup.contents.length >= res.totalElements : false);

        this.genrePaginationState.update(prev => ({
          ...prev,
          [genreId]: {
            page: nextPage,
            loading: false,
            hasMore: !isLast
          }
        }));
      },
      error: (err) => {
        console.error(`[SearchComponent] Error loading more contents for genre ${genreId}:`, err);
        this.genrePaginationState.update(prev => ({
          ...prev,
          [genreId]: {
            ...currentState,
            loading: false,
            hasMore: false
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
}
