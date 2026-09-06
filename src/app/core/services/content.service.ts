import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, catchError, switchMap, throwError, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Content, ContentText, ContentFilterRequest, ContentTextFilterRequest } from '../models/content.models';
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

  saveContentText(contentText: { id?: number; contentId: number; scriptId: number; title: string; body: string }): Observable<ApiResponse<void>> {
    const payload = {
      id: contentText.id,
      contentId: contentText.contentId,
      scriptId: contentText.scriptId,
      title: contentText.title,
      body: contentText.body
    };

    return this.api.post<ApiResponse<void>>('/api/content-texts/addOrUpdate', payload).pipe(
      tap(() => this.clearCache()),
      catchError((err) => {
        if (err?.status === 400 || err?.status === 404) {
          const fallbackPayload = {
            id: contentText.id,
            content: { id: contentText.contentId },
            script: { id: contentText.scriptId },
            title: contentText.title,
            body: contentText.body
          };
          return this.api.post<ApiResponse<void>>('/api/content-texts/addOrUpdate', fallbackPayload).pipe(
            tap(() => this.clearCache())
          );
        }
        return throwError(() => err);
      }),
      catchError(() => this.api.post<ApiResponse<void>>('/api/content-texts/addOrUpdate', payload).pipe(
        tap(() => this.clearCache())
      ))
    );
  }

  saveCompleteContentWithTexts(
    contentData: { id?: number; title: string; authorId?: number; genreId?: number; themeIds?: number[] },
    scriptTexts: {
      ur?: { title: string; body: string };
      hi?: { title: string; body: string };
      en?: { title: string; body: string };
    },
    existingTexts?: ContentText[]
  ): Observable<any> {
    return this.saveContent({
      id: contentData.id,
      title: contentData.title,
      authorId: contentData.authorId,
      genreId: contentData.genreId,
      themeIds: contentData.themeIds
    }).pipe(
      switchMap((res: any) => {
        const contentId = res?.data?.id || contentData.id;
        if (!contentId) {
          return throwError(() => new Error('Failed to get content ID from server response.'));
        }

        const textsList = existingTexts || [];
        const existingUr = textsList.find(t => this.scriptService.isScriptMatch(t, 'ur'));
        const existingHi = textsList.find(t => this.scriptService.isScriptMatch(t, 'hi'));
        const existingEn = textsList.find(t => this.scriptService.isScriptMatch(t, 'en'));

        const urScriptId = existingUr?.scriptId || this.scriptService.getScriptId('ur');
        const hiScriptId = existingHi?.scriptId || this.scriptService.getScriptId('hi');
        const enScriptId = existingEn?.scriptId || this.scriptService.getScriptId('en');

        const requests: Observable<any>[] = [];
        if (scriptTexts.ur?.body || scriptTexts.ur?.title) {
          requests.push(this.saveContentText({
            id: existingUr?.id,
            contentId,
            scriptId: urScriptId,
            title: scriptTexts.ur.title || contentData.title,
            body: scriptTexts.ur.body || ''
          }));
        }
        if (scriptTexts.hi?.body || scriptTexts.hi?.title) {
          requests.push(this.saveContentText({
            id: existingHi?.id,
            contentId,
            scriptId: hiScriptId,
            title: scriptTexts.hi.title || contentData.title,
            body: scriptTexts.hi.body || ''
          }));
        }
        if (scriptTexts.en?.body || scriptTexts.en?.title) {
          requests.push(this.saveContentText({
            id: existingEn?.id,
            contentId,
            scriptId: enScriptId,
            title: scriptTexts.en.title || contentData.title,
            body: scriptTexts.en.body || ''
          }));
        }
        return requests.length > 0 ? forkJoin(requests) : of([]);
      })
    );
  }

  // Get full enriched content listing with authors, genres, themes, and multi-script texts (Paged)
  getEnrichedContentsPaged(scriptId?: number, request: ContentFilterRequest = {}): Observable<PagedResponse<Content>> {
    const sId = scriptId ?? this.scriptService.getScriptId(this.scriptService.activeScript());
    const targetCode = this.scriptService.getCodeFromId(sId);
    const filterReq: ContentFilterRequest = {
      page: request.page ?? 0,
      size: request.size ?? 10,
      ...request
    };

    const texts$ = this.cachedTexts 
      ? of(this.cachedTexts) 
      : this.filterContentTexts({ size: 200 }).pipe(
          map(res => { this.cachedTexts = res.data || []; return this.cachedTexts; }),
          catchError(() => of([]))
        );

    return forkJoin({
      contentsRes: this.filterContents(filterReq).pipe(catchError(() => of({ data: [], page: 0, size: 10, totalElements: 0, totalPages: 0, last: true } as any))),
      texts: texts$,
      genres: this.taxonomyService.getAllGenres().pipe(catchError(() => of([]))),
      themes: this.taxonomyService.getAllThemes().pipe(catchError(() => of([]))),
      authors: this.authorService.getEnrichedAuthors(sId).pipe(catchError(() => of([])))
    }).pipe(
      map(({ contentsRes, texts, genres, themes, authors }) => {
        const rawContents: Content[] = contentsRes.data || [];

        const enriched = rawContents.map(item => {
          const itemTexts: ContentText[] = (item.contentTexts && item.contentTexts.length > 0)
            ? item.contentTexts
            : (texts || []).filter(t => {
                const cId = t.contentId ?? (t as any).content_id ?? (t as any).content?.id;
                return Number(cId) === Number(item.id);
              });
          const currentText = itemTexts.find((t: ContentText) => this.scriptService.isScriptMatch(t, targetCode)) || itemTexts[0] || item.primaryText;
          const author = item.author || (authors || []).find(a => a.id === item.authorId);
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

    return forkJoin({
      content: this.getEnrichedContents(sId).pipe(
        map(contents => contents.find(c => Number(c.id) === Number(id)) || null)
      ),
      directTextsRes: this.filterContentTexts({ contentId: id, size: 50 }).pipe(
        catchError(err => {
          console.error('[ContentService] Failed to query content_texts directly by contentId:', err);
          return of({ data: [] } as any);
        })
      )
    }).pipe(
      map(({ content, directTextsRes }) => {
        if (!content) return null;

        const rawDirect = (directTextsRes?.data || []) as any[];
        const normalizedDirect: ContentText[] = rawDirect.map(t => {
          const rawId = Number(t.scriptId ?? t.script_id ?? t.script?.id);
          const detected = this.scriptService.detectScriptFromText((t.title || '') + ' ' + (t.body || ''));
          const finalSId = rawId || this.scriptService.getScriptId(detected);
          if (rawId) {
            this.scriptService.learnScriptId(rawId, detected);
          }
          return {
            id: t.id,
            contentId: Number(t.contentId ?? t.content_id ?? t.content?.id ?? id),
            scriptId: finalSId,
            title: t.title || '',
            body: t.body || ''
          };
        });

        const existingTexts = content.texts || (content as any).contentTexts || [];
        const finalTexts: ContentText[] = normalizedDirect.length > 0 ? normalizedDirect : existingTexts;

        const currentText = finalTexts.find((t: ContentText) => this.scriptService.isScriptMatch(t, targetCode))
          || finalTexts[0]
          || content.primaryText;

        return {
          ...content,
          texts: finalTexts,
          primaryText: currentText
        };
      })
    );
  }

  // Page-specific API for Poet Detail Page: Fetch ONLY poems by this author
  getContentsByAuthorId(authorId: number, scriptId?: number): Observable<Content[]> {
    return this.getEnrichedContents(scriptId).pipe(
      map(contents => contents.filter(c => Number(c.authorId) === Number(authorId) || Number(c.author?.id) === Number(authorId)))
    );
  }
}
