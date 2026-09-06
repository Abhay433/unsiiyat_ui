import { Injectable, inject } from '@angular/core';
import { Observable, of, map, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Genre, GenreFilterRequest, Theme, ThemeFilterRequest, Script, ScriptFilterRequest } from '../models/taxonomy.models';
import { ApiResponse, PagedResponse } from '../models/api-response.models';

@Injectable({
  providedIn: 'root'
})
export class TaxonomyService {
  private readonly api = inject(ApiService);

  private cachedGenres: Genre[] | null = null;
  private cachedThemes: Theme[] | null = null;
  private cachedScripts: Script[] | null = null;

  clearCache() {
    this.cachedGenres = null;
    this.cachedThemes = null;
    this.cachedScripts = null;
  }

  // Genres
  filterGenres(request: GenreFilterRequest = {}): Observable<PagedResponse<Genre>> {
    const payload = {
      page: request.page ?? 0,
      size: request.size ?? 10,
      sortBy: request.sortBy ?? 'id',
      sortDirection: request.sortDirection ?? 'asc',
      ...request
    };
    return this.api.post<PagedResponse<Genre>>('/api/genres/list', payload);
  }

  getAllGenres(forceRefresh = false): Observable<Genre[]> {
    if (!forceRefresh && this.cachedGenres && this.cachedGenres.length > 0) {
      return of(this.cachedGenres);
    }
    return this.filterGenres({ page: 0, size: 100 }).pipe(
      map(res => {
        this.cachedGenres = res.data || [];
        return this.cachedGenres;
      })
    );
  }

  saveGenre(genre: Genre): Observable<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/api/genres/addOrUpdate', genre).pipe(
      tap(() => this.cachedGenres = null)
    );
  }

  deleteGenre(genre: { id?: number }): Observable<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/api/genres/delete', genre).pipe(
      tap(() => this.cachedGenres = null)
    );
  }

  // Themes
  filterThemes(request: ThemeFilterRequest = {}): Observable<PagedResponse<Theme>> {
    const payload = {
      page: request.page ?? 0,
      size: request.size ?? 10,
      sortBy: request.sortBy ?? 'id',
      sortDirection: request.sortDirection ?? 'asc',
      ...request
    };
    return this.api.post<PagedResponse<Theme>>('/api/themes/list', payload);
  }

  getAllThemes(forceRefresh = false): Observable<Theme[]> {
    if (!forceRefresh && this.cachedThemes && this.cachedThemes.length > 0) {
      return of(this.cachedThemes);
    }
    return this.filterThemes({ page: 0, size: 100 }).pipe(
      map(res => {
        this.cachedThemes = res.data || [];
        return this.cachedThemes;
      })
    );
  }

  saveTheme(theme: Theme): Observable<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/api/themes/addOrUpdate', theme).pipe(
      tap(() => this.cachedThemes = null)
    );
  }

  deleteTheme(theme: { id?: number }): Observable<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/api/themes/delete', theme).pipe(
      tap(() => this.cachedThemes = null)
    );
  }

  // Scripts
  filterScripts(request: ScriptFilterRequest = {}): Observable<PagedResponse<Script>> {
    const payload = {
      page: request.page ?? 0,
      size: request.size ?? 50,
      sortBy: request.sortBy ?? 'id',
      sortDirection: request.sortDirection ?? 'asc',
      ...request
    };
    return this.api.post<PagedResponse<Script>>('/api/scripts/list', payload);
  }

  getAllScripts(forceRefresh = false): Observable<Script[]> {
    if (!forceRefresh && this.cachedScripts && this.cachedScripts.length > 0) {
      return of(this.cachedScripts);
    }
    return this.filterScripts({ page: 0, size: 50 }).pipe(
      map(res => {
        this.cachedScripts = res.data || [];
        return this.cachedScripts;
      })
    );
  }

  saveScript(script: Script): Observable<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/api/scripts/addOrUpdate', script).pipe(
      tap(() => this.cachedScripts = null)
    );
  }
}

