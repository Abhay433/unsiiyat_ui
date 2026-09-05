import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, catchError, switchMap, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { Content, ContentText, ContentFilterRequest, ContentTextFilterRequest } from '../models/content.models';
import { Genre, Theme } from '../models/taxonomy.models';
import { ApiResponse, PagedResponse } from '../models/api-response.models';
import { TaxonomyService } from './taxonomy.service';
import { AuthorService } from './author.service';

@Injectable({
  providedIn: 'root'
})
export class ContentService {
  private readonly api = inject(ApiService);
  private readonly taxonomyService = inject(TaxonomyService);
  private readonly authorService = inject(AuthorService);

  filterContents(request: ContentFilterRequest = {}): Observable<PagedResponse<Content>> {
    const payload = {
      page: request.page ?? 0,
      size: request.size ?? 200,
      sortBy: request.sortBy ?? 'id',
      sortDirection: request.sortDirection ?? 'desc',
      ...request
    };
    return this.api.post<PagedResponse<Content>>('/api/contents/list', payload);
  }

  saveContent(content: Content): Observable<ApiResponse<Content>> {
    return this.api.post<ApiResponse<Content>>('/api/contents/addOrUpdate', content);
  }

  deleteContent(content: { id: number }): Observable<ApiResponse<string>> {
    return this.api.post<ApiResponse<string>>('/api/contents/delete', content);
  }

  filterContentTexts(request: ContentTextFilterRequest = {}): Observable<PagedResponse<ContentText>> {
    const payload = {
      page: request.page ?? 0,
      size: request.size ?? 500,
      sortBy: request.sortBy ?? 'id',
      sortDirection: request.sortDirection ?? 'asc',
      ...request
    };
    return this.api.post<PagedResponse<ContentText>>('/api/content-texts/list', payload);
  }

  saveContentText(text: ContentText): Observable<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/api/content-texts/addOrUpdate', text);
  }

  saveCompleteContentWithTexts(
    contentData: { id?: number; title: string; authorId?: number; genreId?: number; themeIds?: number[] },
    scriptTexts: {
      ur?: { title: string; body: string };
      hi?: { title: string; body: string };
      en?: { title: string; body: string };
    }
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

        const requests: Observable<any>[] = [];
        if (scriptTexts.ur?.body || scriptTexts.ur?.title) {
          requests.push(this.saveContentText({
            contentId,
            scriptId: 1,
            title: scriptTexts.ur.title || contentData.title,
            body: scriptTexts.ur.body
          }));
        }
        if (scriptTexts.hi?.body || scriptTexts.hi?.title) {
          requests.push(this.saveContentText({
            contentId,
            scriptId: 2,
            title: scriptTexts.hi.title || contentData.title,
            body: scriptTexts.hi.body
          }));
        }
        if (scriptTexts.en?.body || scriptTexts.en?.title) {
          requests.push(this.saveContentText({
            contentId,
            scriptId: 3,
            title: scriptTexts.en.title || contentData.title,
            body: scriptTexts.en.body
          }));
        }
        return requests.length > 0 ? forkJoin(requests) : of([]);
      })
    );
  }

  // Get full enriched content listing with authors, genres, themes, and multi-script texts
  getEnrichedContents(scriptId: number = 1): Observable<Content[]> {
    return forkJoin({
      contentsRes: this.filterContents().pipe(catchError(() => of({ data: [] } as any))),
      textsRes: this.filterContentTexts().pipe(catchError(() => of({ data: [] } as any))),
      genresRes: this.taxonomyService.filterGenres().pipe(catchError(() => of({ data: [] } as any))),
      themesRes: this.taxonomyService.filterThemes().pipe(catchError(() => of({ data: [] } as any))),
      authorsRes: this.authorService.getEnrichedAuthors(scriptId).pipe(catchError(() => of([])))
    }).pipe(
      map(({ contentsRes, textsRes, genresRes, themesRes, authorsRes }) => {
        const contents: Content[] = contentsRes.data || [];
        const texts: ContentText[] = textsRes.data || [];
        const genres: Genre[] = genresRes.data || [];
        const themes: Theme[] = themesRes.data || [];

        return contents.map(item => {
          const itemTexts: ContentText[] = (item.contentTexts && item.contentTexts.length > 0)
            ? item.contentTexts
            : texts.filter(t => t.contentId === item.id);
          const currentText = itemTexts.find((t: ContentText) => t.scriptId === scriptId) || itemTexts[0] || item.primaryText;
          const author = item.author || authorsRes.find(a => a.id === item.authorId);
          const genre = item.genre || genres.find((g: Genre) => g.id === item.genreId);
          const itemThemes = themes.filter((t: Theme) => item.themeIds?.includes(t.id!));

          return {
            ...item,
            genre,
            author,
            themes: itemThemes,
            texts: itemTexts,
            primaryText: currentText
          };
        });
      })
    );
  }
}
