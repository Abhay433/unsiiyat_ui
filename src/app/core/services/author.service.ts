import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, catchError } from 'rxjs';
import { ApiService } from './api.service';
import { ScriptService } from './script.service';
import { Author, AuthorDetail, AuthorFilterRequest, AuthorDetailFilterRequest } from '../models/author.models';
import { ApiResponse, PagedResponse } from '../models/api-response.models';

@Injectable({
  providedIn: 'root'
})
export class AuthorService {
  private readonly api = inject(ApiService);
  private readonly scriptService = inject(ScriptService);

  filterAuthors(request: AuthorFilterRequest = {}): Observable<PagedResponse<Author>> {
    const payload = {
      page: request.page ?? 0,
      size: request.size ?? 10,
      sortBy: request.sortBy ?? 'id',
      sortDirection: request.sortDirection ?? 'asc',
      ...request
    };
    return this.api.post<PagedResponse<Author>>('/api/authors/list', payload);
  }

  saveAuthor(author: Author): Observable<ApiResponse<Author>> {
    return this.api.post<ApiResponse<Author>>('/api/authors/addOrUpdate', author);
  }

  deleteAuthor(author: { id: number }): Observable<ApiResponse<string>> {
    return this.api.post<ApiResponse<string>>('/api/authors/delete', author);
  }

  filterAuthorDetails(request: AuthorDetailFilterRequest = {}): Observable<PagedResponse<AuthorDetail>> {
    const payload = {
      page: request.page ?? 0,
      size: request.size ?? 500,
      sortBy: request.sortBy ?? 'id',
      sortDirection: request.sortDirection ?? 'asc',
      ...request
    };
    return this.api.post<PagedResponse<AuthorDetail>>('/api/author-details/list', payload);
  }

  saveAuthorDetail(detail: AuthorDetail): Observable<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/api/author-details/addOrUpdate', detail);
  }

  // Helper to load authors enriched with their multi-script details dynamically (Paged)
  getEnrichedAuthorsPaged(scriptId?: number, request: AuthorFilterRequest = {}): Observable<PagedResponse<Author>> {
    const filterReq: AuthorFilterRequest = {
      page: request.page ?? 0,
      size: request.size ?? 10,
      ...request
    };

    return forkJoin({
      authorsRes: this.filterAuthors(filterReq).pipe(catchError(() => of({ data: [], page: 0, size: 10, totalElements: 0, totalPages: 0, last: true } as any))),
      detailsRes: this.filterAuthorDetails({ size: 500 }).pipe(catchError(() => of({ data: [] } as any)))
    }).pipe(
      map(({ authorsRes, detailsRes }) => {
        const rawAuthors: Author[] = authorsRes.data || [];
        const details: AuthorDetail[] = detailsRes.data || [];
        const targetCode = scriptId ? this.scriptService.getCodeFromId(scriptId) : this.scriptService.activeScript();

        const enriched = rawAuthors.map(author => {
          const authorDetails = (author.details && author.details.length > 0) 
            ? author.details 
            : details.filter(d => d.authorId === author.id);
          const currentDetail = authorDetails.find(d => this.scriptService.isScriptMatch({ scriptId: d.scriptId, title: d.name, body: d.biography }, targetCode)) || authorDetails[0];

          const primaryName = currentDetail?.name 
            || (targetCode === 'ur' ? author.urName : (targetCode === 'hi' ? author.hiName : author.enName))
            || author.primaryName 
            || author.name 
            || 'Unknown Poet';

          return {
            ...author,
            details: authorDetails,
            primaryName,
            primaryBio: currentDetail?.biography || ''
          };
        });

        return {
          success: authorsRes.success ?? true,
          message: authorsRes.message || 'Authors fetched successfully',
          data: enriched,
          page: authorsRes.page ?? 0,
          size: authorsRes.size ?? 10,
          totalElements: authorsRes.totalElements ?? enriched.length,
          totalPages: authorsRes.totalPages || (enriched.length > 0 ? 1 : 1),
          last: authorsRes.last ?? true
        };
      })
    );
  }

  getEnrichedAuthors(scriptId?: number): Observable<Author[]> {
    return this.getEnrichedAuthorsPaged(scriptId, { size: 100 }).pipe(map(res => res.data));
  }
}
