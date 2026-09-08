import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, catchError, switchMap, throwError, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Content, ContentText, ContentFilterRequest, ContentTextFilterRequest, GenreCuratedGroup } from '../models/content.models';
import { Genre, Theme } from '../models/taxonomy.models';
import { ApiResponse, PagedResponse } from '../models/api-response.models';
import { TaxonomyService } from './taxonomy.service';
import { AuthorService } from './author.service';
import { Author, AuthorDetail } from '../models/author.models';
import { ScriptService } from './script.service';

@Injectable({
  providedIn: 'root'
})
export class ContentService {
  private readonly api = inject(ApiService);
  private readonly taxonomyService = inject(TaxonomyService);
  private readonly authorService = inject(AuthorService);
  private readonly scriptService = inject(ScriptService);

  private cachedTexts: ContentText[] | null = null;

  clearCache() {
    this.cachedTexts = null;
  }

  getGhazalOfTheDay(scriptId?: number): Observable<ApiResponse<Content>> {
    const query = scriptId ? `?scriptId=${scriptId}` : '';
    return this.api.get<ApiResponse<Content>>(`/api/home/ghazal-of-the-day${query}`);
  }

  getCuratedGenres(scriptId?: number): Observable<ApiResponse<GenreCuratedGroup[]>> {
    const sId = scriptId ?? this.scriptService.getScriptId(this.scriptService.activeScript());
    const query = sId ? `?scriptId=${sId}` : '';
    return this.api.get<ApiResponse<GenreCuratedGroup[]>>(`/api/home/curated-genres${query}`);
  }

  getSelectedGhazals(scriptId?: number): Observable<ApiResponse<Content[]>> {
    const sId = scriptId ?? this.scriptService.getScriptId(this.scriptService.activeScript());
    const query = sId ? `?scriptId=${sId}` : '';
    return this.api.get<ApiResponse<Content[]>>(`/api/home/selected-ghazals${query}`);
  }

  getSelectedNazms(scriptId?: number): Observable<ApiResponse<Content[]>> {
    const sId = scriptId ?? this.scriptService.getScriptId(this.scriptService.activeScript());
    const query = sId ? `?scriptId=${sId}` : '';
    return this.api.get<ApiResponse<Content[]>>(`/api/home/selected-nazm${query}`);
  }

  countSelectedByGenre(genreId: number): Observable<ApiResponse<number>> {
    return this.api.get<ApiResponse<number>>(`/api/contents/count-selected?genreId=${genreId}`);
  }

  filterContents(request: ContentFilterRequest = {}): Observable<PagedResponse<Content>> {
    const payload = {
      page: request.page ?? 0,
      size: request.size ?? 10,
      sortBy: request.sortBy ?? 'id',
      sortDirection: request.sortDirection ?? 'desc',
      ...request
    };
    return this.api.post<PagedResponse<Content>>('/api/contents/list', payload);
  }

  saveContent(content: Content): Observable<ApiResponse<Content>> {
    return this.api.post<ApiResponse<Content>>('/api/contents/addOrUpdate', content).pipe(
      tap(() => this.clearCache())
    );
  }

  deleteContent(content: { id: number }): Observable<ApiResponse<string>> {
    return this.api.post<ApiResponse<string>>('/api/contents/delete', content).pipe(
      tap(() => this.clearCache())
    );
  }

  filterContentTexts(request: ContentTextFilterRequest = {}): Observable<PagedResponse<ContentText>> {
    const payload: any = {
      page: request.page ?? 0,
      size: request.size ?? 500,
      sortBy: request.sortBy ?? 'id',
      sortDirection: request.sortDirection ?? 'asc',
      ...request
    };
    if (request.contentId !== undefined) {
      payload.contentId = request.contentId;
      payload.content_id = request.contentId;
    }
    if (request.scriptId !== undefined) {
      payload.scriptId = request.scriptId;
      payload.script_id = request.scriptId;
    }
    return this.api.post<PagedResponse<ContentText>>('/api/content-texts/list', payload);
  }

  saveContentText(contentText: { id?: number; contentId: number; scriptId: number; title: string; body: string }): Observable<any> {
    const payload: Content = {
      id: contentText.contentId,
      title: contentText.title || '',
      contentTexts: [{
        id: contentText.id,
        contentId: contentText.contentId,
        scriptId: contentText.scriptId,
        title: contentText.title,
        body: contentText.body
      }]
    };
    return this.saveContent(payload);
  }

