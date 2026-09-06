import { BaseFilterRequest } from './api-response.models';
import { Author } from './author.models';
import { Genre, Theme } from './taxonomy.models';

export interface Content {
  id?: number;
  genreId?: number;
  authorId?: number;
  title: string;
  themeIds?: number[];
  createdAt?: string;
  updatedAt?: string;

  // UI Enriched fields
  genre?: Genre;
  author?: Author;
  themes?: Theme[];
  texts?: ContentText[];
  contentTexts?: ContentText[];
  primaryText?: ContentText;
}

export interface ContentText {
  id?: number;
  contentId: number;
  scriptId: number;
  title: string;
  body: string;
}

export interface ContentFilterRequest extends BaseFilterRequest {
  id?: number;
  genreId?: number;
  authorId?: number;
  title?: string;
  themeId?: number;
  search?: string;
  authorName?: string;
}

export interface ContentTextFilterRequest extends BaseFilterRequest {
  contentId?: number;
  scriptId?: number;
  title?: string;
  body?: string;
}

export interface Couplet {
  firstLine: string;
  secondLine: string;
  meaning?: string;
}

export type ContentDto = Content;
