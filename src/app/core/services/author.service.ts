import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, catchError, tap, switchMap } from 'rxjs';
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

  private cachedEnrichedAuthors: Record<string, Author[]> = {};
  private cachedCarouselAuthors: Record<number, Author[]> = {};

  clearCache() {
    this.cachedEnrichedAuthors = {};
    this.cachedCarouselAuthors = {};
  }

  getCachedCarouselAuthors(scriptId?: number): Author[] {
    const sId = scriptId ?? this.scriptService.getScriptId(this.scriptService.activeScript());
    return this.cachedCarouselAuthors[sId] || [];
  }

  setCachedCarouselAuthors(scriptId: number, authors: Author[]) {
    this.cachedCarouselAuthors[scriptId] = authors;
  }

  getAuthorAvatar(author: Partial<Author> | null | undefined): string {
    if (!author) return 'https://ui-avatars.com/api/?name=Poet&background=3d2216&color=d4af37&font-size=0.38&bold=true';
    if (author.avatarUrl && author.avatarUrl.trim().length > 0) {
      return author.avatarUrl.trim();
    }
    if (author.id) {
      try {
        const stored = localStorage.getItem(`author_avatar_${author.id}`);
        if (stored && stored.trim().length > 0) return stored.trim();
      } catch (_) {}
    }
    const name = author.primaryName || author.enName || author.name || 'Poet';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3d2216&color=d4af37&font-size=0.38&bold=true`;
  }

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
    return this.api.post<ApiResponse<Author>>('/api/authors/addOrUpdate', author).pipe(
      tap(() => this.clearCache())
    );
  }

  deleteAuthor(author: { id: number }): Observable<ApiResponse<string>> {
    return this.api.post<ApiResponse<string>>('/api/authors/delete', author).pipe(
      tap(() => this.clearCache())
    );
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
    return this.api.post<ApiResponse<void>>('/api/author-details/addOrUpdate', detail).pipe(
      tap(() => this.clearCache())
    );
  }

  // Unified single-call author save/update with multi-script details (Urdu, Hindi, English)
  saveAuthorWithDetails(
    authorData: { id?: number; birthDate?: string; deathDate?: string; avatarUrl?: string },
    scriptDetails: {
      ur?: { name: string; biography?: string };
      hi?: { name: string; biography?: string };
      en?: { name: string; biography?: string };
    },
    existingDetails?: AuthorDetail[]
  ): Observable<ApiResponse<Author>> {
    const detailsList = existingDetails || [];
    const existingUr = detailsList.find(d => this.scriptService.isScriptMatch({ scriptId: d.scriptId, title: d.name, body: d.biography }, 'ur'));
    const existingHi = detailsList.find(d => this.scriptService.isScriptMatch({ scriptId: d.scriptId, title: d.name, body: d.biography }, 'hi'));
    const existingEn = detailsList.find(d => this.scriptService.isScriptMatch({ scriptId: d.scriptId, title: d.name, body: d.biography }, 'en'));

    const urScriptId = existingUr?.scriptId || this.scriptService.getScriptId('ur');
    const hiScriptId = existingHi?.scriptId || this.scriptService.getScriptId('hi');
    const enScriptId = existingEn?.scriptId || this.scriptService.getScriptId('en');

    const authorDetails: AuthorDetail[] = [];

    if (scriptDetails.ur?.name?.trim() || scriptDetails.ur?.biography?.trim()) {
      authorDetails.push({
        id: existingUr?.id,
        authorId: authorData.id || 0,
        scriptId: urScriptId,
        name: scriptDetails.ur.name?.trim() || '',
        biography: scriptDetails.ur.biography?.trim() || ''
      });
    }

    if (scriptDetails.hi?.name?.trim() || scriptDetails.hi?.biography?.trim()) {
      authorDetails.push({
        id: existingHi?.id,
        authorId: authorData.id || 0,
        scriptId: hiScriptId,
        name: scriptDetails.hi.name?.trim() || '',
        biography: scriptDetails.hi.biography?.trim() || ''
      });
    }

    if (scriptDetails.en?.name?.trim() || scriptDetails.en?.biography?.trim()) {
      authorDetails.push({
        id: existingEn?.id,
        authorId: authorData.id || 0,
        scriptId: enScriptId,
        name: scriptDetails.en.name?.trim() || '',
        biography: scriptDetails.en.biography?.trim() || ''
      });
    }

    const avatarUrl = authorData.avatarUrl 
      || (authorData.id ? localStorage.getItem(`author_avatar_${authorData.id}`) : undefined) 
      || undefined;

    const payload: Author = {
      id: authorData.id,
      avatarUrl,
      birthDate: authorData.birthDate || undefined,
      deathDate: authorData.deathDate || undefined,
      urName: scriptDetails.ur?.name?.trim() || '',
      urBio: scriptDetails.ur?.biography?.trim() || '',
      hiName: scriptDetails.hi?.name?.trim() || '',
      hiBio: scriptDetails.hi?.biography?.trim() || '',
      enName: scriptDetails.en?.name?.trim() || '',
      enBio: scriptDetails.en?.biography?.trim() || '',
      primaryName: scriptDetails.en?.name?.trim() || scriptDetails.ur?.name?.trim() || scriptDetails.hi?.name?.trim() || '',
      primaryBio: scriptDetails.en?.biography?.trim() || scriptDetails.ur?.biography?.trim() || scriptDetails.hi?.biography?.trim() || '',
      name: scriptDetails.en?.name?.trim() || scriptDetails.ur?.name?.trim() || scriptDetails.hi?.name?.trim() || '',
      authorDetails,
      details: authorDetails
    };

    return this.saveAuthor(payload);
  }

  // Upload author photo and synchronize with database & local storage
  uploadAuthorPhoto(authorId: number, file: File): Observable<ApiResponse<string>> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.api.post<ApiResponse<string>>(`/api/authors/${authorId}/photo`, formData).pipe(
      tap((res) => {
        if (res.data) {
          try { localStorage.setItem(`author_avatar_${authorId}`, res.data); } catch (_) {}
          this.clearCache();
        }
      }),
      catchError(() => {
        return this.api.post<ApiResponse<string>>('/api/users/profile/photo', formData).pipe(
          switchMap((res) => {
            if (res.data) {
              try { localStorage.setItem(`author_avatar_${authorId}`, res.data); } catch (_) {}
              return this.saveAuthor({ id: authorId, avatarUrl: res.data }).pipe(
                map(() => res),
                catchError(() => of(res))
              );
            }
            return of(res);
          }),
          tap(() => this.clearCache())
        );
      })
    );
  }

  // Helper to load authors enriched with their multi-script details dynamically (Paged)
  getEnrichedAuthorsPaged(scriptId?: number, request: AuthorFilterRequest = {}): Observable<PagedResponse<Author>> {
    const sId = scriptId ?? this.scriptService.getScriptId(this.scriptService.activeScript());
    const filterReq: AuthorFilterRequest = {
      page: request.page ?? 0,
      size: request.size ?? 10,
      scriptId: sId,
      ...request
    };

    return this.filterAuthors(filterReq).pipe(
      map((authorsRes) => {
        const rawAuthors: Author[] = authorsRes.data || [];
        const targetCode = this.scriptService.getCodeFromId(sId);

        const enriched = rawAuthors.map(author => {
          const authorDetails = (author.details && author.details.length > 0) 
            ? author.details 
            : (author.authorDetails || []);
          const currentDetail = authorDetails.find(d => this.scriptService.isScriptMatch({ scriptId: d.scriptId, title: d.name, body: d.biography }, targetCode)) || authorDetails[0];

          const primaryName = author.primaryName 
            || currentDetail?.name 
            || (targetCode === 'ur' ? author.urName : (targetCode === 'hi' ? author.hiName : author.enName))
            || author.name 
            || 'Unknown Poet';

          const primaryBio = author.primaryBio
            || currentDetail?.biography
            || (targetCode === 'ur' ? author.urBio : (targetCode === 'hi' ? author.hiBio : author.enBio))
            || '';

          // Look up avatar from backend avatarUrl or persistent storage
          const storedAvatar = author.id ? localStorage.getItem(`author_avatar_${author.id}`) : null;
          const avatarUrl = author.avatarUrl || storedAvatar || undefined;
          if (author.id && author.avatarUrl) {
            try { localStorage.setItem(`author_avatar_${author.id}`, author.avatarUrl); } catch (_) {}
          }

          return {
            ...author,
            details: authorDetails,
            authorDetails,
            primaryName,
            primaryBio,
            avatarUrl
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

  getEnrichedAuthors(scriptId?: number, forceRefresh = false, size = 10): Observable<Author[]> {
    const key = `${scriptId ? String(scriptId) : 'default'}_${size}`;
    if (!forceRefresh && this.cachedEnrichedAuthors[key] && this.cachedEnrichedAuthors[key].length > 0) {
      return of(this.cachedEnrichedAuthors[key]);
    }
    return this.getEnrichedAuthorsPaged(scriptId, { size }).pipe(
      map(res => {
        const list = res.data || [];
        this.cachedEnrichedAuthors[key] = list;
        return list;
      })
    );
  }

  getAuthorById(authorId: number, scriptId?: number): Observable<Author | null> {
    const sId = scriptId ?? this.scriptService.getScriptId(this.scriptService.activeScript());
    return this.getEnrichedAuthorsPaged(sId, { id: authorId, size: 1 }).pipe(
      map(res => (res.data && res.data.length > 0) ? res.data[0] : null),
      catchError(err => {
        console.error('[AuthorService] Failed to get author by ID:', err);
        return of(null);
      })
    );
  }
}