  saveCompleteContentWithTexts(
    contentData: { id?: number; title: string; authorId?: number; genreId?: number; themeIds?: number[]; isSelected?: boolean },
    scriptTexts: {
      ur?: { title: string; body: string };
      hi?: { title: string; body: string };
      en?: { title: string; body: string };
    },
    existingTexts?: ContentText[]
  ): Observable<ApiResponse<Content>> {
    const textsList = existingTexts || [];
    const existingUr = textsList.find(t => this.scriptService.isScriptMatch(t, 'ur'));
    const existingHi = textsList.find(t => this.scriptService.isScriptMatch(t, 'hi'));
    const existingEn = textsList.find(t => this.scriptService.isScriptMatch(t, 'en'));

    const urScriptId = existingUr?.scriptId || this.scriptService.getScriptId('ur');
    const hiScriptId = existingHi?.scriptId || this.scriptService.getScriptId('hi');
    const enScriptId = existingEn?.scriptId || this.scriptService.getScriptId('en');

    const contentTexts: ContentText[] = [];

    if (scriptTexts.ur?.body && scriptTexts.ur.body.trim().length > 0) {
      const urTitle = scriptTexts.ur.title?.trim()
        || (this.scriptService.isScriptMatch({ title: contentData.title }, 'ur') ? contentData.title : scriptTexts.ur.body.trim().split('\n')[0]?.trim() || '');
      contentTexts.push({
        id: existingUr?.id,
        contentId: contentData.id,
        scriptId: urScriptId,
        title: urTitle,
        body: scriptTexts.ur.body.trim()
      });
    }

    if (scriptTexts.hi?.body && scriptTexts.hi.body.trim().length > 0) {
      const hiTitle = scriptTexts.hi.title?.trim()
        || (this.scriptService.isScriptMatch({ title: contentData.title }, 'hi') ? contentData.title : scriptTexts.hi.body.trim().split('\n')[0]?.trim() || '');
      contentTexts.push({
        id: existingHi?.id,
        contentId: contentData.id,
        scriptId: hiScriptId,
        title: hiTitle,
        body: scriptTexts.hi.body.trim()
      });
    }

    if (scriptTexts.en?.body && scriptTexts.en.body.trim().length > 0) {
      const enTitle = scriptTexts.en.title?.trim()
        || (this.scriptService.isScriptMatch({ title: contentData.title }, 'en') ? contentData.title : scriptTexts.en.body.trim().split('\n')[0]?.trim() || '');
      contentTexts.push({
        id: existingEn?.id,
        contentId: contentData.id,
        scriptId: enScriptId,
        title: enTitle,
        body: scriptTexts.en.body.trim()
      });
    }

    const payload: Content = {
      id: contentData.id,
      title: contentData.title,
      authorId: contentData.authorId,
      genreId: contentData.genreId,
      themeIds: contentData.themeIds,
      isSelected: contentData.isSelected,
      contentTexts
    };

    return this.saveContent(payload);
  }

  // Get full enriched content listing with authors, genres, themes, and multi-script texts (Paged)

  getEnrichedContentsPaged(scriptId?: number, request: ContentFilterRequest = {}): Observable<PagedResponse<Content>> {
    const sId = scriptId ?? this.scriptService.getScriptId(this.scriptService.activeScript());
    const targetCode = this.scriptService.getCodeFromId(sId);
    const filterReq: ContentFilterRequest = {
      page: request.page ?? 0,
      size: request.size ?? 10,
      scriptId: sId,
      ...request
    };

    return forkJoin({
      contentsRes: this.filterContents(filterReq).pipe(
        catchError(() => of({ data: [], page: 0, size: 10, totalElements: 0, totalPages: 0, last: true } as any))
      ),
      genres: this.taxonomyService.getAllGenres().pipe(catchError(() => of([]))),
      themes: this.taxonomyService.getAllThemes().pipe(catchError(() => of([]))),
      authors: filterReq.authorId
        ? of([])
        : this.authorService.getEnrichedAuthors(sId).pipe(catchError(() => of([])))
    }).pipe(
      map(({ contentsRes, genres, themes, authors }) => {
        const rawContents: Content[] = contentsRes.data || [];

        const enriched = rawContents.map(item => {
          const itemTexts: ContentText[] = (item.contentTexts && item.contentTexts.length > 0)
            ? item.contentTexts
            : [];
          const currentText = itemTexts.find((t: ContentText) => this.scriptService.isScriptMatch(t, targetCode))
            || item.primaryText
            || itemTexts[0];
          const matchedAuthor = (authors || []).find(a => a.id === (item.authorId || item.author?.id));
          const author = matchedAuthor 
            ? { ...item.author, ...matchedAuthor, avatarUrl: matchedAuthor.avatarUrl || item.author?.avatarUrl }
            : item.author;
          if (author && !author.avatarUrl && author.id) {
            try {
              const stored = localStorage.getItem(`author_avatar_${author.id}`);
              if (stored) author.avatarUrl = stored;
            } catch (_) {}
          }
          const genre = item.genre || (genres || []).find((g: Genre) => g.id === item.genreId);
          const itemThemes = (themes || []).filter((t: Theme) => item.themeIds?.includes(t.id!));

          return {
            ...item,
            genre,
            author,
            themes: itemThemes,
            texts: itemTexts,
            primaryText: currentText
          };
        });

        return {
          success: contentsRes.success ?? true,
          message: contentsRes.message || 'Contents fetched successfully',
          data: enriched,
          page: contentsRes.page ?? 0,
          size: contentsRes.size ?? 10,
          totalElements: contentsRes.totalElements ?? enriched.length,
          totalPages: contentsRes.totalPages || (enriched.length > 0 ? 1 : 1),
          last: contentsRes.last ?? true
        };
      })
    );
  }

