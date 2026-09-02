import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Genre, GenreFilterRequest, Theme, ThemeFilterRequest, Script, ScriptFilterRequest } from '../models/taxonomy.models';
import { ApiResponse, PagedResponse } from '../models/api-response.models';

@Injectable({
  providedIn: 'root'
})
export class TaxonomyService {
  private readonly api = inject(ApiService);

  // Genres
  filterGenres(request: GenreFilterRequest = {}): Observable<PagedResponse<Genre>> {
    const payload = {
      page: request.page ?? 0,
      size: request.size ?? 50,
      sortBy: request.sortBy ?? 'id',
      sortDirection: request.sortDirection ?? 'asc',
      ...request
    };
    return this.api.post<PagedResponse<Genre>>('/api/genres/list', payload);
  }

  saveGenre(genre: Genre): Observable<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/api/genres/addOrUpdate', genre);
  }

  // Themes
  filterThemes(request: ThemeFilterRequest = {}): Observable<PagedResponse<Theme>> {
    const payload = {
      page: request.page ?? 0,
      size: request.size ?? 50,
      sortBy: request.sortBy ?? 'id',
      sortDirection: request.sortDirection ?? 'asc',
      ...request
    };
    return this.api.post<PagedResponse<Theme>>('/api/themes/list', payload);
  }

  saveTheme(theme: Theme): Observable<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/api/themes/addOrUpdate', theme);
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

  saveScript(script: Script): Observable<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/api/scripts/addOrUpdate', script);
  }
}
