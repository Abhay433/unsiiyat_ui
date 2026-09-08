import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.models';
import { AuthorDto } from '../models/author.models';
import { ContentDto } from '../models/content.models';

export interface GenreSearchResultGroup {
  genreId: number;
  genreName: string;
  genreSlug: string;
  totalCount: number;
  contents: ContentDto[];
}

export interface SearchResultData {
  text: string;
  detectedScript: string;
  detectedLanguage: string;
  authors: AuthorDto[];
  resultsByGenre: GenreSearchResultGroup[];
}

export interface CoupletSearchResult {
  contentId: number;
  contentTitle: string;
  genreId?: number;
  genreName?: string;
  genreSlug?: string;
  authorId?: number;
  authorName?: string;
  author?: AuthorDto;
  scriptId?: number;
  scriptCode?: string;
  coupletIndex?: number;
  lines: string[];
  coupletText: string;
  matchedLine?: string;
  linesByScript?: Record<string, string[]>;
  coupletByScript?: Record<string, string>;
}

export interface CoupletsSearchResponse {
  text: string;
  detectedScript: string;
  detectedLanguage: string;
  genreId?: number;
  genreName?: string;
  genreSlug?: string;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
  couplets: CoupletSearchResult[];
}

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private readonly api = inject(ApiService);

  search(text: string): Observable<ApiResponse<SearchResultData>> {
    return this.api.post<ApiResponse<SearchResultData>>('/api/search', { text });
  }

  searchCouplets(
    text: string,
    genreId?: number,
    page: number = 0,
    size: number = 5,
    scriptId?: number
  ): Observable<ApiResponse<CoupletsSearchResponse>> {
    const params = new URLSearchParams();
    if (text) params.set('text', text);
    if (genreId != null) params.set('genreId', genreId.toString());
    if (page != null) params.set('page', page.toString());
    if (size != null) params.set('size', size.toString());
    if (scriptId != null) params.set('scriptId', scriptId.toString());
    const qs = params.toString();
    return this.api.get<ApiResponse<CoupletsSearchResponse>>(`/api/search/couplets${qs ? '?' + qs : ''}`);
  }
}