  getEnrichedContents(scriptId?: number): Observable<Content[]> {
    return this.getEnrichedContentsPaged(scriptId, { size: 100 }).pipe(map(res => res.data));
  }

  // Page-specific API: Fetch ONLY the requested content, its texts, and its author
  getContentDetailById(id: number, scriptId?: number): Observable<Content | null> {
    const sId = scriptId ?? this.scriptService.getScriptId(this.scriptService.activeScript());
    const targetCode = this.scriptService.getCodeFromId(sId);

    return this.filterContents({ id, scriptId: sId, size: 1 } as any).pipe(
      map(res => {
        const item = (res.data || [])[0];
        if (!item) return null;

        const itemTexts: ContentText[] = (item.contentTexts && item.contentTexts.length > 0)
          ? item.contentTexts
          : [];
        const currentText = itemTexts.find((t: ContentText) => this.scriptService.isScriptMatch(t, targetCode))
          || item.primaryText
          || itemTexts[0];

        return {
          ...item,
          texts: itemTexts,
          primaryText: currentText
        };
      }),
      catchError(err => {
        console.error('[ContentService] Failed to get content detail by ID:', err);
        return of(null);
      })
    );
  }

  // Page-specific API for Poet Detail Page: Fetch ONLY poems by this author with pagination (size: 10) & optional genreId
  getContentsByAuthorPaged(request: {
    authorId: number;
    genreId?: number | null;
    scriptId?: number;
    page?: number;
    size?: number;
  }): Observable<PagedResponse<Content>> {
    const sId = request.scriptId ?? this.scriptService.getScriptId(this.scriptService.activeScript());
    const filterReq: ContentFilterRequest = {
      authorId: request.authorId,
      scriptId: sId,
      page: request.page ?? 0,
      size: request.size ?? 10,
      sortBy: 'id',
      sortDirection: 'desc'
    };
    if (request.genreId && request.genreId > 0) {
      filterReq.genreId = request.genreId;
    }
    const targetCode = this.scriptService.getCodeFromId(sId);
    return this.filterContents(filterReq).pipe(
      map(res => {
        const rawList = res.data || [];
        const enriched = rawList.map(item => {
          const itemTexts: ContentText[] = (item.contentTexts && item.contentTexts.length > 0)
            ? item.contentTexts
            : [];
          const currentText = itemTexts.find((t: ContentText) => this.scriptService.isScriptMatch(t, targetCode))
            || item.primaryText
            || itemTexts[0];
          return {
            ...item,
            texts: itemTexts,
            primaryText: currentText
          };
        });
        return {
          ...res,
          data: enriched
        };
      })
    );
  }

  getContentsByAuthorId(authorId: number, scriptId?: number): Observable<Content[]> {
    return this.getContentsByAuthorPaged({ authorId, scriptId, size: 50 }).pipe(
      map(res => res.data || [])
    );
  }

  // Page-specific API for Genre Works Detail Page: Fetch poems by genre with 10-item pagination
  getContentsByGenrePaged(request: {
    genreId: number;
    scriptId?: number;
    page?: number;
    size?: number;
  }): Observable<PagedResponse<Content>> {
    const sId = request.scriptId ?? this.scriptService.getScriptId(this.scriptService.activeScript());
    const filterReq: ContentFilterRequest = {
      genreId: request.genreId,
      scriptId: sId,
      page: request.page ?? 0,
      size: request.size ?? 10,
      sortBy: 'id',
      sortDirection: 'desc'
    };
    const targetCode = this.scriptService.getCodeFromId(sId);
    return this.filterContents(filterReq).pipe(
      map(res => {
        const rawList = res.data || [];
        const enriched = rawList.map(item => {
          const itemTexts: ContentText[] = (item.contentTexts && item.contentTexts.length > 0)
            ? item.contentTexts
            : [];
          const currentText = itemTexts.find((t: ContentText) => this.scriptService.isScriptMatch(t, targetCode))
            || item.primaryText
            || itemTexts[0];
          return {
            ...item,
            texts: itemTexts,
            primaryText: currentText
          };
        });
        return {
          ...res,
          data: enriched
        };
      })
    );
  }
}
