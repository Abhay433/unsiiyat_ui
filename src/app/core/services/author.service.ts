import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, catchError } from 'rxjs';
import { ApiService } from './api.service';
import { Author, AuthorDetail, AuthorFilterRequest, AuthorDetailFilterRequest } from '../models/author.models';
import { ApiResponse, PagedResponse } from '../models/api-response.models';

@Injectable({
  providedIn: 'root'
})
export class AuthorService {
  private readonly api = inject(ApiService);

  filterAuthors(request: AuthorFilterRequest = {}): Observable<PagedResponse<Author>> {
    const payload = {
      page: request.page ?? 0,
      size: request.size ?? 50,
      sortBy: request.sortBy ?? 'id',
      sortDirection: request.sortDirection ?? 'asc',
      ...request
    };
    return this.api.post<PagedResponse<Author>>('/api/authors/list', payload);
  }

  saveAuthor(author: Author): Observable<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/api/authors/addOrUpdate', author);
  }

  filterAuthorDetails(request: AuthorDetailFilterRequest = {}): Observable<PagedResponse<AuthorDetail>> {
    const payload = {
      page: request.page ?? 0,
      size: request.size ?? 100,
      sortBy: request.sortBy ?? 'id',
      sortDirection: request.sortDirection ?? 'asc',
      ...request
    };
    return this.api.post<PagedResponse<AuthorDetail>>('/api/author-details/list', payload);
  }

  saveAuthorDetail(detail: AuthorDetail): Observable<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/api/author-details/addOrUpdate', detail);
  }

  // Helper to load authors enriched with their multi-script details
  getEnrichedAuthors(scriptId: number = 1): Observable<Author[]> {
    return forkJoin({
      authorsRes: this.filterAuthors().pipe(catchError(() => of({ data: [] } as any))),
      detailsRes: this.filterAuthorDetails().pipe(catchError(() => of({ data: [] } as any)))
    }).pipe(
      map(({ authorsRes, detailsRes }) => {
        const authors: Author[] = authorsRes.data || [];
        const details: AuthorDetail[] = detailsRes.data || [];

        return authors.map(author => {
          const authorDetails = details.filter(d => d.authorId === author.id);
          const currentDetail = authorDetails.find(d => d.scriptId === scriptId) || authorDetails[0];

          return {
            ...author,
            details: authorDetails,
            primaryName: currentDetail?.name || `Poet #${author.id}`,
            primaryBio: currentDetail?.biography || ''
          };
        });
      })
    );
  }
}
