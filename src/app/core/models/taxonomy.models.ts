import { BaseFilterRequest } from './api-response.models';

export interface Genre {
  id?: number;
  name: string;
  slug: string;
}

export interface GenreFilterRequest extends BaseFilterRequest {
  name?: string;
  slug?: string;
}

export interface Theme {
  id?: number;
  name: string;
  slug: string;
}

export interface ThemeFilterRequest extends BaseFilterRequest {
  name?: string;
  slug?: string;
}

export interface Script {
  id?: number;
  code: string; // 'ur' | 'hi' | 'en'
  name: string; // 'Urdu' | 'Hindi' | 'English'
}

export interface ScriptFilterRequest extends BaseFilterRequest {
  code?: string;
  name?: string;
}
