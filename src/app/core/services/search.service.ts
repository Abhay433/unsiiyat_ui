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

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private readonly api = inject(ApiService);

  search(text: string): Observable<ApiResponse<SearchResultData>> {
    return this.api.post<ApiResponse<SearchResultData>>('/api/search', { text });
  }
}
